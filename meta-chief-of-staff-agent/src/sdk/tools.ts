import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';
import type { MetaAgentContext } from './context.js';

const { classifyAction, summarizePolicy } = require('../policy-engine.js') as {
  classifyAction: (actionType: string, context?: Record<string, unknown>) => Record<string, any>;
  summarizePolicy: () => Record<string, unknown>;
};
const { buildTaskApprovalWorkflow } = require('../packet-workflow.js') as {
  buildTaskApprovalWorkflow: (input: Record<string, unknown>) => Record<string, any>;
};
const { buildPortfolioRoutingPlan } = require('../orchestrators/portfolio-router.js') as {
  buildPortfolioRoutingPlan: (input: Record<string, unknown>) => Record<string, any>;
};
const { buildProcurementWorkflow } = require('../procurement/procurement-workflow.js') as {
  buildProcurementWorkflow: (input: Record<string, unknown>) => Record<string, any>;
};
const { stableId } = require('../packet-utils.js') as {
  stableId: (prefix: string, payload: unknown) => string;
};

const actionContextSchema = z.object({
  selfApprovalAttempt: z.boolean().optional(),
  bypassRepositoryOrchestrator: z.boolean().optional(),
  requestsSecrets: z.boolean().optional(),
  productionMutationWithoutApproval: z.boolean().optional(),
  externalMessageWithoutApproval: z.boolean().optional(),
  paidSpendWithoutApproval: z.boolean().optional(),
  vendorAwardWithoutApproval: z.boolean().optional(),
  disableApprovalGates: z.boolean().optional(),
  regulatedDomain: z.boolean().optional(),
}).default({});

function getContext(runContext: RunContext<MetaAgentContext> | undefined): MetaAgentContext {
  if (!runContext?.context) throw new Error('MetaAgentContext is required.');
  return runContext.context;
}

function requireAuthorizedRepository(context: MetaAgentContext, repository: string): void {
  if (!context.authorizedRepositories.includes(repository)) {
    throw new Error(`Repository is outside the authorized portfolio scope: ${repository}`);
  }
}

function asRecord(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, any>;
}

function includesAll(values: string[], required: string[]): boolean {
  return required.every((value) => values.includes(value));
}

async function persistWorkflow(context: MetaAgentContext, workflow: Record<string, any>): Promise<void> {
  const task = workflow.task_packet as Record<string, any> | undefined;
  const approval = workflow.approval_packet as Record<string, any> | null | undefined;
  const queue = workflow.pending_approval as Record<string, any> | null | undefined;
  const run = workflow.agent_run as Record<string, any> | undefined;
  const blocked = workflow.blocked_action as Record<string, any> | null | undefined;
  if (task?.task_id) await context.stateStore.put('taskPackets', task.task_id, task);
  if (approval?.approval_id) await context.stateStore.put('approvalPackets', approval.approval_id, approval);
  if (queue?.queue_id) await context.stateStore.put('approvalQueues', queue.queue_id, queue);
  if (run?.run_id) await context.stateStore.put('agentRuns', run.run_id, run);
  if (blocked?.blocked_action_id) {
    await context.stateStore.put('auditEvents', blocked.blocked_action_id, {
      event_type: 'blocked_action',
      ...blocked,
    });
  }
}

