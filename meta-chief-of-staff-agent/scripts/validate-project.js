#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifyAction, summarizePolicy } = require('../src/policy-engine');
const { evaluateToolGuardrail } = require('../src/guardrails');
const { validateApprovalDecision } = require('../src/approval-policy');
const { buildTaskApprovalWorkflow } = require('../src/packet-workflow');
const { buildProcurementWorkflow } = require('../src/procurement/procurement-workflow');
const { buildPortfolioRoutingPlan } = require('../src/orchestrators/portfolio-router');

const root = path.join(__dirname, '..');
const requiredFiles = [
  'package.json',
  'tsconfig.json',
  'README.md',
  'PRD.md',
  'ARCHITECTURE.md',
  'ROADMAP.md',
  'MILESTONES.md',
  'IMPLEMENTATION-PLAN.md',
  'AGENT-MODEL.md',
  'GOVERNANCE-AUTHORIZATIONS.md',
  'RISK-REGISTER.md',
  'registries/repositories.seed.json',
  'schemas/approval-packet.schema.json',
  'schemas/task-packet.schema.json',
  'schemas/project-health.schema.json',
  'schemas/agent-run.schema.json',
  'schemas/procurement-request.schema.json',
  'schemas/procurement-brief.schema.json',
  'policies/authorization-matrix.yaml',
  'policies/action-risk-policy.yaml',
  'src/policy-engine.js',
  'src/guardrails.js',
  'src/approval-policy.js',
  'src/packet-utils.js',
  'src/task-packet-builder.js',
  'src/approval-packet-builder.js',
  'src/run-state.js',
  'src/packet-workflow.js',
  'src/repository-registry.js',
  'src/meta-chief-agent.js',
  'src/orchestrators/orchestrator-registry.js',
  'src/orchestrators/repository-orchestrator-adapter.js',
  'src/orchestrators/portfolio-router.js',
  'src/oversight/oversight-registry.js',
  'src/procurement/procurement-policy.js',
  'src/procurement/procurement-workflow.js',
  'src/state/StateStore.ts',
  'src/state/InMemoryStateStore.ts',
  'src/sdk/context.ts',
  'src/sdk/tools.ts',
  'src/sdk/specialists.ts',
  'src/sdk/meta-chief-of-staff.ts',
  'src/sdk/cli.ts',
  'src/sdk/smoke.ts',
  'src/sdk/index.ts',
  'scripts/run-dry-run.js',
  'scripts/run-policy-check.js',
  'scripts/run-phase3-demo.js',
  'scripts/run-phase4-procurement-demo.js',
  'scripts/validate-project.js',
  'tests/phase2-policy.test.js',
  'tests/phase3-packets.test.js',
  'tests/phase4-routing-procurement.test.js'
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${file}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const script of ['validate', 'phase4', 'verify', 'typecheck', 'sdk:smoke', 'sdk:chat', 'sdk:resume']) {
  if (!packageJson.scripts || !packageJson.scripts[script]) throw new Error(`Missing package script: ${script}`);
}
if (packageJson.dependencies?.['@openai/agents'] !== '0.11.6') throw new Error('Agents SDK dependency must be pinned to audited version 0.11.6.');
if (!packageJson.dependencies?.zod) throw new Error('Missing zod dependency.');
if (!packageJson.devDependencies?.typescript || !packageJson.devDependencies?.tsx) throw new Error('Missing TypeScript runtime dependencies.');

const registry = JSON.parse(fs.readFileSync(path.join(root, 'registries/repositories.seed.json'), 'utf8'));
if (!Array.isArray(registry.repositories) || registry.repositories.length < 1) throw new Error('Repository registry must contain at least one repository.');

const known = registry.repositories.filter((repo) => repo.orchestrator && repo.orchestrator.known);
if (!known.some((repo) => repo.repository_full_name === 'dzinh1901-lang/aurelean-app')) throw new Error('Known orchestrator missing: aurelean-app');
if (!known.some((repo) => repo.repository_full_name === 'dzinh1901-lang/designOS-App')) throw new Error('Known orchestrator missing: designOS-App');

