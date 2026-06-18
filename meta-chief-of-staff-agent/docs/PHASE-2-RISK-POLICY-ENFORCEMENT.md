# Phase 2: Risk and Policy Enforcement

## Status

Phase 2 implements deterministic policy enforcement for the Meta Chief of Staff Agent scaffold.

## Runtime modules

- `src/policy-engine.js` defines risk levels, approver roles, action taxonomy, v1-prohibited actions, hard blocks, and policy decisions.
- `src/approval-policy.js` validates whether a human approval decision is present, scoped, role-complete, unexpired, and executable.
- `src/guardrails.js` evaluates whether a tool call is allowed, blocked, or paused for human approval.
- `scripts/run-policy-check.js` prints representative decisions and guardrail results.
- `tests/phase2-policy.test.js` provides deterministic policy assertions without external services.

## Commands

```bash
cd meta-chief-of-staff-agent
npm run validate
npm run policy:check
npm run test:phase2
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

- approval exists when the action requires approval
- status is `approved`
- approval is not expired
- approval covers the requested action
- approval includes every required approver role
- approval cannot override hard blocks or v1-prohibited actions

Read-only actions do not need approval and remain executable without a decision packet.

## Phase 3 handoff

Phase 3 should consume `classifyAction()`, `evaluateToolGuardrail()`, and `validateApprovalDecision()` when generating task packets, approval packets, pending approval queue objects, and run-state transitions.
