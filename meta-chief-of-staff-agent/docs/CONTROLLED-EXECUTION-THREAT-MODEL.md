# Controlled Execution Threat Model

Residual risk scale: Low, Medium, High, Critical.

| Threat ID | Description | Attack Path | Component | Likelihood | Impact | Preventive Control | Detective Control | Current Evidence | Remaining Gap | Residual Risk | Readiness Effect |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | Approval replay | Reuse old approval nonce | Approval model | Medium | High | Single-use nonce | Audit nonce ledger | Approval schema designed | Nonce store not implemented | Medium | Condition |
| T02 | Expired approval | Use approval after expiry | Approval model | Medium | High | Expiry check | Audit failure | Schema requires expiry | Runtime verifier future work | Medium | Condition |
| T03 | Scope mismatch | Approval for different task/repo/branch/commit | Approval model | Medium | High | Digest and scope binding | Audit mismatch | Policy/schema require bindings | Verifier future work | Medium | Condition |
| T04 | Self-approval | Agent signs its own approval | Governance | Low | Critical | Owner role required | Approval identity audit | Existing policy forbids self approval | Signature verifier future work | Medium | Condition |
| T05 | Prompt injection | Repository content asks agent to break scope | Input parser | Medium | High | Allowlisted inputs, no delegated execution | Audit input list | Boundary doc | Content sanitizer future work | Medium | Condition |
| T06 | Malformed task input | Invalid task bypasses controls | Task validation | Medium | High | Schema validation | Validation report | Runtime task validation exists | Controlled pilot task schema future work | Medium | Condition |
| T07 | Path traversal | Output path escapes directory | Output writer | Medium | Critical | Relative path normalization | Audit output manifest | Policy denies traversal | Writer not implemented | Medium | Condition |
| T08 | Absolute path write | Attempt write outside sandbox | Output writer | Medium | Critical | Deny absolute paths | Audit manifest | Policy denies | Writer not implemented | Medium | Condition |
| T09 | Symlink escape | Symlink points outside output dir | Output writer | Low | Critical | Symlink refusal | Path audit | Evidence map identifies gap | Symlink protection future work | High | Blocks READY |
| T10 | Hidden-file write | Write dotfiles or git metadata | Output writer | Low | High | Hidden path deny | Output manifest | Policy denies | Writer not implemented | Medium | Condition |
| T11 | Source-file modification | Mutate tracked code/docs | Output writer | Medium | Critical | Output directory allowlist | Git status audit | Boundary doc | Writer not implemented | Medium | Condition |
| T12 | Shell injection | Task invokes shell | Executor | Low | Critical | Shell denied | Audit denied capabilities | Policy denies | Future verifier required | Medium | Condition |
| T13 | Subprocess spawn | Runtime spawns process | Executor | Low | Critical | Subprocess denied | Audit denied capabilities | Policy denies | Future verifier required | Medium | Condition |
| T14 | Network egress | Calls external API | Executor | Low | Critical | Network denied | Audit denied capabilities | Policy denies | Future verifier required | Medium | Condition |
| T15 | Secret read | Reads credentials/env | Input access | Low | Critical | Secret/env deny | Access audit | Existing NO-GO statements | Future filesystem filter | Medium | Condition |
| T16 | Excessive output | Too many files/bytes | Output writer | Medium | Medium | Resource limits | Manifest size check | Policy limits | Writer not implemented | Medium | Condition |
| T17 | Audit tampering | Output modifies audit logs | Audit packager | Low | High | Append-only package design | Hash manifest | Audit package exists | Integrity hash future work | Medium | Condition |
| T18 | Kill-switch failure | Unreadable or ignored switch | Guard | Low | Critical | Fail closed | Kill-switch audit | Design doc | Runtime check future work | High | Blocks READY |
| T19 | Stale policy | Old policy used | Policy loader | Medium | High | Policy digest binding | Digest audit | Schema requires digest | Loader future work | Medium | Condition |
| T20 | TOCTOU mismatch | Commit/path changes after approval | Preflight | Medium | High | Baseline commit match | Pre/post audit | Policy requires baseline | Future preflight | Medium | Condition |
| T21 | Cross-repo expansion | Task reads unapproved repo | Input access | Medium | High | Repository allowlist | Input manifest | Policy scope | Future access filter | Medium | Condition |
| T22 | Nondeterministic output | Output changes across runs | Generator | Medium | Medium | Stable inputs, no time/network | Output hash | Boundary doc | Determinism test future work | Medium | Condition |
| T23 | Rollback failure | Generated files not removed | Rollback | Medium | Medium | Rollback manifest | Rollback audit | Design doc | Rollback tool future work | Medium | Condition |

## Summary

High residual risks remain for symlink escape and kill-switch implementation. They block a READY verdict but allow a CONDITIONALLY_READY implementation-planning verdict because no execution is authorized in this milestone.

