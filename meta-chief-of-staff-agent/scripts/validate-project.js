#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifyAction, summarizePolicy } = require('../src/policy-engine');
const { evaluateToolGuardrail } = require('../src/guardrails');
const { validateApprovalDecision } = require('../src/approval-policy');

const root = path.join(__dirname, '..');
const requiredFiles = [
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
  'policies/authorization-matrix.yaml',
  'policies/action-risk-policy.yaml',
  'src/policy-engine.js',
  'src/guardrails.js',
  'src/approval-policy.js',
  'src/approval-packet-builder.js',
  'src/repository-registry.js',
  'src/meta-chief-agent.js',
  'scripts/run-policy-check.js'
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing required file: ${file}`);
}

const registry = JSON.parse(fs.readFileSync(path.join(root, 'registries/repositories.seed.json'), 'utf8'));
if (!Array.isArray(registry.repositories) || registry.repositories.length < 1) throw new Error('Repository registry must contain at least one repository.');

const known = registry.repositories.filter((repo) => repo.orchestrator && repo.orchestrator.known);
if (!known.some((repo) => repo.repository_full_name === 'dzinh1901-lang/aurelean-app')) throw new Error('Known orchestrator missing: aurelean-app');
if (!known.some((repo) => repo.repository_full_name === 'dzinh1901-lang/designOS-App')) throw new Error('Known orchestrator missing: designOS-App');

for (const schema of ['approval-packet', 'task-packet', 'project-health', 'agent-run']) {
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

const merge = classifyAction('merge_pull_request');
if (!merge.blocked || merge.allowed || !merge.reason.includes('prohibited in v1')) throw new Error('Merge PR must be prohibited in v1.');

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

console.log(JSON.stringify({
  ok: true,
  phase: 'phase_2_policy_enforcement',
  repository_count: registry.repositories.length,
  known_orchestrator_count: known.length,
  agent_definition_count: agentFiles.length,
  policy_action_count: policy.action_count,
  validations: [
    'required_files_present',
    'schemas_parse',
    'agent_front_matter_present',
    'self_approval_forbidden',
    'read_only_allowed',
    'draft_pr_approval_gated',
    'unknown_action_fails_closed',
    'secret_access_prohibited',
    'merge_pr_prohibited',
    'public_marketing_guarded',
    'scoped_approval_allows_issue_creation',
    'missing_approver_role_rejected'
  ]
}, null, 2));
