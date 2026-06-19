#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyAction, approvalCoversAction } = require('../src/policy-engine');
const { validateApprovalDecision } = require('../src/approval-policy');
const { buildApprovalPacket } = require('../src/approval-packet-builder');
const { findSecretFieldPaths, assertNoSecretFields } = require('../src/secret-field-guard');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const phase7 = read('scripts/phase7-monitor-dashboard.js');
const phase8 = read('scripts/phase8-production-operations.js');
const migration = read('src/state/migrations/001_evidence_ledger.sql');
const stateStore = read('src/state/PostgresStateStore.ts');
const tools = read('src/sdk/tools.ts');

assert.ok(phase7.includes("projectHealthSnapshots: 'project_health_snapshots'"));
assert.ok(!phase7.includes("projectHealth: 'project_health'"));
assert.ok(phase7.includes("backupPlans: 'backup_plans'"));
assert.ok(phase8.includes("projectHealthSnapshots: 'project_health_snapshots'"));
assert.ok(!phase8.includes("projectHealth: 'project_health'"));
assert.ok(phase8.includes("backupPlans: 'backup_plans'"));
assert.ok(migration.includes('create table if not exists backup_plans'));
assert.ok(stateStore.includes("projectHealth: 'project_health_snapshots'"));
assert.ok(stateStore.includes("backupPlans: 'backup_plans'"));

const nestedSecrets = {
  provider: 'marketing_platform',
  credentials: {
    apiKey: 'sk-redacted',
    nested: [{ webhook_secret: 'redacted' }]
  }
};
assert.deepEqual(findSecretFieldPaths(nestedSecrets), ['credentials', 'credentials.apiKey', 'credentials.nested[0].webhook_secret']);
assert.throws(() => assertNoSecretFields(nestedSecrets, 'integrationMeta'), /credentials\.apiKey/);
assert.doesNotThrow(() => assertNoSecretFields({ provider: 'marketing_platform', audience: { segment: 'buyers' } }, 'integrationMeta'));
assert.ok(tools.includes('assertNoSecretFields(args.integrationMeta'));

const decision = classifyAction('create_github_issue');
const packet = buildApprovalPacket({
  action: { type: 'create_github_issue', summary: 'Create an approved issue.' },
  decision,
  repositories: ['dzinh1901-lang/aurelean-app'],
  requestingAgent: 'meta-chief-of-staff-agent',
  evidenceBundle: { test: 'phase1-8-audit' },
  expectedOutcome: 'Issue payload only.',
  rollbackPlan: 'Do not execute external write.',
  constraints: { allowed_repository: 'dzinh1901-lang/aurelean-app' },
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-06-18T00:00:00Z'
});
const approvedStoredPacket = { ...packet, status: 'approved' };
assert.equal(approvalCoversAction(decision, approvedStoredPacket, { repository: 'dzinh1901-lang/aurelean-app' }), true);
const validation = validateApprovalDecision({ actionType: 'create_github_issue', approval: approvedStoredPacket, scope: { repository: 'dzinh1901-lang/aurelean-app' } });
assert.equal(validation.executable, true);
assert.deepEqual(validation.errors, []);

assert.ok(tools.includes("stateStore.put('backupPlans'"));
assert.ok(!tools.includes("stateStore.put('approvalPackets', backupId"));

console.log(JSON.stringify({ ok: true, suite: 'phase1-8-audit-fixes', assertions: 25 }, null, 2));