for (const schema of ['approval-packet', 'task-packet', 'project-health', 'agent-run', 'procurement-request', 'procurement-brief']) {
  JSON.parse(fs.readFileSync(path.join(root, 'schemas', `${schema}.schema.json`), 'utf8'));
}

const agentDir = path.join(root, 'agents');
const agentFiles = fs.readdirSync(agentDir).filter((name) => name.endsWith('.md'));
for (const file of agentFiles) {
  const body = fs.readFileSync(path.join(agentDir, file), 'utf8');
  if (!body.startsWith('---')) throw new Error(`Agent file missing YAML front matter: ${file}`);
  if (/can_self_approve:\s*true/.test(body)) throw new Error(`Agent file grants self approval: ${file}`);
}

const policy = summarizePolicy();
if (policy.self_approval_allowed !== false) throw new Error('Policy summary must forbid self-approval.');
if (policy.default_mode !== 'read_only_until_authorized') throw new Error('Default policy mode must remain read-only until authorized.');

const readOnly = classifyAction('read_repository_metadata');
if (!readOnly.allowed || readOnly.requiresHumanApproval || readOnly.blocked) throw new Error('Read-only metadata should be allowed without approval.');

const draftPr = classifyAction('create_pull_request_draft');
if (draftPr.risk !== 'high' || !draftPr.requiresHumanApproval || draftPr.allowed || draftPr.blocked) throw new Error('Draft PR should be high-risk and approval gated.');

const unknown = classifyAction('not_a_real_action');
if (unknown.risk !== 'critical' || !unknown.blocked || unknown.allowed) throw new Error('Unknown action must fail closed as critical blocked.');

const secret = classifyAction('request_secret_access');
if (!secret.blocked || secret.allowed || !secret.reason.includes('prohibited in v1')) throw new Error('Secret access must be blocked/prohibited in v1.');

const publicGuard = evaluateToolGuardrail({ actionType: 'publish_public_marketing' });
if (publicGuard.allowed || !publicGuard.requiresApproval) throw new Error('Public marketing must pause for approval.');

const approvedIssue = evaluateToolGuardrail({
  actionType: 'create_github_issue',
  approval: {
    status: 'approved',
    approved_actions: ['create_github_issue'],
    approver_roles: ['engineering_approver'],
    expires_at: '2999-01-01T00:00:00Z'
  }
});
if (!approvedIssue.allowed) throw new Error('Scoped engineering approval should allow create_github_issue.');

const missingRole = validateApprovalDecision({
  actionType: 'deploy_production',
  approval: {
    status: 'approved',
    approved_actions: ['deploy_production'],
    approver_roles: ['principal_approver'],
    expires_at: '2999-01-01T00:00:00Z'
  }
});
if (missingRole.executable || !missingRole.errors.some((error) => error.includes('engineering_approver'))) throw new Error('Approval validation must reject missing required approver roles.');

