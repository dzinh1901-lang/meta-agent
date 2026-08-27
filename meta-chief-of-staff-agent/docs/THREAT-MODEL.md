# Chief of Staff Runtime Threat Model

## Protected assets

- human approval authority;
- repository and production mutation authority;
- API tokens and service credentials;
- customer, supplier, financial, contract, and tenant data;
- portfolio policy and repository-local orchestrator boundaries;
- integrity of task, approval, evidence, and audit records.

## Principal threats and controls

| Threat | Control |
|---|---|
| Model self-approves | Root manager has no approval-decision tool; runtime accepts only trusted role allowlist claims. |
| Approval replay | Approved packets become `consumed` after the exact interruption executes. Consumed packets cannot resume again. |
| Approval substitution | Canonical exact-action binding covers tool, agent, action type, repository, environment, and normalized arguments. |
| Argument mutation after review | Runtime recomputes the pending SDK action digest and compares it with the stored packet before approving. |
| Broad approval scope | Fixed repository, environment, forbidden-action, and digest constraints are validated before each decision. |
| Conflicting multi-approver constraints | New constraints cannot overwrite an existing constraint with a different value. |
| Prompt injection from repositories | Discovery returns structural evidence, not raw repository text; repository content is explicitly untrusted. |
| Secret exfiltration in tool arguments | Secret-like field names and common credential patterns are rejected before persistence. |
| Secret leakage through GitHub adapter | Token is server-side only; adapter exposes no token field and supports GET requests only. |
| Unknown action authority | Deterministic policy classifies unknown actions as critical and hard-blocked. |
| Missing repository authority | Authorized repositories must exist in the registry; unknown orchestrators remain discovery-required. |
| Sensitive trace leakage | SDK runner sets `traceIncludeSensitiveData: false`; serialized state excludes tracing API keys. |
| Local state disclosure | JSON state is written atomically with mode `0600` and omitted from CLI output. |
| Corrupt or forged local state | JSON store validates version, collection shape, record IDs, and timestamps before use. |
| Partial multi-party approval executes early | Runtime resumes the model only after every current interruption has a final approval queue state. |
| Regulated or secret-access action | Existing hard blocks remain authoritative and cannot be overridden by a normal approval packet. |

## Residual risks

- CLI operator identity is only as strong as the host environment. Production deployments require authenticated middleware and signed identity claims.
- Action text fields can contain sensitive business information even when they do not match credential patterns. State and audit stores remain confidential systems.
- A future write adapter must independently enforce idempotency, target allowlists, branch protections, approval consumption, and postconditions.
- Sanitized repository metadata can still be misleading or stale. Every claim must retain source SHA, scan time, and confidence.
- Model outputs remain advisory. Deterministic policy, state transitions, and external adapter controls are the enforcement mechanisms.
