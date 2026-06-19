# Meta Chief of Staff Agent

This folder starts a dedicated project for a portfolio-level **Meta Agent / Chief of Staff Agent**. The system is designed to supervise all current project repositories, route work through each repository's own orchestrator, maintain human authorization gates, and coordinate portfolio functions such as procurement, marketing, launch readiness, security, billing, compliance, and evidence collection.

The design deliberately does **not** replace repository-level orchestrators. It introduces a controlled oversight layer that can inspect project state, request plans, route work packets, consolidate blockers, and prepare approval packets for humans.

## Core Principle

```txt
Portfolio Chief of Staff Agent
  -> supervises repository-level orchestrators
  -> orchestrators supervise project-level sub-agents
  -> sub-agents execute bounded specialist workflows
  -> high-risk actions pause for human authorization
```

Authority is supervisory and procedural. The Chief of Staff Agent can recommend, route, rank, hold, and escalate. It must not self-approve production, billing, procurement awards, public marketing, supplier/client communications, live credentials, or regulated/high-risk actions.

## Project Folder Map

```txt
meta-chief-of-staff-agent/
├── README.md
├── PRD.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── MILESTONES.md
├── IMPLEMENTATION-PLAN.md
├── AGENT-MODEL.md
├── GOVERNANCE-AUTHORIZATIONS.md
├── RISK-REGISTER.md
├── agents/
├── docs/
│   ├── human-in-the-loop.md
│   ├── integration-blueprint.md
│   ├── operating-cadence.md
│   ├── repository-inventory.md
│   ├── PHASE-2-RISK-POLICY-ENFORCEMENT.md
│   └── PHASE-3-TASK-APPROVAL-PACKETS.md
├── policies/
├── registries/
├── schemas/
├── examples/
├── src/
│   ├── approval-packet-builder.js
│   ├── approval-policy.js
│   ├── guardrails.js
│   ├── meta-chief-agent.js
│   ├── packet-utils.js
│   ├── packet-workflow.js
│   ├── policy-engine.js
│   ├── repository-registry.js
│   ├── run-state.js
│   └── task-packet-builder.js
├── scripts/
│   ├── run-dry-run.js
│   ├── run-phase3-demo.js
│   ├── run-policy-check.js
│   └── validate-project.js
├── tests/
│   ├── phase2-policy.test.js
│   └── phase3-packets.test.js
└── package.json
```

## Local Commands

```bash
npm run validate
npm run dry-run
npm run policy:check
npm run packet:demo
npm run monitor
npm run monitor -- --postgres --schema public
npm run test:phase2
npm run test:phase3
npm run phase2
npm run phase3
```

## Portfolio Control Plane

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

### Monitoring Dashboard (`npm run monitor`)

Use `npm run monitor` to render a local oversight view from state records:

- repository health cards (from `projectHealth`/`projectHealthSnapshots`)
- approval queue status and pending/approved backlog
- blockers from blocked tasks, rejected queues, and blocked audit events
- risk summaries from tasks and approvals
- procurement queue from procurement workflows
- marketing queue from action intent/metadata heuristics
- audit log tail

By default, the dashboard uses in-memory seed mode (empty unless `--source` is used). For persisted records, use Postgres/Supabase:

```bash
DATABASE_URL=... npm run monitor -- --postgres
```

The included JavaScript is deterministic and dependency-free. It validates the design package, loads the repository registry, classifies actions by risk, enforces guardrails, validates scoped approvals, produces task packets, produces approval packets, creates pending approval queue items, and models pause/resume run state.

## Current Build Status

- Phase 0 scaffold: complete.
- Phase 1 read-only discovery design target: defined in roadmap/docs.
- Phase 2 risk and policy enforcement: implemented.
- Phase 3 task and approval packet generation: implemented.

## Immediate Next Commit Target

1. Add repository-orchestrator routing adapters.
2. Add typed state-store interfaces for persisted task packets, approvals, and agent runs.
3. Add read-only GitHub discovery adapter for project-health evidence.
4. Keep external side effects blocked until explicit human authorization exists.
