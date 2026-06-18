import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';
import type { MetaAgentContext } from './context.js';

const { classifyAction, summarizePolicy } = require('../policy-engine.js') as {
  classifyAction: (actionType: string, context?: Record<string, unknown>) => Record<string, unknown>;
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
const { recordApprovalDecision, applyApprovalDecision, resumeRunFromApprovalQueue } = require('../run-state.js') as {
  recordApprovalDecision: (input: {
    pendingApproval: Record<string, any>;
    decisionType: string;
    approverRole: string;
    decidedAt?: string;
    constraints?: Record<string, unknown>;
    notes?: string;
  }) => Record<string, any>;
  applyApprovalDecision: (pendingApproval: Record<string, any>, decisionRecord: Record<string, any>) => Record<string, any>;
  resumeRunFromApprovalQueue: (run: Record<string, any>, approvalQueue: Record<string, any>) => Record<string, any>;
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

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, any> {
  if (!isRecord(value)) throw new Error('Stored state value is malformed.');
  return value;
}

function queueStatusToApprovalPacketStatus(decisionType: string): string {
  if (decisionType === 'reject' || decisionType === 'always_reject') return 'rejected';
  if (decisionType === 'request_changes') return 'changes_requested';
  return 'approved';
}

function buildIssuePayload(input: {
  repository: string;
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
  environment: string;
}) {
  return {
    destination: 'github_issue',
    repository: input.repository,
    title: input.title,
    body: input.body,
    labels: input.labels,
    assignees: input.assignees,
    metadata: {
      environment: input.environment,
      delivery_mode: 'write-gated-stub',
      prepared_at: new Date().toISOString(),
    },
    stub: true,
    api_call: 'createIssue',
  };
}

function buildDraftPrPayload(input: {
  repository: string;
  title: string;
  body: string;
  baseBranch: string;
  headBranch: string;
  environment: string;
  reviewers: string[];
  labels: string[];
}) {
  return {
    destination: 'github_pull_request',
    repository: input.repository,
    title: input.title,
    body: input.body,
    base: input.baseBranch,
    head: input.headBranch,
    reviewers: input.reviewers,
    labels: input.labels,
    metadata: {
      environment: input.environment,
      delivery_mode: 'write-gated-stub',
      draft: true,
      prepared_at: new Date().toISOString(),
    },
    stub: true,
    api_call: 'createDraftPullRequest',
  };
}

async function requireSignedApproverRoleForWrite(context: MetaAgentContext, args: {
  approvalId: string;
  approverRole: string;
  queueId?: string;
  runId?: string;
}) {
  const [approvalRows, queueRows, decisionRows] = await Promise.all([
    context.stateStore.get('approvalPackets', args.approvalId),
    context.stateStore.list('approvalQueues'),
    context.stateStore.list('approvalDecisions'),
  ]);

  if (!approvalRows) throw new Error(`Approval packet not found for approvalId=${args.approvalId}.`);
  const approval = getRecord(approvalRows.value);
  const validApprover = approval.required_approver_roles?.includes(args.approverRole);
  if (!validApprover) {
    throw new Error(`Approver role '${args.approverRole}' is not authorized for approval ${args.approvalId}.`);
  }

  const queue = args.queueId
    ? queueRows.find((row) => row.id === args.queueId)
    : queueRows.find((row) => getRecord(row.value).approval_id === args.approvalId);
  if (!queue) throw new Error(`Approval queue not found for approvalId=${args.approvalId}.`);

  const queueValue = getRecord(queue.value);
  const queueStatus = queueValue.status;
  if (queueStatus === 'approved' && (typeof args.runId === 'undefined' || !args.runId || queueValue.run_id === args.runId || !queueValue.run_id)) {
    const decision = decisionRows
      .map((record) => getRecord(record.value))
      .find((candidate) =>
        candidate.approval_id === args.approvalId &&
        candidate.approver_role === args.approverRole &&
        ['approve_once', 'approve_with_limits'].includes(candidate.decision_type) &&
        candidate.queue_id === queue.id
      );
    if (decision) return { queue: queueValue, approval, queueRecordId: queue.id };
  }

  if (queueStatus === 'approved') {
    throw new Error(`Approval packet ${args.approvalId} has not been approved by '${args.approverRole}'.`);
  }
  if (queueStatus === 'pending') {
    throw new Error(`Approval packet ${args.approvalId} is still pending for role '${args.approverRole}'.`);
  }
  if (queueStatus === 'rejected' || queueStatus === 'changes_requested' || queueStatus === 'expired') {
    throw new Error(`Approval packet ${args.approvalId} cannot be executed from status: ${queueStatus}.`);
  }
  throw new Error(`Approval packet ${args.approvalId} is not executable in current queue state: ${queueStatus}.`);
}

async function buildWriteWorkflow(context: MetaAgentContext, input: {
  repository: string;
  actionType: 'create_github_issue' | 'create_pull_request_draft';
  objective: string;
  writePayload: ReturnType<typeof buildIssuePayload> | ReturnType<typeof buildDraftPrPayload>;
  runId?: string;
}) {
  const workflow = buildTaskApprovalWorkflow({
    registry: context.registry,
    objective: input.objective,
    repository: input.repository,
    action: { type: input.actionType, summary: input.objective },
    actionType: input.actionType,
    context: {},
    validationRequirements: ['human approval before write execution'],
    requestedOutputs: ['write_payload', 'approval_packet', 'approved_run_status'],
    evidenceBundle: { source: 'write_gate_stub', task_type: input.actionType, policy_version: '0.2.0' },
    expectedOutcome: `Prepare ${input.actionType} payload for ${input.repository} without API call until Stage 6.`,
    rollbackPlan: 'No external mutation occurs at this stage; discard stub and replay from new approval token if needed.',
    createdAt: new Date().toISOString(),
    costImpact: null,
    customerSupplierImpact: null,
  });

  await persistWorkflow(context, workflow);
  const task = workflow.task_packet as Record<string, any> | undefined;
  const approval = workflow.approval_packet as Record<string, any> | null | undefined;
  const queue = workflow.pending_approval as Record<string, any> | null | undefined;
  const run = workflow.agent_run as Record<string, any> | undefined;

  if (!run?.run_id) throw new Error('Unable to initialize run state for gated write action.');
  const runAwarePayload = { ...input.writePayload, metadata: { ...(input.writePayload as any).metadata, run_id: run.run_id } };

  return {
    mode: 'write-gated-stub',
    task_packet: task,
    approval_packet: approval,
    pending_approval: queue,
    agent_run: run,
    write_payload: runAwarePayload,
    execution_plan: {
      status: queue?.status ?? 'not_queued',
      reason: approval ? 'Approval required before execution.' : 'No approval required by policy.',
      run_id: run.run_id,
      execute_mode: 'stub-only',
    },
  };
}

async function writeDecisionAndUpdateRun(
  context: MetaAgentContext,
  input: {
    approvalId: string;
    runId?: string;
    queueId?: string;
    decisionType: 'approve_once' | 'approve_with_limits' | 'reject' | 'request_changes' | 'always_reject';
    approverRole: string;
    constraints?: Record<string, unknown>;
    notes?: string;
    decidedAt?: string;
  }
) {
  const queuedRows = await context.stateStore.list('approvalQueues');
  const queueRecord = input.queueId
    ? queuedRows.find((row) => row.id === input.queueId)
    : queuedRows.find((row) => getRecord(row.value).approval_id === input.approvalId);
  if (!queueRecord) {
    throw new Error(`Approval queue not found for approval_id=${input.approvalId}.`);
  }

  const queue = getRecord(queueRecord.value);
  if (!queue.approval_id || queue.approval_id !== input.approvalId) {
    throw new Error(`Approval queue does not match approval_id=${input.approvalId}.`);
  }

  const decisionRecord = recordApprovalDecision({
    pendingApproval: queue,
    decisionType: input.decisionType,
    approverRole: input.approverRole,
    decidedAt: input.decidedAt,
    constraints: input.constraints,
    notes: input.notes,
  });

  const updatedQueue = applyApprovalDecision(queue, decisionRecord);
  await context.stateStore.put('approvalDecisions', decisionRecord.decision_id, {
    ...decisionRecord,
    operator_id: context.operatorId,
  });
  await context.stateStore.put('approvalQueues', queueRecord.id, updatedQueue);

  const runId = input.runId ?? queue.run_id;
  let runRecord = runId ? await context.stateStore.get('agentRuns', runId) : null;
  let updatedRun = null;
  if (runRecord) {
    const run = getRecord(runRecord.value);
    updatedRun = resumeRunFromApprovalQueue(run, updatedQueue);
    await context.stateStore.put('agentRuns', runRecord.id, updatedRun);
  }

  const approvalRecord = await context.stateStore.get('approvalPackets', input.approvalId);
  if (approvalRecord) {
    const approval = getRecord(approvalRecord.value);
    approval.status = queueStatusToApprovalPacketStatus(input.decisionType);
    await context.stateStore.put('approvalPackets', input.approvalId, approval);
  }

  const evidenceId = stableId('evidence', {
    approval_id: input.approvalId,
    decision_type: input.decisionType,
    approver_role: input.approverRole,
  });
  await context.stateStore.put('evidenceEvents', evidenceId, {
    event_type: 'approval_decision_recorded',
    approval_id: input.approvalId,
    queue_id: queueRecord.id,
    run_id: runId ?? null,
    decision_id: decisionRecord.decision_id,
    decision_type: input.decisionType,
    approver_role: input.approverRole,
    decided_at: decisionRecord.decided_at,
    evidence_correlation_id: queueRecord.id,
  });

  const auditId = stableId('audit', { approval_id: input.approvalId, decision_id: decisionRecord.decision_id });
  await context.stateStore.put('auditEvents', auditId, {
    event_type: 'approval_decision',
    approval_id: input.approvalId,
    queue_id: queueRecord.id,
    run_id: runId ?? null,
    decision_id: decisionRecord.decision_id,
    decision_type: input.decisionType,
    approver_role: input.approverRole,
    operator_id: context.operatorId,
    recorded_at: new Date().toISOString(),
  });

    return {
      decision_record: decisionRecord,
      queue: updatedQueue,
      run: updatedRun,
      evidence_event_id: evidenceId,
      audit_event_id: auditId,
    };
  }

export const createGitHubIssueTool = tool({
  name: 'create_github_issue',
  description: 'Prepare a GitHub issue write payload and approval packet, but do not call GitHub API until Stage 6.',
  parameters: z.object({
    repository: z.string().min(1),
    title: z.string().min(1),
    body: z.string().default(''),
    labels: z.array(z.string()).default([]),
    assignees: z.array(z.string()).default([]),
    environment: z.string().default('non-production'),
    runId: z.string().optional(),
    approvalId: z.string().optional(),
    queueId: z.string().optional(),
    approverRole: z.string().optional(),
  }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const payload = buildIssuePayload({
      repository: args.repository,
      title: args.title,
      body: args.body,
      labels: args.labels,
      assignees: args.assignees,
      environment: args.environment,
    });

    const plan = await buildWriteWorkflow(context, {
      repository: args.repository,
      actionType: 'create_github_issue',
      objective: `Create issue: ${args.title}`,
      writePayload: payload,
      runId: args.runId,
    });

    const isPending = plan.execution_plan.status === 'pending';
    if (args.approvalId && args.approverRole) {
      await requireSignedApproverRoleForWrite(context, {
        approvalId: args.approvalId,
        approverRole: args.approverRole,
        queueId: args.queueId,
        runId: plan.agent_run?.run_id,
      });
    }

    return {
      ...plan,
      write_tool: 'create_github_issue',
      prepared_for_stage6: true,
      write_enabled: false,
      ready_for_hand_off: !isPending,
      note: isPending
        ? 'Writes are intentionally disabled in Stage 6 groundwork; execution remains gated by approval and run state.'
        : 'Write tool payload is prepared and signed off by role, but API call is intentionally disabled until Stage 6.',
    };
  },
});

export const createDraftPRTool = tool({
  name: 'create_draft_pr',
  description: 'Prepare a draft PR payload and approval packet, but do not call GitHub API until Stage 6.',
  parameters: z.object({
    repository: z.string().min(1),
    title: z.string().min(1),
    body: z.string().default(''),
    baseBranch: z.string().default('main'),
    headBranch: z.string().min(1),
    reviewers: z.array(z.string()).default([]),
    labels: z.array(z.string()).default([]),
    environment: z.string().default('non-production'),
    runId: z.string().optional(),
    approvalId: z.string().optional(),
    queueId: z.string().optional(),
    approverRole: z.string().optional(),
  }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const payload = buildDraftPrPayload({
      repository: args.repository,
      title: args.title,
      body: args.body,
      baseBranch: args.baseBranch,
      headBranch: args.headBranch,
      reviewers: args.reviewers,
      labels: args.labels,
      environment: args.environment,
    });

    const plan = await buildWriteWorkflow(context, {
      repository: args.repository,
      actionType: 'create_pull_request_draft',
      objective: `Create draft PR: ${args.title}`,
      writePayload: payload,
      runId: args.runId,
    });

    if (args.approvalId && args.approverRole) {
      await requireSignedApproverRoleForWrite(context, {
        approvalId: args.approvalId,
        approverRole: args.approverRole,
        queueId: args.queueId,
        runId: plan.agent_run?.run_id,
      });
    }

    return {
      ...plan,
      write_tool: 'create_draft_pr',
      prepared_for_stage6: true,
      write_enabled: false,
      note: 'Writes are intentionally disabled in Phase 6 groundwork; API call is still disabled until Stage 6 production routing.',
    };
  },
});

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
      evidenceBundle: { policy_version: '0.2.0', evidence_refs: args.evidenceRefs ?? [] },
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
    await context.stateStore.put('procurementWorkflows', workflow.procurement_request.procurement_request_id, workflow);
    await persistWorkflow(context, workflow.task_workflow);
    return workflow;
  },
});

