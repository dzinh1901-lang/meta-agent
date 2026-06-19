# Controlled Execution Weekly Brief Acceptance Criteria

## Required Outputs

- `weekly-executive-brief.json`
- `weekly-executive-brief.md`
- `output-manifest.json`
- `execution-audit.json`
- `rollback-manifest.json`

## Required State

- `execution_authorization`: `NOT_AUTHORIZED`
- `live_execution_enabled`: `false`
- Result status: `owner_review_required` or a fail-closed rejection state

## Acceptance

- Identical canonical inputs and policy produce identical output hashes.
- All writes are confined to a new or empty approved output directory.
- All safeguards emit audit evidence.
- Rollback manifest names only generated artifacts.
- No real pilot data is processed.
- No live execution, production action, external communication, secret access, deployment, migration, billing action, tool invocation, skill invocation, network call, or subprocess occurs.