const gatedWorkflow = buildTaskApprovalWorkflow({
  objective: 'Create draft PR for project-health reporting.',
  repository: 'dzinh1901-lang/aurelean-app',
  action: { type: 'create_pull_request_draft', summary: 'Create draft PR for project-health reporting.' },
  actionType: 'create_pull_request_draft',
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
if (!gatedWorkflow.task_packet.task_id || !gatedWorkflow.approval_packet || !gatedWorkflow.pending_approval) throw new Error('Gated workflow must generate task, approval, and pending approval packets.');
if (gatedWorkflow.task_packet.approval_id !== gatedWorkflow.approval_packet.approval_id) throw new Error('Task packet must link generated approval packet.');
if (gatedWorkflow.agent_run.status !== 'paused_for_approval') throw new Error('Gated workflow run must pause for approval.');

const routingPlan = buildPortfolioRoutingPlan({
  registry,
  objective: 'Read portfolio metadata.',
  repositories: ['dzinh1901-lang/aurelean-app', 'dzinh1901-lang/designOS-App'],
  action: { type: 'read_repository_metadata', summary: 'Read portfolio metadata.' },
  actionType: 'read_repository_metadata',
  createdAt: '2026-06-18T00:00:00Z'
});
if (routingPlan.routes.length !== 2 || routingPlan.external_side_effects_executed !== false) throw new Error('Portfolio routing smoke check failed.');

const procurementWorkflow = buildProcurementWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Shortlist analytics vendors.',
  intent: 'shortlist',
  estimated_cost: 12000,
  budget_owner: 'portfolio_principal',
  contract_required: true,
  legal_compliance_review_id: 'legal-review-001',
  security_review_id: 'security-review-001',
  data_access: true,
  vendors: [
    { vendor_id: 'vendor_alpha', vendor_name: 'Vendor Alpha', security_review_status: 'pending', legal_review_status: 'pending' },
    { vendor_id: 'vendor_beta', vendor_name: 'Vendor Beta', security_review_status: 'approved', legal_review_status: 'approved' }
  ],
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
if (procurementWorkflow.procurement_brief.blocked) throw new Error('Complete procurement shortlist should not be blocked.');
if (!procurementWorkflow.task_workflow.approval_packet || procurementWorkflow.task_workflow.agent_run.status !== 'paused_for_approval') throw new Error('Procurement shortlist must generate an approval packet and pause.');
if (procurementWorkflow.task_workflow.approval_packet.constraints.maximum_budget !== 12000) throw new Error('Procurement approval packet must be budget scoped.');

const incompleteCommitment = buildProcurementWorkflow({
  registry,
  repository: 'dzinh1901-lang/aurelean-app',
  summary: 'Incomplete vendor award.',
  intent: 'award',
  estimated_cost: 5000,
  budget_owner: 'portfolio_principal',
  vendors: [{ vendor_id: 'vendor_alpha', vendor_name: 'Vendor Alpha' }],
  createdAt: '2026-06-18T00:00:00Z'
});
if (!incompleteCommitment.procurement_brief.blocked || incompleteCommitment.task_workflow.approval_packet !== null) throw new Error('Incomplete procurement commitment must block before approval.');

const sdkManagerSource = fs.readFileSync(path.join(root, 'src/sdk/meta-chief-of-staff.ts'), 'utf8');
const sdkToolsSource = fs.readFileSync(path.join(root, 'src/sdk/tools.ts'), 'utf8');
const sdkCliSource = fs.readFileSync(path.join(root, 'src/sdk/cli.ts'), 'utf8');
if (!sdkManagerSource.includes('specialistAgentTools') || !sdkManagerSource.includes('coreMetaTools')) throw new Error('SDK manager must compose core and specialist tools.');
if (!sdkToolsSource.includes('needsApproval: true')) throw new Error('Controlled action tool must use Agents SDK approval interruption.');
if (!sdkToolsSource.includes("stateStore.get('approvalPackets'")) throw new Error('Controlled action tool must validate the referenced approval packet.');
if (!sdkCliSource.includes('RunState.fromString') || !sdkCliSource.includes('interruptions')) throw new Error('SDK CLI must support resumable human approval interruptions.');

console.log(JSON.stringify({
  ok: true,
  phase: 'phase_4_and_sdk_runtime',
  repository_count: registry.repositories.length,
  known_orchestrator_count: known.length,
  agent_definition_count: agentFiles.length,
  policy_action_count: policy.action_count,
  validations: [
    'required_files_present',
    'package_scripts_and_dependencies_present',
    'schemas_parse',
    'agent_front_matter_present',
    'self_approval_forbidden',
    'read_only_allowed',
    'gated_workflow_pauses',
    'portfolio_routing_dry_run_only',
    'procurement_shortlist_scoped_and_gated',
    'incomplete_procurement_commitment_blocked',
    'sdk_manager_graph_present',
    'sdk_tool_approval_interrupt_present',
    'sdk_approval_packet_validation_present',
    'sdk_runstate_resume_present'
  ]
}, null, 2));
