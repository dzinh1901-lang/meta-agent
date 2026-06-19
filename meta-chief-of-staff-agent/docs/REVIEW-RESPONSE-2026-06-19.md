# Response to Phase 1–8 Review Findings

## Open question: nested secret rejection mode

Decision: use strict recursive deny mode by default.

Rationale:

- Integration metadata should never carry server-side secrets, regardless of nesting depth.
- Unknown non-secret objects remain allowed so integrations can carry provider-neutral metadata.
- Secret-like keys are normalized before matching, so variants such as `apiKey`, `api_key`, `client-secret`, `webhookSecret`, `refresh_token`, and `privateKey` are blocked.
- Per-integration allowlists may be added later, but only to constrain allowed non-secret metadata fields. All secret-like keys remain rejected globally.

## Fix mapping

| Finding | Resolution |
|---|---|
| Postgres scripts referenced missing `project_health` | Removed script references and mapped compatibility collection `projectHealth` to `project_health_snapshots`. |
| Integration secret guard was shallow | Added recursive secret field walker and wired it into `prepare_controlled_integration`. |
| Approval packet schema mismatch | Added policy fallbacks for stored approval packets and write decision enrichment for approved packets. |
| Backup plans stored in `approvalPackets` | Added `backupPlans` state collection and `backup_plans` migration table; tools/scripts now use it. |

## Verification command

```bash
cd meta-chief-of-staff-agent
npm run verify
```
