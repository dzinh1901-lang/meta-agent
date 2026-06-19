# Controlled Execution Weekly Brief Implementation Plan

## Verdict Carried Forward

- Implementation readiness: `CONDITIONALLY_READY`
- Execution authorization: `NOT_AUTHORIZED`
- Live execution: `NO-GO`
- Candidate: Chief of Staff Weekly Executive Brief

This plan defines the foundation for a future owner-authorized pilot. It does not authorize or run the pilot.

## Readiness Condition Map

| Condition | Owning Repository | Implementation Component | Contract | Test | Acceptance Criterion | Residual Risk |
| --- | --- | --- | --- | --- | --- | --- |
| Symlink and path-escape protection | AgentOps Runtime | `controlled-execution/path-guard.ts` | controlled execution result schemas | path rejection tests | All lexical and resolved escapes fail closed. | Host-specific reparse-point behavior may need extra platform review. |
| Approval replay prevention | AgentOps Runtime | approval validator and replay store | weekly brief approval request | nonce reuse tests | Approval nonce is single-use and bound to policy/task digests. | No real owner approval is consumed in this milestone. |
| Kill-switch enforcement | AgentOps Runtime | kill-switch provider | kill-switch state schema | missing, malformed, expired, engaged tests | Missing or ambiguous state means engaged. | Real owner-controlled switch remains future work. |
| Audit integrity | AgentOps Runtime | audit ledger and output manifest | audit ledger schema | hash-chain tamper tests | Audit events and output hashes are deterministic. | Hash chain is tamper-evident, not identity-authenticated. |
| Rollback integrity | AgentOps Runtime | rollback manager | rollback manifest schema | rollback path tamper tests | Only generated artifacts in the run directory may be removed. | Human review still required after rollback. |
| Resource and output limits | AgentOps Runtime | resource governor | resource-limit result schema | limit rejection tests | Limit violations fail closed and prevent accepted output. | Limits may need tuning after owner review. |

## Next Gate

The next gate, after implementation review, is `codex/controlled-execution-weekly-brief-pilot-authorization`.
