import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { assertAuthorizedApproverRole, createMetaAgentContext } from '../../src/sdk/context.js';
import { InMemoryStateStore } from '../../src/state/InMemoryStateStore.js';

const registry = {
  schema_version: '1.0.0',
  owner: 'example',
  repositories: [
    {
      repository_full_name: 'example/project',
      name: 'project',
      orchestrator: { known: true, path: '.claude/agents/orchestrator.md' },
    },
  ],
};

test('approver roles come from trusted runtime context', () => {
  const context = createMetaAgentContext({
    operatorId: 'principal-1',
    registry,
    stateStore: new InMemoryStateStore(),
    authorizedRepositories: ['example/project'],
    approverRoles: ['engineering_approver'],
  });

  assert.doesNotThrow(() => assertAuthorizedApproverRole(context, 'engineering_approver'));
  assert.throws(
    () => assertAuthorizedApproverRole(context, 'principal_approver'),
    /not authorized for operator 'principal-1'/,
  );
});

test('repository authorization cannot introduce an unregistered repository', () => {
  assert.throws(
    () =>
      createMetaAgentContext({
        registry,
        stateStore: new InMemoryStateStore(),
        authorizedRepositories: ['example/unknown'],
      }),
    /not present in the portfolio registry/,
  );
});

test('manager and specialists do not import the legacy decision-capable tool surface', async () => {
  const [manager, specialists, governedTools, tsconfig] = await Promise.all([
    readFile('src/sdk/metaChiefOfStaff.ts', 'utf8'),
    readFile('src/sdk/specialists.ts', 'utf8'),
    readFile('src/sdk/governedTools.ts', 'utf8'),
    readFile('tsconfig.json', 'utf8'),
  ]);

  assert.match(manager, /from '\.\/governedTools\.js'/);
  assert.match(specialists, /from '\.\/governedTools\.js'/);
  assert.doesNotMatch(manager, /recordDecisionTool|record_decision/);
  assert.doesNotMatch(specialists, /recordDecisionTool|record_decision/);
  assert.doesNotMatch(governedTools, /recordDecisionTool|name:\s*'record_decision'/);
  assert.match(governedTools, /name:\s*'create_github_issue'[\s\S]*needsApproval:\s*true/);
  assert.match(governedTools, /name:\s*'create_draft_pr'[\s\S]*needsApproval:\s*true/);
  assert.match(tsconfig, /"src\/\*\*\/\*\.js"/);
  assert.match(tsconfig, /"src\/sdk\/tools\.ts"/);
});
