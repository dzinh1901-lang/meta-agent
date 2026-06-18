'use strict';

const { classifyAction } = require('../policy-engine');
const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');

function requireAmount(value, fieldName) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return value;
}

function buildBudgetReview(input) {
  const repository = requireNonEmptyString(input.repository, 'repository');
  const summary = requireNonEmptyString(input.summary, 'summary');
  const currency = String(input.currency || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be a three-letter uppercase code.');

  const approvedBudget = requireAmount(input.approved_budget, 'approved_budget');
  const spentToDate = requireAmount(input.spent_to_date || 0, 'spent_to_date');
  const committedAmount = requireAmount(input.committed_amount || 0, 'committed_amount');
  const requestedAmount = requireAmount(input.requested_amount, 'requested_amount');
  const projectedTotal = spentToDate + committedAmount + requestedAmount;
  const remainingAfterRequest = approvedBudget - projectedTotal;
  const overBudgetAmount = Math.max(0, projectedTotal - approvedBudget);

  const actionType = input.billing_activation ? 'activate_live_billing' : 'approve_budget_change';
  const baseDecision = classifyAction(actionType);
  const blockReasons = [];
  if (!input.budget_owner) blockReasons.push('A budget owner is required.');
  if (!input.purpose) blockReasons.push('A business purpose is required.');
  if (requestedAmount <= 0) blockReasons.push('A positive requested amount is required.');
  if (input.billing_activation && !input.security_review_id) blockReasons.push('A security review reference is required before billing activation review.');
  if (overBudgetAmount > 0 && !input.exception_reason) blockReasons.push('An exception reason is required when projected spend exceeds the approved budget.');

  const approvals = Array.from(new Set([
    ...baseDecision.approvals,
    'finance_approver',
    ...(overBudgetAmount > 0 || requestedAmount >= approvedBudget * 0.25 ? ['principal_approver'] : [])
  ]));
  const risk = input.billing_activation || overBudgetAmount > 0 ? 'critical' : requestedAmount >= 10000 ? 'high' : 'medium';
  const blocked = blockReasons.length > 0;
  const decision = {
    ...baseDecision,
    actionType,
    risk,
    approvals,
    allowed: false,
    blocked,
    requiresHumanApproval: !blocked,
    category: input.billing_activation ? 'billing' : 'finance',
    effect: input.billing_activation ? 'production_path' : 'commitment',
    reason: blocked ? blockReasons.join(' ') : 'Finance review requires scoped human authorization.',
    blockReasons
  };

  const base = {
    repository,
    summary,
    currency,
    approved_budget: approvedBudget,
    spent_to_date: spentToDate,
    committed_amount: committedAmount,
    requested_amount: requestedAmount,
    projected_total: projectedTotal,
    remaining_after_request: remainingAfterRequest,
    over_budget_amount: overBudgetAmount,
    recurring: Boolean(input.recurring),
    billing_activation: Boolean(input.billing_activation),
    budget_owner: input.budget_owner || null,
    purpose: input.purpose || null,
    exception_reason: input.exception_reason || null,
    security_review_id: input.security_review_id || null,
    evidence_refs: normalizeArray(input.evidence_refs),
    policy_decision: decision,
    required_approver_roles: approvals,
    blocked,
    block_reasons: blockReasons,
    autonomous_payment_allowed: false,
    autonomous_billing_activation_allowed: false,
    external_side_effect_executed: false
  };

  return { budget_review_id: stableId('budget', base), ...base };
}

module.exports = { requireAmount, buildBudgetReview };
