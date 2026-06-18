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
const { assertNoSecretFields, findSecretFieldPaths } = require('../secret-field-guard.js') as {
  assertNoSecretFields: (value: unknown, label?: string) => unknown;
  findSecretFieldPaths: (value: unknown, parentPath?: string) => string[];
};

const MULTI_APPROVER_POLICIES: Record<string, { minimumApprovers: number; requiredRoles: string[]; integrationType: string }> = {
  billing: { minimumApprovers: 2, requiredRoles: ['finance_approver', 'principal_approver'], integrationType: 'billing_platform' },
  marketing: { minimumApprovers: 2, requiredRoles: ['marketing_approver', 'principal_approver'], integrationType: 'marketing_platform' },
  procurement: { minimumApprovers: 2, requiredRoles: ['procurement_approver', 'finance_approver', 'principal_approver'], integrationType: 'procurement_platform' },
  deployment: { minimumApprovers: 2, requiredRoles: ['engineering_approver', 'principal_approver', 'security_approver'], integrationType: 'deployment_service' },
};

function getMultiApproverPolicy(policy: Record<string, unknown>) {
  const category = String(policy.category || '').toLowerCase();
  return MULTI_APPROVER_POLICIES[category] ?? null;
}

function addApproverQuorum(policyDecision: Record<string, any>) {
  const policy = getMultiApproverPolicy(policyDecision);
  if (!policy) return policyDecision;
  const approvals = Array.from(new Set([...(Array.isArray(policyDecision.approvals) ? policyDecision.approvals : []), ...policy.requiredRoles]));
  return { ...policyDecision, approvals, minApprovers: policy.minimumApprovers, integrationType: policy.integrationType, multiApproverRequired: true };
}

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
  if (!context.authorizedRepositories.includes(repository)) throw new Error(`Repository is outside the authorized portfolio scope: ${repository}`);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown): Record<string, any> {
  if (!isRecord(value)) throw new Error('Stored state value is malformed.');
  return value;
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
  if (blocked?.blocked_action_id) await context.stateStore.put('auditEvents', blocked.blocked_action_id, { event_type: 'blocked_action', ...blocked });
}

function queueStatusToApprovalPacketStatus(decisionType: string): string {
  if (decisionType === 'reject' || decisionType === 'always_reject') return 'rejected';
  if (decisionType === 'request_changes') return 'changes_requested';
  return 'approved';
}

function buildIssuePayload(input: { repository: string; title: string; body: string; labels: string[]; assignees: string[]; environment: string }) {
  return {
    destination: 'github_issue',
    repository: input.repository,
    title: input.title,
    body: input.body,
    labels: input.labels,
    assignees: input.assignees,
    metadata: { environment: input.environment, delivery_mode: 'write-gated-stub', prepared_at: new Date().toISOString() },
    stub: true,
    api_call: 'createIssue',
  };
}

function buildDraftPrPayload(input: { repository: string; title: string; body: string; baseBranch: string; headBranch: string; environment: string; reviewers: string[]; labels: string[] }) {
  return {
    destination: 'github_pull_request',
    repository: input.repository,
    title: input.title,
    body: input.body,
    base: input.baseBranch,
    head: input.headBranch,
    reviewers: input.reviewers,
    labels: input.labels,
    metadata: { environment: input.environment, delivery_mode: 'write-gated-stub', draft: true, prepared_at: new Date().toISOString() },
    stub: true,
    api_call: 'createDraftPullRequest',
  };
}

