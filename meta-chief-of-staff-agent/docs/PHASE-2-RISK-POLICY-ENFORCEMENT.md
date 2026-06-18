# Phase 2: Risk and Policy Enforcement

## Status

Phase 2 now implements deterministic policy enforcement for the Meta Chief of Staff Agent scaffold.

## Added modules

- `src/policy-engine.js`
- `src/guardrails.js`
- `src/approval-policy.js`
- `scripts/run-policy-check.js`

## Commands

```bash
cd meta-chief-of-staff-agent
npm run validate
npm run policy:check
npm run phase2
```

## Policy contract

The policy engine defines:

- central risk levels: `low`, `medium`, `high`, `critical`
- required approver roles
- action taxonomy
- action category metadata
- action effect metadata
- hard-block contexts
- v1-prohibited actions
- approval coverage checks
- default read-only posture
- no self-approval

## Guardrail contract

`evaluateToolGuardrail()` returns a deterministic decision before a tool can run.

Allowed cases:

- read-only metadata actions
- low-risk planning actions
- scoped approval that covers the exact action and required roles

Blocked or paused cases:

- unknown action
- secret access
- merge PR
- trigger deployment
- production mutation without approval
- public marketing without approval
- paid spend without approval
- vendor award without approval
- bypassing a repository orchestrator
- self-approval attempt

## Approval validation

`validateApprovalDecision()` checks:

- approval exists
- status is approved
- approval is not expired
- approval covers the requested action
- approval includes every required approver role

## Phase 3 handoff

Phase 3 should consume `classifyAction()`, `evaluateToolGuardrail()`, and `validateApprovalDecision()` when generating task packets, approval packets, pending approval queue objects, and run-state transitions.
