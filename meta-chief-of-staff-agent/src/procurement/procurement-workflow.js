'use strict';

const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');
const { buildTaskApprovalWorkflow } = require('../packet-workflow');
const { classifyProcurementRequest, buildVendorRiskMatrix, DEFAULT_PROCUREMENT_THRESHOLDS } = require('./procurement-policy');

function normalizeVendor(vendor, index, repository) {
  const vendorName = requireNonEmptyString(vendor.vendor_name, `vendors[${index}].vendor_name`);
  const base = {
    repository,
    vendor_name: vendorName,
    index,
    data_access: Boolean(vendor.data_access),
    system_access: Boolean(vendor.system_access),
    sole_source: Boolean(vendor.sole_source),
    cross_border: Boolean(vendor.cross_border)
  };
  return {
    vendor_id: vendor.vendor_id || stableId('vendor', base),
    vendor_name: vendorName,
    data_access: Boolean(vendor.data_access),
    system_access: Boolean(vendor.system_access),
    security_review_status: vendor.security_review_status || 'not_started',
    legal_review_status: vendor.legal_review_status || 'not_started',
    sole_source: Boolean(vendor.sole_source),
    cross_border: Boolean(vendor.cross_border),
    evidence_refs: normalizeArray(vendor.evidence_refs)
  };
}

function normalizeProcurementRequest(input) {
  const repository = requireNonEmptyString(input.repository, 'repository');
  const summary = requireNonEmptyString(input.summary, 'summary');
  const intent = input.intent || 'research';
  const vendors = normalizeArray(input.vendors).map((vendor, index) => normalizeVendor(vendor, index, repository));
  const base = {
    repository,
    summary,
    intent,
    category: input.category || 'general_services',
    estimated_cost: Number.isFinite(input.estimated_cost) ? input.estimated_cost : null,
    currency: String(input.currency || DEFAULT_PROCUREMENT_THRESHOLDS.currency).toUpperCase(),
    budget_owner: input.budget_owner || null,
    vendors,
    selected_vendor_id: input.selected_vendor_id || null,
    contract_required: Boolean(input.contract_required || intent === 'contract'),
    data_access: Boolean(input.data_access),
    system_access: Boolean(input.system_access),
    sole_source: Boolean(input.sole_source),
    cross_border: Boolean(input.cross_border),
    regulated_domain: Boolean(input.regulated_domain),
    administrative_review_only: Boolean(input.administrative_review_only),
    legal_compliance_review_id: input.legal_compliance_review_id || null,
    security_review_id: input.security_review_id || null,
    contract_id: input.contract_id || null,
    purchase_order_id: input.purchase_order_id || null,
    controlled_goods: Boolean(input.controlled_goods),
    defense_related: Boolean(input.defense_related),
    weapons_related: Boolean(input.weapons_related),
    evidence_refs: normalizeArray(input.evidence_refs)
  };
  return { procurement_request_id: input.procurement_request_id || stableId('proc', base), ...base };
}

function buildProcurementBrief(request, decision, vendorRiskMatrix) {
  const missingInformation = [];
  if (request.estimated_cost === null || request.estimated_cost <= 0) missingInformation.push('estimated_cost');
  if (!request.budget_owner && request.intent !== 'research') missingInformation.push('budget_owner');
  if (request.vendors.length === 0) missingInformation.push('vendor_options');
  if ((request.contract_required || request.intent === 'contract' || request.cross_border || request.regulated_domain) && !request.legal_compliance_review_id) missingInformation.push('legal_compliance_review_id');
  if ((request.data_access || request.system_access) && !request.security_review_id) missingInformation.push('security_review_id');
  if (['award', 'contract', 'payment'].includes(request.intent) && !request.selected_vendor_id) missingInformation.push('selected_vendor_id');
  if (request.intent === 'payment' && !request.contract_id && !request.purchase_order_id) missingInformation.push('contract_id_or_purchase_order_id');

  const recommendation = decision.blocked
    ? decision.hard_block_reasons && decision.hard_block_reasons.length
      ? 'stop_and_escalate_to_legal_compliance'
      : 'request_changes_before_approval'
    : decision.requiresHumanApproval
      ? 'prepare_human_approval_packet'
      : 'continue_research_only';

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
    selected_vendor_id: request.selected_vendor_id,
    required_approver_roles: decision.approvals,
    blocked: decision.blocked,
    block_reasons: decision.blockReasons,
    hard_block_reasons: decision.hard_block_reasons || [],
    readiness_block_reasons: decision.readiness_block_reasons || [],
    missing_information: Array.from(new Set(missingInformation)),
    vendor_risk_matrix: vendorRiskMatrix,
    recommendation,
    approval_scope: {
      repository: request.repository,
      action_type: decision.actionType,
      intent: request.intent,
      maximum_budget: request.estimated_cost,
      currency: request.currency,
      allowed_vendor_ids: request.vendors.map((vendor) => vendor.vendor_id),
      selected_vendor_id: request.selected_vendor_id
    },
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
    data_access: vendor.data_access || request.data_access,
    system_access: vendor.system_access || request.system_access,
    sole_source: vendor.sole_source || request.sole_source,
    cross_border: vendor.cross_border || request.cross_border
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
      'confirm budget owner before procurement decisions',
      'confirm procurement and finance approvals before vendor award or spend',
      'confirm legal/compliance review when contracts, cross-border activity, or regulated domains apply',
      'confirm security review when vendor data or system access applies',
      'confirm selected vendor and payment basis before commitment'
    ],
    evidenceBundle: {
      policy_version: '0.3.0',
      procurement_request_id: request.procurement_request_id,
      procurement_brief_id: brief.procurement_brief_id,
      evidence_refs: request.evidence_refs,
      vendor_risk_matrix: vendorRiskMatrix,
      missing_information: brief.missing_information
    },
    expectedOutcome: 'Decision support and approval artifacts only. No vendor award, contract signature, payment, purchase order, or spend is executed.',
    rollbackPlan: 'Reject or expire the approval packet, stop the procurement route, and preserve the audit record.',
    constraints: {
      allowed_repository: request.repository,
      allowed_action_type: decision.actionType,
      allowed_intent: request.intent,
      maximum_budget: request.estimated_cost,
      currency: request.currency,
      allowed_vendor_ids: request.vendors.map((vendor) => vendor.vendor_id),
      selected_vendor_id: request.selected_vendor_id,
      execution_authorized: false,
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

module.exports = { normalizeVendor, normalizeProcurementRequest, buildProcurementBrief, buildProcurementWorkflow };
