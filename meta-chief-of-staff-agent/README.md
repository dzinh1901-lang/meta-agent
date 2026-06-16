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
│   ├── meta-chief-of-staff-agent.md
│   ├── cross-repository-orchestrator.md
│   ├── procurement-oversight-agent.md
│   ├── marketing-oversight-agent.md
│   ├── finance-ops-agent.md
│   ├── security-compliance-agent.md
│   └── audit-evidence-agent.md
├── docs/
│   ├── human-in-the-loop.md
│   ├── integration-blueprint.md
│   ├── operating-cadence.md
│   └── repository-inventory.md
├── policies/
│   ├── authorization-matrix.yaml
│   └── action-risk-policy.yaml
├── registries/
│   └── repositories.seed.json
├── schemas/
│   ├── approval-packet.schema.json
│   ├── task-packet.schema.json
│   ├── project-health.schema.json
│   └── agent-run.schema.json
├── examples/
│   ├── approval-packet.example.json
│   ├── task-packet.example.json
│   └── project-health.example.json
├── src/
│   ├── approval-packet-builder.js
│   ├── meta-chief-agent.js
│   ├── policy-engine.js
│   └── repository-registry.js
├── scripts/
│   ├── run-dry-run.js
│   └── validate-project.js
└── package.json
```

## First Local Commands

```bash
npm run validate
npm run dry-run
```

The included JavaScript is intentionally deterministic and dependency-free. It validates that the design package is coherent, loads the repository registry, classifies requested actions by risk, and produces approval packets where human authorization is required.

## Immediate Next Commit Target

1. Commit this folder as a standalone repository or under a parent `agentops-runtime` / `designos-orchestrator-v2` workspace.
2. Run read-only repository discovery against every visible GitHub repository.
3. Create one project-health record per repository.
4. Add adapter records for known orchestrators: AURELEAN and DesignOS.
5. Keep write, procurement, live-service, billing, marketing-publication, and regulated-domain actions blocked until explicit human authorization exists.
