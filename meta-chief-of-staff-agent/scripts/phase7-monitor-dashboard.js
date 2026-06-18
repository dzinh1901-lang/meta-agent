#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const { Pool } = require('pg');

const collectionTables = {
  repositories: 'repositories',
  projectHealthSnapshots: 'project_health_snapshots',
  taskPackets: 'task_packets',
  approvalPackets: 'approval_packets',
  approvalQueues: 'approval_queues',
  approvalDecisions: 'approval_decisions',
  evidenceEvents: 'evidence_events',
  agentRuns: 'agent_runs',
  routingPlans: 'routing_plans',
  procurementWorkflows: 'procurement_workflows',
  backupPlans: 'backup_plans',
  auditEvents: 'audit_events',
  policyVersions: 'policy_versions'
};

const COLLECTIONS = Object.keys(collectionTables);

function safeParse(value) {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function toRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const value = safeParse(record.value);
  if (!value || typeof value !== 'object') return null;
  return {
    id: record.id,
    value,
    createdAt: new Date(record.created_at || record.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(record.updated_at || record.updatedAt || record.createdAt || Date.now()).toISOString()
  };
}

function coerceRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function safeText(value) {
  if (value === null || typeof value === 'undefined') return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  return JSON.stringify(value);
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return null;
}

function pad(value, width) {
  const text = String(safeText(value));
  if (text.length >= width) return text.slice(0, width - 3) + '...';
  return text.padEnd(width, ' ');
}

class InMemoryStateStore {
  constructor(seedRecords = {}) { this.seed = seedRecords; }
  async get(collection, id) { return (this.seed[collection] || []).find((item) => item.id === id) || null; }
  async list(collection) { return (this.seed[collection] || []).map((record) => toRecord(record)).filter(Boolean); }
}

class PostgresStateStore {
  constructor({ connectionString, schema = 'public', tablePrefix = '' } = {}) {
    this.pool = new Pool({ connectionString });
    this.schema = schema;
    this.tablePrefix = tablePrefix;
  }
  tableName(collection) {
    const table = collectionTables[collection];
    if (!table) throw new Error(`Unknown collection: ${collection}`);
    return `${this.schema}.${this.tablePrefix}${table}`;
  }
  async list(collection) {
    const { rows } = await this.pool.query(`select id, value, created_at, updated_at from ${this.tableName(collection)} order by created_at asc`);
    return rows.map((row) => toRecord(row)).filter(Boolean);
  }
  async get(collection, id) {
    const { rows } = await this.pool.query(`select id, value, created_at, updated_at from ${this.tableName(collection)} where id = $1`, [id]);
    return rows[0] ? toRecord(rows[0]) : null;
  }
}

function normalizeRisk(value) {
  const known = ['critical', 'high', 'medium', 'low'];
  return known.includes(value) ? value : 'unknown';
}

function buildSummaryByRisk(items, field) {
  const tally = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 };
  for (const item of items) {
    const risk = normalizeRisk(coerceRecord(item.value)[field]);
    tally[risk] = (tally[risk] || 0) + 1;
  }
  return tally;
}

function latestByRepository(records, idKeys = ['repository_full_name', 'repository', 'repo']) {
  const buckets = new Map();
  for (const record of records) {
    const value = coerceRecord(record.value);
    const repository = idKeys.map((key) => pickText(value[key])).find(Boolean) || record.id;
    const updated = new Date(record.updatedAt || record.createdAt).getTime();
    const current = buckets.get(repository);
    const currentUpdated = current ? new Date(current.updatedAt || current.createdAt).getTime() : 0;
    if (!current || updated > currentUpdated) buckets.set(repository, record);
  }
  return [...buckets.values()];
}

function buildApprovalQueueRows(approvalQueues, tasksById, tasksByApprovalId) {
  return approvalQueues.map((record) => {
    const value = coerceRecord(record.value);
    const task = coerceRecord(tasksById.get(value.task_id)?.value || tasksByApprovalId.get(value.approval_id)?.value || {});
    return {
      id: record.id,
      status: pickText(value.status, 'unknown'),
      repository: pickText(task.repository, 'unknown'),
      approvalId: pickText(value.approval_id, 'N/A'),
      taskId: pickText(value.task_id, 'N/A'),
      action: pickText(value.action_type, task.action_type, 'N/A'),
      risk: normalizeRisk(pickText(value.risk_level, task.risk_level, 'unknown')),
      createdAt: value.created_at || record.createdAt,
      expiresAt: value.expires_at || value.expiresAt || '-',
      approvedRoles: Array.isArray(value.approved_roles) ? value.approved_roles.length : 0
    };
  });
}

