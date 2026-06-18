#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { loadRegistry, findRepository } = require('../src/repository-registry');
const { buildTaskPacket, attachApprovalToTaskPacket } = require('../src/task-packet-builder');
const { buildApprovalPacket } = require('../src/approval-packet-builder');
const { buildTaskApprovalWorkflow } = require('../src/packet-workflow');
const { classifyAction } = require('../src/policy-engine');
const { validateApprovalDecision } = require('../src/approval-policy');
const {
  createAgentRun,
  createPendingApproval,
  pauseRunForApproval,
  recordApprovalDecision,
  applyApprovalDecision,
  resumeRunFromApprovalQueue
} = require('../src/run-state');

const registry = loadRegistry();
const aurelean = findRepository(registry, 'dzinh1901-lang/aurelean-app');
assert.ok(aurelean && aurelean.orchestrator && aurelean.orchestrator.known);

const lowTask = buildTaskPacket({
  registry,
  objective: 'Read repository metadata for portfolio health.',
  repository: 'dzinh1901-lang/aurelean-app',
  actionType: 'read_repository_metadata',
  requestedOutputs: ['project_health'],
  validationRequirements: ['read-only metadata only'],
  auditCorrelationId: 'corr_phase3_low'
});
assert.equal(lowTask.requires_human_approval, false);
assert.equal(lowTask.risk_level, 'low');
assert.equal(lowTask.target_orchestrator, aurelean.orchestrator.path);
assert.equal(lowTask.audit_correlation_id, 'corr_phase3_low');
assert.equal(lowTask.execution_disposition, 'allowed');
assert.equal(lowTask.blocked, false);

const highDecision = classifyAction('create_pull_request_draft');
const highTask = buildTaskPacket({
  registry,
  objective: 'Create draft PR for project-health reporting.',
  repository: 'dzinh1901-lang/aurelean-app',
  actionType: 'create_pull_request_draft',
  requestedOutputs: ['draft_pr_plan', 'validation_plan'],
  validationRequirements: ['human approval before PR creation'],
  auditCorrelationId: 'corr_phase3_high',
  policyDecision: highDecision
});
assert.equal(highTask.requires_human_approval, true);
assert.equal(highTask.risk_level, 'high');
assert.equal(highTask.approval_id, null);
assert.equal(highTask.execution_disposition, 'approval_required');

const approval = buildApprovalPacket({
  action: { type: 'create_pull_request_draft', summary: 'Create draft PR for project-health reporting.' },
  decision: highDecision,
  repositories: ['dzinh1901-lang/aurelean-app'],
  requestingAgent: 'meta-chief-of-staff-agent',
  evidenceBundle: { task_packet_id: highTask.task_id, policy_version: '0.2.0' },
  expectedOutcome: 'Draft PR only.',
  rollbackPlan: 'Close draft PR and stop execution.',
  constraints: { allowed_repository: 'dzinh1901-lang/aurelean-app', forbidden_actions: ['merge_pull_request', 'trigger_deployment', 'request_secret_access'] },
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z',
  auditCorrelationId: highTask.audit_correlation_id
});
assert.equal(approval.status, 'pending');
assert.equal(approval.risk_level, 'high');
assert.deepEqual(approval.required_approver_roles, ['engineering_approver']);
assert.equal(approval.audit_correlation_id, highTask.audit_correlation_id);
assert.ok(approval.evidence_hash.length >= 32);

const linkedTask = attachApprovalToTaskPacket(highTask, approval);
assert.equal(linkedTask.approval_id, approval.approval_id);
assert.equal(linkedTask.approval_status, 'pending');