async function loadAndValidateApprovalPacket(
  context: MetaAgentContext,
  args: { actionType: string; repository: string; approvalPacketId: string; environment: string },
): Promise<Record<string, any>> {
  const stored = await context.stateStore.get('approvalPackets', args.approvalPacketId);
  if (!stored) throw new Error(`Approval packet not found: ${args.approvalPacketId}`);
  const packet = asRecord(stored.value, 'Approval packet');

  if (packet.approval_id !== args.approvalPacketId) throw new Error('Stored approval packet ID is inconsistent.');
  if (packet.action_type !== args.actionType) throw new Error('Approval packet does not cover the requested action type.');
  if (!Array.isArray(packet.affected_repositories) || !packet.affected_repositories.includes(args.repository)) {
    throw new Error('Approval packet does not cover the requested repository.');
  }
  const expiry = Date.parse(String(packet.expires_at ?? ''));
  if (Number.isNaN(expiry) || expiry <= Date.now()) throw new Error('Approval packet is expired or has an invalid expiry.');

  const requiredRoles = Array.isArray(packet.required_approver_roles) ? packet.required_approver_roles.map(String) : [];
  if (!includesAll(context.operatorRoles, requiredRoles)) {
    const missing = requiredRoles.filter((role: string) => !context.operatorRoles.includes(role));
    throw new Error(`Current operator lacks required approval roles: ${missing.join(', ')}`);
  }

  const constraints = asRecord(packet.constraints ?? {}, 'Approval constraints');
  const allowedRepositories = Array.isArray(constraints.allowed_repositories)
    ? constraints.allowed_repositories.map(String)
    : constraints.allowed_repository
      ? [String(constraints.allowed_repository)]
      : null;
  if (allowedRepositories && !allowedRepositories.includes(args.repository)) throw new Error('Approval constraints do not cover the repository.');
  if (constraints.allowed_action_type && constraints.allowed_action_type !== args.actionType) throw new Error('Approval constraints do not cover the action type.');
  if (constraints.target_environment && constraints.target_environment !== args.environment) throw new Error('Approval constraints do not cover the environment.');
  if (Array.isArray(constraints.forbidden_actions) && constraints.forbidden_actions.includes(args.actionType)) throw new Error('Requested action is forbidden by the approval constraints.');

  return packet;
}

export const getPolicySummaryTool = tool({
  name: 'get_policy_summary',
  description: 'Return the deterministic portfolio policy summary. This is read-only.',
  parameters: z.object({}),
  async execute(_args, runContext) {
    getContext(runContext as RunContext<MetaAgentContext>);
    return summarizePolicy();
  },
});

export const classifyActionTool = tool({
  name: 'classify_action',
  description: 'Classify an exact proposed action by risk, approvals, and hard-block status before planning or execution.',
  parameters: z.object({
    actionType: z.string().min(1),
    context: actionContextSchema.optional(),
  }),
  async execute({ actionType, context: actionContext }, runContext) {
    getContext(runContext as RunContext<MetaAgentContext>);
    return classifyAction(actionType, actionContext ?? {});
  },
});

export const getPortfolioRegistryTool = tool({
  name: 'get_portfolio_registry',
  description: 'List repositories and known orchestrator status from the local portfolio registry. This is read-only.',
  parameters: z.object({
    includeDiscoveryTargets: z.boolean().default(false),
  }),
  async execute({ includeDiscoveryTargets }, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    return {
      owner: context.registry.owner,
      schema_version: context.registry.schema_version,
      repository_count: context.registry.repositories.length,
      repositories: context.registry.repositories.map((repo) => ({
        repository: repo.repository_full_name,
        domain: repo.domain_guess ?? 'unknown',
        oversight_status: repo.oversight_status ?? 'unknown',
        orchestrator_known: Boolean(repo.orchestrator?.known),
        orchestrator_path: repo.orchestrator?.path ?? null,
        approval_policy_known: Boolean(repo.orchestrator?.approval_policy_known),
        ...(includeDiscoveryTargets ? { discovery_targets: repo.required_next_discovery ?? [] } : {}),
      })),
    };
  },
});

export const getControlPlaneSnapshotTool = tool({
  name: 'get_control_plane_snapshot',
  description: 'Return read-only counts and pending approvals from the local control-plane state store.',
  parameters: z.object({ includePendingApprovals: z.boolean().default(true) }),
  async execute({ includePendingApprovals }, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    const collections = ['taskPackets', 'approvalPackets', 'approvalQueues', 'agentRuns', 'routingPlans', 'procurementWorkflows', 'auditEvents'] as const;
    const entries = await Promise.all(collections.map(async (collection) => [collection, await context.stateStore.list(collection)] as const));
    const counts = Object.fromEntries(entries.map(([collection, records]) => [collection, records.length]));
    const approvalQueues = entries.find(([collection]) => collection === 'approvalQueues')?.[1] ?? [];
    const pending = approvalQueues
      .map((record) => asRecord(record.value, 'Approval queue'))
      .filter((queue) => queue.status === 'pending');
    return {
      operator_id: context.operatorId,
      operator_roles: context.operatorRoles,
      mode: context.mode,
      environment: context.environment,
      counts,
      pending_approval_count: pending.length,
      ...(includePendingApprovals ? { pending_approvals: pending } : {}),
    };
  },
});