function buildBlockedRows(taskPackets, approvalQueues, auditEvents) {
  const blocked = [];
  for (const task of taskPackets) {
    const value = coerceRecord(task.value);
    if (value.blocked || value.execution_disposition === 'blocked' || value.routing_status === 'blocked_by_policy') {
      blocked.push({ type: 'task_packet', id: task.id, repository: value.repository || 'unknown', action: value.action_type || 'unknown', risk: normalizeRisk(value.risk_level), reason: (value.block_reasons || []).join(', ') || value.reason || 'policy_block' });
    }
  }
  for (const queue of approvalQueues) {
    const value = coerceRecord(queue.value);
    if (['rejected', 'changes_requested', 'expired'].includes(value.status)) {
      blocked.push({ type: 'approval_queue', id: queue.id, repository: 'unknown', action: value.action_type || 'unknown', risk: normalizeRisk(value.risk_level), reason: `approval_queue_${value.status}` });
    }
  }
  for (const event of auditEvents) {
    const value = coerceRecord(event.value);
    if (value.event_type === 'blocked_action' && value.repository) {
      blocked.push({ type: 'audit_event', id: event.id, repository: value.repository, action: value.action_type || value.task_id || 'blocked_action', risk: normalizeRisk(value.risk_level), reason: Array.isArray(value.reasons) ? value.reasons.join(', ') : value.reason || 'hard_block' });
    }
  }
  return blocked;
}

function buildRepositoryHealthCards(collections, taskRows, repoRows) {
  const sourceRows = collections.projectHealthSnapshots.length ? collections.projectHealthSnapshots : (repoRows.length ? repoRows : taskRows);
  return latestByRepository(sourceRows).map((record) => {
    const value = coerceRecord(record.value);
    return {
      repository: pickText(value.repository_full_name, value.repository, value.repo, record.id),
      health: pickText(value.health_score, value.health, value.status, value.state, value.risk_level, 'unknown'),
      owner: pickText(value.owner, value.requested_by, '-'),
      updatedAt: record.updatedAt,
      action: pickText(value.action_type, value.last_output, value.status_summary, 'N/A')
    };
  }).sort((a, b) => String(a.repository).localeCompare(String(b.repository)));
}

function buildProcurementRows(procurementRows, approvalRowsById) {
  return procurementRows.map((record) => {
    const value = coerceRecord(record.value);
    const task = coerceRecord(value.task_workflow || {});
    const approval = coerceRecord(value.task_workflow?.approval_packet || task.approval_packet || {});
    const request = coerceRecord(value.procurement_request || approval.evidence_bundle || {});
    const queue = approvalRowsById.get(approval.approval_id);
    const queueValue = coerceRecord(queue?.value);
    return {
      id: record.id,
      repository: pickText(request.repository, task.repository, 'unknown'),
      intent: pickText(request.intent, 'procurement'),
      status: pickText(queueValue.status, value.task_workflow?.pending_approval?.status, 'queued'),
      risk: normalizeRisk(pickText(value.procurement_brief?.risk_level, approval.risk_level, task.risk_level)),
      approvalId: pickText(approval.approval_id, value.approval_id, task.approval_id),
      summary: pickText(value.procurement_brief?.summary, request.summary, 'procurement request')
    };
  });
}

function buildMarketingRows(taskPackets, approvalById) {
  return taskPackets.filter((record) => {
    const value = coerceRecord(record.value);
    const action = String(value.action_type || '').toLowerCase();
    const output = (value.requested_outputs || []).join(' ').toLowerCase();
    const approval = coerceRecord(approvalById.get(value.approval_id)?.value || {});
    return action.includes('marketing') || action.includes('publish') || action.includes('campaign') || output.includes('campaign') || approval.requested_authority?.category === 'marketing';
  }).map((record) => {
    const value = coerceRecord(record.value);
    const approval = coerceRecord(approvalById.get(value.approval_id)?.value || {});
    return { id: record.id, repository: value.repository || 'unknown', action: value.action_type || 'marketing_action', status: approval.status || (value.execution_disposition === 'approval_required' ? 'pending' : 'none'), risk: normalizeRisk(value.risk_level), approvalId: value.approval_id || 'N/A' };
  });
}

function buildBackupRows(backupPlans) {
  return backupPlans.map((record) => {
    const value = coerceRecord(record.value);
    return { id: record.id, repository: value.repository || 'unknown', scope: value.scope || '-', status: value.status || 'unknown', retentionDays: value.retention_days || '-', createdAt: value.created_at || record.createdAt };
  });
}

async function readCollections(stateStore) {
  const output = {};
  for (const collection of COLLECTIONS) output[collection] = await stateStore.list(collection);
  return output;
}

