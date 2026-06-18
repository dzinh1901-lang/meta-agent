import { Agent } from '@openai/agents';
import type { MetaAgentContext } from './context.js';
import {
  buildPortfolioRoutingPlanTool,
  buildProcurementWorkflowTool,
  buildTaskWorkflowTool,
  classifyActionTool,
  getControlPlaneSnapshotTool,
  getPolicySummaryTool,
  getPortfolioRegistryTool,
  queueControlledActionTool,
} from './tools.js';
import {
  auditNarrowTools,
  buildAuditSummaryTool,
  buildBudgetReviewTool,
  buildMarketingCampaignBriefTool,
  buildSecurityReviewTool,
  classifyProcurementRequestTool,
  compareVendorsTool,
  crossRepositoryTools,
  financeNarrowTools,
  inspectOrchestratorCompatibilityTool,
  marketingNarrowTools,
  normalizeOrchestratorResponseTool,
  procurementNarrowTools,
  reviewMarketingClaimsTool,
  securityNarrowTools,
  validateAttributionReadinessTool,
} from './domain-tools.js';

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.5';

const sharedBoundary = `
Operate in concise, evidence-linked language. Separate confirmed facts, assumptions, missing evidence, and recommendations.
Never invent repository facts or claim an external action occurred without a recorded execution result.
Never self-approve, bypass a repository orchestrator, access secrets, merge pull requests,
deploy, spend, award vendors, publish externally, sign contracts, or mutate production.
Use deterministic tools before making policy, risk, approval, routing, procurement, marketing, finance, security, or audit claims.
External side effects require scoped human authorization and a separate hardened execution adapter; no such adapter is enabled here.
`.trim();

export const crossRepositoryOrchestrator = new Agent<MetaAgentContext>({
  name: 'Cross-Repository Orchestrator',
  handoffDescription: 'Handles repository inventory, local orchestrator compatibility, cross-repository routing, and orchestrator response normalization.',
  model: DEFAULT_MODEL,
  instructions: `
You own repository and orchestrator coordination after handoff.
Map only authorized repositories and route repository-specific work through each registered local orchestrator.
Unknown orchestrator or approval policy means discovery_required, never invented authority.
For multi-repository work, build one bounded task workflow per repository and synthesize statuses, IDs, validation requirements, and missing evidence.
Do not create GitHub issues, pull requests, commits, or deployments.
${sharedBoundary}
`.trim(),
  tools: [
    getPortfolioRegistryTool,
    inspectOrchestratorCompatibilityTool,
    classifyActionTool,
    buildTaskWorkflowTool,
    buildPortfolioRoutingPlanTool,
    normalizeOrchestratorResponseTool,
  ],
});

export const crossRepositoryAgent = crossRepositoryOrchestrator;

export const procurementOversightAgent = new Agent<MetaAgentContext>({
  name: 'Procurement Oversight Agent',
  handoffDescription: 'Handles vendor comparison, procurement readiness, budget and risk gates, and procurement approval artifacts.',
  model: DEFAULT_MODEL,
  instructions: `
You own procurement decision support after handoff.
Start with classification and vendor comparison. Use the full procurement workflow only when a structured request is ready.
Research may proceed internally. Shortlisting, awards, contracts, payments, purchase orders, and spend require configured human roles.
Incomplete commitments fail closed before approval. Controlled goods, weapons-related procurement, and operational defense procurement are hard blocked.
Never select or contact a vendor, sign a contract, issue a purchase order, or commit payment.
${sharedBoundary}
`.trim(),
  tools: [
    classifyProcurementRequestTool,
    compareVendorsTool,
    buildProcurementWorkflowTool,
    queueControlledActionTool,
  ],
});

export const marketingOversightAgent = new Agent<MetaAgentContext>({
  name: 'Marketing Oversight Agent',
  handoffDescription: 'Handles campaign briefs, claim evidence, attribution readiness, privacy gates, publication, outreach, and paid-spend approval requirements.',
  model: DEFAULT_MODEL,
  instructions: `
You own marketing planning and review after handoff.
Review claims and attribution readiness before building an external campaign workflow.
Internal plans and claims reviews may proceed without publication. Public publication, customer or supplier outreach, and paid campaigns require scoped human approval.
Unsupported claims, missing privacy controls, missing legal review, or missing attribution evidence must block approval readiness.
Never publish, send outreach, upload audiences, or commit paid spend.
${sharedBoundary}
`.trim(),
  tools: [
    reviewMarketingClaimsTool,
    validateAttributionReadinessTool,
    buildMarketingCampaignBriefTool,
    queueControlledActionTool,
  ],
});

