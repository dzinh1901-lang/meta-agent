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
  'audit_correlation_id'
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

  const base = {
    objective,
    repository,
    target_orchestrator: targetOrchestrator,
    action_type: actionType,
    requested_by: input.requestedBy || 'meta-chief-of-staff-agent',
    risk_level: input.riskLevel || decision.risk,
    requested_outputs: requestedOutputs,
    validation_requirements: validationRequirements,
    requires_human_approval: Boolean(decision.requiresHumanApproval || decision.blocked),
    approval_id: input.approvalId || null,
    audit_correlation_id: auditCorrelationId,
    priority: input.priority || (decision.risk === 'critical' ? 'critical' : decision.risk === 'high' ? 'high' : 'medium'),
    due_at: input.dueAt || null,
    evidence_refs: normalizeArray(input.evidenceRefs),
    policy_decision: decision,
    routing_status: targetOrchestrator ? 'orchestrator_known' : 'requires_orchestrator_discovery'
  };

  const packet = { task_id: input.taskId || stableId('task', base), ...base };
  return assertRequiredFields(packet, TASK_PACKET_REQUIRED_FIELDS, 'TaskPacket');
}

function attachApprovalToTaskPacket(taskPacket, approvalPacket) {
  if (!approvalPacket || !approvalPacket.approval_id) {
    throw new Error('approvalPacket with approval_id is required.');
  }
  return {
    ...taskPacket,
    requires_human_approval: true,
    approval_id: approvalPacket.approval_id,
    approval_status: approvalPacket.status || 'pending'
  };
}

module.exports = { TASK_PACKET_REQUIRED_FIELDS, buildTaskPacket, attachApprovalToTaskPacket };