export const queueControlledActionTool = tool({
  name: 'queue_controlled_action',
  description: 'Request explicit human authorization for an external side-effect action. Approval only records authorization intent; this tool never performs the external action.',
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
    if (policyDecision.blocked) {
      throw new Error(`Hard-blocked action cannot be authorized: ${String(policyDecision.reason)}`);
    }
    const event = {
      event_id: stableId('audit', { ...args, operatorId: context.operatorId }),
      event_type: 'controlled_action_authorization_recorded',
      operator_id: context.operatorId,
      action_type: args.actionType,
      repository: args.repository,
      exact_action: args.exactAction,
      approval_packet_id: args.approvalPacketId,
      environment: args.environment,
      execution_status: 'not_executed',
      external_side_effect_executed: false,
      recorded_at: new Date().toISOString(),
    };
    await context.stateStore.put('auditEvents', event.event_id, event);
    return event;
  },
});

export const recordDecisionTool = tool({
  name: 'record_decision',
  description: 'Write an approval/rejection decision for a queue entry and advance run state.',
  parameters: z.object({
    approvalId: z.string().min(1),
    runId: z.string().optional(),
    queueId: z.string().optional(),
    decisionType: z.enum(['approve_once', 'approve_with_limits', 'reject', 'request_changes', 'always_reject']),
    approverRole: z.string().min(1),
    constraints: z.record(z.unknown()).default({}),
    notes: z.string().default(''),
    decidedAt: z.string().datetime().optional(),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    return writeDecisionAndUpdateRun(context, args);
  },
});

export const coreMetaTools = [
  getPolicySummaryTool,
  classifyActionTool,
  getPortfolioRegistryTool,
  buildTaskWorkflowTool,
  buildPortfolioRoutingPlanTool,
  buildProcurementWorkflowTool,
  queueControlledActionTool,
  createGitHubIssueTool,
  createDraftPRTool,
  recordDecisionTool,
];
