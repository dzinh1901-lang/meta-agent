import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertApprovalConstraints,
  assertExactActionMatch,
  createExactActionBinding,
} from '../../src/sdk/actionBinding.js';

test('exact action digest is stable across object key order', () => {
  const first = createExactActionBinding({
    toolName: 'create_github_issue',
    agentName: 'Cross-Repository Orchestrator',
    arguments: {
      repository: 'dzinh1901-lang/aurelean-app',
      title: 'Create launch checklist',
      labels: ['governed'],
      environment: 'non-production',
    },
  });
  const second = createExactActionBinding({
    toolName: 'create_github_issue',
    agentName: 'Cross-Repository Orchestrator',
    arguments: JSON.stringify({
      environment: 'non-production',
      labels: ['governed'],
      title: 'Create launch checklist',
      repository: 'dzinh1901-lang/aurelean-app',
    }),
  });
  assert.equal(first.action_digest, second.action_digest);
  assert.equal(first.action_type, 'create_github_issue');
  assert.equal(first.repository, 'dzinh1901-lang/aurelean-app');
});

test('changed arguments invalidate exact action approval', () => {
  const approved = createExactActionBinding({
    toolName: 'create_draft_pr',
    agentName: 'Cross-Repository Orchestrator',
    arguments: {
      repository: 'dzinh1901-lang/designOS-App',
      title: 'Draft health report',
      baseBranch: 'main',
      headBranch: 'cosmos/health-report',
    },
  });
  const changed = createExactActionBinding({
    toolName: 'create_draft_pr',
    agentName: 'Cross-Repository Orchestrator',
    arguments: {
      repository: 'dzinh1901-lang/designOS-App',
      title: 'Draft health report and merge',
      baseBranch: 'main',
      headBranch: 'cosmos/health-report',
    },
  });
  assert.throws(() => assertExactActionMatch(approved, changed), /digest mismatch/i);
});

test('approval constraints bind repository, environment, action and digest', () => {
  const binding = createExactActionBinding({
    toolName: 'queue_controlled_action',
    agentName: 'Marketing Oversight Agent',
    arguments: {
      actionType: 'send_external_message',
      repository: 'dzinh1901-lang/aurelean-app',
      exactAction: 'Send approved launch message',
      approvalPacketId: 'appr_example',
      environment: 'staging',
    },
  });
  assert.doesNotThrow(() =>
    assertApprovalConstraints(binding, {
      allowed_repository: 'dzinh1901-lang/aurelean-app',
      target_environment: 'staging',
      action_digest: binding.action_digest,
      forbidden_actions: ['deploy_production'],
    }),
  );
  assert.throws(
    () => assertApprovalConstraints(binding, { action_digest: '0'.repeat(64) }),
    /digest/i,
  );
});

test('secret-bearing arguments fail closed', () => {
  assert.throws(
    () =>
      createExactActionBinding({
        toolName: 'create_github_issue',
        agentName: 'Cross-Repository Orchestrator',
        arguments: { repository: 'dzinh1901-lang/aurelean-app', apiKey: 'not-allowed' },
      }),
    /secret-bearing field/i,
  );
  assert.throws(
    () =>
      createExactActionBinding({
        toolName: 'create_github_issue',
        agentName: 'Cross-Repository Orchestrator',
        arguments: { repository: 'dzinh1901-lang/aurelean-app', body: `token sk-proj-${'a'.repeat(32)}` },
      }),
    /secret value/i,
  );
  assert.throws(
    () =>
      createExactActionBinding({
        toolName: 'create_github_issue',
        agentName: 'Cross-Repository Orchestrator',
        arguments: '{not-json}',
      }),
    /valid JSON/i,
  );
});
