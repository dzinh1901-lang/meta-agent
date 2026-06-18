'use strict';

const { classifyAction } = require('../policy-engine');
const { normalizeArray } = require('../packet-utils');

const INTENT_TO_ACTION = {
  plan: 'create_internal_plan',
  claims_review: 'create_internal_plan',
  public_publish: 'publish_public_marketing',
  customer_outreach: 'send_external_message',
  paid_campaign: 'commit_paid_marketing_spend'
};

const EXTERNAL_INTENTS = new Set(['public_publish', 'customer_outreach', 'paid_campaign']);

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function reviewClaims(claims) {
  const reviewed = normalizeArray(claims).map((claim) => {
    const evidenceRefs = normalizeArray(claim.evidence_refs);
    const supported = evidenceRefs.length > 0;
    return {
      claim_id: claim.claim_id || null,
      text: claim.text,
      supported,
      evidence_refs: evidenceRefs,
      regulated: Boolean(claim.regulated),
      requires_legal_review: Boolean(claim.requires_legal_review || claim.regulated),
      status: supported ? 'supported' : 'unsupported'
    };
  });
  return {
    claims: reviewed,
    claim_count: reviewed.length,
    supported_count: reviewed.filter((claim) => claim.supported).length,
    unsupported_count: reviewed.filter((claim) => !claim.supported).length,
    regulated_count: reviewed.filter((claim) => claim.regulated).length,
    all_supported: reviewed.every((claim) => claim.supported)
  };
}

function attributionReadiness(request) {
  const missing = [];
  const utm = request.utm || {};
  if (!request.landing_url) missing.push('landing_url');
  if (!utm.source) missing.push('utm.source');
  if (!utm.medium) missing.push('utm.medium');
  if (!utm.campaign) missing.push('utm.campaign');
  if (normalizeArray(request.attribution_events).length === 0) missing.push('attribution_events');
  return {
    ready: missing.length === 0,
    missing,
    utm,
    attribution_events: normalizeArray(request.attribution_events)
  };
}

function hardBlockReasons(request) {
  const reasons = [];
  if (request.fabricate_evidence) reasons.push('Fabricating claim evidence is prohibited.');
  if (request.bypass_privacy_review) reasons.push('Bypassing privacy review is prohibited.');
  if (request.impersonation) reasons.push('Deceptive impersonation is prohibited.');
  return unique(reasons);
}

function marketingReadinessReasons(request, claimsReview, attribution) {
  const reasons = [];
  const intent = request.intent || 'plan';

  if (Number.isFinite(request.budget) && request.budget < 0) reasons.push('Campaign budget cannot be negative.');

  if (EXTERNAL_INTENTS.has(intent)) {
    if (!request.audience) reasons.push('An audience definition is required before external activity.');
    if (normalizeArray(request.channels).length === 0) reasons.push('At least one channel is required before external activity.');
    if (!claimsReview.all_supported) reasons.push('Every external marketing claim must have evidence.');
  }

  if (intent === 'public_publish') {
    if (request.tracking_enabled && !request.privacy_review_id) reasons.push('A privacy review reference is required when publication includes tracking.');
  }

  if (intent === 'customer_outreach') {
    if (!request.recipient_basis) reasons.push('A lawful recipient basis is required before customer or supplier outreach.');
    if (!request.privacy_review_id) reasons.push('A privacy review reference is required before customer or supplier outreach.');
    if (!request.unsubscribe_mechanism) reasons.push('An unsubscribe or opt-out mechanism is required before outreach.');
  }

  if (intent === 'paid_campaign') {
    if (!Number.isFinite(request.budget) || request.budget <= 0) reasons.push('A positive campaign budget is required before paid media approval.');
    if (!request.budget_owner) reasons.push('A budget owner is required before paid media approval.');
    if (!request.privacy_review_id) reasons.push('A privacy review reference is required before paid media approval.');
    reasons.push(...attribution.missing.map((field) => `Attribution readiness is missing: ${field}.`));
  }

  const legalReviewRequired = request.regulated_claims || claimsReview.claims.some((claim) => claim.requires_legal_review);
  if (EXTERNAL_INTENTS.has(intent) && legalReviewRequired && !request.legal_review_id) {
    reasons.push('A legal/compliance review reference is required for regulated or legally sensitive claims.');
  }

  return unique(reasons);
}

function classifyMarketingRequest(request) {
  const intent = request.intent || 'plan';
  const actionType = INTENT_TO_ACTION[intent];
  if (!actionType) {
    return {
      actionType: 'unknown_marketing_action',
      risk: 'critical',
      approvals: ['principal_approver', 'marketing_approver'],
      allowed: false,
      blocked: true,
      requiresHumanApproval: false,
      category: 'marketing',
      effect: 'unknown',
      reason: 'Unknown marketing intent. Policy fails closed.',
      blockReasons: ['Unknown marketing intent. Policy fails closed.'],
      hard_block_reasons: ['Unknown marketing intent. Policy fails closed.'],
      readiness_block_reasons: []
    };
  }

  const base = classifyAction(actionType);
  const claimsReview = reviewClaims(request.claims);
  const attribution = attributionReadiness(request);
  const hardBlocks = hardBlockReasons(request);
  const readinessBlocks = marketingReadinessReasons(request, claimsReview, attribution);
  const blockReasons = unique([...hardBlocks, ...readinessBlocks]);
  const approvals = [...base.approvals];
  let risk = base.risk;

  if (intent === 'plan' || intent === 'claims_review') {
    risk = 'medium';
  }
  if (request.regulated_claims || claimsReview.claims.some((claim) => claim.requires_legal_review)) {
    approvals.push('legal_compliance_approver');
    if (EXTERNAL_INTENTS.has(intent)) risk = 'critical';
  }
  if (request.personal_data_use) {
    approvals.push('security_approver', 'legal_compliance_approver');
    if (EXTERNAL_INTENTS.has(intent)) risk = 'critical';
  }

  const blocked = blockReasons.length > 0;
  const requiredApprovals = unique(approvals);
  const requiresHumanApproval = !blocked && (EXTERNAL_INTENTS.has(intent) || risk === 'high' || risk === 'critical' || requiredApprovals.length > 0);

  return {
    ...base,
    actionType,
    risk,
    approvals: requiredApprovals,
    allowed: !blocked && !requiresHumanApproval,
    blocked,
    requiresHumanApproval,
    category: 'marketing',
    effect: intent === 'plan' || intent === 'claims_review' ? 'derive' : intent === 'paid_campaign' ? 'spend' : 'external_send',
    reason: blocked ? blockReasons.join(' ') : 'Classified by marketing oversight policy.',
    blockReasons,
    hard_block_reasons: hardBlocks,
    readiness_block_reasons: readinessBlocks,
    claims_review: claimsReview,
    attribution_readiness: attribution
  };
}

module.exports = {
  INTENT_TO_ACTION,
  EXTERNAL_INTENTS,
  reviewClaims,
  attributionReadiness,
  hardBlockReasons,
  marketingReadinessReasons,
  classifyMarketingRequest
};
