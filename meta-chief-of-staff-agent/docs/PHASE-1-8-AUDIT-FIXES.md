# Phase 1–8 Audit Fixes

This patch addresses four end-to-end audit findings found after Phases 1–8.

## 1. Postgres dashboard and ops table mapping

`projectHealth` no longer maps to a non-existent `project_health` table in runtime scripts. The canonical Postgres table is `project_health_snapshots`.

Changes:

- `scripts/phase7-monitor-dashboard.js`
- `scripts/phase8-production-operations.js`
- `src/state/PostgresStateStore.ts`

`projectHealth` remains a compatibility alias in `PostgresStateStore`, but it maps to `project_health_snapshots`.

## 2. Recursive integration secret rejection

Integration metadata now uses a recursive server-side secret guard. Nested keys such as `credentials.apiKey`, `oauth.client_secret`, `headers.authorizationToken`, and `webhook_secret` are rejected before any integration workflow is prepared.

Changes:

- `src/secret-field-guard.js`
- `src/sdk/tools.ts`

Current mode: strict recursive denylist. Unknown non-secret objects are allowed. Per-integration allowlists can be added later, but the default posture is fail closed for any key that normalizes to a secret-like field.

## 3. Approval packet schema interoperability

Approval validation now accepts stored approval packets that use the existing artifact schema (`action_type`, `required_approver_roles`) as well as explicit execution schema (`approved_actions`, `approver_roles`). `record_decision` now updates approved approval packets with `approved_actions`, `approver_roles`, and `approved_by_roles` when a queue is fully approved.

Changes:

- `src/policy-engine.js`
- `src/approval-policy.js`
- `src/sdk/tools.ts`

## 4. Dedicated backup plan collection

Backup plans are no longer stored in `approvalPackets`. They now use a dedicated `backupPlans` collection and `backup_plans` Postgres table.

Changes:

- `src/state/StateStore.ts`
- `src/state/PostgresStateStore.ts`
- `src/state/migrations/001_evidence_ledger.sql`
- `src/sdk/tools.ts`
- `scripts/phase7-monitor-dashboard.js`
- `scripts/phase8-production-operations.js`

## Verification

Added deterministic regression coverage:

```bash
npm run test:audit-fixes
npm run verify
```

The test asserts:

- no runtime script references `project_health`
- `backup_plans` exists in migration/table mappings
- nested integration secret fields are rejected
- stored approval packets interoperate with policy validation
- backup plans are written to `backupPlans`, not `approvalPackets`
