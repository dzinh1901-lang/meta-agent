'use strict';

const { classifyAction } = require('../policy-engine');
const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');

const REQUIRED_EVIDENCE_BY_EFFECT = {
  read: [],
  derive: [],
  external_write: ['validation_plan', 'rollback_plan'],
  external_send: ['claims_or_content_review', 'privacy_review'],
  spend: ['budget_approval', 'measurement_plan'],
  commitment: ['approval_plan', 'rollback_plan'],
  production_path: ['validation_plan', 'rollback_plan', 'security_review'],
  sensitive_export: ['data_inventory', 'privacy_review', 'security_review'],
  secret_access: ['security_review', 'access_justification'],
  regulated: ['legal_compliance_review', 'security_review']
};

function buildSecurityReview(input) {
  const repository = requireNonEmptyString(input.repository, 'repository');
  const actionType = requireNonEmptyString(input.action_type, 'action_type');
  const environment = input.environment || 'non-production';
  const context = {
    selfApprovalAttempt: Boolean(input.self_approval_attempt),
    bypassRepositoryOrchestrator: Boolean(input.bypass_repository_orchestrator),
    requestsSecrets: Boolean(input.requests_secrets),
    productionMutationWithoutApproval: Boolean(input.production_mutation_without_approval),
    externalMessageWithoutApproval: Boolean(input.external_message_without_approval),
    paidSpendWithoutApproval: Boolean(input.paid_spend_without_approval),
    vendorAwardWithoutApproval: Boolean(input.vendor_award_without_approval),
    disableApprovalGates: Boolean(input.disable_approval_gates),
    regulatedDomain: Boolean(input.regulated_domain)
  };
  const decision = classifyAction(actionType, context);
  const evidence = input.evidence || {};
  const requiredEvidence = REQUIRED_EVIDENCE_BY_EFFECT[decision.effect] || [];
  const missingEvidence = requiredEvidence.filter((key) => !evidence[key]);
  const productionScopeMissing = environment === 'production' && !input.production_change_id;
  if (productionScopeMissing) missingEvidence.push('production_change_id');
  if (input.auth_or_tenant_change && !evidence.threat_model) missingEvidence.push('threat_model');
  if (input.personal_data && !evidence.data_protection_review) missingEvidence.push('data_protection_review');

  const hardBlocked = Boolean(decision.blocked);
  const readinessBlocked = !hardBlocked && missingEvidence.length > 0;
  const recommendation = hardBlocked
    ? 'block_and_escalate_policy_review'
    : readinessBlocked
      ? 'request_missing_security_evidence'
      : decision.requiresHumanApproval
        ? 'prepare_scoped_human_approval'
        : 'allow_read_only_or_internal_work';

  const base = {
    repository,
    action_type: actionType,
    environment,
    data_classification: input.data_classification || 'internal',
    auth_or_tenant_change: Boolean(input.auth_or_tenant_change),
    personal_data: Boolean(input.personal_data),
    production_change_id: input.production_change_id || null,
    evidence,
    evidence_refs: normalizeArray(input.evidence_refs),
    required_evidence: requiredEvidence,
    missing_evidence: Array.from(new Set(missingEvidence)),
    policy_decision: decision,
    hard_blocked: hardBlocked,
    readiness_blocked: readinessBlocked,
    executable: decision.allowed && !readinessBlocked,
    recommendation,
    required_approver_roles: decision.approvals,
    external_side_effect_executed: false
  };

  return { security_review_id: stableId('security', base), ...base };
}

module.exports = { REQUIRED_EVIDENCE_BY_EFFECT, buildSecurityReview };
