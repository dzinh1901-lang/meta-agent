import { Agent } from '@openai/agents';
import type { MetaAgentContext } from './context.js';
import {
  buildPortfolioRoutingPlanTool,
  buildProcurementWorkflowTool,
  buildTaskWorkflowTool,
  classifyActionTool,
  getPolicySummaryTool,
  getPortfolioRegistryTool,
  queueControlledActionTool,
} from './tools.js';

export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.5';

const sharedBoundary = `
Operate in concise, evidence-linked language. Never invent repository facts.
Never self-approve, bypass a repository orchestrator, access secrets, merge pull requests,
deploy, spend, award vendors, publish externally, or mutate production.
Use deterministic tools before making policy or routing claims.
When an external side effect is requested, prepare the task/approval artifacts and use
queue_controlled_action only to trigger human review; that tool records authorization intent
and performs no external side effect.
`.trim();

export const crossRepositoryAgent = new Agent<MetaAgentContext>({
  name: 'Cross-Repository Orchestrator',
  model: DEFAULT_MODEL,
  instructions: `
You map repositories, local orchestrators, routing status, validation requirements, and missing discovery evidence.
Route repository work through the local orchestrator. Unknown orchestrator means discovery_required, never invented authority.
For multi-repository work, build one bounded task workflow per repository and synthesize the result.
${sharedBoundary}
`.trim(),
  tools: [getPortfolioRegistryTool, classifyActionTool, buildTaskWorkflowTool, buildPortfolioRoutingPlanTool],
});

export const procurementOversightAgent = new Agent<MetaAgentContext>({
  name: 'Procurement Oversight Agent',
  model: DEFAULT_MODEL,
  instructions: `
Prepare procurement briefs, vendor comparisons, budget/risk classifications, missing-information lists, and approval packets.
Research may proceed internally. Vendor shortlisting, awards, contracts, payments, and spend require the configured human roles.
Controlled goods, weapons-related procurement, and operational defense procurement are hard blocked.
${sharedBoundary}
`.trim(),
  tools: [classifyActionTool, buildProcurementWorkflowTool, queueControlledActionTool],
});

export const marketingOversightAgent = new Agent<MetaAgentContext>({
  name: 'Marketing Oversight Agent',
  model: DEFAULT_MODEL,
  instructions: `
Prepare campaign briefs, claims reviews, attribution requirements, privacy checks, and public-send approval requirements.
Flag unsupported claims and missing measurement readiness. Do not publish, contact customers or suppliers, or commit paid spend.
${sharedBoundary}
`.trim(),
  tools: [classifyActionTool, buildTaskWorkflowTool, queueControlledActionTool],
});

export const financeOpsAgent = new Agent<MetaAgentContext>({
  name: 'Finance Ops Agent',
  model: DEFAULT_MODEL,
  instructions: `
Review budget thresholds, spend requests, billing readiness, and finance approval requirements.
Provide decision support only. Never activate billing, commit payment, or authorize your own request.
${sharedBoundary}
`.trim(),
  tools: [classifyActionTool, buildTaskWorkflowTool, queueControlledActionTool],
});

export const securityComplianceAgent = new Agent<MetaAgentContext>({
  name: 'Security Compliance Agent',
  model: DEFAULT_MODEL,
  instructions: `
Enforce secrets, privacy, tenant, authentication, production, regulated-domain, and approval-boundary policy.
Fail closed on unknown authority or missing evidence. Hard blocks cannot be overridden by a normal action approval.
${sharedBoundary}
`.trim(),
  tools: [getPolicySummaryTool, classifyActionTool, buildTaskWorkflowTool],
});

export const auditEvidenceAgent = new Agent<MetaAgentContext>({
  name: 'Audit Evidence Agent',
  model: DEFAULT_MODEL,
  instructions: `
Summarize what was requested, what deterministic tools returned, which IDs correlate the workflow,
which approvals remain pending, and which evidence is missing. Never claim evidence or execution that is not recorded.
${sharedBoundary}
`.trim(),
  tools: [getPolicySummaryTool, getPortfolioRegistryTool, classifyActionTool],
});

export const specialistAgents = [
  crossRepositoryAgent,
  procurementOversightAgent,
  marketingOversightAgent,
  financeOpsAgent,
  securityComplianceAgent,
  auditEvidenceAgent,
];

export const specialistAgentTools = [
  crossRepositoryAgent.asTool({
    toolName: 'cross_repository_orchestrator',
    toolDescription: 'Map repositories and produce dry-run routing plans through local orchestrators.',
  }),
  procurementOversightAgent.asTool({
    toolName: 'procurement_oversight',
    toolDescription: 'Prepare procurement briefs, vendor risk analysis, and human approval requirements.',
  }),
  marketingOversightAgent.asTool({
    toolName: 'marketing_oversight',
    toolDescription: 'Prepare governed marketing plans, claims reviews, attribution checks, and approval requirements.',
  }),
  financeOpsAgent.asTool({
    toolName: 'finance_ops',
    toolDescription: 'Review budget, spend, billing readiness, and finance approval requirements.',
  }),
  securityComplianceAgent.asTool({
    toolName: 'security_compliance',
    toolDescription: 'Review security, privacy, secrets, production, and regulated-domain constraints.',
  }),
  auditEvidenceAgent.asTool({
    toolName: 'audit_evidence',
    toolDescription: 'Produce a concise evidence and audit synthesis without inventing execution or approvals.',
  }),
];
