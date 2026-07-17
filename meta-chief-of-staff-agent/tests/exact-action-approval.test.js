#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { hashPayload } = require('../src/packet-utils');
const { buildApprovalPacket } = require('../src/approval-packet-builder');
const { approvalCoversAction, classifyAction } = require('../src/policy-engine');

const digestPayload = {
  binding_version: '1.0',
  action_type: 'create_pull_request_draft',
  tool_name: 'create_draft_pr',
  agent_name: 'Cross-Repository Orchestrator',
  repository: 'dzinh1901-lang/aurelean-app',
  environment: 'non-production',
  normalized_arguments: {
    baseBranch: 'main',
    environment: 'non-production',
    headBranch: 'cosmos/health-report',
    repository: 'dzinh1901-lang/aurelean-app',
    title: 'Draft project health report'
  }
};
const exactAction = { ...digestPayload, action_digest: hashPayload(digestPayload) };
const decision = classifyAction('create_pull_request_draft');
const packet = buildApprovalPacket({
  action: { type: 'create_pull_request_draft', summary: 'Draft project health report.' },
  decision,
  repositories: ['dzinh1901-lang/aurelean-app'],
  requestingAgent: 'Cross-Repository Orchestrator',
  evidenceBundle: { source: 'exact-action-regression-test' },
  constraints: { allowed_repository: 'dzinh1901-lang/aurelean-app' },
  expiresAt: '2999-01-01T00:00:00Z',
  createdAt: '2026-07-17T00:00:00Z',
  exactAction
});

assert.equal(packet.action_digest, exactAction.action_digest);
assert.equal(packet.constraints.action_digest, exactAction.action_digest);
assert.deepEqual(packet.exact_action, exactAction);

const approved = {
  ...packet,
  status: 'approved',
  approved_roles: ['engineering_approver']
};
assert.equal(
  approvalCoversAction(decision, approved, {
    repository: 'dzinh1901-lang/aurelean-app',
    environment: 'non-production',
    action_digest: exactAction.action_digest
  }),
  true
);
assert.equal(
  approvalCoversAction(decision, approved, {
    repository: 'dzinh1901-lang/aurelean-app',
    environment: 'non-production',
    action_digest: '0'.repeat(64)
  }),
  false
);
assert.equal(
  approvalCoversAction(decision, approved, {
    repository: 'dzinh1901-lang/aurelean-app',
    environment: 'non-production'
  }),
  false
);
assert.equal(
  approvalCoversAction(decision, { ...approved, status: 'consumed' }, {
    repository: 'dzinh1901-lang/aurelean-app',
    environment: 'non-production',
    action_digest: exactAction.action_digest
  }),
  false
);

assert.throws(
  () =>
    buildApprovalPacket({
      action: { type: 'create_pull_request_draft', summary: 'Changed request.' },
      decision,
      repositories: ['dzinh1901-lang/aurelean-app'],
      exactAction: { ...exactAction, action_digest: 'f'.repeat(64) }
    }),
  /does not match/i
);

const legacyApproval = {
  status: 'approved',
  approved_actions: ['create_pull_request_draft'],
  approver_roles: ['engineering_approver'],
  expires_at: '2999-01-01T00:00:00Z',
  constraints: { allowed_repository: 'dzinh1901-lang/aurelean-app' }
};
assert.equal(
  approvalCoversAction(decision, legacyApproval, { repository: 'dzinh1901-lang/aurelean-app' }),
  true
);

console.log(JSON.stringify({ ok: true, suite: 'exact-action-approval', assertions: 10 }, null, 2));
