'use strict';

const { classifyAction } = require('./policy-engine');
const { loadRegistry, knownOrchestrators } = require('./repository-registry');
const { createTaskPacket, createApprovalPacket } = require('./phase3-tools');

function planAction(input) {
  const registry = loadRegistry();
  const policyDecision = classifyAction(input.action.type, input.context || {});
  const firstRepository = (input.repositories && input.repositories[0]) || 'dzinh1901-lang/aurelean-app';
  const packet = createTaskPacket({
    objective: input.action.summary || 'Portfolio execution task',
    repository: firstRepository,
    actionType: input.action.type,
    actionSummary: input.action.summary,
    context: input.context || {},
    requestedOutputs: ['project_health', 'validation_plan', 'approval_gaps', 'final_synthesis'],
    validationRequirements: input.validationRequirements || ['npm run validate'],
    evidenceBundle: input.evidenceBundle,
    expectedOutcome: input.expectedOutcome || 'Scoped, approval-gated execution only.',
    rollbackPlan: input.rollbackPlan || 'Stop run, discard generated changes, and preserve audit record.',
    constraints: input.constraints || { forbidden_actions: ['self_approve', 'bypass_orchestrator', 'access_secrets'] },
    expiresAt: input.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  });
  const policyApproval = createApprovalPacket({
    action: input.action,
    repositories: input.repositories || [],
    context: input.context || {},
    requestingAgent: 'meta-chief-of-staff-agent',
    evidenceBundle: input.evidenceBundle || { policy_version: '0.1.0', registry: 'registries/repositories.seed.json' },
    expectedOutcome: input.expectedOutcome || 'Scoped, approval-gated execution only.',
    rollbackPlan: input.rollbackPlan || 'Stop run, discard generated changes, and preserve audit record.',
    constraints: input.constraints || { forbidden_actions: ['self_approve', 'bypass_orchestrator', 'access_secrets'] },
    expiresAt: input.expiresAt || '2026-06-18T00:00:00Z'
  });

  const plan = {
    agent: 'meta-chief-of-staff-agent',
    mode: 'dry-run',
    action: input.action,
    policy_decision: policyDecision,
    task_packet: packet.task_packet,
    run_state: packet.run_state,
    known_orchestrators: knownOrchestrators(registry).map((repo) => ({
      repository: repo.repository_full_name,
      orchestrator_path: repo.orchestrator.path
    })),
    needsApproval: packet.needsApproval,
    next_steps: []
  };

  if (packet.needsApproval) {
    plan.approval_packet = packet.approval_packet || policyApproval.approval_packet;
    plan.next_steps.push('Pause execution until a human approver resolves the approval packet.');
  } else {
    plan.next_steps.push('Proceed in dry-run/read-only mode and record evidence.');
  }

  return plan;
}
module.exports = { planAction };
