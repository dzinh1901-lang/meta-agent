'use strict';

const { loadRegistry, knownOrchestrators } = require('./repository-registry');
const { buildTaskApprovalWorkflow } = require('./packet-workflow');

function planAction(input) {
  const registry = loadRegistry();
  const repositories = Array.isArray(input.repositories) && input.repositories.length ? input.repositories : ['unknown'];
  const workflow = buildTaskApprovalWorkflow({
    registry,
    objective: input.action.summary,
    repository: repositories[0],
    affectedRepositories: repositories,
    action: input.action,
    actionType: input.action.type,
    context: input.context || {},
    requestedOutputs: input.requestedOutputs || ['project_health', 'validation_plan', 'approval_gaps', 'final_synthesis'],
    validationRequirements: input.validationRequirements || ['read-only evidence review', 'human approval before gated execution'],
    requestedBy: 'meta-chief-of-staff-agent',
    evidenceBundle: input.evidenceBundle || { policy_version: '0.2.0', registry: 'registries/repositories.seed.json' },
    expectedOutcome: input.expectedOutcome,
    rollbackPlan: input.rollbackPlan,
    constraints: input.constraints,
    expiresAt: input.expiresAt,
    costImpact: input.costImpact,
    customerSupplierImpact: input.customerSupplierImpact
  });

  return {
    agent: 'meta-chief-of-staff-agent',
    mode: 'dry-run',
    action: input.action,
    policy_decision: workflow.policy_decision,
    known_orchestrators: knownOrchestrators(registry).map((repo) => ({
      repository: repo.repository_full_name,
      orchestrator_path: repo.orchestrator.path
    })),
    task_packet: workflow.task_packet,
    approval_packet: workflow.approval_packet,
    pending_approval: workflow.pending_approval,
    agent_run: workflow.agent_run,
    next_steps: workflow.next_steps
  };
}

module.exports = { planAction };
