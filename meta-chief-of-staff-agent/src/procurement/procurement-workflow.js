'use strict';

const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');
const { buildTaskApprovalWorkflow } = require('../packet-workflow');
const { classifyProcurementRequest, buildVendorRiskMatrix, DEFAULT_PROCUREMENT_THRESHOLDS } = require('./procurement-policy');

function normalizeProcurementRequest(input) {
  const repository = requireNonEmptyString(input.repository, 'repository');
  const summary = requireNonEmptyString(input.summary, 'summary');
  const intent = input.intent || 'research';
  const base = {
    repository,
    summary,
    intent,
    category: input.category || 'general_services',
    estimated_cost: Number.isFinite(input.estimated_cost) ? input.estimated_cost : null,
    currency: input.currency || DEFAULT_PROCUREMENT_THRESHOLDS.currency,
    budget_owner: input.budget_owner || null,
    vendors: normalizeArray(input.vendors),
    contract_required: Boolean(input.contract_required),
    data_access: Boolean(input.data_access),
    system_access: Boolean(input.system_access),
    sole_source: Boolean(input.sole_source),
    cross_border: Boolean(input.cross_border),
    regulated_domain: Boolean(input.regulated_domain),
    administrative_review_only: Boolean(input.administrative_review_only),
    legal_compliance_review_id: input.legal_compliance_review_id || null,
    controlled_goods: Boolean(input.controlled_goods),
    defense_related: Boolean(input.defense_related),
    weapons_related: Boolean(input.weapons_related),
    evidence_refs: normalizeArray(input.evidence_refs)
  };
  return { procurement_request_id: input.procurement_request_id || stableId('proc', base), ...base };
}

function buildProcurementBrief(request, decision, vendorRiskMatrix) {
  const missingInformation = [];
  if (request.estimated_cost === null) missingInformation.push('estimated_cost');
  if (!request.budget_owner && request.intent !== 'research') missingInformation.push('budget_owner');
  if (request.vendors.length === 0) missingInformation.push('vendor_options');
  if (request.contract_required && !request.legal_compliance_review_id) missingInformation.push('legal_compliance_review');

  return {
    procurement_brief_id: stableId('procbrief', {
      procurement_request_id: request.procurement_request_id,
      decision,
      vendorRiskMatrix
    }),
    procurement_request_id: request.procurement_request_id,
    repository: request.repository,
    summary: request.summary,
    intent: request.intent,
    risk_level: decision.risk,
    budget_band: decision.budget_band,
    estimated_cost: request.estimated_cost,
    currency: request.currency,
    budget_owner: request.budget_owner,
    required_approver_roles: decision.approvals,
    blocked: decision.blocked,
    block_reasons: decision.blockReasons,
    missing_information: missingInformation,
    vendor_risk_matrix: vendorRiskMatrix,
    recommendation: decision.blocked
      ? 'stop_and_escalate_to_legal_compliance'
      : decision.requiresHumanApproval
        ? 'prepare_human_approval_packet'
        : 'continue_research_only',
    autonomous_spend_allowed: false,
    autonomous_vendor_award_allowed: false,
    external_side_effect_executed: false
  };
}

function buildProcurementWorkflow(input) {
  const request = normalizeProcurementRequest(input);
  const decision = classifyProcurementRequest(request, input.thresholds || DEFAULT_PROCUREMENT_THRESHOLDS);
  const vendorRiskMatrix = buildVendorRiskMatrix(request.vendors.map((vendor) => ({
    ...vendor,
    data_access: vendor.data_access ?? request.data_access,
    system_access: vendor.system_access ?? request.system_access,
    sole_source: vendor.sole_source ?? request.sole_source,
    cross_border: vendor.cross_border ?? request.cross_border
  })));
  const brief = buildProcurementBrief(request, decision, vendorRiskMatrix);
  const workflow = buildTaskApprovalWorkflow({
    registry: input.registry,
    objective: request.summary,
    repository: request.repository,
    affectedRepositories: [request.repository],
    action: {
      type: decision.actionType,
      summary: `${request.intent} procurement request: ${request.summary}`
    },
    actionType: decision.actionType,
    policyDecision: decision,
    requestedBy: 'procurement-oversight-agent',
    requestedOutputs: ['procurement_brief', 'vendor_risk_matrix', 'approval_packet', 'audit_summary'],
    validationRequirements: [
      'confirm budget owner before commitment',
      'confirm procurement and finance approvals before vendor award or spend',
      'confirm legal/compliance review when contracts or regulated domains apply',
      'confirm security review when vendor data or system access applies'
    ],
    evidenceBundle: {
      policy_version: '0.2.0',
      procurement_request_id: request.procurement_request_id,
      procurement_brief_id: brief.procurement_brief_id,
      evidence_refs: request.evidence_refs,
      vendor_risk_matrix: vendorRiskMatrix
    },
    expectedOutcome: 'Decision support and approval packet only. No vendor award, contract signature, payment, purchase order, or spend is executed.',
    rollbackPlan: 'Reject or expire the approval packet, stop the procurement route, and preserve the audit record.',
    constraints: {
      allowed_actions: ['research', 'compare_vendors', 'prepare_approval_packet'],
      forbidden_actions: ['vendor_award', 'contract_signature', 'payment', 'purchase_order', 'commit_spend', 'controlled_goods_procurement']
    },
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
    costImpact: request.estimated_cost,
    customerSupplierImpact: 'No supplier commitment or communication is sent by this workflow.'
  });

  return {
    workflow: 'procurement_oversight',
    mode: 'dry-run',
    procurement_request: request,
    policy_decision: decision,
    procurement_brief: brief,
    vendor_risk_matrix: vendorRiskMatrix,
    task_workflow: workflow,
    external_side_effects_executed: false
  };
}

module.exports = { normalizeProcurementRequest, buildProcurementBrief, buildProcurementWorkflow };
