# Controlled Execution Weekly Brief Pilot

## Purpose

The Chief of Staff Weekly Executive Brief pilot is a future owner-authorized local artifact-generation workflow. It converts an immutable, owner-supplied portfolio snapshot into a JSON brief, Markdown brief, output manifest, execution audit, and rollback manifest.

## Non-Authorization Boundary

This definition does not authorize the pilot. Execution authorization remains `NOT_AUTHORIZED`; live execution remains `NO-GO`.

## Allowed Future Activity

- Validate a local immutable input snapshot.
- Generate local artifacts inside an approved output root.
- Produce deterministic audit and rollback evidence.
- Return `owner_review_required`.

## Prohibited Activity

- Running against real portfolio data in this milestone.
- Accessing secrets, credentials, environment variables, databases, email, external accounts, clients, suppliers, vendors, or production systems.
- Invoking LLMs, tools, skills, subprocesses, network calls, deployments, migrations, billing, Git writes, or external communications.
