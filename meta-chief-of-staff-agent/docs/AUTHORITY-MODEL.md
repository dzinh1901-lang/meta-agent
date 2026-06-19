# Authority Model

## Action Classes

| Class | Meaning | Examples | Approval |
| --- | --- | --- | --- |
| Recommend-only | Agent may analyze and suggest | Launch gaps, architecture options | Not required |
| Draft-only | Agent may prepare but not execute | PR drafts, migration plans, vendor emails | Owner review before use |
| Executable | Agent may run locally | JSON validation, doc link checks, schema tests | Not required when non-production |
| Blocked | Agent must stop | Deploy, spend, alter secrets, send external messages | Explicit owner approval required |

## Deny List Without Approval

- Deploy production or preview releases intended for users.
- Change billing, Stripe live-mode, procurement, or purchasing state.
- Alter secrets, environment variables, tokens, or credentials.
- Run live database migrations.
- Send external communications.
- Modify production systems or irreversible infrastructure.

## Escalation

When risk is ambiguous, classify the task as draft-only and produce a ProposedAction with target, risk, evidence, rollback plan, and requested approval.
