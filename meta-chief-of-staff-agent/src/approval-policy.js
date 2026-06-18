'use strict';

const { classifyAction, approvalCoversAction } = require('./policy-engine');

function validateApprovalDecision({ actionType, context = {}, approval = null }) {
  const decision = classifyAction(actionType, context);
  const approvalRequired = decision.requiresHumanApproval || decision.blocked;
  const approved = approvalCoversAction(decision, approval);
  const errors = [];

  if (decision.blocked) {
    errors.push(...decision.blockReasons);
  }

  if (!approvalRequired) {
    return {
      actionType,
      approvalRequired,
      approved: false,
      executable: decision.allowed,
      policyDecision: decision,
      errors
    };
  }

  if (!approval) errors.push('Missing approval decision.');
  if (approval && approval.status !== 'approved') errors.push('Approval status is not approved.');
  if (approval && approval.expires_at && Date.parse(approval.expires_at) <= Date.now()) errors.push('Approval has expired.');
  if (approval && Array.isArray(approval.approved_actions) && !approval.approved_actions.includes(actionType)) errors.push('Approval does not cover requested action.');
  if (approval && !Array.isArray(approval.approved_actions)) errors.push('Approval must define approved_actions.');
  if (approval && Array.isArray(decision.approvals)) {
    const roles = approval.approver_roles || [];
    for (const requiredRole of decision.approvals) {
      if (!roles.includes(requiredRole)) errors.push(`Missing required approver role: ${requiredRole}`);
    }
  }

  return {
    actionType,
    approvalRequired,
    approved,
    executable: approved && !decision.blocked,
    policyDecision: decision,
    errors
  };
}

module.exports = { validateApprovalDecision };
