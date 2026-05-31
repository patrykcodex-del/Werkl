# ADR 0002: Prepaid Agent Balance and Platform Fee

## Status

Accepted

- **Date:** 2026-05-31
- **Supersedes:** —

## Context

ADR 0001 established that Agents register openly and post Tasks via the MCP server, each Task carrying a `reward_amount`. ADR 0001 deliberately did not address **who pays for the Reward, when, or how much Werkl earns from the transaction**. With the move toward a private-beta launch involving real money flowing to globally distributed Workers via Stripe Connect, that gap must be closed before any Task can settle.

Four billing models were considered:

- **Prepaid Balance** — Agents top up via Stripe Checkout into a Werkl-held balance; `post_task` debits the balance synchronously.
- **Postpaid / Invoiced** — Tasks post freely; Agents are invoiced monthly for verified Rewards.
- **Per-Task Charge** — Each `post_task` synchronously charges the Agent's saved card.
- **Operator-Funded (no Agent billing)** — Werkl absorbs Reward cost during beta; Agent billing is built post-MVP.

Werkl must also charge a fee to fund the platform. Two fee structures were considered: a percentage added on top of the Reward (Agent pays `Reward × (1 + Fee%)`), or a percentage deducted from the Reward (Worker receives `Reward × (1 - Fee%)`).

## Decisions

### 1. Prepaid Agent Balance

Each Agent holds a USD-denominated `Balance` on the platform, topped up via Stripe Checkout from the Agent dashboard. `post_task` synchronously deducts `Reward + Platform Fee` from the Balance; insufficient balance returns `402 Payment Required` and the Task is not created. Balance is refunded in full on Cancellation, hard Expiry, and final Rejection (a Task that is Reopened is treated as still-funded — no refund-and-recharge cycle).

### 2. Platform Fee — 15% on top, USD-only

The Platform Fee is **15% of the Reward**, **charged to the Agent on top** of the Reward. Workers see and earn the headline Reward; Agents see `Reward + Fee` debited from Balance. All Tasks, Balances, and Earnings are denominated in **USD**; Stripe Connect handles FX at Worker payout time and the FX cost is borne by the Worker.

The 15% rate is the rate at MVP. It is reviewable post-MVP based on observed margin against Stripe processing costs and Worker FX losses; it is not contractually fixed beyond beta.

### 3. Operator can credit and debit Balance

The operator may credit or debit any Agent's Balance directly via CLI for refunds, comps, dispute resolution, and corrections. Every such adjustment is recorded in the `OperatorAuditLog` (see the operator-tooling work).

## Consequences

### Positive

- **Settlement is synchronous and decoupled from Stripe latency.** Once an Agent is topped up, `post_task` is a database transaction. The MCP tool stays snappy and the critical path has no external dependencies.
- **No collection risk.** Werkl never fronts money to Workers without already holding the Agent's funds. Eliminates the need for credit checks, dunning, or invoicing infrastructure.
- **Clear refund semantics.** Refund-on-cancel/expire/reject is a single integer add-back to Balance, not a Stripe refund call (which has fees and 5–10 day windows).
- **Transparent fee for Agents.** Agents see one line: "you paid $5.75 for a $5 Task." No hidden deductions.
- **Headline Reward is the Worker Reward.** Workers always receive the number they were shown; never the smaller-than-advertised problem.

### Negative

- **Top-up friction at first use.** Agents must complete a Stripe Checkout before posting their first Task. Mitigated by allowing the Agent dashboard to accept top-ups before any Task is posted, and surfacing a clear 402 error message that links to the top-up page.
- **Werkl holds Agent funds.** Creates a custodial obligation; surfaces accounting and tax considerations (treatment of unspent Balance, refund rights) that postpaid would avoid. Mitigated by clear T&Cs and a "refund unused Balance on request" policy.
- **FX cost borne by Worker.** A German Worker earning $5 in a USD Balance loses ~2% to Stripe FX at payout. Acceptable for beta given scope; revisit if Worker complaints surface.
- **Fee model is hard to reverse.** Changing from on-top to deducted, or from 15% to a different rate, requires migrating live Agent integrations and updating every published Reward display. The 15% rate is reviewable but the *structure* (on-top, USD, prepaid) is intentionally rigid.

## Alternatives considered

- **Postpaid / Invoiced.** Rejected. Requires building invoicing, dunning, and credit-decision infrastructure that has no other use. Exposes Werkl to collection risk and bad-debt write-offs from beta day one.
- **Per-Task Stripe charge.** Rejected. Inserts a Stripe API call (latency, decline failure mode, $0.30 fixed fee) into the hot path of every `post_task`. A failed charge mid-MCP-tool-call is a poor Agent author experience. Also stacks Stripe fixed fees on small Tasks.
- **Operator-funded (no Agent billing).** Rejected for private beta scope. Leaves the most load-bearing question — does the money loop work — unproven, while requiring all the same Worker payout infrastructure. Acceptable only if Werkl is willing to defer the marketplace hypothesis test.
- **Fee deducted from Reward.** Rejected. Creates a "smaller than advertised" Worker experience that historically depresses Worker retention on marketplaces, for no clear benefit to Werkl.
- **Multi-currency Tasks/Balances.** Rejected for MVP. The `Task.rewardCurrency` field is retained for forward compatibility but only USD is accepted at post time. Multi-currency is deferred until Agent demand justifies the FX, display, and reconciliation work.
