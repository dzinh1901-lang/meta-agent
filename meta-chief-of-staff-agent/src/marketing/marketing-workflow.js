'use strict';

const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');
const { buildTaskApprovalWorkflow } = require('../packet-workflow');
const { classifyMarketingRequest } = require('./marketing-policy');

function normalizeClaim(claim, index) {
  if (!claim || typeof claim !== 'object') throw new Error(`claims[${index}] must be an object.`);
  const text = requireNonEmptyString(claim.text, `claims[${index}].text`);
  return {
    claim_id: claim.claim_id || stableId('claim', { text, index }),
    text,
    evidence_refs: normalizeArray(claim.evidence_refs),
    regulated: Boolean(claim.regulated),
    requires_legal_review: Boolean(claim.requires_legal_review)
  };
}

function normalizeMarketingRequest(input) {
  const repository = requireNonEmptyString(input.repository, 'repository');
  const summary = requireNonEmptyString(input.summary, 'summary');
  const intent = input.intent || 'plan';
  const claims = normalizeArray(input.claims).map(normalizeClaim);
  const channels = normalizeArray(input.channels).map(String);
  const attributionEvents = normalizeArray(input.attribution_events).map(String);
  const budget = Number.isFinite(input.budget) ? input.budget : null;
  const base = {
    repository,
    summary,
    intent,
    audience: input.audience || null,
    channels,
    claims,
    landing_url: input.landing_url || null,
    utm: {
      source: input.utm && input.utm.source ? input.utm.source : null,
      medium: input.utm && input.utm.medium ? input.utm.medium : null,
      campaign: input.utm && input.utm.campaign ? input.utm.campaign : null,
      content: input.utm && input.utm.content ? input.utm.content : null,
      term: input.utm && input.utm.term ? input.utm.term : null
    },
    attribution_events: attributionEvents,
    budget,
    currency: String(input.currency || 'USD').toUpperCase(),
    budget_owner: input.budget_owner || null,
    privacy_review_id: input.privacy_review_id || null,
    legal_review_id: input.legal_review_id || null,
    recipient_basis: input.recipient_basis || null,
    unsubscribe_mechanism: input.unsubscribe_mechanism || null,
    tracking_enabled: Boolean(input.tracking_enabled),
    personal_data_use: Boolean(input.personal_data_use),
    regulated_claims: Boolean(input.regulated_claims),
    fabricate_evidence: Boolean(input.fabricate_evidence),
    bypass_privacy_review: Boolean(input.bypass_privacy_review),
    impersonation: Boolean(input.impersonation),
    evidence_refs: normalizeArray(input.evidence_refs)
  };
  return { marketing_request_id: input.marketing_request_id || stableId('marketing', base), ...base };
}

function buildCampaignBrief(request, decision) {
  const claimsReview = decision.claims_review;
  const attribution = decision.attribution_readiness;
  const missingInformation = [];
  if (!request.audience && ['public_publish', 'customer_outreach', 'paid_campaign'].includes(request.intent)) missingInformation.push('audience');
  if (request.channels.length === 0 && ['public_publish', 'customer_outreach', 'paid_campaign'].includes(request.intent)) missingInformation.push('channels');
  if (request.intent === 'paid_campaign' && request.budget === null) missingInformation.push('budget');
  if (request.intent === 'paid_campaign' && !request.budget_owner) missingInformation.push('budget_owner');
  if (request.intent === 'customer_outreach' && !request.recipient_basis) missingInformation.push('recipient_basis');

  const recommendation = decision.blocked
    ? decision.hard_block_reasons && decision.hard_block_reasons.length
      ? 'stop_and_escalate_policy_review'
      : 'request_changes_before_approval'
    : decision.requiresHumanApproval
      ? 'prepare_human_approval_packet'
      : 'continue_internal_planning';

  const base = {
    marketing_request_id: request.marketing_request_id,
    repository: request.repository,
    summary: request.summary,
    intent: request.intent,
    audience: request.audience,
    channels: request.channels,
    risk_level: decision.risk,
    required_approver_roles: decision.approvals,
    blocked: decision.blocked,
    block_reasons: decision.blockReasons,
    hard_block_reasons: decision.hard_block_reasons || [],
    readiness_block_reasons: decision.readiness_block_reasons || [],
    missing_information: Array.from(new Set(missingInformation)),
    claims_review: claimsReview,
    attribution_readiness: attribution,
    budget: request.budget,
    currency: request.currency,
    budget_owner: request.budget_owner,
    privacy_review_id: request.privacy_review_id,
    legal_review_id: request.legal_review_id,
    recommendation,
    publication_authorized: false,
    outreach_authorized: false,
    paid_spend_authorized: false,
    external_side_effect_executed: false
  };
  return { campaign_brief_id: stableId('campaign', base), ...base };
}

function buildMarketingWorkflow(input) {
  const request = normalizeMarketingRequest(input);
  const decision = classifyMarketingRequest(request);
  const brief = buildCampaignBrief(request, decision);
  const workflow = buildTaskApprovalWorkflow({
    registry: input.registry,
    objective: request.summary,
    repository: request.repository,
    affectedRepositories: [request.repository],
    action: { type: decision.actionType, summary: `${request.intent} marketing request: ${request.summary}` },
    actionType: decision.actionType,
    policyDecision: decision,
    requestedBy: 'marketing-oversight-agent',
    requestedOutputs: ['campaign_brief', 'claims_review', 'attribution_readiness', 'approval_packet', 'audit_summary'],
    validationRequirements: [
      'every external claim must link to evidence',
      'public publication and outreach require marketing and principal approval',
      'paid media requires marketing, finance, and principal approval',
      'tracking and personal data require privacy review',
      'regulated claims require legal/compliance review'
    ],
    evidenceBundle: {
      policy_version: '0.3.0',
      marketing_request_id: request.marketing_request_id,
      campaign_brief_id: brief.campaign_brief_id,
      evidence_refs: request.evidence_refs,
      claims_review: brief.claims_review,
      attribution_readiness: brief.attribution_readiness
    },
    expectedOutcome: 'Campaign planning and approval artifacts only. No publication, outreach, or paid spend is executed.',
    rollbackPlan: 'Reject or expire the approval packet, stop the campaign route, and preserve the audit record.',
    constraints: {
      allowed_repository: request.repository,
      allowed_action_type: decision.actionType,
      allowed_intent: request.intent,
      allowed_channels: request.channels,
      maximum_budget: request.budget,
      currency: request.currency,
      execution_authorized: false,
      forbidden_actions: ['publish', 'send_outreach', 'commit_paid_spend', 'fabricate_claim_evidence', 'bypass_privacy_review']
    },
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
    costImpact: request.budget,
    customerSupplierImpact: request.intent === 'customer_outreach' ? 'Potential recipient impact requires human approval and privacy controls.' : 'No external message is sent by this workflow.'
  });

  return {
    workflow: 'marketing_oversight',
    mode: 'dry-run',
    marketing_request: request,
    policy_decision: decision,
    campaign_brief: brief,
    task_workflow: workflow,
    external_side_effects_executed: false
  };
}

module.exports = { normalizeClaim, normalizeMarketingRequest, buildCampaignBrief, buildMarketingWorkflow };
