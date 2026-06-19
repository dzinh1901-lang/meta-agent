# Failure Modes

| Failure | Impact | Detection | Response |
| --- | --- | --- | --- |
| Missing repository | Work routed to wrong place | Path and Git checks | Record blocker and ask owner |
| Stale registry | Wrong status/reporting | Registry validator and weekly review | Update registry |
| Approval bypass | Production or financial risk | Approval gate review | Stop, escalate, log ProposedAction |
| Secret exposure | Security incident | Secret hygiene checks | Stop, remove from draft, rotate if exposed |
| Invalid schema | Runtime incompatibility | JSON/schema validators | Fix schema before execution |
| Failed validation | Unsafe change | Local test output | Report failure and block promotion |

## Rollback And Escalation

Documentation changes can be reverted by repository commit. Production-risk work must include a rollback plan before approval. If rollback is unknown, the action is blocked.
