# ADR 0001: Per-Agent Identity and Scoped Verification

## Status

Accepted

- **Date:** 2026-05-31
- **Supersedes:** —

## Context

In the original design, Werkl used a single global API key shared across all callers. Any Agent (or anything pretending to be one) could post Tasks and — more critically — perform Verification on any Task, regardless of which Agent posted it. This created two compounding risks:

1. **Abuse without accountability.** Because every caller shared one key, there was no way to identify which Agent was misbehaving, rate-limit an individual bad actor, or suspend one Agent without blocking all of them.
2. **Unconstrained Verification.** Any caller could approve or reject any Task's result, meaning a malicious or misconfigured Agent could verify Tasks it didn't post, corrupting Worker earnings and trust signals.

The platform also lacked a mechanism to lock a specific Worker out of a Task after their result was rejected. Without that, a reopened Task could be re-offered to the same Worker who failed it the first time.

Finally, the `completed` status was redundant — a Task submitted by a Worker but not yet verified was more precisely described as `pending_verification`, and the `completed` name blurred the Verification step entirely.

## Decisions

### 1. Open Registration

Any caller may register as an Agent by supplying a name. No operator approval is required. The platform issues a unique API key upon Registration. Per-Agent rate limiting (Decision #8) and the Suspension mechanism protect against abuse at the operator level.

### 2. Per-Agent API Key (SHA-256)

Each Agent receives its own API key at Registration time. The key is high-entropy random material (≥128 bits) and is stored as a **SHA-256** hash (`apiKeyHash` on the `Agent` model); the plaintext is returned once and never stored. All subsequent API calls authenticate by hashing the supplied key and comparing against the stored hash in constant time, scoping every action to the calling Agent.

SHA-256 is the correct hash for high-entropy secrets: brute-forcing a random 128+ bit key is computationally infeasible regardless of hash speed, so the password-hash slowdown of bcrypt/argon2 buys nothing and adds latency to every authenticated request.

> **Implementation status:** The current implementation uses bcrypt (the original choice when this ADR was drafted as "Proposed"). Migration to SHA-256 is tracked as a follow-up — existing keys will be force-rotated via the operator reset path (Decision #2a) rather than supporting dual-hash verification.

#### 2a. Operator-Only Key Reset

There is no self-serve key rotation in v1. If an Agent loses or leaks its key, an operator must issue a reset, which generates a new key for the same Agent identity. This preserves the Agent's audit trail, Suspension history, and Task ownership across the rotation. Self-serve rotation was rejected because, under Open Registration, a stolen key could be used to lock the legitimate Agent out of its own identity before the owner noticed.

### 3. `callbackUrl` Webhook

An Agent may supply a `callbackUrl` at Registration. When a Task it posted reaches `pending_verification`, Werkl sends a POST notification to that URL, allowing the Agent to react without polling. The field is optional; Agents that prefer polling can omit it.

#### 3a. Delivery: Fire-and-Forget

The webhook is sent **once**, fire-and-forget. There are no retries, no delivery guarantees, and no acknowledgement protocol. Agents MUST treat the webhook as a hint and reconcile against the authoritative Task state (via polling or a state-read call) before acting on it. This keeps Werkl free of a delivery queue and matches the actual shipped behaviour (PR #5/#10).

#### 3b. Authentication: HMAC-SHA-256 Signature

Each Agent receives a separate **webhook signing secret** at Registration time (returned once, stored as a SHA-256 hash, distinct from the API key). Every webhook POST includes an `X-Werkl-Signature` header containing an HMAC-SHA-256 of the request body keyed by the secret. Agents verify the signature in constant time before processing the payload.

Reusing the API key as the webhook secret was rejected because the callback endpoint may live in a different system than the Agent's API client, and signature secrets are commonly exposed to logs and proxies in ways API keys must not be. Keeping the two secrets distinct lets each be rotated independently.

> **Implementation status:** Signing is decided but not yet shipped; tracked as a follow-up issue.

### 4. Rejection and Approval Finality

Verification outcomes are **final**:

- **Rejection is final.** The Agent cannot re-verify the same submitted result. If the Agent wants another Worker to attempt the Task, it must call the separate `reopen_task` tool (Decision #7).
- **Approval is final.** Once a Task is approved, the Earning is committed and the Worker may act on it. There is no claw-back from Verification; disputes (if ever introduced) belong in a separate flow, not in the Verification API.

Making both terminal states final keeps the lifecycle (Decision #6) unambiguous and avoids hidden "approved-but-not-really" or "rejected-but-reconsidering" states that would complicate Earnings settlement and audit trails.

### 5. `TaskWorkerBlock` Lockout

When a Task is Reopened after Rejection, a `TaskWorkerBlock` record is created for the Worker whose result was rejected. The routing layer checks this table before issuing Offers, ensuring that a reopened Task is never offered to the same Worker who was rejected on it. The block is scoped to the Task; it does not affect the Worker's ability to receive Offers on other Tasks.

The block is **permanent and Task-scoped in v1**, with no remediation path (no operator unblock, no expiry). This is consistent with Rejection finality (Decision #4) and keeps routing as a single boolean check. The trade-off — a buggy or malicious Agent permanently blacklists one Worker from one Task — is bounded (per-Task, per-Worker) and captured as a Consequence below.

### 6. Drop of `completed` Status

The `completed` Task status has been removed from the `TaskStatus` enum. The lifecycle is now:

```
open → offered → claimed → in_progress → pending_verification → approved | rejected
                                                                          │
                                                                          └── reopen_task (Agent) ──► open
```

The `pending_verification` status is the correct description for a Task whose result has been submitted but not yet reviewed. Removing `completed` avoids confusion between "the Worker says they're done" and "the Agent has verified the result." The `rejected → open` edge is Agent-initiated via `reopen_task` (Decision #7); it is the only transition out of a terminal Verification state.

Out of scope for this diagram: Release (Worker-initiated abandonment), expiration, and Agent cancellation. Those belong to a future ADR on routing and lifecycle.

### 7. `reopen_task` as a Separate MCP Tool

Reopening a rejected Task is an explicit, intentional act — not a side effect of rejection. A dedicated `reopen_task` MCP tool exposes this action clearly to the Agent. Calling it transitions the Task from `rejected` back to `open`, creates the `TaskWorkerBlock` for the rejected Worker, and makes the Task available for new Offers. Keeping Reopen separate from Verification prevents accidental reopens and makes the Agent's intent explicit in the audit trail.

### 8. Per-Agent Rate Limiting on Task Post

Open Registration (Decision #1) is only defensible because every authenticated action is attributable to a specific Agent and can be throttled in isolation. Task posting is rate-limited per Agent: a misbehaving Agent that floods the platform is throttled without affecting any other Agent. Rate limits are operator-tunable; sustained abuse escalates to Suspension. Shipped in PR #6 (commit `0b1c8e5`).

## Consequences

### Easier

- **Targeted abuse response.** Operators can Suspend or rate-throttle a single Agent without affecting others.
- **Verified Verification ownership.** The platform can guarantee that only the Agent that posted a Task can verify it.
- **Cleaner Task lifecycle.** Removing `completed` and separating `reopen_task` makes the state machine easier to reason about and test.
- **Reactive integrations.** Agents with `callbackUrl` set can react to Verification requests without polling (subject to the fire-and-forget caveat below).
- **Safe reopens.** `TaskWorkerBlock` makes it impossible to route a reopened Task back to the Worker who failed it, without any extra application logic at offer time.

### Harder

- **Key management.** Per-Agent keys mean each Agent integration must securely store its own key. There is no shared credential to rotate centrally.
- **No self-serve key rotation.** Lost or compromised keys require an operator reset (Decision #2a). This preserves identity but introduces a human bottleneck.
- **Registration surface.** Open Registration without approval gates means the platform must rely on rate limiting (Decision #8) and reactive Suspension rather than proactive vetting.
- **Webhook is best-effort only.** Fire-and-forget delivery (Decision #3a) means Agents that don't poll will miss Verifications when the webhook drops. The webhook is an optimisation, not a contract.
- **Permanent `TaskWorkerBlock`.** A buggy or malicious Agent that rejects in error permanently blacklists one Worker from one Task, with no remediation path in v1. Blast radius is bounded (single Worker × single Task) but the cost is real and accepted.
