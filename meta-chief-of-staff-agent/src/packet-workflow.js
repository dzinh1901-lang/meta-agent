'use strict';

const { classifyAction } = require('./policy-engine');
const { loadRegistry } = require('./repository-registry');
const { buildTaskPacket, attachApprovalToTaskPacket } = require('./task-packet-builder');
const { buildApprovalPacket } = require('./approval-packet-builder');
const { createAgentRun, createPendingApproval, pauseRunForApproval } = require('./run-state');

function buildTaskApprovalWorkflow(input) {
  const registry = input.registry || loadRegistry();
  const actionType = input.actionType || (input.action && input.action.type) || 'create_internal_task_packet';
  const action = input.action || { type: actionType, summary: input.objective };
  const decision = classifyAction(actionType, input.context || {});

  let taskPacket = buildTaskPacket({
    ...input,
    registry,
    actionType,
    policyDecision: decision
  });

  let approvalPacket = null;
  let pendingApproval = null;
  let run = createAgentRun({
    inputSummary: input.objective,
    auditCorrelationId: taskPacket.audit_correlation_id,
    outputs: [{ type: 'task_packet', task_id: taskPacket.task_id }],
    status: 'planned',
    createdAt: input.createdAt
  });

  if (taskPacket.requires_human_approval) {
    approvalPacket = buildApprovalPacket({
      action,
      decision,
      repositories: input.affectedRepositories || [taskPacket.repository],
      requestingAgent: input.requestedBy || 'meta-chief-of-staff-agent',
      evidenceBundle: input.evidenceBundle || { task_packet_id: taskPacket.task_id, policy_version: '0.2.0' },
      expectedOutcome: input.expectedOutcome || 'Scoped task routing only. No merge, deploy, external send, spend, secret access, or production mutation.',
      rollbackPlan: input.rollbackPlan || 'Cancel task packet, keep audit record, and do not route execution.',
      constraints: input.constraints || { forbidden_actions: ['merge_pull_request', 'trigger_deployment', 'request_secret_access'] },
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      costImpact: input.costImpact,
      customerSupplierImpact: input.customerSupplierImpact,
      auditCorrelationId: taskPacket.audit_correlation_id
    });
    taskPacket = attachApprovalToTaskPacket(taskPacket, approvalPacket);
    pendingApproval = createPendingApproval({ approvalPacket, taskPacket, run, createdAt: input.createdAt });
    run = pauseRunForApproval(run, approvalPacket, taskPacket);
  } else {
    run = {
      ...run,
      status: 'completed',
      outputs: [...run.outputs, { type: 'policy_result', allowed: true, action_type: actionType }]
    };
  }

  return {
    workflow: 'task_approval_packet_generation',
    mode: 'dry-run',
    policy_decision: decision,
    task_packet: taskPacket,
    approval_packet: approvalPacket,
    pending_approval: pendingApproval,
    agent_run: run,
    next_steps: approvalPacket
      ? ['Pause run until scoped human approval is recorded.', 'Do not execute the gated action before approval.']
      : ['Task packet is low-risk/read-only and may proceed without approval.']
  };
}

module.exports = { buildTaskApprovalWorkflow };