export const buildTaskWorkflowTool = tool({
  name: 'build_task_workflow',
  description: 'Build a deterministic task packet, approval packet when needed, pending approval item, and run state for one repository. No external side effect occurs.',
  parameters: z.object({
    objective: z.string().min(1),
    repository: z.string().min(1),
    actionType: z.string().min(1),
    requestedOutputs: z.array(z.string()).optional(),
    validationRequirements: z.array(z.string()).optional(),
    evidenceRefs: z.array(z.string()).optional(),
    expectedOutcome: z.string().optional(),
    rollbackPlan: z.string().optional(),
    context: actionContextSchema.optional(),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const workflow = buildTaskApprovalWorkflow({
      registry: context.registry,
      objective: args.objective,
      repository: args.repository,
      action: { type: args.actionType, summary: args.objective },
      actionType: args.actionType,
      context: args.context ?? {},
      requestedOutputs: args.requestedOutputs,
      validationRequirements: args.validationRequirements,
      evidenceRefs: args.evidenceRefs,
      evidenceBundle: { policy_version: '0.3.0', evidence_refs: args.evidenceRefs ?? [] },
      expectedOutcome: args.expectedOutcome,
      rollbackPlan: args.rollbackPlan,
    });
    await persistWorkflow(context, workflow);
    return workflow;
  },
});

export const buildPortfolioRoutingPlanTool = tool({
  name: 'build_portfolio_routing_plan',
  description: 'Build a dry-run cross-repository routing plan through each repository orchestrator. It never creates issues, pull requests, commits, or deployments.',
  parameters: z.object({
    objective: z.string().min(1),
    repositories: z.array(z.string().min(1)).min(1),
    actionType: z.string().min(1),
    requestedOutputs: z.array(z.string()).optional(),
    validationRequirements: z.array(z.string()).optional(),
    context: actionContextSchema.optional(),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    for (const repository of args.repositories) requireAuthorizedRepository(context, repository);
    const plan = buildPortfolioRoutingPlan({
      registry: context.registry,
      objective: args.objective,
      repositories: args.repositories,
      action: { type: args.actionType, summary: args.objective },
      actionType: args.actionType,
      requestedOutputs: args.requestedOutputs,
      validationRequirements: args.validationRequirements,
      context: args.context ?? {},
    });
    await context.stateStore.put('routingPlans', plan.routing_plan_id, plan);
    for (const route of plan.routes ?? []) await persistWorkflow(context, route.workflow);
    return plan;
  },
});

const vendorSchema = z.object({
  vendor_id: z.string().optional(),
  vendor_name: z.string().min(1),
  data_access: z.boolean().optional(),
  system_access: z.boolean().optional(),
  security_review_status: z.string().optional(),
  legal_review_status: z.string().optional(),
  sole_source: z.boolean().optional(),
  cross_border: z.boolean().optional(),
  evidence_refs: z.array(z.string()).optional(),
});

export const buildProcurementWorkflowTool = tool({
  name: 'build_procurement_workflow',
  description: 'Create a governed procurement brief, vendor risk matrix, task workflow, and approval packet when required. It never awards a vendor or commits spend.',
  parameters: z.object({
    repository: z.string().min(1),
    summary: z.string().min(1),
    intent: z.enum(['research', 'shortlist', 'award', 'contract', 'payment']).default('research'),
    category: z.string().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD'),
    budgetOwner: z.string().optional(),
    vendors: z.array(vendorSchema).default([]),
    selectedVendorId: z.string().optional(),
    contractRequired: z.boolean().default(false),
    dataAccess: z.boolean().default(false),
    systemAccess: z.boolean().default(false),
    soleSource: z.boolean().default(false),
    crossBorder: z.boolean().default(false),
    regulatedDomain: z.boolean().default(false),
    administrativeReviewOnly: z.boolean().default(false),
    legalComplianceReviewId: z.string().optional(),
    securityReviewId: z.string().optional(),
    contractId: z.string().optional(),
    purchaseOrderId: z.string().optional(),
    controlledGoods: z.boolean().default(false),
    defenseRelated: z.boolean().default(false),
    weaponsRelated: z.boolean().default(false),
    evidenceRefs: z.array(z.string()).default([]),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const workflow = buildProcurementWorkflow({
      registry: context.registry,
      repository: args.repository,
      summary: args.summary,
      intent: args.intent,
      category: args.category,
      estimated_cost: args.estimatedCost,
      currency: args.currency,
      budget_owner: args.budgetOwner,
      vendors: args.vendors,
      selected_vendor_id: args.selectedVendorId,
      contract_required: args.contractRequired,
      data_access: args.dataAccess,
      system_access: args.systemAccess,
      sole_source: args.soleSource,
      cross_border: args.crossBorder,
      regulated_domain: args.regulatedDomain,
      administrative_review_only: args.administrativeReviewOnly,
      legal_compliance_review_id: args.legalComplianceReviewId,
      security_review_id: args.securityReviewId,
      contract_id: args.contractId,
      purchase_order_id: args.purchaseOrderId,
      controlled_goods: args.controlledGoods,
      defense_related: args.defenseRelated,
      weapons_related: args.weaponsRelated,
      evidence_refs: args.evidenceRefs,
    });
    await context.stateStore.put('procurementWorkflows', workflow.procurement_request.procurement_request_id, workflow);
    await persistWorkflow(context, workflow.task_workflow);
    return workflow;
  },
});

export const queueControlledActionTool = tool({
  name: 'queue_controlled_action',
  description: 'Request explicit human authorization for an external side-effect action. Approval records authorization intent only; this tool never performs the external action.',
  parameters: z.object({
    actionType: z.string().min(1),
    repository: z.string().min(1),
    exactAction: z.string().min(1),
    approvalPacketId: z.string().min(1),
    environment: z.string().default('non-production'),
  }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const policyDecision = classifyAction(args.actionType, {});
    if (policyDecision.blocked) throw new Error(`Hard-blocked action cannot be authorized: ${String(policyDecision.reason)}`);

    const packet = await loadAndValidateApprovalPacket(context, args);
    const approvedAt = new Date().toISOString();
    const approvedPacket = {
      ...packet,
      status: 'approved',
      approved_at: approvedAt,
      approved_by_operator_id: context.operatorId,
      approved_by_roles: context.operatorRoles,
    };
    await context.stateStore.put('approvalPackets', args.approvalPacketId, approvedPacket);

    const queueRecords = await context.stateStore.list('approvalQueues');
    for (const record of queueRecords) {
      const queue = asRecord(record.value, 'Approval queue');
      if (queue.approval_id !== args.approvalPacketId) continue;
      await context.stateStore.put('approvalQueues', record.id, {
        ...queue,
        status: 'approved',
        approved_roles: Array.from(new Set([...(queue.approved_roles ?? []), ...context.operatorRoles])),
        updated_at: approvedAt,
      });
    }

    const event = {
      event_id: stableId('audit', { ...args, operatorId: context.operatorId, approvedAt }),
      event_type: 'controlled_action_authorization_recorded',
      operator_id: context.operatorId,
      operator_roles: context.operatorRoles,
      action_type: args.actionType,
      repository: args.repository,
      exact_action: args.exactAction,
      approval_packet_id: args.approvalPacketId,
      environment: args.environment,
      execution_status: 'not_executed',
      external_side_effect_executed: false,
      recorded_at: approvedAt,
    };
    await context.stateStore.put('auditEvents', event.event_id, event);
    return event;
  },
});

export const coreMetaTools = [
  getPolicySummaryTool,
  classifyActionTool,
  getPortfolioRegistryTool,
  getControlPlaneSnapshotTool,
  buildTaskWorkflowTool,
  buildPortfolioRoutingPlanTool,
  buildProcurementWorkflowTool,
  queueControlledActionTool,
];
