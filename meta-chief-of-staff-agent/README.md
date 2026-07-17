# Meta Chief of Staff Agent

**COSMOS** is a governed portfolio control plane for supervising repository-level orchestrators. It inventories project evidence, routes bounded work through local orchestrators, prepares decision packets, pauses risky SDK tool calls for human authorization, and produces structured executive synthesis.

It does not replace repository orchestrators. It does not self-approve, access secrets, merge, deploy, spend, award vendors, publish externally, contact customers or suppliers, or mutate production.

## Operating hierarchy

```text
Human principal and approvers
  -> COSMOS Meta Chief of Staff Agent
  -> repository-level orchestrators
  -> project specialist agents
  -> validation and evidence
```

The deterministic policy engine remains the authorization boundary. The OpenAI Agents SDK supplies manager/specialist orchestration, tool approval interruptions, tracing, and serializable run state.

## Implemented runtime

- Root TypeScript manager agent with structured executive output.
- Specialist agents exposed through the manager pattern.
- Read-only, sanitized GitHub repository discovery.
- Deterministic task, routing, procurement, policy, and evidence tools.
- Durable in-memory, local JSON, and Postgres/Supabase-ready state adapters.
- Human-in-the-loop pause/resume using serialized Agents SDK `RunState`.
- Server-authorized approver role allowlists.
- SHA-256 exact-action approval binding.
- Multi-approver queues, expiry, constraint conflict detection, and single-use consumption.
- Regression tests for legacy policy/packet workflows and the SDK runtime.
- CI validation for deterministic and TypeScript layers.

## Security invariants

```text
Unknown action -> hard block
Unknown repository authority -> discovery required
High or critical action -> approval interruption
Changed tool arguments -> approval invalid
Missing trusted approver role -> decision rejected
Consumed approval -> replay rejected
Repository content -> untrusted evidence
Secrets in action arguments -> fail closed
```

See [SDK Runtime](docs/SDK-RUNTIME.md) and [Threat Model](docs/THREAT-MODEL.md).

## Install and validate

Requirements: Node.js 20 or later.

```bash
npm install
npm run check
```

`npm run check` validates the design package, policy and GitHub protocols, legacy phase tests, exact-action approval behavior, TypeScript compilation, local durable state, and read-only discovery.

Useful deterministic commands:

```bash
npm run validate
npm run dry-run
npm run policy:check
npm run packet:demo
npm run monitor
npm run test:legacy
npm run test:exact-action
npm run test:sdk
```

## Run the manager agent

Provide credentials and identity claims through a trusted server environment. Do not put secrets in prompts or tool arguments.

```bash
OPENAI_API_KEY=... \
COSMOS_OPERATOR_ID=principal-1 \
COSMOS_APPROVER_ROLES=engineering_approver,principal_approver,security_approver \
npm run agent:run -- \
  --objective "Prepare launch-readiness reports for AURELEAN and DesignOS"
```

The default durable store is `.data/cosmos-state.json`. The CLI prints a redacted public snapshot and does not print serialized SDK state.

Inspect status and approvals:

```bash
npm run agent:status -- --run-id sdk_run_...
npm run agent:approvals
```

Record a decision for a pending exact action:

```bash
COSMOS_OPERATOR_ID=principal-1 \
COSMOS_APPROVER_ROLES=engineering_approver \
npm run agent:decide -- \
  --run-id sdk_run_... \
  --approval-id appr_... \
  --decision approve_once \
  --role engineering_approver \
  --constraints '{"allowed_repository":"dzinh1901-lang/aurelean-app"}'
```

Production identity must come from authenticated middleware. The CLI role is accepted only when the trusted hosting environment already authorizes it through `COSMOS_APPROVER_ROLES`.

## Read-only discovery

The manager can inspect public GitHub repositories without a token, subject to API rate limits. Private repository discovery uses a server-side token:

```bash
GITHUB_READ_TOKEN=... npm run agent:run -- --objective "Refresh portfolio repository evidence"
```

Discovery uses GET requests only and returns artifact paths, source SHAs, sizes, package script names, structural metadata, evidence status, and confidence. It never returns raw repository text to the model.

## Project map

```text
meta-chief-of-staff-agent/
├── agents/                         Markdown agent contracts
├── docs/                           Governance, runtime, operations and portfolio documents
├── policies/                       Approval and risk matrices
├── registries/                     Repository source of truth
├── schemas/                        JSON schemas
├── scripts/                        Deterministic validation and operating commands
├── src/
│   ├── discovery/                  GET-only GitHub reader and evidence normalization
│   ├── sdk/                        Manager, specialists, governed tools, runtime and CLI
│   ├── state/                      In-memory, JSON file and Postgres state adapters
│   ├── approval-packet-builder.js  Approval packet construction
│   ├── policy-engine.js            Deterministic risk and authorization policy
│   ├── run-state.js                Approval queue and deterministic run state
│   └── ...                         Existing task, routing, procurement and evidence modules
├── tests/
│   ├── sdk/                        TypeScript runtime tests
│   └── phase*.test.js              Deterministic regression tests
├── .env.example
├── package.json
└── tsconfig.json
```

## Portfolio documentation

- [Portfolio registry](docs/PORTFOLIO-REGISTRY.md)
- [Project status matrix](docs/PROJECT-STATUS-MATRIX.md)
- [Portfolio blockers](docs/PORTFOLIO-BLOCKERS.md)
- [Meta-Agent PRD](docs/META-AGENT-PRD.md)
- [Authority model](docs/AUTHORITY-MODEL.md)
- [Approval gates](docs/APPROVAL-GATES.md)
- [Agent hierarchy](docs/AGENT-HIERARCHY.md)
- [Agent contract standard](docs/AGENT-CONTRACT-STANDARD.md)
- [Cross-repo orchestration map](docs/CROSS-REPO-ORCHESTRATION-MAP.md)
- [Governance validation](docs/GOVERNANCE-VALIDATION.md)
- [Weekly portfolio report template](templates/WEEKLY-PORTFOLIO-REPORT.md)

## External side effects

The new runtime does not add autonomous merge, deployment, billing, procurement award, paid media, public send, or production mutation capabilities. Existing GitHub write tools remain approval-gated stubs. Any future real adapter must independently enforce exact-action digest matching, single-use approval consumption, idempotency, rollback, and postcondition validation.