async function buildWriteWorkflow(context: MetaAgentContext, input: { repository: string; actionType: 'create_github_issue' | 'create_pull_request_draft'; objective: string; writePayload: Record<string, any> }) {
  const workflow = buildTaskApprovalWorkflow({
    registry: context.registry,
    objective: input.objective,
    repository: input.repository,
    action: { type: input.actionType, summary: input.objective },
    actionType: input.actionType,
    context: {},
    validationRequirements: ['human approval before write execution'],
    requestedOutputs: ['write_payload', 'approval_packet', 'approved_run_status'],
    evidenceBundle: { source: 'write_gate_stub', task_type: input.actionType, policy_version: '0.2.1' },
    expectedOutcome: `Prepare ${input.actionType} payload for ${input.repository} without API call until Stage 6.`,
    rollbackPlan: 'No external mutation occurs at this stage; discard stub and replay from new approval token if needed.',
    createdAt: new Date().toISOString(),
    costImpact: null,
    customerSupplierImpact: null,
  });
  await persistWorkflow(context, workflow);
  const run = workflow.agent_run as Record<string, any> | undefined;
  const runAwarePayload = { ...input.writePayload, metadata: { ...(input.writePayload.metadata || {}), run_id: run?.run_id || null } };
  return {
    mode: 'write-gated-stub',
    task_packet: workflow.task_packet,
    approval_packet: workflow.approval_packet,
    pending_approval: workflow.pending_approval,
    agent_run: workflow.agent_run,
    write_payload: runAwarePayload,
    execution_plan: {
      status: workflow.pending_approval?.status ?? 'not_queued',
      reason: workflow.approval_packet ? 'Approval required before execution.' : 'No approval required by policy.',
      run_id: run?.run_id || null,
      execute_mode: 'stub-only',
    },
  };
}

async function requireSignedApproverRoleForWrite(context: MetaAgentContext, args: { approvalId: string; approverRole: string; queueId?: string; runId?: string }) {
  const [approvalRows, queueRows, decisionRows] = await Promise.all([
    context.stateStore.get('approvalPackets', args.approvalId),
    context.stateStore.list('approvalQueues'),
    context.stateStore.list('approvalDecisions'),
  ]);
  if (!approvalRows) throw new Error(`Approval packet not found for approvalId=${args.approvalId}.`);
  const approval = getRecord(approvalRows.value);
  if (!approval.required_approver_roles?.includes(args.approverRole)) throw new Error(`Approver role '${args.approverRole}' is not authorized for approval ${args.approvalId}.`);
  const queue = args.queueId ? queueRows.find((row) => row.id === args.queueId) : queueRows.find((row) => getRecord(row.value).approval_id === args.approvalId);
  if (!queue) throw new Error(`Approval queue not found for approvalId=${args.approvalId}.`);
  const queueValue = getRecord(queue.value);
  if (queueValue.status !== 'approved') throw new Error(`Approval packet ${args.approvalId} is not approved; current status=${queueValue.status}.`);
  const decision = decisionRows.map((record) => getRecord(record.value)).find((candidate) =>
    candidate.approval_id === args.approvalId &&
    candidate.approver_role === args.approverRole &&
    ['approve_once', 'approve_with_limits'].includes(candidate.decision_type) &&
    candidate.queue_id === queue.id
  );
  if (!decision) throw new Error(`Approval packet ${args.approvalId} has not been approved by '${args.approverRole}'.`);
  return { queue: queueValue, approval, queueRecordId: queue.id };
}

