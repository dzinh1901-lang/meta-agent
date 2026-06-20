# Controlled Execution Owner Approval Model

Owner approval must bind to approval id, owner role, pilot id, workflow id, exact task id, canonical task payload digest, policy version, policy digest, repository, branch, baseline commit SHA, input allowlist, output directory, action allowlist, prohibited-action acknowledgement, resource limits, issue time, expiry time, single-use nonce, approval status, revocation status, and owner signature or future signature reference.

Rules:

- The agent cannot approve itself.
- Approval must be explicit.
- Approval must be time-bounded.
- Approval must be single-use.
- Any task, policy, branch, commit, path, action, or input change invalidates approval.
- Expired, revoked, malformed, reused, or mismatched approval fails closed.
- Approval for a pilot never authorizes production execution.
- Approval artifacts in this milestone are templates or fixtures only.