async function loadSeedFromFile(seedPath) {
  if (!seedPath) return {};
  const fs = require('node:fs/promises');
  const raw = await fs.readFile(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const result = {};
  for (const [key, value] of Object.entries(parsed)) result[key] = Array.isArray(value) ? value.map((item) => toRecord(item)).filter(Boolean) : [];
  return result;
}

function parseArgsFromCli() {
  const { values } = parseArgs({ options: { postgres: { type: 'boolean' }, source: { type: 'string', short: 's' }, schema: { type: 'string' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, allowPositionals: true });
  return values;
}

function printUsage() {
  console.log('Usage: node scripts/phase7-monitor-dashboard.js [--postgres] [--schema public] [--source seed.json] [--json]');
}

function printCards(title, rows, formatter) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (!rows.length) return console.log('None.');
  for (const row of rows) formatter(row);
}

async function run() {
  const args = parseArgsFromCli();
  if (args.help) return printUsage();
  const usePostgres = Boolean(args.postgres || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const schema = args.schema || process.env.SUPABASE_SCHEMA || 'public';
  const stateStore = usePostgres ? new PostgresStateStore({ connectionString, schema }) : new InMemoryStateStore(await loadSeedFromFile(args.source));
  const collections = await readCollections(stateStore);

  const approvalRows = collections.approvalPackets;
  const approvalById = new Map(approvalRows.map((record) => [coerceRecord(record.value).approval_id || record.id, record]).filter(([id]) => Boolean(id)));
  const taskRows = collections.taskPackets;
  const taskById = new Map(taskRows.map((record) => [record.id, record]));
  const taskByApproval = new Map(taskRows.map((record) => [coerceRecord(record.value).approval_id, record]).filter(([id]) => Boolean(id)));
  const queueRows = buildApprovalQueueRows(collections.approvalQueues, taskById, taskByApproval);
  const blockedRows = buildBlockedRows(taskRows, collections.approvalQueues, collections.auditEvents);
  const procurementRows = buildProcurementRows(collections.procurementWorkflows, approvalById);
  const marketingRows = buildMarketingRows(taskRows, approvalById);
  const backupRows = buildBackupRows(collections.backupPlans);
  const risks = { taskPackets: buildSummaryByRisk(taskRows, 'risk_level'), approvalPackets: buildSummaryByRisk(approvalRows, 'risk_level') };
  const healthCards = buildRepositoryHealthCards(collections, taskRows, collections.repositories);

  const payload = {
    timestamp: new Date().toISOString(),
    source: usePostgres ? 'postgres' : 'memory',
    totals: {
      repositories: collections.repositories.length,
      projectHealthSnapshots: collections.projectHealthSnapshots.length,
      taskPackets: taskRows.length,
      approvalPackets: approvalRows.length,
      approvalQueues: queueRows.length,
      approvalDecisions: collections.approvalDecisions.length,
      procurementWorkflows: collections.procurementWorkflows.length,
      backupPlans: collections.backupPlans.length
    },
    repositoryHealthCards: healthCards,
    approvalQueue: queueRows,
    blockers: blockedRows,
    risks,
    procurementQueue: procurementRows,
    marketingQueue: marketingRows,
    backupPlans: backupRows,
    auditLog: collections.auditEvents.slice(-60)
  };

  if (args.json) return console.log(JSON.stringify(payload, null, 2));

  console.log('Portfolio Monitoring Dashboard');
  console.log(`Generated: ${payload.timestamp}`);
  console.log(`Data source: ${payload.source}`);
  console.log(`Counts: repos=${payload.totals.repositories}, snapshots=${payload.totals.projectHealthSnapshots}, tasks=${payload.totals.taskPackets}, approvals=${payload.totals.approvalPackets}, queues=${payload.totals.approvalQueues}, backups=${payload.totals.backupPlans}`);
  printCards('Repository Health Cards', healthCards, (card) => console.log(`  - ${pad(card.repository, 32)} | status=${pad(card.health, 14)} | owner=${pad(card.owner, 18)} | updated=${card.updatedAt}`));
  printCards('Approval Queue', queueRows.slice(0, 8), (row) => console.log(`  - [${row.status}] ${pad(row.repository, 42)} | ${pad(row.action, 28)} | risk=${row.risk}`));
  printCards('Procurement Queue', procurementRows, (row) => console.log(`  - ${pad(row.repository, 32)} | ${pad(row.intent, 12)} | status=${pad(row.status, 12)} | risk=${pad(row.risk, 8)} | id=${row.id}`));
  printCards('Marketing Queue', marketingRows, (row) => console.log(`  - ${pad(row.repository, 32)} | ${pad(row.action, 30)} | status=${pad(row.status, 12)} | risk=${pad(row.risk, 8)} | approval=${row.approvalId}`));
  printCards('Backup Plans', backupRows, (row) => console.log(`  - ${pad(row.repository, 32)} | scope=${pad(row.scope, 10)} | status=${pad(row.status, 12)} | retention=${row.retentionDays}`));
  printCards('Blockers', blockedRows.slice(0, 12), (row) => console.log(`  - ${pad(row.type, 14)} | ${pad(row.repository, 30)} | ${pad(row.action, 28)} | ${row.reason}`));
}

run().catch((error) => {
  console.error(`Monitoring dashboard failed: ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
});
