'use strict';

const { classifyAction, approvalCoversAction } = require('./policy-engine');

function evaluateToolGuardrail({ actionType, context = {}, approval = null }) {
  const decision = classifyAction(actionType, context);
  const approved = approvalCoversAction(decision, approval);

  if (decision.blocked) {
    return { allowed: false, requiresApproval: true, decision, reason: decision.reason };
  }
  if (decision.requiresHumanApproval && !approved) {
    return { allowed: false, requiresApproval: true, decision, reason: 'Human approval required before this tool can execute.' };
  }
  return {
    allowed: true,
    requiresApproval: false,
    decision,
    reason: approved ? 'Approved action within scoped approval.' : 'Read-only or low-risk action allowed.'
  };
}

function assertToolAllowed(input) {
  const result = evaluateToolGuardrail(input);
  if (!result.allowed) {
    const error = new Error(result.reason);
    error.guardrail = result;
    throw error;
  }
  return result;
}

module.exports = { evaluateToolGuardrail, assertToolAllowed };
