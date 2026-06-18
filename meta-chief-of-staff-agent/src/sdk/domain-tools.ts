import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';
import type { MetaAgentContext } from './context.js';
import {
  asRecord,
  getMetaContext,
  persistTaskWorkflow,
  requireAuthorizedRepositories,
  requireAuthorizedRepository,
} from './runtime-helpers.js';

const { listOrchestratorCompatibility, createOrchestratorAdapter } = require('../orchestrators/orchestrator-registry.js') as {
  listOrchestratorCompatibility: (registry?: unknown) => Record<string, any>[];
  createOrchestratorAdapter: (repository: string, registry?: unknown) => {
    normalizeResponse: (response: Record<string, unknown>, taskPacket: Record<string, unknown>) => Record<string, any>;
  };
};
const { buildVendorRiskMatrix, classifyProcurementRequest } = require('../procurement/procurement-policy.js') as {
  buildVendorRiskMatrix: (vendors: Record<string, unknown>[]) => Record<string, any>[];
  classifyProcurementRequest: (request: Record<string, unknown>) => Record<string, any>;
};
const { reviewClaims, attributionReadiness, classifyMarketingRequest } = require('../marketing/marketing-policy.js') as {
  reviewClaims: (claims: Record<string, unknown>[]) => Record<string, any>;
  attributionReadiness: (request: Record<string, unknown>) => Record<string, any>;
  classifyMarketingRequest: (request: Record<string, unknown>) => Record<string, any>;
};
const { buildMarketingWorkflow } = require('../marketing/marketing-workflow.js') as {
  buildMarketingWorkflow: (input: Record<string, unknown>) => Record<string, any>;
};
const { buildBudgetReview } = require('../finance/finance-review.js') as {
  buildBudgetReview: (input: Record<string, unknown>) => Record<string, any>;
};
const { buildSecurityReview } = require('../security/security-review.js') as {
  buildSecurityReview: (input: Record<string, unknown>) => Record<string, any>;
};
const { stableId } = require('../packet-utils.js') as {
  stableId: (prefix: string, payload: unknown) => string;
};

const vendorSchema = z.object({
  vendor_id: z.string().optional(),
  vendor_name: z.string().min(1),
  data_access: z.boolean().default(false),
  system_access: z.boolean().default(false),
  security_review_status: z.string().default('not_started'),
  legal_review_status: z.string().default('not_started'),
  sole_source: z.boolean().default(false),
  cross_border: z.boolean().default(false),
  evidence_refs: z.array(z.string()).default([]),
});

const claimSchema = z.object({
  claim_id: z.string().optional(),
  text: z.string().min(1),
  evidence_refs: z.array(z.string()).default([]),
  regulated: z.boolean().default(false),
  requires_legal_review: z.boolean().default(false),
});

export const inspectOrchestratorCompatibilityTool = tool({
  name: 'inspect_orchestrator_compatibility',
  description: 'Inspect registered repository orchestrators, approval-policy status, and discovery requirements. Read-only.',
  parameters: z.object({ repositories: z.array(z.string().min(1)).optional() }),
  async execute({ repositories }, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    const selected = repositories ?? context.authorizedRepositories;
    requireAuthorizedRepositories(context, selected);
    const allowed = new Set(selected);
    const profiles = listOrchestratorCompatibility(context.registry).filter((profile) => allowed.has(profile.repository));
    return {
      repository_count: profiles.length,
      known_count: profiles.filter((profile) => profile.known).length,
      discovery_required_count: profiles.filter((profile) => !profile.known || !profile.approval_policy_known).length,
      restricted_count: profiles.filter((profile) => profile.restricted).length,
      profiles,
      external_side_effects_executed: false,
    };
  },
});

