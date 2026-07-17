import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';
import type { MetaAgentContext } from './context.js';
import { createExactActionBinding } from './actionBinding.js';

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

const actionContextSchema = z
  .object({
    selfApprovalAttempt: z.boolean().optional(),
    bypassRepositoryOrchestrator: z.boolean().optional(),
    requestsSecrets: z.boolean().optional(),
    productionMutationWithoutApproval: z.boolean().optional(),
    externalMessageWithoutApproval: z.boolean().optional(),
    paidSpendWithoutApproval: z.boolean().optional(),
    vendorAwardWithoutApproval: z.boolean().optional(),
    disableApprovalGates: z.boolean().optional(),
    regulatedDomain: z.boolean().optional(),
  })
  .default({});

function getContext(runContext: RunContext<MetaAgentContext> | undefined): MetaAgentContext {
  if (!runContext?.context) throw new Error('MetaAgentContext is required.');
  return runContext.context;
}

function requireAuthorizedRepository(context: MetaAgentContext, repository: string): void {
  if (!context.authorizedRepositories.includes(repository)) {
    throw new Error(`Repository is outside the authorized portfolio scope: ${repository}`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function assertPlannableAction(actionType: string, actionContext: Record<string, unknown> = {}): Record<string, any> {
  const decision = classifyAction(actionType, actionContext);
  if (decision.blocked) {
    throw new Error(`Action is hard-blocked and cannot be queued: ${String(decision.reason)}`);
  }
  return decision;
}

async function recordControlledStub(
  context: MetaAgentContext,
  input: {
    toolName: string;
    actionType: string;
    repository: string;
    environment: string;
    arguments: Record<string, unknown>;
    payload: Record<string, unknown>;
  },
): Promise<Record<string, unknown>> {
  requireAuthorizedRepository(context, input.repository);
  const decision = assertPlannableAction(input.actionType);
  const exactAction = createExactActionBinding({
    toolName: input.toolName,
    agentName: 'Meta Chief of Staff Agent',
    actionType: input.actionType,
    arguments: input.arguments,
  });
  const eventId = stableId('audit', {
    operator_id: context.operatorId,
    action_digest: exactAction.action_digest,
  });
  const event = {
    event_id: eventId,
    event_type: 'approved_controlled_stub_prepared',
    operator_id: context.operatorId,
    repository: input.repository,
    environment: input.environment,
    action_type: input.actionType,
    risk_level: decision.risk,
    required_approver_roles: decision.approvals,
    exact_action: exactAction,
    payload: input.payload,
    external_side_effect_executed: false,
    execution_status: 'stub_only',
    recorded_at: new Date().toISOString(),
  };
  await context.stateStore.put('auditEvents', eventId, event);
  await context.stateStore.put('evidenceEvents', eventId, {
    event_id: eventId,
    event_type: 'controlled_stub_evidence',
    action_digest: exactAction.action_digest,
    repository: input.repository,
    external_side_effect_executed: false,
    recorded_at: event.recorded_at,
  });
  return event;
}

export const getPolicySummaryTool = tool({
  name: 'get_policy_summary',
  description: 'Return the deterministic portfolio authority and risk-policy summary. Read-only.',
  parameters: z.object({}),
  async execute(_args, runContext) {
    getContext(runContext as RunContext<MetaAgentContext>);
    return summarizePolicy();
  },
});

export const classifyActionTool = tool({
  name: 'classify_action',
  description: 'Classify one exact action type before planning or requesting authorization.',
  parameters: z.object({
    actionType: z.string().min(1),
    context: actionContextSchema.optional(),
  }),
  async execute(args, runContext) {
    getContext(runContext as RunContext<MetaAgentContext>);
    return classifyAction(args.actionType, args.context ?? {});
  },
});

export const getPortfolioRegistryTool = tool({
  name: 'get_portfolio_registry',
  description: 'Return the authorized portfolio repository registry and orchestrator coverage. Read-only.',
  parameters: z.object({
    includeDiscoveryTargets: z.boolean().default(false),
  }),
  async execute(args, runContext) {
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
        ...(args.includeDiscoveryTargets ? { discovery_targets: repo.required_next_discovery ?? [] } : {}),
      })),
    };
  },
});

export const buildTaskWorkflowTool = tool({
  name: 'build_task_workflow',
  description: 'Build and persist a deterministic task/approval workflow without performing an external side effect.',
  parameters: z.object({
    objective: z.string().min(1),
    repository: z.string().min(1),
    actionType: z.string().min(1),
    requestedOutputs: z.array(z.string()).default([]),
    validationRequirements: z.array(z.string()).default([]),
    evidenceRefs: z.array(z.string()).default([]),
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
      affectedRepositories: [args.repository],
      action: { type: args.actionType, summary: args.objective },
      actionType: args.actionType,
      context: args.context ?? {},
      requestedOutputs: args.requestedOutputs,
      validationRequirements: args.validationRequirements,
      evidenceRefs: args.evidenceRefs,
      evidenceBundle: { policy_version: '1.0.0', evidence_refs: args.evidenceRefs },
      expectedOutcome: args.expectedOutcome,
      rollbackPlan: args.rollbackPlan,
    });
    await persistWorkflow(context, workflow);
    return workflow;
  },
});

