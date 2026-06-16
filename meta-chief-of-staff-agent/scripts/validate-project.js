#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  'src/approval-packet-builder.js',
  'src/repository-registry.js',
  'src/meta-chief-agent.js'
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const registry = JSON.parse(fs.readFileSync(path.join(root, 'registries/repositories.seed.json'), 'utf8'));
if (!Array.isArray(registry.repositories) || registry.repositories.length < 1) {
  throw new Error('Repository registry must contain at least one repository.');
}

const known = registry.repositories.filter((repo) => repo.orchestrator && repo.orchestrator.known);
if (!known.some((repo) => repo.repository_full_name === 'dzinh1901-lang/aurelean-app')) {
  throw new Error('Known orchestrator missing: aurelean-app');
}
if (!known.some((repo) => repo.repository_full_name === 'dzinh1901-lang/designOS-App')) {
  throw new Error('Known orchestrator missing: designOS-App');
}

for (const schema of ['approval-packet', 'task-packet', 'project-health', 'agent-run']) {
  JSON.parse(fs.readFileSync(path.join(root, 'schemas', `${schema}.schema.json`), 'utf8'));
}

const agentDir = path.join(root, 'agents');
const agentFiles = fs.readdirSync(agentDir).filter((name) => name.endsWith('.md'));
for (const file of agentFiles) {
  const body = fs.readFileSync(path.join(agentDir, file), 'utf8');
  if (!body.startsWith('---')) {
    throw new Error(`Agent file missing YAML front matter: ${file}`);
  }
  if (/can_self_approve:\s*true/.test(body)) {
    throw new Error(`Agent file grants self approval: ${file}`);
  }
}

console.log(JSON.stringify({ ok: true, repository_count: registry.repositories.length, known_orchestrator_count: known.length, agent_definition_count: agentFiles.length }, null, 2));