export const normalizeOrchestratorResponseTool = tool({
  name: 'normalize_orchestrator_response',
  description: 'Normalize and persist a repository-orchestrator response against a previously stored task packet. Read-only with respect to GitHub.',
  parameters: z.object({
    repository: z.string().min(1),
    taskId: z.string().min(1),
    status: z.enum(['accepted', 'planned', 'running', 'completed', 'blocked', 'failed']),
    outputs: z.array(z.string()).default([]),
    validationEvidence: z.array(z.string()).default([]),
    blockers: z.array(z.string()).default([]),
    nextActions: z.array(z.string()).default([]),
    auditCorrelationId: z.string().optional(),
  }),
  async execute(args, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const storedTask = await context.stateStore.get('taskPackets', args.taskId);
    if (!storedTask) throw new Error(`Task packet not found: ${args.taskId}`);
    const task = asRecord(storedTask.value, 'Task packet');
    if (task.repository !== args.repository) throw new Error('Task packet repository does not match requested repository.');
    const adapter = createOrchestratorAdapter(args.repository, context.registry);
    const normalized = adapter.normalizeResponse({
      status: args.status,
      outputs: args.outputs,
      validation_evidence: args.validationEvidence,
      blockers: args.blockers,
      next_actions: args.nextActions,
      audit_correlation_id: args.auditCorrelationId ?? task.audit_correlation_id,
    }, task);
    await context.stateStore.put('orchestratorResponses', normalized.response_id, normalized);
    return { ...normalized, external_side_effects_executed: false };
  },
});

export const compareVendorsTool = tool({
  name: 'compare_vendors',
  description: 'Create a deterministic vendor risk comparison. It does not shortlist, award, contact, or pay vendors.',
  parameters: z.object({
    repository: z.string().min(1),
    vendors: z.array(vendorSchema).min(1),
  }),
  async execute({ repository, vendors }, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, repository);
    const matrix = buildVendorRiskMatrix(vendors);
    const ranked = [...matrix].sort((a, b) => a.risk_score - b.risk_score || String(a.vendor_name).localeCompare(String(b.vendor_name)));
    return {
      comparison_id: stableId('vendorcompare', { repository, ranked }),
      repository,
      vendor_count: ranked.length,
      ranked_vendors: ranked,
      recommendation: 'Use this comparison as decision support only; any shortlist, award, contract, or payment requires the procurement workflow and human approval.',
      vendor_selected: false,
      external_side_effects_executed: false,
    };
  },
});

export const classifyProcurementRequestTool = tool({
  name: 'classify_procurement_request',
  description: 'Classify procurement intent, risk, missing readiness evidence, and required human roles without executing procurement.',
  parameters: z.object({
    intent: z.enum(['research', 'shortlist', 'award', 'contract', 'payment']),
    estimatedCost: z.number().nonnegative().optional(),
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
  }),
  async execute(args, runContext) {
    getMetaContext(runContext as RunContext<MetaAgentContext>);
    return classifyProcurementRequest({
      intent: args.intent,
      estimated_cost: args.estimatedCost,
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
    });
  },
});

export const reviewMarketingClaimsTool = tool({
  name: 'review_marketing_claims',
  description: 'Check whether campaign claims have evidence and identify regulated or legal-review-sensitive claims. It does not publish content.',
  parameters: z.object({ repository: z.string().min(1), claims: z.array(claimSchema) }),
  async execute({ repository, claims }, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, repository);
    return { repository, ...reviewClaims(claims), external_side_effects_executed: false };
  },
});

export const validateAttributionReadinessTool = tool({
  name: 'validate_attribution_readiness',
  description: 'Validate landing URL, UTM fields, and attribution events before campaign approval. It does not launch a campaign.',
  parameters: z.object({
    repository: z.string().min(1),
    landingUrl: z.string().url().optional(),
    utm: z.object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      content: z.string().optional(),
      term: z.string().optional(),
    }).default({}),
    attributionEvents: z.array(z.string()).default([]),
  }),
  async execute(args, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    return {
      repository: args.repository,
      ...attributionReadiness({ landing_url: args.landingUrl, utm: args.utm, attribution_events: args.attributionEvents }),
      external_side_effects_executed: false,
    };
  },
});

