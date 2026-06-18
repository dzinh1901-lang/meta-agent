'use strict';

const { classifyAction } = require('./policy-engine');
const { findRepository } = require('./repository-registry');
const { stableId, normalizeArray, requireNonEmptyString, assertRequiredFields } = require('./packet-utils');

const TASK_PACKET_REQUIRED_FIELDS = [
  'task_id',
  'objective',
  'repository',
  'target_orchestrator',
  'risk_level',
  'requested_outputs',
  'validation_requirements',
  'audit_correlation_id',
  'execution_disposition'
];

function resolveTargetOrchestrator({ repository, targetOrchestrator, registry }) {
  if (typeof targetOrchestrator !== 'undefined') return targetOrchestrator;
  if (!registry) return null;
  const repo = findRepository(registry, repository);
  if (!repo || !repo.orchestrator || !repo.orchestrator.known) return null;
  return repo.orchestrator.path || null;
}

function buildTaskPacket(input) {
  const objective = requireNonEmptyString(input.objective, 'objective');
  const repository = requireNonEmptyString(input.repository, 'repository');
  const actionType = requireNonEmptyString(input.actionType || 'create_internal_task_packet', 'actionType');
  const decision = input.policyDecision || classifyAction(actionType, input.context || {});
  const targetOrchestrator = resolveTargetOrchestrator({
    repository,
    targetOrchestrator: input.targetOrchestrator,
    registry: input.registry
  });
  const requestedOutputs = normalizeArray(input.requestedOutputs || ['orchestrator_response', 'validation_plan', 'final_synthesis']);
  const validationRequirements = normalizeArray(input.validationRequirements || ['read-only discovery evidence required before execution']);
  const auditCorrelationId = input.auditCorrelationId || stableId('corr', {
    objective,
    repository,
    actionType,
    requestedOutputs,
    validationRequirements
  });
  const blocked = Boolean(decision.blocked);
  const requiresHumanApproval = !blocked && Boolean(decision.requiresHumanApproval);
  const executionDisposition = blocked ? 'blocked' : requiresHumanApproval ? 'approval_required' : 'allowed';
  const routingStatus = blocked
    ? 'blocked_by_policy'
    : targetOrchestrator
      ? 'orchestrator_known'
      : 'requires_orchestrator_discovery';

  const base = {
    objective,
    repository,
    target_orchestrator: targetOrchestrator,
    action_type: actionType,
    requested_by: input.requestedBy || 'meta-chief-of-staff-agent',
    risk_level: input.riskLevel || decision.risk,
    requested_outputs: requestedOutputs,
    validation_requirements: validationRequirements,
    requires_human_approval: requiresHumanApproval,
    approval_id: input.approvalId || null,
    audit_correlation_id: auditCorrelationId,
    priority: input.priority || (decision.risk === 'critical' ? 'critical' : decision.risk === 'high' ? 'high' : 'medium'),
    due_at: input.dueAt || null,
    evidence_refs: normalizeArray(input.evidenceRefs),
    policy_decision: decision,
    blocked,
    block_reasons: normalizeArray(decision.blockReasons),
    execution_disposition: executionDisposition,
    routing_status: routingStatus
  };

  const packet = { task_id: input.taskId || stableId('task', base), ...base };
  return assertRequiredFields(packet, TASK_PACKET_REQUIRED_FIELDS, 'TaskPacket');
}

function attachApprovalToTaskPacket(taskPacket, approvalPacket) {
  if (taskPacket.blocked) throw new Error('Blocked task packets cannot receive an execution approval.');
  if (!approvalPacket || !approvalPacket.approval_id) {
    throw new Error('approvalPacket with approval_id is required.');
  }
  return {
    ...taskPacket,
    requires_human_approval: true,
    approval_id: approvalPacket.approval_id,
    approval_status: approvalPacket.status || 'pending',
    execution_disposition: 'approval_required'
  };
}

module.exports = { TASK_PACKET_REQUIRED_FIELDS, buildTaskPacket, attachApprovalToTaskPacket };