async function writeDecisionAndUpdateRun(context: MetaAgentContext, input: { approvalId: string; runId?: string; queueId?: string; decisionType: 'approve_once' | 'approve_with_limits' | 'reject' | 'request_changes' | 'always_reject'; approverRole: string; constraints?: Record<string, unknown>; notes?: string; decidedAt?: string }) {
  const queuedRows = await context.stateStore.list('approvalQueues');
  const queueRecord = input.queueId ? queuedRows.find((row) => row.id === input.queueId) : queuedRows.find((row) => getRecord(row.value).approval_id === input.approvalId);
  if (!queueRecord) throw new Error(`Approval queue not found for approval_id=${input.approvalId}.`);
  const queue = getRecord(queueRecord.value);
  const decisionRecord = recordApprovalDecision({ pendingApproval: queue, decisionType: input.decisionType, approverRole: input.approverRole, decidedAt: input.decidedAt, constraints: input.constraints, notes: input.notes });
  const updatedQueue = applyApprovalDecision(queue, decisionRecord);
  await context.stateStore.put('approvalDecisions', decisionRecord.decision_id, { ...decisionRecord, operator_id: context.operatorId });
  await context.stateStore.put('approvalQueues', queueRecord.id, updatedQueue);

  const runId = input.runId ?? queue.run_id;
  const runRecord = runId ? await context.stateStore.get('agentRuns', runId) : null;
  let updatedRun = null;
  if (runRecord) {
    updatedRun = resumeRunFromApprovalQueue(getRecord(runRecord.value), updatedQueue);
    await context.stateStore.put('agentRuns', runRecord.id, updatedRun);
  }

  const approvalRecord = await context.stateStore.get('approvalPackets', input.approvalId);
  if (approvalRecord) {
    const approval = getRecord(approvalRecord.value);
    const nextStatus = queueStatusToApprovalPacketStatus(input.decisionType);
    const approvedRoles = Array.isArray(updatedQueue.approved_roles) ? updatedQueue.approved_roles : [];
    const approved = updatedQueue.status === 'approved';
    const updatedApproval = {
      ...approval,
      status: nextStatus,
      approved_actions: approved ? Array.from(new Set([...(approval.approved_actions || []), approval.action_type].filter(Boolean))) : [],
      approver_roles: approved ? Array.from(new Set([...(approval.approver_roles || []), ...approvedRoles])) : [],
      approved_by_roles: approved ? approvedRoles : [],
      approval_queue_status: updatedQueue.status,
    };
    await context.stateStore.put('approvalPackets', input.approvalId, updatedApproval);
  }

  const evidenceId = stableId('evidence', { approval_id: input.approvalId, decision_type: input.decisionType, approver_role: input.approverRole });
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

  return { decision_record: decisionRecord, queue: updatedQueue, run: updatedRun, evidence_event_id: evidenceId, audit_event_id: auditId };
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
  parameters: z.object({ actionType: z.string().min(1), context: actionContextSchema.optional() }),
  async execute({ actionType, context: actionContext }, runContext) {
    getContext(runContext as RunContext<MetaAgentContext>);
    return classifyAction(actionType, actionContext ?? {});
  },
});

