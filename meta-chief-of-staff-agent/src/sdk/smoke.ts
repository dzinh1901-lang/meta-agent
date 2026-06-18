import { createMetaAgentContext } from './context.js';
import { metaChiefOfStaffAgent } from './meta-chief-of-staff.js';
import {
  auditEvidenceAgent,
  crossRepositoryOrchestrator,
  financeOpsAgent,
  marketingOversightAgent,
  procurementOversightAgent,
  securityComplianceAgent,
  specialistAgents,
} from './specialists.js';
import { SPECIALIST_HANDOFF_TOOL_NAMES } from './handoffs.js';

const context = createMetaAgentContext({
  operatorId: 'sdk-smoke-operator',
  operatorRoles: ['principal_approver', 'engineering_approver'],
});

const rootTools = metaChiefOfStaffAgent.tools.map((entry) => entry.name);
const specialists = specialistAgents.map((agent) => agent.name);
const handoffCount = metaChiefOfStaffAgent.handoffs.length;

if (!rootTools.includes('classify_action')) throw new Error('Root manager is missing classify_action.');
if (rootTools.includes('cross_repository_orchestrator')) throw new Error('Root manager should delegate specialists through handoffs, not specialist agent tools.');
if (handoffCount !== 6) throw new Error(`Expected six specialist handoffs; received ${handoffCount}.`);
if (SPECIALIST_HANDOFF_TOOL_NAMES.length !== 6) throw new Error('Expected six named handoff tools.');
if (specialists.length !== 6) throw new Error(`Expected six specialist agents; received ${specialists.length}.`);

const requiredNarrowTools = new Map([
  [crossRepositoryOrchestrator, ['inspect_orchestrator_compatibility', 'normalize_orchestrator_response']],
  [procurementOversightAgent, ['classify_procurement_request', 'compare_vendors', 'build_procurement_workflow']],
  [marketingOversightAgent, ['review_marketing_claims', 'validate_attribution_readiness', 'build_marketing_campaign_brief']],
  [financeOpsAgent, ['build_budget_review']],
  [securityComplianceAgent, ['build_security_review']],
  [auditEvidenceAgent, ['build_audit_summary']],
]);

for (const [agent, expectedTools] of requiredNarrowTools) {
  const names = agent.tools.map((entry) => entry.name);
  for (const expected of expectedTools) {
    if (!names.includes(expected)) throw new Error(`${agent.name} is missing narrow tool: ${expected}`);
  }
}

console.log(JSON.stringify({
  ok: true,
  agent: metaChiefOfStaffAgent.name,
  model: metaChiefOfStaffAgent.model,
  root_tool_count: rootTools.length,
  root_tools: rootTools,
  handoff_count: handoffCount,
  handoff_tool_names: SPECIALIST_HANDOFF_TOOL_NAMES,
  specialist_count: specialists.length,
  specialists: specialistAgents.map((agent) => ({
    name: agent.name,
    tools: agent.tools.map((entry) => entry.name),
  })),
  authorized_repository_count: context.authorizedRepositories.length,
  external_side_effects_executed: false,
}, null, 2));