export const buildMarketingCampaignBriefTool = tool({
  name: 'build_marketing_campaign_brief',
  description: 'Build a governed campaign brief, claims review, attribution check, and approval workflow. It never publishes, sends outreach, or commits paid spend.',
  parameters: z.object({
    repository: z.string().min(1),
    summary: z.string().min(1),
    intent: z.enum(['plan', 'claims_review', 'public_publish', 'customer_outreach', 'paid_campaign']).default('plan'),
    audience: z.string().optional(),
    channels: z.array(z.string()).default([]),
    claims: z.array(claimSchema).default([]),
    landingUrl: z.string().url().optional(),
    utm: z.object({
      source: z.string().optional(),
      medium: z.string().optional(),
      campaign: z.string().optional(),
      content: z.string().optional(),
      term: z.string().optional(),
    }).default({}),
    attributionEvents: z.array(z.string()).default([]),
    budget: z.number().nonnegative().optional(),
    currency: z.string().length(3).default('USD'),
    budgetOwner: z.string().optional(),
    privacyReviewId: z.string().optional(),
    legalReviewId: z.string().optional(),
    recipientBasis: z.string().optional(),
    unsubscribeMechanism: z.string().optional(),
    trackingEnabled: z.boolean().default(false),
    personalDataUse: z.boolean().default(false),
    regulatedClaims: z.boolean().default(false),
    evidenceRefs: z.array(z.string()).default([]),
  }),
  async execute(args, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const workflow = buildMarketingWorkflow({
      registry: context.registry,
      repository: args.repository,
      summary: args.summary,
      intent: args.intent,
      audience: args.audience,
      channels: args.channels,
      claims: args.claims,
      landing_url: args.landingUrl,
      utm: args.utm,
      attribution_events: args.attributionEvents,
      budget: args.budget,
      currency: args.currency,
      budget_owner: args.budgetOwner,
      privacy_review_id: args.privacyReviewId,
      legal_review_id: args.legalReviewId,
      recipient_basis: args.recipientBasis,
      unsubscribe_mechanism: args.unsubscribeMechanism,
      tracking_enabled: args.trackingEnabled,
      personal_data_use: args.personalDataUse,
      regulated_claims: args.regulatedClaims,
      evidence_refs: args.evidenceRefs,
    });
    await context.stateStore.put('marketingWorkflows', workflow.marketing_request.marketing_request_id, workflow);
    await persistTaskWorkflow(context, workflow.task_workflow);
    return workflow;
  },
});

export const buildBudgetReviewTool = tool({
  name: 'build_budget_review',
  description: 'Build a deterministic budget and billing-readiness review. It never activates billing or commits payment.',
  parameters: z.object({
    repository: z.string().min(1),
    summary: z.string().min(1),
    approvedBudget: z.number().nonnegative(),
    spentToDate: z.number().nonnegative().default(0),
    committedAmount: z.number().nonnegative().default(0),
    requestedAmount: z.number().nonnegative(),
    currency: z.string().length(3).default('USD'),
    budgetOwner: z.string().optional(),
    purpose: z.string().optional(),
    recurring: z.boolean().default(false),
    billingActivation: z.boolean().default(false),
    securityReviewId: z.string().optional(),
    exceptionReason: z.string().optional(),
    evidenceRefs: z.array(z.string()).default([]),
  }),
  async execute(args, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const review = buildBudgetReview({
      repository: args.repository,
      summary: args.summary,
      approved_budget: args.approvedBudget,
      spent_to_date: args.spentToDate,
      committed_amount: args.committedAmount,
      requested_amount: args.requestedAmount,
      currency: args.currency,
      budget_owner: args.budgetOwner,
      purpose: args.purpose,
      recurring: args.recurring,
      billing_activation: args.billingActivation,
      security_review_id: args.securityReviewId,
      exception_reason: args.exceptionReason,
      evidence_refs: args.evidenceRefs,
    });
    await context.stateStore.put('financeReviews', review.budget_review_id, review);
    return review;
  },
});

