'use strict';

const { classifyAction } = require('../policy-engine');
const { normalizeArray } = require('../packet-utils');

const DEFAULT_PROCUREMENT_THRESHOLDS = {
  major_spend: 10000,
  strategic_spend: 50000,
  currency: 'USD'
};

const INTENT_TO_ACTION = {
  research: 'procurement_vendor_research',
  shortlist: 'approve_vendor_shortlist',
  award: 'procurement_vendor_award',
  contract: 'contract_or_legal_commitment',
  payment: 'approve_procurement_action'
};

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function budgetBand(amount, thresholds = DEFAULT_PROCUREMENT_THRESHOLDS) {
  if (!Number.isFinite(amount) || amount <= 0) return 'not_provided';
  if (amount >= thresholds.strategic_spend) return 'strategic';
  if (amount >= thresholds.major_spend) return 'major';
  return 'standard';
}

function restrictedProcurementReasons(request) {
  const reasons = [];
  if (request.controlled_goods) reasons.push('Controlled-goods procurement is not supported.');
  if (request.defense_related) reasons.push('Defense-related procurement is blocked from operational execution.');
  if (request.weapons_related) reasons.push('Weapons-related procurement is blocked.');
  if (request.regulated_domain && !request.administrative_review_only) reasons.push('Regulated-domain procurement is limited to explicitly authorized administrative review.');
  if (request.regulated_domain && request.administrative_review_only && !request.legal_compliance_review_id) reasons.push('Administrative review of a regulated-domain request requires a legal/compliance review reference.');
  if (request.administrative_review_only && request.intent && request.intent !== 'research') reasons.push('Administrative review cannot shortlist, award, contract, or pay a vendor.');
  return unique(reasons);
}

function classifyProcurementRequest(request, thresholds = DEFAULT_PROCUREMENT_THRESHOLDS) {
  const intent = request.intent || 'research';
  const actionType = INTENT_TO_ACTION[intent];
  if (!actionType) {
    return {
      actionType: 'unknown_procurement_action',
      risk: 'critical',
      approvals: ['principal_approver', 'security_approver', 'legal_compliance_approver'],
      allowed: false,
      blocked: true,
      requiresHumanApproval: false,
      category: 'procurement',
      effect: 'unknown',
      reason: 'Unknown procurement intent. Policy fails closed.',
      blockReasons: ['Unknown procurement intent. Policy fails closed.'],
      budget_band: budgetBand(request.estimated_cost, thresholds)
    };
  }

  const base = classifyAction(actionType);
  const blockReasons = restrictedProcurementReasons(request);
  const approvals = [...base.approvals];
  let risk = base.risk;

  if (request.data_access || request.system_access) approvals.push('security_approver');
  if (request.contract_required || request.cross_border || request.regulated_domain) approvals.push('legal_compliance_approver');
  if (Number.isFinite(request.estimated_cost) && request.estimated_cost > 0 && intent !== 'research') approvals.push('finance_approver');
  if (intent === 'award' || intent === 'contract' || intent === 'payment') approvals.push('principal_approver', 'procurement_approver', 'finance_approver');
  if (request.sole_source || request.data_access || request.system_access || request.contract_required) {
    if (risk === 'medium') risk = 'high';
  }
  if (budgetBand(request.estimated_cost, thresholds) === 'strategic') {
    risk = 'critical';
    approvals.push('principal_approver', 'finance_approver');
  }

  const blocked = blockReasons.length > 0;
  const requiredApprovals = unique(approvals);
  const requiresHumanApproval = !blocked && (risk === 'high' || risk === 'critical' || requiredApprovals.length > 0);

  return {
    ...base,
    actionType,
    risk,
    approvals: requiredApprovals,
    allowed: !blocked && !requiresHumanApproval,
    blocked,
    requiresHumanApproval,
    category: 'procurement',
    effect: intent === 'research' ? 'derive' : intent === 'shortlist' ? 'decision' : 'commitment',
    reason: blocked ? blockReasons.join(' ') : 'Classified by procurement oversight policy.',
    blockReasons,
    budget_band: budgetBand(request.estimated_cost, thresholds),
    thresholds
  };
}

function scoreVendorRisk(vendor) {
  let score = 0;
  const flags = [];
  if (vendor.data_access) { score += 25; flags.push('data_access'); }
  if (vendor.system_access) { score += 25; flags.push('system_access'); }
  if (vendor.security_review_status !== 'approved') { score += 15; flags.push('security_review_incomplete'); }
  if (vendor.legal_review_status !== 'approved') { score += 15; flags.push('legal_review_incomplete'); }
  if (vendor.sole_source) { score += 10; flags.push('sole_source'); }
  if (vendor.cross_border) { score += 10; flags.push('cross_border'); }
  const riskLevel = score >= 70 ? 'critical' : score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
  return {
    vendor_id: vendor.vendor_id || null,
    vendor_name: vendor.vendor_name || 'unnamed_vendor',
    risk_score: score,
    risk_level: riskLevel,
    flags,
    evidence_refs: normalizeArray(vendor.evidence_refs),
    recommendation: riskLevel === 'critical' ? 'do_not_advance_without_security_legal_review' : riskLevel === 'high' ? 'advance_only_with_remediation_and_approval' : 'eligible_for_further_review'
  };
}

function buildVendorRiskMatrix(vendors) {
  return normalizeArray(vendors).map(scoreVendorRisk);
}

module.exports = {
  DEFAULT_PROCUREMENT_THRESHOLDS,
  INTENT_TO_ACTION,
  budgetBand,
  restrictedProcurementReasons,
  classifyProcurementRequest,
  scoreVendorRisk,
  buildVendorRiskMatrix
};
