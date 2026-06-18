# Meta Chief of Staff Agent

A governed portfolio-level agent that supervises GitHub project orchestrators, delegates domain work to specialist agents, prepares controlled workflows, and pauses sensitive tool calls for human authorization.

The Chief of Staff is not an autonomous operator. It can inspect, classify, plan, route, summarize, and prepare approval artifacts. It cannot self-approve, access secrets, merge pull requests, deploy, mutate production, publish externally, spend money, award vendors, or sign contracts.

## Architecture

```txt
Human operator / approvers
  -> Meta Chief of Staff Agent
       -> deterministic policy and control-plane tools
       -> handoff: Cross-Repository Orchestrator
       -> handoff: Procurement Oversight Agent
       -> handoff: Marketing Oversight Agent
       -> handoff: Finance Ops Agent
       -> handoff: Security Compliance Agent
       -> handoff: Audit Evidence Agent
  -> repository-level orchestrators
  -> project specialist agents
```

The top-level agent uses OpenAI Agents SDK handoffs. Each handoff carries structured routing metadata and writes an audit event before the specialist takes ownership of the run. Specialist agents expose narrow deterministic tools rather than broad mutation capabilities. Sensitive controlled-action requests still use SDK human-in-the-loop interruptions and resume from `RunState` after an explicit approval or rejection.

## Specialist responsibilities and tools

| Specialist | Narrow tools |
|---|---|
| Cross-Repository Orchestrator | repository/orchestrator compatibility, dry-run routing, orchestrator response normalization |
| Procurement Oversight Agent | procurement classification, vendor risk comparison, governed procurement workflow |
| Marketing Oversight Agent | claim evidence review, attribution readiness, governed campaign brief |
| Finance Ops Agent | budget utilization, spend variance, billing-readiness review |
| Security Compliance Agent | action/security review, required evidence, hard-block and approval analysis |
| Audit Evidence Agent | StateStore-backed evidence summary, pending approvals, correlated workflow records |

## Current implementation

- Deterministic action taxonomy, risk classification, hard blocks, and scoped approval policy
- Task packets, approval packets, pending approval queues, and multi-role decisions
- Run pause, resume, reject, and blocked-state transitions
- Repository-orchestrator compatibility and dry-run portfolio routing
- Six separate Agents SDK specialists and six structured handoffs
- Audited handoff events persisted to `handoffEvents` and `auditEvents`
- Procurement research, shortlist, award, contract, and payment readiness gates
- Vendor risk matrix and repository/budget/vendor-scoped approval packets
- Campaign claim, attribution, privacy, publication, outreach, and paid-spend readiness checks
- Budget and security review adapters
- Typed state-store interface with an in-memory implementation
- Interactive CLI with local session memory and serialized approval run state
- Deterministic Phase 2–4 tests and GitHub Actions verification

## Install

```bash
cd meta-chief-of-staff-agent
npm install --ignore-scripts
npm run verify
```

`npm run verify` executes deterministic validation and Phase 2–4 tests, TypeScript type checking, and a non-network SDK graph smoke test.

## Interactive agent

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="gpt-5.5"
export META_AGENT_OPERATOR_ID="principal-user-id"
export META_AGENT_OPERATOR_ROLES="principal_approver,engineering_approver,security_approver,finance_approver,procurement_approver,marketing_approver,legal_compliance_approver"
export META_AGENT_MODE="approval_gated"
export META_AGENT_ENVIRONMENT="local"
```

Start an interactive session:

```bash
npm run sdk:chat
```

Run one request:

```bash
npm run sdk:chat -- --once "Review the portfolio and hand off procurement risks to the correct specialist."
```

Resume a serialized approval run:

```bash
npm run sdk:resume
```

The CLI stores a paused SDK `RunState` in `.meta-agent-run-state.json` by default. Override the location with `META_AGENT_RUN_STATE_FILE`.

## Commands

```bash
npm run validate
npm run dry-run
npm run policy:check
npm run packet:demo
npm run procurement:demo
npm run test:phase2
npm run test:phase3
npm run test:phase4
npm run test:phase4:specialists
npm run phase4
npm run typecheck
npm run sdk:smoke
npm run sdk:chat
npm run verify
```

## Safety behavior

- Read-only actions may proceed without approval.
- Handoffs validate repository authorization and record the reason, objective, priority, action type, and evidence references.
- Approval-required actions create task, approval, queue, and run records and pause.
- Hard-blocked or incomplete commitment actions do not receive an execution approval packet.
- Specialist tools produce decision support and workflow artifacts; they do not execute external side effects.
- `queue_controlled_action` validates the referenced approval packet, repository, action, expiry, environment constraints, and operator roles.
- A successful controlled-action authorization records an audit event with `external_side_effect_executed: false`.
- No live GitHub write, deployment, billing, marketing-send, vendor-award, contract, or payment adapter is enabled.

## Phase status

| Phase | Status |
|---|---|
| Phase 0 — Scaffold and guardrails | Complete |
| Phase 1 — Evidence-backed repository discovery | Partial; seed registry only |
| Phase 2 — Risk and policy enforcement | Implemented |
| Phase 3 — Task and approval packets | Implemented |
| Phase 4 — Orchestrator and oversight adapters | Implemented and CI-verified on the audit branch |
| Phase 5 — Full marketing integration | Deterministic brief/readiness core exists; provider integrations are not enabled |
| Phase 6 — Controlled GitHub writes | Not enabled |
| Phase 7–8 — Dashboard and production operations | Not ready |

## Audit

See [`docs/COMPREHENSIVE-AUDIT-2026-06-18.md`](docs/COMPREHENSIVE-AUDIT-2026-06-18.md) and [`docs/PHASE-4-ORCHESTRATOR-OVERSIGHT-ADAPTERS.md`](docs/PHASE-4-ORCHESTRATOR-OVERSIGHT-ADAPTERS.md).

## Production blockers

Before production use, complete evidence-backed GitHub discovery, durable state and append-only audit storage, authenticated RBAC/multi-approver identity, hardened external adapters, monitoring, incident workflows, and deployment review.
