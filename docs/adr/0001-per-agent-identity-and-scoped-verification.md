# ADR 0001: Per-Agent Identity and Scoped Verification

## Status

Proposed

## Context

In the original design, Werkl used a single global API key shared across all callers. Any Agent (or anything pretending to be one) could post Tasks and — more critically — perform Verification on any Task, regardless of which Agent posted it. This created two compounding risks:

1. **Abuse without accountability.** Because every caller shared one key, there was no way to identify which Agent was misbehaving, rate-limit an individual bad actor, or suspend one Agent without blocking all of them.
2. **Unconstrained Verification.** Any caller could approve or reject any Task's result, meaning a malicious or misconfigured Agent could verify Tasks it didn't post, corrupting Worker earnings and trust signals.

The platform also lacked a mechanism to lock a specific Worker out of a Task after their result was rejected. Without that, a reopened Task could be re-offered to the same Worker who failed it the first time.

Finally, the `completed` status was redundant — a Task submitted by a Worker but not yet verified was more precisely described as `pending_verification`, and the `completed` name blurred the Verification step entirely.

## Decisions

### 1. Open Registration

Any caller may register as an Agent by supplying a name. No operator approval is required. The platform issues a unique API key upon Registration. Rate limiting and the Suspension mechanism protect against abuse at the operator level.

### 2. Per-Agent API Key (Hashed)

Each Agent receives its own API key at Registration time. The key is stored as a bcrypt hash (`apiKeyHash` on the `Agent` model); the plaintext is returned once and never stored. All subsequent API calls authenticate by hashing the supplied key and comparing against the stored hash, scoping every action to the calling Agent.

### 3. `callbackUrl` Webhook

An Agent may supply a `callbackUrl` at Registration. When a Task it posted reaches `pending_verification`, Werkl sends a POST notification to that URL, allowing the Agent to react without polling. The field is optional; Agents that prefer polling can omit it.

### 4. Rejection Finality + Explicit Reopen

Rejection is final from a Verification standpoint — the Agent cannot re-verify the same submitted result. If the Agent wants another Worker to attempt the Task, it must call the separate `reopen_task` tool (see decision 7). This makes the outcome of each Verification unambiguous and prevents silent overwrites of rejected results.

### 5. `TaskWorkerBlock` Lockout

When a Task is Reopened after Rejection, a `TaskWorkerBlock` record is created for the Worker whose result was rejected. The routing layer checks this table before issuing Offers, ensuring that a reopened Task is never offered to the same Worker who was rejected on it. The block is scoped to the Task; it does not affect the Worker's ability to receive Offers on other Tasks.

### 6. Drop of `completed` Status

The `completed` Task status has been removed from the `TaskStatus` enum. The lifecycle is now:

```
open → offered → claimed → in_progress → pending_verification → approved | rejected
```

The `pending_verification` status is the correct description for a Task whose result has been submitted but not yet reviewed. Removing `completed` avoids confusion between "the Worker says they're done" and "the Agent has verified the result."

### 7. `reopen_task` as a Separate MCP Tool

Reopening a rejected Task is an explicit, intentional act — not a side effect of rejection. A dedicated `reopen_task` MCP tool exposes this action clearly to the Agent. Calling it transitions the Task from `rejected` back to `open`, creates the `TaskWorkerBlock` for the rejected Worker, and makes the Task available for new Offers. Keeping Reopen separate from Verification prevents accidental reopens and makes the Agent's intent explicit in the audit trail.

## Consequences

### Easier

- **Targeted abuse response.** Operators can Suspend a single Agent without affecting others.
- **Verified Verification ownership.** The platform can guarantee that only the Agent that posted a Task can verify it.
- **Cleaner Task lifecycle.** Removing `completed` and separating `reopen_task` makes the state machine easier to reason about and test.
- **Reactive integrations.** Agents with `callbackUrl` set can react to Verification requests in real time rather than polling.
- **Safe reopens.** `TaskWorkerBlock` makes it impossible to route a reopened Task back to the Worker who failed it, without any extra application logic at offer time.

### Harder

- **Key management.** Per-Agent keys mean each Agent integration must securely store its own key. There is no shared credential to rotate centrally.
- **Registration surface.** Open Registration without approval gates means the platform must rely on rate limiting and reactive Suspension rather than proactive vetting.
- **Webhook reliability.** Agents that rely on `callbackUrl` notifications are sensitive to network issues between Werkl and the Agent's endpoint. Agents should treat the webhook as a hint and still be able to poll.