export const getPortfolioRegistryTool = tool({
  name: 'get_portfolio_registry',
  description: 'List repositories and known orchestrator status from the local portfolio registry. This is read-only.',
  parameters: z.object({ includeDiscoveryTargets: z.boolean().default(false) }),
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
      evidenceBundle: { policy_version: '0.2.1', evidence_refs: args.evidenceRefs ?? [] },
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
  parameters: z.object({ objective: z.string().min(1), repositories: z.array(z.string().min(1)).min(1), actionType: z.string().min(1), requestedOutputs: z.array(z.string()).optional(), validationRequirements: z.array(z.string()).optional(), context: actionContextSchema.optional() }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    for (const repository of args.repositories) requireAuthorizedRepository(context, repository);
    const plan = buildPortfolioRoutingPlan({ registry: context.registry, objective: args.objective, repositories: args.repositories, action: { type: args.actionType, summary: args.objective }, actionType: args.actionType, requestedOutputs: args.requestedOutputs, validationRequirements: args.validationRequirements, context: args.context ?? {} });
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

export const createGitHubIssueTool = tool({
  name: 'create_github_issue',
  description: 'Prepare a GitHub issue write payload and approval packet, but do not call GitHub API until Stage 6.',
  parameters: z.object({ repository: z.string().min(1), title: z.string().min(1), body: z.string().default(''), labels: z.array(z.string()).default([]), assignees: z.array(z.string()).default([]), environment: z.string().default('non-production'), approvalId: z.string().optional(), queueId: z.string().optional(), approverRole: z.string().optional() }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const plan = await buildWriteWorkflow(context, { repository: args.repository, actionType: 'create_github_issue', objective: `Create issue: ${args.title}`, writePayload: buildIssuePayload(args) });
    if (args.approvalId && args.approverRole) await requireSignedApproverRoleForWrite(context, { approvalId: args.approvalId, approverRole: args.approverRole, queueId: args.queueId, runId: plan.agent_run?.run_id });
    return { ...plan, write_tool: 'create_github_issue', prepared_for_stage6: true, write_enabled: false, external_side_effect_executed: false };
  },
});

export const createDraftPRTool = tool({
  name: 'create_draft_pr',
  description: 'Prepare a draft PR payload and approval packet, but do not call GitHub API until Stage 6.',
  parameters: z.object({ repository: z.string().min(1), title: z.string().min(1), body: z.string().default(''), baseBranch: z.string().default('main'), headBranch: z.string().min(1), reviewers: z.array(z.string()).default([]), labels: z.array(z.string()).default([]), environment: z.string().default('non-production'), approvalId: z.string().optional(), queueId: z.string().optional(), approverRole: z.string().optional() }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const plan = await buildWriteWorkflow(context, { repository: args.repository, actionType: 'create_pull_request_draft', objective: `Create draft PR: ${args.title}`, writePayload: buildDraftPrPayload(args) });
    if (args.approvalId && args.approverRole) await requireSignedApproverRoleForWrite(context, { approvalId: args.approvalId, approverRole: args.approverRole, queueId: args.queueId, runId: plan.agent_run?.run_id });
    return { ...plan, write_tool: 'create_draft_pr', prepared_for_stage6: true, write_enabled: false, external_side_effect_executed: false };
  },
});

export const queueControlledActionTool = tool({
  name: 'queue_controlled_action',
  description: 'Request explicit human authorization for an external side-effect action. Approval only records authorization intent; this tool never performs the external action.',
  parameters: z.object({ actionType: z.string().min(1), repository: z.string().min(1), exactAction: z.string().min(1), approvalPacketId: z.string().min(1), environment: z.string().default('non-production') }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const policyDecision = classifyAction(args.actionType, {});
    if (policyDecision.blocked) throw new Error(`Hard-blocked action cannot be authorized: ${String(policyDecision.reason)}`);
    const event = { event_id: stableId('audit', { ...args, operatorId: context.operatorId }), event_type: 'controlled_action_authorization_recorded', operator_id: context.operatorId, action_type: args.actionType, repository: args.repository, exact_action: args.exactAction, approval_packet_id: args.approvalPacketId, environment: args.environment, execution_status: 'not_executed', external_side_effect_executed: false, recorded_at: new Date().toISOString() };
    await context.stateStore.put('auditEvents', event.event_id, event);
    return event;
  },
});

export const scheduleRepositoryScanTool = tool({
  name: 'run_scheduled_scan',
  description: 'Run a read-only scheduled scan across one or more repositories and persist scan tasks to state.',
  parameters: z.object({ repositories: z.array(z.string().min(1)).optional(), actionType: z.string().default('compute_project_health'), scanLabel: z.string().default('portfolio_control_plane_scan'), objective: z.string().default('Run scheduled read-only portfolio scan.'), context: actionContextSchema.optional() }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    const repositoryList = (args.repositories && args.repositories.length) ? args.repositories : context.registry.repositories.map((repo) => repo.repository_full_name);
    const workflows = [];
    for (const repository of repositoryList) {
      requireAuthorizedRepository(context, repository);
      const workflow = buildTaskApprovalWorkflow({ registry: context.registry, objective: args.objective, repository, action: { type: args.actionType, summary: args.objective }, actionType: args.actionType, context: args.context ?? {}, requestedOutputs: ['project_health', 'approval_gate_status', 'scan_report'], validationRequirements: ['read-only scan', 'no side effects'], evidenceBundle: { source: 'scheduled_scan_tool', scan_label: args.scanLabel }, expectedOutcome: 'Produce deterministic evidence for operating readiness.', rollbackPlan: 'No external execution in scan mode.', createdAt: new Date().toISOString() });
      await persistWorkflow(context, workflow);
      workflows.push({ repository, workflow_id: workflow.task_packet?.task_id || null, queue_status: workflow.pending_approval ? workflow.pending_approval.status : 'not_required', run_id: workflow.agent_run?.run_id || null });
    }
    const alertId = stableId('audit', { type: 'scheduled_scan_completed', scan_label: args.scanLabel, repositories: repositoryList, operator: context.operatorId });
    await context.stateStore.put('auditEvents', alertId, { event_type: 'scheduled_scan_completed', scan_label: args.scanLabel, repository_count: repositoryList.length, operator_id: context.operatorId, task_count: workflows.length, created_at: new Date().toISOString() });
    return { scan_label: args.scanLabel, repositories: repositoryList, action_type: args.actionType, workflow_count: workflows.length, workflows, source: 'scheduled_scan_tool', audit_event_id: alertId, external_side_effects_executed: false };
  },
});

export const prepareControlledIntegrationTool = tool({
  name: 'prepare_controlled_integration',
  description: 'Prepare an approval-gated payload for billing/marketing/procurement integrations; no server-side secrets are accepted at any nesting depth.',
  parameters: z.object({ repository: z.string().min(1), actionType: z.string().min(1), objective: z.string().min(1), integrationMeta: z.record(z.unknown()).default({}), requestedOutputs: z.array(z.string()).default(['integration_payload', 'approval_packet']), approvalReason: z.string().default('human-in-the-loop required'), environment: z.string().default('non-production') }),
  needsApproval: true,
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    assertNoSecretFields(args.integrationMeta, 'integrationMeta');
    const decision = classifyAction(args.actionType, { objective: args.objective, environment: args.environment });
    if (decision.blocked) throw new Error(`Integration cannot be prepared because action is blocked: ${String(decision.reason)}`);
    if (!decision.requiresHumanApproval) throw new Error('Integration path is not configured for approval-gated execution in this plan.');
    const gatedDecision = addApproverQuorum(decision);
    const workflow = buildTaskApprovalWorkflow({ registry: context.registry, objective: args.objective, repository: args.repository, action: { type: args.actionType, summary: args.objective }, actionType: args.actionType, policyDecision: gatedDecision, requestedOutputs: ['integration_payload', 'approval_packet', 'rollback_plan', 'audit_summary'], validationRequirements: ['no secrets in payload at any nesting depth', 'human approval required before any external call', 'server-side secret retrieval only'], evidenceBundle: { policy_version: '0.2.1', integration_meta: args.integrationMeta }, expectedOutcome: `Prepare a server-side controlled payload for ${args.actionType} and await approval before execution.`, rollbackPlan: 'Do not execute external integration call unless approvals are valid and unexpired. Revoke prepared payload after expiry.', createdAt: new Date().toISOString(), costImpact: null, customerSupplierImpact: `Potential integration action in ${args.environment} with multi-approver controls.` });
    await persistWorkflow(context, workflow);
    const policy = getMultiApproverPolicy(gatedDecision);
    return { ...workflow, tool: 'prepare_controlled_integration', approval: workflow.approval_packet || null, multi_approver_control: policy ? { minimumApprovers: policy.minimumApprovers, requiredApproverRoles: Array.from(new Set([...(workflow.approval_packet?.required_approver_roles || []), ...policy.requiredRoles])), integrationType: policy.integrationType } : null, note: args.approvalReason, environment: args.environment, secret_field_paths_rejected: findSecretFieldPaths(args.integrationMeta), integration_payload: { destination: String(gatedDecision.category || 'external_integration'), action_type: args.actionType, repository: args.repository, approval_gate_required: true, multi_approver_required: Boolean(policy), prepared_at: new Date().toISOString(), server_side_secret_required: true }, external_side_effect_executed: false };
  },
});

export const emitExternalAlertTool = tool({
  name: 'emit_external_alert',
  description: 'Record a controlled external alert artifact for high-risk conditions and incidents.',
  parameters: z.object({ title: z.string().min(1), message: z.string().min(1), severity: z.enum(['info', 'warning', 'critical']).default('warning'), source: z.string().default('production_control_plane'), correlationId: z.string().optional() }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    const id = stableId('alert', { title: args.title, source: args.source, correlationId: args.correlationId || 'none' });
    await context.stateStore.put('auditEvents', id, { event_type: 'external_alert', alert_id: id, source: args.source, title: args.title, message: args.message, severity: args.severity, correlation_id: args.correlationId || null, operator_id: context.operatorId, recorded_at: new Date().toISOString() });
    return { alert_id: id, status: 'recorded', source: args.source, severity: args.severity };
  },
});

export const buildBackupPlanTool = tool({
  name: 'build_backup_plan',
  description: 'Prepare a deterministic backup workflow artifact for potential rollback.',
  parameters: z.object({ repository: z.string().min(1), targetScope: z.string().default('full'), objective: z.string().default('Prepare backup manifest for rollback readiness.'), retentionDays: z.number().int().positive().max(365).default(30), runCorrelationId: z.string().optional() }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const backupId = stableId('backup', { repository: args.repository, targetScope: args.targetScope, timestamp: new Date().toISOString() });
    const workflow = buildTaskApprovalWorkflow({ registry: context.registry, objective: args.objective, repository: args.repository, action: { type: 'create_internal_plan', summary: args.objective }, actionType: 'create_internal_plan', requestedOutputs: ['backup_manifest', 'rollback_readiness'], validationRequirements: ['read-only backup planning'], evidenceBundle: { policy_version: '0.2.1', backup_artifact: backupId }, expectedOutcome: 'Prepare a recovery/rollback readiness plan.', rollbackPlan: 'Retain plan until next backup window; invalidate after successful incident test.', createdAt: new Date().toISOString() });
    await persistWorkflow(context, workflow);
    const record = { backup_plan_id: backupId, repository: args.repository, scope: args.targetScope, retention_days: args.retentionDays, workflow_task_id: workflow.task_packet?.task_id || null, run_correlation_id: args.runCorrelationId || null, prepared_by: context.operatorId, created_at: new Date().toISOString(), status: 'prepared', external_side_effect_executed: false };
    await context.stateStore.put('backupPlans', backupId, record);
    return { ...record, rollback_readiness: 'queued', task_packet_id: workflow.task_packet?.task_id || null };
  },
});

export const buildRollbackPlanTool = tool({
  name: 'build_rollback_plan',
  description: 'Prepare a deterministic rollback workflow plan that stays server-side until authorized.',
  parameters: z.object({ repository: z.string().min(1), targetRunId: z.string().min(1), triggerEventId: z.string().optional(), recoveryObjective: z.string().default('Revert last unsafe change after approved rollback.') }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const rollbackId = stableId('rollback', { repository: args.repository, targetRunId: args.targetRunId });
    const rollbackRecord = { rollback_plan_id: rollbackId, repository: args.repository, target_run_id: args.targetRunId, trigger_event_id: args.triggerEventId || null, recovery_objective: args.recoveryObjective, approval_required: true, requested_by: context.operatorId, prepared_at: new Date().toISOString(), status: 'prepared', execution_mode: 'controlled_runbook_only', executed: false };
    await context.stateStore.put('agentRuns', rollbackId, rollbackRecord);
    await context.stateStore.put('auditEvents', rollbackId, { event_type: 'rollback_plan_prepared', rollback_plan_id: rollbackId, repository: args.repository, target_run_id: args.targetRunId, operator_id: context.operatorId, recorded_at: new Date().toISOString() });
    return rollbackRecord;
  },
});

export const recordDecisionTool = tool({
  name: 'record_decision',
  description: 'Write an approval/rejection decision for a queue entry and advance run state.',
  parameters: z.object({ approvalId: z.string().min(1), runId: z.string().optional(), queueId: z.string().optional(), decisionType: z.enum(['approve_once', 'approve_with_limits', 'reject', 'request_changes', 'always_reject']), approverRole: z.string().min(1), constraints: z.record(z.unknown()).default({}), notes: z.string().default(''), decidedAt: z.string().datetime().optional() }),
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
  scheduleRepositoryScanTool,
  prepareControlledIntegrationTool,
  emitExternalAlertTool,
  buildBackupPlanTool,
  buildRollbackPlanTool,
];
