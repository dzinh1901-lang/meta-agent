'use strict';

const { classifyAction } = require('../policy-engine');
const { loadRegistry } = require('../repository-registry');
const { stableId, normalizeArray, requireNonEmptyString } = require('../packet-utils');
const { buildTaskApprovalWorkflow } = require('../packet-workflow');
const { createOrchestratorAdapter } = require('./orchestrator-registry');
const { selectOversightAgent } = require('../oversight/oversight-registry');

function summarizeRoutes(routes) {
  const counts = {};
  for (const route of routes) {
    const status = route.dispatch.status;
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function buildPortfolioRoutingPlan(input) {
  const registry = input.registry || loadRegistry();
  const objective = requireNonEmptyString(input.objective, 'objective');
  const actionType = requireNonEmptyString(input.actionType || (input.action && input.action.type), 'actionType');
  const repositories = normalizeArray(input.repositories);
  if (repositories.length === 0) throw new Error('At least one repository is required.');
  const action = input.action || { type: actionType, summary: objective };
  const decision = input.policyDecision || classifyAction(actionType, input.context || {});
  const oversightAgent = selectOversightAgent(decision, objective);

  const routes = repositories.map((repository) => {
    const workflow = buildTaskApprovalWorkflow({
      registry,
      objective,
      repository,
      affectedRepositories: [repository],
      action,
      actionType,
      policyDecision: decision,
      context: input.context || {},
      requestedOutputs: input.requestedOutputs,
      validationRequirements: input.validationRequirements,
      requestedBy: input.requestedBy || 'meta-chief-of-staff-agent',
      evidenceBundle: input.evidenceBundle,
      evidenceRefs: input.evidenceRefs,
      expectedOutcome: input.expectedOutcome,
      rollbackPlan: input.rollbackPlan,
      constraints: input.constraints,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      costImpact: input.costImpact,
      customerSupplierImpact: input.customerSupplierImpact
    });
    const adapter = createOrchestratorAdapter(repository, registry);
    const dispatch = adapter.prepareDispatch(workflow.task_packet);
    return {
      repository,
      oversight_agent: oversightAgent.name,
      adapter_profile: adapter.getProfile(),
      workflow,
      dispatch
    };
  });

  const base = {
    objective,
    action_type: actionType,
    repositories,
    oversight_agent: oversightAgent.name,
    policy_decision: decision,
    mode: 'dry_run',
    route_count: routes.length
  };

  return {
    routing_plan_id: stableId('routing', base),
    ...base,
    routes,
    status_summary: summarizeRoutes(routes),
    external_side_effects_executed: false
  };
}

module.exports = { summarizeRoutes, buildPortfolioRoutingPlan };
