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
│   └── PHASE-2-RISK-POLICY-ENFORCEMENT.md
├── policies/
│   ├── authorization-matrix.yaml
│   └── action-risk-policy.yaml
├── registries/
│   └── repositories.seed.json
├── schemas/
├── examples/
├── src/
│   ├── approval-packet-builder.js
│   ├── approval-policy.js
│   ├── guardrails.js
│   ├── meta-chief-agent.js
│   ├── policy-engine.js
│   └── repository-registry.js
├── scripts/
│   ├── run-dry-run.js
│   ├── run-policy-check.js
│   └── validate-project.js
├── tests/
│   └── phase2-policy.test.js
└── package.json
```

## Local Commands

```bash
npm run validate
npm run dry-run
npm run policy:check
npm run test:phase2
npm run phase2
```

The included JavaScript is deterministic and dependency-free. It validates that the design package is coherent, loads the repository registry, classifies actions by risk, enforces guardrails, validates scoped approvals, and produces approval packets where human authorization is required.

## Current Build Status

- Phase 0 scaffold: complete.
- Phase 1 read-only discovery design target: defined in roadmap/docs.
- Phase 2 risk and policy enforcement: implemented in `src/policy-engine.js`, `src/guardrails.js`, `src/approval-policy.js`, and `tests/phase2-policy.test.js`.

## Immediate Next Commit Target

1. Add typed task packet and approval packet builders.
2. Add pending approval queue records.
3. Add run-state transitions for pause/resume.
4. Keep write, procurement, live-service, billing, marketing-publication, and regulated-domain actions blocked until explicit human authorization exists.
