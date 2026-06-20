# Controlled Execution Pilot Boundary

## Definition

A controlled execution pilot for this program means one approved workflow, one repository or approved portfolio-data snapshot, one immutable task payload, one allowlisted output directory, local workspace only, deterministic artifact generation, and zero external side effects.

## Allowed Future Write Scope

The proposed future pilot may write only generated artifacts under:

`.controlled-execution-pilot/output/`

That path must remain ignored by Git.

## Explicit Maximum Blast Radius

- one task
- one owner approval
- one output package
- one execution attempt
- one local workspace
- one expiry window
- zero external side effects

## Distinctions

Dry-run planning describes what would happen and produces no controlled output.

Controlled local artifact generation may, in a future milestone, write deterministic Markdown/JSON artifacts to the isolated output directory only.

Live or production execution remains prohibited: no network, APIs, shell, packages, Git writes, secrets, database access, deployments, production access, external communications, autonomous approval, chained execution, delegated execution, or source-file modification.

