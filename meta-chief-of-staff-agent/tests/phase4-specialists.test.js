#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { loadRegistry } = require('../src/repository-registry');
const { reviewClaims, attributionReadiness, classifyMarketingRequest } = require('../src/marketing/marketing-policy');
const { buildMarketingWorkflow } = require('../src/marketing/marketing-workflow');
const { buildBudgetReview } = require('../src/finance/finance-review');
const { buildSecurityReview } = require('../src/security/security-review');

const registry = loadRegistry();

const claimsReview = reviewClaims([
  { claim_id: 'claim_supported', text: 'Documented product capability.', evidence_refs: ['evidence-001'] },
  { claim_id: 'claim_missing', text: 'Unsupported claim.', evidence_refs: [] }
]);
assert.equal(claimsReview.claim_count, 2);
assert.equal(claimsReview.supported_count, 1);
assert.equal(claimsReview.unsupported_count, 1);
assert.equal(claimsReview.all_supported, false);

const attribution = attributionReadiness({
  landing_url: 'https://example.com/campaign',
  utm: { source: 'newsletter', medium: 'email', campaign: 'launch' },
  attribution_events: ['landing_view', 'signup_completed']
});
assert.equal(attribution.ready, true);
assert.deepEqual(attribution.missing, []);

const blockedMarketingDecision = classifyMarketingRequest({
  intent: 'public_publish',
  audience: 'public',
  channels: ['website'],
  claims: [{ text: 'Unsupported public claim.', evidence_refs: [] }]
});
assert.equal(blockedMarketingDecision.blocked, true);
assert.equal(blockedMarketingDecision.requiresHumanApproval, false);
assert.ok(blockedMarketingDecision.readiness_block_reasons.some((reason) => reason.includes('claim')));

const planningWorkflow = buildMarketingWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Draft an internal campaign concept.',
  intent: 'plan',
  claims: [{ text: 'Draft claim pending evidence.', evidence_refs: [] }],
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(planningWorkflow.campaign_brief.blocked, false);
assert.equal(planningWorkflow.task_workflow.approval_packet, null);
assert.equal(planningWorkflow.task_workflow.agent_run.status, 'completed');
assert.equal(planningWorkflow.external_side_effects_executed, false);

const publishWorkflow = buildMarketingWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Prepare an evidence-backed public launch page.',
  intent: 'public_publish',
  audience: 'public product buyers',
  channels: ['website'],
  claims: [{ text: 'Documented product capability.', evidence_refs: ['evidence-001'] }],
  tracking_enabled: false,
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(publishWorkflow.campaign_brief.blocked, false);
assert.equal(publishWorkflow.task_workflow.agent_run.status, 'paused_for_approval');
assert.ok(publishWorkflow.task_workflow.approval_packet.required_approver_roles.includes('marketing_approver'));
assert.ok(publishWorkflow.task_workflow.approval_packet.required_approver_roles.includes('principal_approver'));
assert.equal(publishWorkflow.task_workflow.approval_packet.constraints.execution_authorized, false);

const paidWorkflow = buildMarketingWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Prepare a measured paid campaign.',
  intent: 'paid_campaign',
  audience: 'qualified textile buyers',
  channels: ['paid_search'],
  claims: [{ text: 'Documented sourcing workflow.', evidence_refs: ['evidence-002'] }],
  landing_url: 'https://example.com/sourcing',
  utm: { source: 'search', medium: 'cpc', campaign: 'sourcing_launch' },
  attribution_events: ['landing_view', 'rfq_started'],
  budget: 5000,
  currency: 'USD',
  budget_owner: 'portfolio_principal',
  privacy_review_id: 'privacy-review-001',
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
assert.equal(paidWorkflow.campaign_brief.blocked, false);
assert.equal(paidWorkflow.task_workflow.agent_run.status, 'paused_for_approval');
assert.ok(paidWorkflow.task_workflow.approval_packet.required_approver_roles.includes('finance_approver'));
assert.equal(paidWorkflow.task_workflow.approval_packet.constraints.maximum_budget, 5000);
assert.equal(paidWorkflow.campaign_brief.paid_spend_authorized, false);

const budgetReview = buildBudgetReview({
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Review analytics platform budget.',
  approved_budget: 20000,
  spent_to_date: 5000,
  committed_amount: 2000,
  requested_amount: 3000,
  currency: 'USD',
  budget_owner: 'portfolio_principal',
  purpose: 'Read-only analytics tooling',
  evidence_refs: ['budget-plan-001']
});
assert.equal(budgetReview.blocked, false);
assert.equal(budgetReview.projected_total, 10000);
assert.equal(budgetReview.remaining_after_request, 10000);
assert.equal(budgetReview.policy_decision.requiresHumanApproval, true);
assert.equal(budgetReview.autonomous_payment_allowed, false);

const overBudgetReview = buildBudgetReview({
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Review over-budget request.',
  approved_budget: 10000,
  spent_to_date: 9000,
  requested_amount: 3000,
  currency: 'USD',
  budget_owner: 'portfolio_principal',
  purpose: 'Additional software capacity'
});
assert.equal(overBudgetReview.blocked, true);
assert.equal(overBudgetReview.over_budget_amount, 2000);
assert.ok(overBudgetReview.block_reasons.some((reason) => reason.includes('exception reason')));

const readSecurityReview = buildSecurityReview({
  repository: 'dzinh1901-lang/aurelean-app',
  action_type: 'read_repository_metadata',
  environment: 'non-production',
  evidence: {}
});
assert.equal(readSecurityReview.hard_blocked, false);
assert.equal(readSecurityReview.readiness_blocked, false);
assert.equal(readSecurityReview.executable, true);

const deploymentSecurityReview = buildSecurityReview({
  repository: 'dzinh1901-lang/aurelean-app',
  action_type: 'deploy_production',
  environment: 'production',
  evidence: {}
});
assert.equal(deploymentSecurityReview.hard_blocked, false);
assert.equal(deploymentSecurityReview.readiness_blocked, true);
assert.ok(deploymentSecurityReview.missing_evidence.includes('rollback_plan'));
assert.ok(deploymentSecurityReview.missing_evidence.includes('production_change_id'));

const secretSecurityReview = buildSecurityReview({
  repository: 'dzinh1901-lang/aurelean-app',
  action_type: 'request_secret_access',
  environment: 'non-production',
  requests_secrets: true,
  evidence: {}
});
assert.equal(secretSecurityReview.hard_blocked, true);
assert.equal(secretSecurityReview.executable, false);
assert.equal(secretSecurityReview.recommendation, 'block_and_escalate_policy_review');

console.log(JSON.stringify({ ok: true, suite: 'phase4-specialists', assertions: 49 }, null, 2));
