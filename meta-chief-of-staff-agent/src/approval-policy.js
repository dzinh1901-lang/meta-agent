'use strict';

const { classifyAction, approvalActions, approvalRoles, approvalCoversAction } = require('./policy-engine');

function validateApprovalDecision({ actionType, context = {}, approval = null, scope = {} }) {
  const decision = classifyAction(actionType, context);
  const approvalRequired = !decision.blocked && decision.requiresHumanApproval;
  const approved = approvalCoversAction(decision, approval, scope);
  const errors = [];

  if (decision.blocked) {
    errors.push(...decision.blockReasons);
    return {
      actionType,
      approvalRequired: false,
      approved: false,
      executable: false,
      policyDecision: decision,
      errors
    };
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
  if (approval) {
    const expiryMs = Date.parse(approval.expires_at);
    if (typeof approval.expires_at !== 'string' || Number.isNaN(expiryMs)) errors.push('Approval expiry is invalid.');
    else if (expiryMs <= Date.now()) errors.push('Approval has expired.');
  }
  if (approval && !approvalActions(approval).includes(actionType)) errors.push('Approval does not cover requested action.');
  if (approval && Array.isArray(decision.approvals)) {
    const roles = approvalRoles(approval);
    for (const requiredRole of decision.approvals) {
      if (!roles.includes(requiredRole)) errors.push(`Missing required approver role: ${requiredRole}`);
    }
  }
  if (approval && scope.repository) {
    const constraints = approval.constraints || {};
    const allowedRepositories = approval.allowed_repositories || constraints.allowed_repositories || (constraints.allowed_repository ? [constraints.allowed_repository] : null);
    if (Array.isArray(allowedRepositories) && !allowedRepositories.includes(scope.repository)) errors.push(`Approval does not cover repository: ${scope.repository}`);
  }
  if (approval && scope.environment && approval.constraints && approval.constraints.target_environment && approval.constraints.target_environment !== scope.environment) {
    errors.push(`Approval does not cover environment: ${scope.environment}`);
  }

  return {
    actionType,
    approvalRequired,
    approved,
    executable: approved,
    policyDecision: decision,
    errors
  };
}

module.exports = { validateApprovalDecision };
