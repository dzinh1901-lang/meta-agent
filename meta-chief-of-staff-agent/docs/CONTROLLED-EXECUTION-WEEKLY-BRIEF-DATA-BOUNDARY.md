# Controlled Execution Weekly Brief Data Boundary

## Included Snapshot Fields

- Repository identifier
- Milestone status
- Certification status
- Blockers
- Risks
- Approvals awaiting owner review
- Owner actions
- Priority recommendations
- Explicit as-of timestamp supplied by the task payload

## Excluded Data

- Secrets
- Environment variables
- Credentials
- Client-confidential source material
- Database contents
- Email contents
- External account data
- Arbitrary repository files

## Snapshot Rule

The pilot may consume only schema-valid immutable local JSON snapshots. It must not discover or enrich the snapshot by inspecting Git, databases, environment variables, external services, or arbitrary filesystem paths.

Execution authorization remains `NOT_AUTHORIZED`.
