'use strict';

const { classifyAction } = require('./policy-engine');
const { buildApprovalPacket } = require('./approval-packet-builder');
const { loadRegistry, knownOrchestrators } = require('./repository-registry');

function planAction(input) {
  const registry = loadRegistry();
  const decision = classifyAction(input.action.type, input.context || {});
  const now = new Date();
  const expiryHoursByRisk = {
    low: 0,
    medium: 24 * 7,
    high: 24 * 3,
    critical: 24
  };
  const riskHours = expiryHoursByRisk[decision.risk] ?? 0;
  const expiresAt = decision.requiresHumanApproval
    ? new Date(now.getTime() + riskHours * 60 * 60 * 1000).toISOString()
    : (input.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
  const plan = {
    agent: 'meta-chief-of-staff-agent',
    mode: 'dry-run',
    action: input.action,
    policy_decision: decision,
    known_orchestrators: knownOrchestrators(registry).map((repo) => ({
      repository: repo.repository_full_name,
      orchestrator_path: repo.orchestrator.path
    })),
    next_steps: []
  };

  if (decision.requiresHumanApproval || !decision.allowed) {
    const approvalPacket = buildApprovalPacket({
      action: input.action,
      decision,
      repositories: input.repositories,
      requestingAgent: 'meta-chief-of-staff-agent',
      evidenceBundle: input.evidenceBundle || { policy_version: '0.1.0', registry: 'registries/repositories.seed.json' },
      expectedOutcome: input.expectedOutcome || 'Scoped, approval-gated execution only.',
      rollbackPlan: input.rollbackPlan || 'Stop run, discard generated changes, and preserve audit record.',
      constraints: input.constraints || { forbidden_actions: ['self_approve', 'bypass_orchestrator', 'access_secrets'] },
      expiresAt,
      costImpact: input.costImpact,
      customerSupplierImpact: input.customerSupplierImpact
    });
    plan.approval_packet = approvalPacket;
    plan.next_steps.push('Pause execution until a human approver resolves the approval packet.');
  } else {
    plan.next_steps.push('Proceed in dry-run/read-only mode and record evidence.');
  }

  return plan;
}

module.exports = { planAction };
