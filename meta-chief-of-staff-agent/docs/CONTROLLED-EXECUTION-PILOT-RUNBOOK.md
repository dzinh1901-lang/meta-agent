# Controlled Execution Pilot Runbook

This is a design-only runbook for a future milestone.

1. Confirm clean and approved repository state. Abort if dirty or unapproved.
2. Pin repository, branch, and commit. Abort on mismatch.
3. Materialize immutable task payload. Abort if mutable.
4. Calculate task and policy digests. Abort if missing.
5. Generate dry-run plan. Abort on blocked policy.
6. Review full proposed input/output scope. Abort on scope expansion.
7. Obtain owner approval. Abort if absent.
8. Verify approval integrity and expiry. Abort if invalid.
9. Verify kill switch state. Abort if engaged, unreadable, or ambiguous.
10. Verify sandbox isolation. Abort on path escape.
11. Verify network, subprocess, Git, secret, database, deployment, billing, and communications denials. Abort on missing denial.
12. Generate one local artifact package. Abort on unexpected output.
13. Validate output schema and file limits. Abort on violation.
14. Generate audit package. Abort if audit missing.
15. Present output and evidence for owner review. Abort if owner rejects.
16. Accept or rollback generated artifacts. Abort if rollback cannot complete.
17. Re-engage kill switch. Abort if not confirmed.
18. Invalidate approval nonce. Abort if nonce remains valid.
19. Produce final pilot report. Abort if evidence incomplete.
20. Do not commit or push pilot output without a separate owner decision.

