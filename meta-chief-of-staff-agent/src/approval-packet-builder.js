'use strict';

const { stableId, hashPayload, normalizeArray, requireNonEmptyString, assertRequiredFields } = require('./packet-utils');

const APPROVAL_PACKET_REQUIRED_FIELDS = [
  'approval_id',
  'requested_action',
  'action_type',
  'risk_level',
  'affected_repositories',
  'requesting_agent',
  'required_approver_roles',
  'evidence_bundle',
  'rollback_plan',
  'expires_at',
  'decision_options'
];

function defaultExpiryForRisk(risk, now = new Date()) {
  const hoursByRisk = { low: 0, medium: 24 * 7, high: 24 * 3, critical: 24 };
  const hours = hoursByRisk[risk] || 24;
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function buildApprovalPacket({
  action,
  decision,
  repositories,
  requestingAgent,
  evidenceBundle,
  expectedOutcome,
  rollbackPlan,
  constraints = {},
  expiresAt,
  createdAt,
  costImpact,
  customerSupplierImpact,
  auditCorrelationId,
  status = 'pending'
}) {
  const actionType = requireNonEmptyString(action.type, 'action.type');
  const requestedAction = requireNonEmptyString(action.summary || action.requested_action, 'action.summary');
  const now = createdAt || new Date().toISOString();
  const evidence = evidenceBundle || {};
  const affectedRepositories = normalizeArray(repositories);
  const base = {
    requested_action: requestedAction,
    action_type: actionType,
    risk_level: decision.risk,
    affected_repositories: affectedRepositories,
    requesting_agent: requestingAgent || 'meta-chief-of-staff-agent',
    required_approver_roles: normalizeArray(decision.approvals),
    evidence_bundle: evidence,
    evidence_hash: hashPayload(evidence),
    expected_outcome: expectedOutcome || 'Scoped, approval-gated execution only.',
    rollback_plan: rollbackPlan || 'Stop run, discard generated changes, and preserve audit record.',
    constraints,
    expires_at: expiresAt || defaultExpiryForRisk(decision.risk),
    created_at: now,
    status,
    decision_options: ['approve_once', 'approve_with_limits', 'reject', 'request_changes', 'always_reject'],
    requested_authority: {
      category: decision.category || 'unknown',
      effect: decision.effect || 'unknown',
      requires_human_approval: Boolean(decision.requiresHumanApproval || decision.blocked)
    },
    risk_reason: decision.reason,
    block_reasons: normalizeArray(decision.blockReasons),
    audit_correlation_id: auditCorrelationId || null
  };

  if (typeof costImpact !== 'undefined') base.cost_impact = costImpact;
  if (typeof customerSupplierImpact !== 'undefined') base.customer_supplier_impact = customerSupplierImpact;

  const idBase = {
    requested_action: base.requested_action,
    action_type: base.action_type,
    risk_level: base.risk_level,
    affected_repositories: base.affected_repositories,
    requesting_agent: base.requesting_agent,
    required_approver_roles: base.required_approver_roles,
    evidence_hash: base.evidence_hash,
    expires_at: base.expires_at,
    audit_correlation_id: base.audit_correlation_id
  };
  const packet = { approval_id: stableId('appr', idBase), ...base };
  return assertRequiredFields(packet, APPROVAL_PACKET_REQUIRED_FIELDS, 'ApprovalPacket');
}

module.exports = { APPROVAL_PACKET_REQUIRED_FIELDS, defaultExpiryForRisk, buildApprovalPacket };