export const buildPortfolioRoutingPlanTool = tool({
  name: 'build_portfolio_routing_plan',
  description: 'Build a dry-run routing plan through repository-local orchestrators. No GitHub write occurs.',
  parameters: z.object({
    objective: z.string().min(1),
    repositories: z.array(z.string().min(1)).min(1),
    actionType: z.string().min(1),
    requestedOutputs: z.array(z.string()).default([]),
    validationRequirements: z.array(z.string()).default([]),
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
    for (const route of plan.routes ?? []) {
      if (isRecord(route) && isRecord(route.workflow)) await persistWorkflow(context, route.workflow);
    }
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
  description: 'Prepare procurement analysis and approval artifacts. Never awards a vendor or commits spend.',
  parameters: z.object({
    repository: z.string().min(1),
    summary: z.string().min(1),
    intent: z.enum(['research', 'shortlist', 'award', 'contract', 'payment']).default('research'),
    category: z.string().optional(),
    estimatedCost: z.number().nonnegative().optional(),
    currency: z.string().default('USD'),
    budgetOwner: z.string().optional(),
    vendors: z.array(vendorSchema).default([]),
    contractRequired: z.boolean().default(false),
    dataAccess: z.boolean().default(false),
    systemAccess: z.boolean().default(false),
    soleSource: z.boolean().default(false),
    crossBorder: z.boolean().default(false),
    regulatedDomain: z.boolean().default(false),
    administrativeReviewOnly: z.boolean().default(false),
    legalComplianceReviewId: z.string().optional(),
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
      contract_required: args.contractRequired,
      data_access: args.dataAccess,
      system_access: args.systemAccess,
      sole_source: args.soleSource,
      cross_border: args.crossBorder,
      regulated_domain: args.regulatedDomain,
      administrative_review_only: args.administrativeReviewOnly,
      legal_compliance_review_id: args.legalComplianceReviewId,
      controlled_goods: args.controlledGoods,
      defense_related: args.defenseRelated,
      weapons_related: args.weaponsRelated,
      evidence_refs: args.evidenceRefs,
    });
    const requestId = workflow.procurement_request?.procurement_request_id;
    if (requestId) await context.stateStore.put('procurementWorkflows', requestId, workflow);
    if (workflow.task_workflow) await persistWorkflow(context, workflow.task_workflow);
    return workflow;
  },
});

export const scheduleRepositoryScanTool = tool({
  name: 'run_scheduled_scan',
  description: 'Create read-only repository scan tasks and persist their audit state.',
  parameters: z.object({
    repositories: z.array(z.string().min(1)).optional(),
    scanLabel: z.string().default('portfolio_control_plane_scan'),
    objective: z.string().default('Run a scheduled read-only portfolio scan.'),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    const repositories = args.repositories?.length
      ? args.repositories
      : context.registry.repositories.map((repo) => repo.repository_full_name);
    const workflows: Record<string, unknown>[] = [];
    for (const repository of repositories) {
      requireAuthorizedRepository(context, repository);
      const workflow = buildTaskApprovalWorkflow({
        registry: context.registry,
        objective: args.objective,
        repository,
        affectedRepositories: [repository],
        action: { type: 'compute_project_health', summary: args.objective },
        actionType: 'compute_project_health',
        requestedOutputs: ['project_health', 'scan_report'],
        validationRequirements: ['read-only scan', 'evidence-backed status claims'],
        evidenceBundle: { source: 'scheduled_scan', scan_label: args.scanLabel, policy_version: '1.0.0' },
        rollbackPlan: 'No external mutation occurs during scanning.',
      });
      await persistWorkflow(context, workflow);
      workflows.push({
        repository,
        task_id: workflow.task_packet?.task_id ?? null,
        run_id: workflow.agent_run?.run_id ?? null,
        status: workflow.agent_run?.status ?? 'unknown',
      });
    }
    const auditId = stableId('audit', { scan_label: args.scanLabel, repositories, operator_id: context.operatorId });
    await context.stateStore.put('auditEvents', auditId, {
      event_type: 'scheduled_scan_queued',
      audit_event_id: auditId,
      scan_label: args.scanLabel,
      repository_count: repositories.length,
      operator_id: context.operatorId,
      external_side_effects_executed: false,
      created_at: new Date().toISOString(),
    });
    return { scan_label: args.scanLabel, repositories, workflows, audit_event_id: auditId };
  },
});

export const buildBackupPlanTool = tool({
  name: 'build_backup_plan',
  description: 'Prepare a deterministic rollback-readiness manifest. This tool does not copy or mutate repository data.',
  parameters: z.object({
    repository: z.string().min(1),
    targetScope: z.string().default('full'),
    retentionDays: z.number().int().positive().max(365).default(30),
    runCorrelationId: z.string().optional(),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const plan = {
      backup_plan_id: stableId('backup', {
        repository: args.repository,
        scope: args.targetScope,
        correlation_id: args.runCorrelationId ?? null,
      }),
      repository: args.repository,
      target_scope: args.targetScope,
      retention_days: args.retentionDays,
      run_correlation_id: args.runCorrelationId ?? null,
      status: 'planned',
      backup_executed: false,
      created_at: new Date().toISOString(),
    };
    await context.stateStore.put('evidenceEvents', plan.backup_plan_id, plan);
    return plan;
  },
});

export const buildRollbackPlanTool = tool({
  name: 'build_rollback_plan',
  description: 'Prepare a rollback runbook linked to a prior run. This tool never executes the rollback.',
  parameters: z.object({
    repository: z.string().min(1),
    targetRunId: z.string().min(1),
    triggerEventId: z.string().optional(),
    recoveryObjective: z.string().default('Revert the unsafe change after explicit authorization.'),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const plan = {
      rollback_plan_id: stableId('rollback', { repository: args.repository, target_run_id: args.targetRunId }),
      repository: args.repository,
      target_run_id: args.targetRunId,
      trigger_event_id: args.triggerEventId ?? null,
      recovery_objective: args.recoveryObjective,
      status: 'prepared',
      approval_required: true,
      executed: false,
      requested_by: context.operatorId,
      prepared_at: new Date().toISOString(),
    };
    await context.stateStore.put('agentRuns', plan.rollback_plan_id, plan);
    await context.stateStore.put('auditEvents', plan.rollback_plan_id, {
      event_type: 'rollback_plan_prepared',
      ...plan,
    });
    return plan;
  },
});

export const queueControlledActionTool = tool({
  name: 'queue_controlled_action',
  description: 'Pause for human authorization, then record an exact-action intent artifact without executing an external action.',
  parameters: z.object({
    actionType: z.string().min(1),
    repository: z.string().min(1),
    exactAction: z.string().min(1),
    environment: z.string().default('non-production'),
  }),
  needsApproval: async (_runContext, args) => {
    const decision = classifyAction(args.actionType, {});
    return Boolean(decision.blocked || decision.requiresHumanApproval);
  },
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    return recordControlledStub(context, {
      toolName: 'queue_controlled_action',
      actionType: args.actionType,
      repository: args.repository,
      environment: args.environment,
      arguments: args,
      payload: { requested_action: args.exactAction, authorization_intent_only: true },
    });
  },
});

export const createGitHubIssueTool = tool({
  name: 'create_github_issue',
  description: 'Approval-gated GitHub issue stub. Records the exact proposed payload but does not call GitHub.',
  parameters: z.object({
    repository: z.string().min(1),
    title: z.string().min(1),
    body: z.string().default(''),
    labels: z.array(z.string()).default([]),
    assignees: z.array(z.string()).default([]),
    environment: z.string().default('non-production'),
  }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    return recordControlledStub(context, {
      toolName: 'create_github_issue',
      actionType: 'create_github_issue',
      repository: args.repository,
      environment: args.environment,
      arguments: args,
      payload: {
        destination: 'github_issue',
        repository: args.repository,
        title: args.title,
        body: args.body,
        labels: args.labels,
        assignees: args.assignees,
        stub: true,
      },
    });
  },
});

export const createDraftPRTool = tool({
  name: 'create_draft_pr',
  description: 'Approval-gated draft pull-request stub. Records the exact proposed payload but does not call GitHub.',
  parameters: z.object({
    repository: z.string().min(1),
    title: z.string().min(1),
    body: z.string().default(''),
    baseBranch: z.string().default('main'),
    headBranch: z.string().min(1),
    reviewers: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
    environment: z.string().default('non-production'),
  }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    return recordControlledStub(context, {
      toolName: 'create_draft_pr',
      actionType: 'create_pull_request_draft',
      repository: args.repository,
      environment: args.environment,
      arguments: args,
      payload: {
        destination: 'github_pull_request',
        repository: args.repository,
        title: args.title,
        body: args.body,
        base: args.baseBranch,
        head: args.headBranch,
        reviewers: args.reviewers,
        labels: args.labels,
        draft: true,
        stub: true,
      },
    });
  },
});

export const coreMetaTools = [
  getPolicySummaryTool,
  classifyActionTool,
  getPortfolioRegistryTool,
  buildTaskWorkflowTool,
  buildPortfolioRoutingPlanTool,
  buildProcurementWorkflowTool,
  scheduleRepositoryScanTool,
  buildBackupPlanTool,
  buildRollbackPlanTool,
  queueControlledActionTool,
  createGitHubIssueTool,
  createDraftPRTool,
];