export const buildSecurityReviewTool = tool({
  name: 'build_security_review',
  description: 'Review an action against security, privacy, production, secret, and evidence requirements. It cannot change policy or access secrets.',
  parameters: z.object({
    repository: z.string().min(1),
    actionType: z.string().min(1),
    environment: z.string().default('non-production'),
    dataClassification: z.string().default('internal'),
    authOrTenantChange: z.boolean().default(false),
    personalData: z.boolean().default(false),
    productionChangeId: z.string().optional(),
    requestsSecrets: z.boolean().default(false),
    regulatedDomain: z.boolean().default(false),
    evidence: z.record(z.string(), z.string()).default({}),
    evidenceRefs: z.array(z.string()).default([]),
  }),
  async execute(args, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const review = buildSecurityReview({
      repository: args.repository,
      action_type: args.actionType,
      environment: args.environment,
      data_classification: args.dataClassification,
      auth_or_tenant_change: args.authOrTenantChange,
      personal_data: args.personalData,
      production_change_id: args.productionChangeId,
      requests_secrets: args.requestsSecrets,
      regulated_domain: args.regulatedDomain,
      evidence: args.evidence,
      evidence_refs: args.evidenceRefs,
    });
    await context.stateStore.put('securityReviews', review.security_review_id, review);
    return review;
  },
});

export const buildAuditSummaryTool = tool({
  name: 'build_audit_summary',
  description: 'Build an evidence-only summary from records in the local state store. It never invents execution or approval evidence.',
  parameters: z.object({ limit: z.number().int().min(1).max(100).default(20) }),
  async execute({ limit }, runContext) {
    const context = getMetaContext(runContext as RunContext<MetaAgentContext>);
    const collections = [
      'taskPackets', 'approvalPackets', 'approvalQueues', 'agentRuns', 'routingPlans',
      'orchestratorResponses', 'procurementWorkflows', 'marketingWorkflows',
      'financeReviews', 'securityReviews', 'handoffEvents', 'auditEvents',
    ] as const;
    const entries = await Promise.all(collections.map(async (collection) => [collection, await context.stateStore.list(collection)] as const));
    const counts = Object.fromEntries(entries.map(([collection, records]) => [collection, records.length]));
    const queues = entries.find(([collection]) => collection === 'approvalQueues')?.[1] ?? [];
    const pendingApprovals = queues.map((record) => asRecord(record.value, 'Approval queue')).filter((queue) => queue.status === 'pending');
    const auditRecords = entries.find(([collection]) => collection === 'auditEvents')?.[1] ?? [];
    const recentAuditEvents = auditRecords.slice(-limit).map((record) => record.value);
    const summary = {
      operator_id: context.operatorId,
      generated_at: new Date().toISOString(),
      counts,
      pending_approval_count: pendingApprovals.length,
      pending_approvals: pendingApprovals,
      recent_audit_events: recentAuditEvents,
      evidence_limitations: [
        'Only records present in the configured StateStore are included.',
        'Absence of a record is not evidence that an external action did or did not occur.',
      ],
    };
    return { audit_summary_id: stableId('auditsummary', summary), ...summary };
  },
});

export const crossRepositoryTools = [inspectOrchestratorCompatibilityTool, normalizeOrchestratorResponseTool];
export const procurementNarrowTools = [classifyProcurementRequestTool, compareVendorsTool];
export const marketingNarrowTools = [reviewMarketingClaimsTool, validateAttributionReadinessTool, buildMarketingCampaignBriefTool];
export const financeNarrowTools = [buildBudgetReviewTool];
export const securityNarrowTools = [buildSecurityReviewTool];
export const auditNarrowTools = [buildAuditSummaryTool];