const run = createAgentRun({
  inputSummary: 'Phase 3 packet workflow test.',
  auditCorrelationId: highTask.audit_correlation_id,
  outputs: [{ type: 'task_packet', task_id: highTask.task_id }],
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(run.status, 'planned');

const pending = createPendingApproval({ approvalPacket: approval, taskPacket: linkedTask, run, createdAt: '2026-06-18T00:00:00Z' });
assert.equal(pending.status, 'pending');
assert.equal(pending.approval_id, approval.approval_id);
assert.deepEqual(pending.required_approver_roles, ['engineering_approver']);

const paused = pauseRunForApproval(run, approval, linkedTask);
assert.equal(paused.status, 'paused_for_approval');
assert.ok(paused.approval_ids.includes(approval.approval_id));

const decisionRecord = recordApprovalDecision({
  pendingApproval: pending,
  decisionType: 'approve_once',
  approverRole: 'engineering_approver',
  decidedAt: '2026-06-18T01:00:00Z'
});
const approvedQueue = applyApprovalDecision(pending, decisionRecord);
assert.equal(approvedQueue.status, 'approved');
assert.deepEqual(approvedQueue.approved_roles, ['engineering_approver']);
const resumed = resumeRunFromApprovalQueue(paused, approvedQueue);
assert.equal(resumed.status, 'running');
assert.ok(resumed.approval_decision_ids.includes(decisionRecord.decision_id));

const rejectedPending = createPendingApproval({ approvalPacket: approval, taskPacket: linkedTask, run, createdAt: '2026-06-18T00:00:00Z' });
const rejectedDecision = recordApprovalDecision({
  pendingApproval: rejectedPending,
  decisionType: 'reject',
  approverRole: 'engineering_approver',
  decidedAt: '2026-06-18T01:00:00Z'
});
const rejectedQueue = applyApprovalDecision(rejectedPending, rejectedDecision);
assert.equal(rejectedQueue.status, 'rejected');
assert.equal(resumeRunFromApprovalQueue(paused, rejectedQueue).status, 'blocked');

const workflow = buildTaskApprovalWorkflow({
  registry,
  objective: 'Create draft PR for project-health reporting.',
  repository: 'dzinh1901-lang/aurelean-app',
  action: { type: 'create_pull_request_draft', summary: 'Create draft PR for project-health reporting.' },
  actionType: 'create_pull_request_draft',
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(workflow.mode, 'dry-run');
assert.equal(workflow.task_packet.requires_human_approval, true);
assert.equal(workflow.task_packet.approval_id, workflow.approval_packet.approval_id);
assert.equal(workflow.pending_approval.approval_id, workflow.approval_packet.approval_id);
assert.equal(workflow.agent_run.status, 'paused_for_approval');
assert.equal(workflow.blocked_action, null);

const lowWorkflow = buildTaskApprovalWorkflow({
  registry,
  objective: 'Read repository metadata for portfolio health.',
  repository: 'dzinh1901-lang/aurelean-app',
  action: { type: 'read_repository_metadata', summary: 'Read repository metadata for portfolio health.' },
  actionType: 'read_repository_metadata',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(lowWorkflow.approval_packet, null);
assert.equal(lowWorkflow.pending_approval, null);
assert.equal(lowWorkflow.blocked_action, null);
assert.equal(lowWorkflow.agent_run.status, 'completed');

const blockedWorkflow = buildTaskApprovalWorkflow({
  registry,
  objective: 'Attempt a prohibited secret-access action.',
  repository: 'dzinh1901-lang/aurelean-app',
  action: { type: 'request_secret_access', summary: 'Request secret access.' },
  actionType: 'request_secret_access',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(blockedWorkflow.approval_packet, null);
assert.equal(blockedWorkflow.pending_approval, null);
assert.equal(blockedWorkflow.agent_run.status, 'blocked');
assert.equal(blockedWorkflow.blocked_action.approval_can_override, false);
assert.equal(blockedWorkflow.task_packet.execution_disposition, 'blocked');

const approvalDecision = validateApprovalDecision({
  actionType: 'create_pull_request_draft',
  approval: {
    status: 'approved',
    approved_actions: ['create_pull_request_draft'],
    approver_roles: ['engineering_approver'],
    expires_at: '2999-01-01T00:00:00Z',
    constraints: { allowed_repository: 'dzinh1901-lang/aurelean-app' }
  },
  scope: { repository: 'dzinh1901-lang/aurelean-app' }
});
assert.equal(approvalDecision.executable, true);

console.log(JSON.stringify({ ok: true, suite: 'phase3-packets', assertions: 52 }, null, 2));
