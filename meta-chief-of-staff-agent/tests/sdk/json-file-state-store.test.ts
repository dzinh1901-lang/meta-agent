import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { JsonFileStateStore } from '../../src/state/JsonFileStateStore.js';

test('JSON state store persists atomically and clones values', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cosmos-state-'));
  const path = join(directory, 'state.json');
  const store = new JsonFileStateStore(path);
  const input = { status: 'planned', nested: { count: 1 } };
  const stored = await store.put('agentRuns', 'run_1', input);
  input.nested.count = 99;

  const loaded = await store.get('agentRuns', 'run_1');
  assert.ok(loaded);
  assert.deepEqual(loaded.value, { status: 'planned', nested: { count: 1 } });
  assert.equal(stored.id, 'run_1');
  assert.equal((await store.list('agentRuns')).length, 1);

  const persisted = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  assert.equal(persisted.version, 1);
  assert.equal((await stat(path)).mode & 0o077, 0);

  assert.equal(await store.delete('agentRuns', 'run_1'), true);
  assert.equal(await store.get('agentRuns', 'run_1'), null);
  await store.put('auditEvents', 'audit_1', { ok: true });
  await store.clear();
  assert.deepEqual(await store.list('auditEvents'), []);
});

test('JSON state store rejects malformed persisted state', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cosmos-state-invalid-'));
  const path = join(directory, 'state.json');
  const store = new JsonFileStateStore(path);
  await import('node:fs/promises').then(({ writeFile }) => writeFile(path, '{broken', 'utf8'));
  await assert.rejects(() => store.list('agentRuns'), /not valid JSON/i);
});
