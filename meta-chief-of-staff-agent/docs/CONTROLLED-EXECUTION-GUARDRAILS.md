# Controlled Execution Guardrails

The canonical policy is `config/controlled-execution-pilot-policy.json` and validates against `contracts/controlled-execution-pilot-policy.schema.json`.

The policy is design-only. It is not connected to a real executor.

## Allowed Capabilities

Read explicitly allowlisted non-secret files, parse approved JSON and Markdown inputs, generate deterministic Markdown/JSON output, write only to `.controlled-execution-pilot/output/`, validate generated output, produce audit evidence, and delete pilot-generated artifacts during rollback.

## Denied Capabilities

Network, external APIs, shell, subprocesses, package installation, Git writes, source-file modification, hidden-file modification, symlink traversal, secret reads, environment credential reads, database access, migrations, billing, deployments, external communications, delegated execution, and self-approval.

## Safety Defaults

Fail closed, deny by default, kill switch engaged by default, execution disabled by default, approval required, immutable task digest required, policy digest required, and baseline commit match required.

