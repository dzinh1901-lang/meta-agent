# Meta Chief of Staff Agent

A governed portfolio-level agent that supervises GitHub project orchestrators, prepares project and procurement workflows, and pauses sensitive tool calls for human authorization.

The Chief of Staff is a manager, not an autonomous operator. It can inspect, classify, plan, route, summarize, and prepare approval artifacts. It cannot self-approve, access secrets, merge pull requests, deploy, mutate production, publish externally, spend money, award vendors, or sign contracts.

## Architecture

```txt
Human operator / approvers
  -> Meta Chief of Staff Agent
       -> deterministic policy and packet tools
       -> Cross-Repository Orchestrator
       -> Procurement Oversight Agent
       -> Marketing Oversight Agent
       -> Finance Ops Agent
       -> Security Compliance Agent
       -> Audit Evidence Agent
  -> repository-level orchestrators
  -> project specialist agents
```

The root agent uses the OpenAI Agents SDK manager-as-tools pattern. Sensitive controlled-action requests use SDK human-in-the-loop interruptions and resume from `RunState` after an explicit approval or rejection.

## Current implementation

- Deterministic action taxonomy, risk classification, hard blocks, and scoped approval policy
- Task packets, approval packets, pending approval queues, and multi-role decisions
- Run pause, resume, reject, and blocked-state transitions
- Repository-orchestrator compatibility and dry-run portfolio routing
- Procurement research, shortlist, award, contract, and payment readiness gates
- Vendor risk matrix and repository/budget/vendor-scoped approval packets
- Typed state-store interface with an in-memory implementation
- Root Agents SDK manager and six specialist agents
- Read-only portfolio/control-plane tools
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

Set runtime configuration:

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
npm run sdk:chat -- --once "Summarize the portfolio and show pending approvals."
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
npm run phase4
npm run typecheck
npm run sdk:smoke
npm run sdk:chat
npm run verify
```

## Safety behavior

- Read-only actions may proceed without approval.
- Approval-required actions create task, approval, queue, and run records and pause.
- Hard-blocked or incomplete commitment actions do not receive an execution approval packet.
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
| Phase 4 — Orchestrator routing and procurement pilot | Implemented for dry-run/local use |
| Phase 5 — Marketing oversight workflow | Next domain phase |
| Phase 6 — Controlled GitHub writes | Not enabled |
| Phase 7–8 — Dashboard and production operations | Not ready |

## Audit

See [`docs/COMPREHENSIVE-AUDIT-2026-06-18.md`](docs/COMPREHENSIVE-AUDIT-2026-06-18.md) for findings, production blockers, and the recommended implementation sequence.

## Production blockers

Before production use, complete evidence-backed GitHub discovery, durable state and append-only audit storage, authenticated RBAC/multi-approver identity, hardened external adapters, monitoring, incident workflows, and deployment review.
