import { createMetaAgentContext } from './context.js';
import { metaChiefOfStaffAgent } from './meta-chief-of-staff.js';
import { specialistAgents } from './specialists.js';

const context = createMetaAgentContext({
  operatorId: 'sdk-smoke-operator',
  operatorRoles: ['principal_approver', 'engineering_approver'],
});

const tools = metaChiefOfStaffAgent.tools.map((entry) => entry.name);
const specialists = specialistAgents.map((agent) => agent.name);

if (!tools.includes('classify_action')) throw new Error('Root manager is missing classify_action.');
if (!tools.includes('cross_repository_orchestrator')) throw new Error('Root manager is missing cross_repository_orchestrator specialist tool.');
if (!tools.includes('procurement_oversight')) throw new Error('Root manager is missing procurement_oversight specialist tool.');
if (specialists.length !== 6) throw new Error(`Expected six specialist agents; received ${specialists.length}.`);

console.log(JSON.stringify({
  ok: true,
  agent: metaChiefOfStaffAgent.name,
  model: metaChiefOfStaffAgent.model,
  tool_count: tools.length,
  tools,
  specialist_count: specialists.length,
  specialists,
  authorized_repository_count: context.authorizedRepositories.length,
  external_side_effects_executed: false,
}, null, 2));
