'use strict';

const crypto = require('node:crypto');

function stableId(prefix, payload) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 12);
  return `${prefix}_${hash}`;
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
  costImpact,
  customerSupplierImpact
}) {
  const base = {
    requested_action: action.summary,
    action_type: action.type,
    risk_level: decision.risk,
    affected_repositories: repositories,
    requesting_agent: requestingAgent,
    required_approver_roles: decision.approvals,
    evidence_bundle: evidenceBundle,
    expected_outcome: expectedOutcome,
    rollback_plan: rollbackPlan,
    constraints,
    expires_at: expiresAt,
    decision_options: ['approve_once', 'approve_with_limits', 'reject', 'request_changes']
  };

  if (typeof costImpact !== 'undefined') {
    base.cost_impact = costImpact;
  }

  if (typeof customerSupplierImpact !== 'undefined') {
    base.customer_supplier_impact = customerSupplierImpact;
  }

  return { approval_id: stableId('appr', base), ...base };
}

module.exports = { buildApprovalPacket };