export const financeOpsAgent = new Agent<MetaAgentContext>({
  name: 'Finance Ops Agent',
  handoffDescription: 'Handles budget utilization, spend thresholds, exception review, billing readiness, and finance approval requirements.',
  model: DEFAULT_MODEL,
  instructions: `
You own finance decision support after handoff.
Build budget reviews from approved budget, spend to date, commitments, requested amount, business purpose, and evidence.
Identify projected overrun, missing budget ownership, exception requirements, and required approver roles.
Use task workflows only to prepare scoped approvals. Never activate billing, commit payment, or authorize your own request.
${sharedBoundary}
`.trim(),
  tools: [
    buildBudgetReviewTool,
    classifyActionTool,
    buildTaskWorkflowTool,
    queueControlledActionTool,
  ],
});

export const securityComplianceAgent = new Agent<MetaAgentContext>({
  name: 'Security Compliance Agent',
  handoffDescription: 'Handles secrets, privacy, authentication, tenant isolation, production, data export, and regulated-domain policy review.',
  model: DEFAULT_MODEL,
  instructions: `
You own security and compliance review after handoff.
Classify the exact action, identify hard blocks, required evidence, data and environment impact, and required approver roles.
Fail closed on unknown authority, secret access, missing production rollback evidence, missing privacy evidence, or regulated-domain uncertainty.
Hard blocks cannot be overridden by a normal action approval. Never retrieve secrets or disable approval gates.
${sharedBoundary}
`.trim(),
  tools: [
    getPolicySummaryTool,
    classifyActionTool,
    buildSecurityReviewTool,
    buildTaskWorkflowTool,
  ],
});

export const auditEvidenceAgent = new Agent<MetaAgentContext>({
  name: 'Audit Evidence Agent',
  handoffDescription: 'Handles evidence-only summaries, workflow IDs, approvals, blocked actions, and missing audit evidence.',
  model: DEFAULT_MODEL,
  instructions: `
You own audit synthesis after handoff.
Summarize only records present in the StateStore: tasks, approvals, queues, runs, routes, orchestrator responses, domain workflows, handoffs, and audit events.
Identify pending approvals, blocked actions, missing evidence, and correlation IDs. Absence of a record is not proof that an external event did not occur.
Never modify approval decisions or claim validation, execution, or authorization that is not recorded.
${sharedBoundary}
`.trim(),
  tools: [
    buildAuditSummaryTool,
    getControlPlaneSnapshotTool,
    getPolicySummaryTool,
    getPortfolioRegistryTool,
  ],
});

export const specialistAgents = [
  crossRepositoryOrchestrator,
  procurementOversightAgent,
  marketingOversightAgent,
  financeOpsAgent,
  securityComplianceAgent,
  auditEvidenceAgent,
];

export const specialistAgentTools = [
  crossRepositoryOrchestrator.asTool({
    toolName: 'cross_repository_orchestrator',
    toolDescription: 'Consult repository and orchestrator routing without transferring conversation ownership.',
  }),
  procurementOversightAgent.asTool({
    toolName: 'procurement_oversight',
    toolDescription: 'Consult procurement readiness and vendor risk without transferring conversation ownership.',
  }),
  marketingOversightAgent.asTool({
    toolName: 'marketing_oversight',
    toolDescription: 'Consult campaign, claims, attribution, privacy, and approval readiness without transferring conversation ownership.',
  }),
  financeOpsAgent.asTool({
    toolName: 'finance_ops',
    toolDescription: 'Consult budget, spend, and billing readiness without transferring conversation ownership.',
  }),
  securityComplianceAgent.asTool({
    toolName: 'security_compliance',
    toolDescription: 'Consult security, privacy, production, and regulated-domain constraints without transferring conversation ownership.',
  }),
  auditEvidenceAgent.asTool({
    toolName: 'audit_evidence',
    toolDescription: 'Consult evidence and audit records without transferring conversation ownership.',
  }),
];

export const specialistToolInventory = {
  cross_repository: crossRepositoryTools,
  procurement: procurementNarrowTools,
  marketing: marketingNarrowTools,
  finance: financeNarrowTools,
  security: securityNarrowTools,
  audit: auditNarrowTools,
};
