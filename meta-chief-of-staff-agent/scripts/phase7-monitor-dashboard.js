#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const { Pool } = require('pg');

const collectionTables = {
  repositories: 'repositories',
  projectHealth: 'project_health',
  projectHealthSnapshots: 'project_health_snapshots',
  taskPackets: 'task_packets',
  approvalPackets: 'approval_packets',
  approvalQueues: 'approval_queues',
  approvalDecisions: 'approval_decisions',
  evidenceEvents: 'evidence_events',
  agentRuns: 'agent_runs',
  routingPlans: 'routing_plans',
  procurementWorkflows: 'procurement_workflows',
  auditEvents: 'audit_events',
  policyVersions: 'policy_versions'
};

const COLLECTIONS = Object.keys(collectionTables);

function toRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const value = typeof record.value === 'string' ? safeParse(record.value) : record.value;
  if (!value || typeof value !== 'object') return null;
  return {
    id: record.id,
    value,
    createdAt: new Date(record.created_at || record.createdAt || Date.now()).toISOString(),
    updatedAt: new Date(record.updated_at || record.updatedAt || record.createdAt || Date.now()).toISOString()
  };
}

function safeParse(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value;
}

function safeText(value) {
  if (value === null || typeof value === 'undefined') return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.join(', ');
  return JSON.stringify(value);
}

function coerceRecord(value) {
  return value && typeof value === 'object' ? value : {};
}

function pickText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function pad(value, width) {
  const text = String(safeText(value));
  if (text.length >= width) return text.slice(0, width - 3) + '...';
  return text.padEnd(width, ' ');
}

class InMemoryStateStore {
  constructor(seedRecords = {}) {
    this.seed = seedRecords;
  }

  async get(collection, id) {
    const rows = this.seed[collection] || [];
    return rows.find((item) => item.id === id) || null;
  }

  async list(collection) {
    return (this.seed[collection] || []).map((record) => toRecord(record));
  }
}

class PostgresStateStore {
  constructor({ connectionString, schema = 'public', tablePrefix = '' } = {}) {
    this.pool = new Pool({ connectionString });
    this.schema = schema;
    this.tablePrefix = tablePrefix;
  }

  tableName(collection) {
    return `${this.schema}.${this.tablePrefix}${collectionTables[collection]}`;
  }

  async list(collection) {
    const table = this.tableName(collection);
    const { rows } = await this.pool.query(
      `select id, value, created_at, updated_at from ${table} order by created_at asc`,
      []
    );
    return rows.map((row) => toRecord(row));
  }

  async get(collection, id) {
    const table = this.tableName(collection);
    const { rows } = await this.pool.query(
      `select id, value, created_at, updated_at from ${table} where id = $1`,
      [id]
    );
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
    const value = coerceRecord(item.value);
    const risk = normalizeRisk(value[field]);
    tally[risk] = (tally[risk] || 0) + 1;
  }
  return tally;
}

function latestByRepository(records, idKeys = ['repository_full_name', 'repository', 'repo']) {
  const buckets = new Map();
  for (const record of records) {
    const value = coerceRecord(record.value);
    const repository = idKeys.map((key) => pickText(value[key], record.id)).find(Boolean) || `record:${record.id}`;
    const current = buckets.get(repository);
    const updated = new Date(record.updatedAt || record.createdAt).getTime();
    const currentUpdated = current ? new Date(current.updatedAt || current.createdAt).getTime() : 0;
    if (!current || updated > currentUpdated) {
      buckets.set(repository, { repository, record });
    }
  }
  return [...buckets.values()].map(({ record }) => record);
}

function buildApprovalQueueRows(approvalQueues, tasksById, tasksByApprovalId) {
  return approvalQueues.map((record) => {
    const value = coerceRecord(record.value);
    const taskRef = coerceRecord(
      tasksById.get(value.task_id) || tasksByApprovalId.get(value.approval_id) || {}
    );
    return {
      id: record.id,
      status: pickText(value.status, 'unknown'),
      repository: pickText(taskRef.repository, 'unknown'),
      approvalId: pickText(value.approval_id, 'N/A'),
      taskId: pickText(value.task_id, 'N/A'),
      action: pickText(value.action_type, taskRef.action_type, 'N/A'),
      risk: normalizeRisk(pickText(value.risk_level, taskRef.risk_level, 'unknown')),
      createdAt: value.created_at || record.createdAt,
      expiresAt: value.expires_at || value.expiresAt || '-',
      approvedRoles: Array.isArray(value.approved_roles) ? value.approved_roles.length : 0
    };
  });
}

function buildBlockedRows(taskPackets, approvalQueueRecords, auditEvents) {
  const blocked = [];

  for (const taskRecord of taskPackets) {
    const value = coerceRecord(taskRecord.value);
    const isBlocked =
      value.blocked || value.execution_disposition === 'blocked' || value.routing_status === 'blocked_by_policy';
    if (isBlocked) {
      blocked.push({
        type: 'task_packet',
        id: taskRecord.id,
        repository: pickText(value.repository, 'unknown'),
        action: pickText(value.action_type, 'unknown'),
        risk: normalizeRisk(value.risk_level),
        reason: pickText((value.block_reasons || []).join(', '), value.reason, 'policy_block')
      });
    }
  }

  for (const queueRecord of approvalQueueRecords) {
    const value = coerceRecord(queueRecord.value);
    if (value.status === 'rejected' || value.status === 'changes_requested' || value.status === 'expired') {
      blocked.push({
        type: 'approval_queue',
        id: queueRecord.id,
        repository: 'unknown',
        action: pickText(value.action_type, 'unknown'),
        risk: normalizeRisk(value.risk_level),
        reason: `approval_queue_${value.status}`
      });
    }
  }

  for (const event of auditEvents) {
    const value = coerceRecord(event.value);
    if (value.event_type === 'blocked_action' && value.repository) {
      blocked.push({
        type: 'audit_event',
        id: event.id,
        repository: value.repository || 'unknown',
        action: pickText(value.action_type, value.task_id, 'blocked_action'),
        risk: normalizeRisk(value.risk_level),
        reason: pickText(value.reasons?.join(', '), value.reason, 'hard_block')
      });
    }
  }

  return blocked;
}

function buildProcurementRows(procurementRows, approvalRowsById) {
  return procurementRows.map((record) => {
    const value = coerceRecord(record.value);
    const task = coerceRecord(value.task_workflow);
    const pending = coerceRecord(task?.pending_approval);
    const approval = coerceRecord(value.task_workflow?.approval_packet || task?.approval_packet);
    const request = coerceRecord(value.procurement_request || approval.evidence_bundle || {});
    const queue = approvalRowsById.get(approval?.approval_id);
    const queueValue = coerceRecord(queue?.value);

    return {
      id: record.id,
      repository: pickText(request.repository, task.repository, 'unknown'),
      intent: pickText(request.intent, task.intent, 'procurement'),
      status: pickText(queueValue.status, pending.status, task.status, 'queued'),
      risk: normalizeRisk(pickText(value.procurement_brief?.risk_level, approval.risk_level, task.risk_level)),
      queueId: pickText(queue?.id, queueValue.queue_id, 'N/A'),
      approvalId: pickText(approval.approval_id, value.approval_id, task.approval_id),
      summary: pickText(value.procurement_brief?.summary, request.summary, 'procurement request'),
      updatedAt: value.created_at || approval.created_at || queue?.updatedAt || record.updatedAt
    };
  });
}

function buildMarketingRows(taskPackets, approvalRowsById) {
  const marketingAction = (value) => {
    const actionType = (value.action_type || '').toLowerCase();
    const requestedSummary = safeText(value.requested_action || '').toLowerCase();
    return (
      actionType.includes('marketing') ||
      actionType.includes('publish') ||
      actionType.includes('campaign') ||
      actionType.includes('spend') ||
      requestedSummary.includes('marketing')
    );
  };

  const approvalById = new Map();
  for (const [id, approval] of approvalRowsById.entries()) {
    approvalById.set(id, coerceRecord(approval.value));
  }

  return taskPackets
    .filter((record) => {
      const value = coerceRecord(record.value);
      if (marketingAction(value)) return true;
      const authority = (value.policy_decision?.category || '').toLowerCase();
      if (authority === 'marketing') return true;
      if ((value.requested_outputs || []).some((item) => String(item).toLowerCase().includes('campaign'))) return true;
      const approval = approvalById.get(value.approval_id) || {};
      return approval.requested_authority?.category === 'marketing';
    })
    .map((record) => {
      const value = coerceRecord(record.value);
      const approval = approvalById.get(value.approval_id);
      return {
        id: record.id,
        repository: pickText(value.repository, 'unknown'),
        action: pickText(value.action_type, 'marketing_action'),
        status: approval ? pickText(approval.status, 'unknown') : (value.execution_disposition === 'approval_required' ? 'pending' : 'none'),
        risk: normalizeRisk(value.risk_level),
        approvalId: pickText(value.approval_id, 'N/A'),
        runId: value.audit_correlation_id || 'N/A'
      };
    });
}

function printCards(title, rows, formatter) {
  console.log(`\n${title}`);
  console.log('-'.repeat(title.length));
  if (!rows.length) {
    console.log('None.');
    return;
  }
  for (const row of rows) {
    formatter(row);
  }
}

function printQueue(rows) {
  const pending = rows.filter((item) => item.status === 'pending');
  const approved = rows.filter((item) => item.status === 'approved');
  const other = rows.filter((item) => !['pending', 'approved'].includes(item.status));
  console.log(`\nApproval Queue (total ${rows.length})`);
  console.log(`  pending: ${pending.length}`);
  console.log(`  approved: ${approved.length}`);
  console.log(`  other: ${other.length}`);
  console.log(`  sample:`);
  for (const item of rows.slice(0, 8)) {
    console.log(`  - [${item.status}] ${pad(item.repository, 42)} | ${pad(item.action, 28)} | risk=${item.risk}`);
  }
}

function printBlocked(rows) {
  console.log(`\nBlockers (${rows.length})`);
  if (!rows.length) {
    console.log('None.');
    return;
  }
  for (const row of rows.slice(0, 12)) {
    console.log(`  - ${pad(row.type, 14)} | ${pad(row.repository, 30)} | ${pad(row.action, 28)} | ${row.reason}`);
  }
}

function printAudit(rows, limit = 20) {
  console.log(`\nAudit Log (last ${Math.min(rows.length, limit)})`);
  const last = [...rows].reverse().slice(0, limit);
  if (!last.length) {
    console.log('None.');
    return;
  }
  for (const row of last) {
    const value = coerceRecord(row.value);
    console.log(`  - ${row.id} | ${pad(value.event_type || 'event', 22)} | ${pad(value.approval_id || value.task_id || '-', 28)} | ${row.updatedAt}`);
  }
}

function buildRepositoryHealthCards(collections, fallbackTaskRows, fallbackRepoRows) {
  const healthSnapshots = collections.projectHealthSnapshots;
  const sourceRows = healthSnapshots.length ? healthSnapshots : (fallbackRepoRows.length ? fallbackRepoRows : fallbackTaskRows);
  const latestByRepo = latestByRepository(sourceRows, ['repository_full_name', 'repository', 'repo']);
  return latestByRepo
    .map((record) => {
      const value = coerceRecord(record.value);
      const repository = pickText(value.repository_full_name, value.repository, value.repo, record.id);
      return {
        repository,
        health: pickText(value.health_score, value.health, value.status, value.state, value.risk_level, 'unknown'),
        owner: pickText(value.owner, value.requested_by, '-'),
        updatedAt: record.updatedAt,
        action: pickText(value.action_type, value.last_output, value.status_summary, 'N/A')
      };
    })
    .sort((a, b) => String(a.repository).localeCompare(String(b.repository)));
}

function buildRisks(taskRows, approvalRows) {
  return {
    taskPackets: buildSummaryByRisk(taskRows, 'risk_level'),
    approvalPackets: buildSummaryByRisk(approvalRows, 'risk_level')
  };
}

async function readCollections(stateStore) {
  const output = {};
  for (const collection of COLLECTIONS) {
    output[collection] = await stateStore.list(collection);
  }
  return output;
}

function parseArgsFromCli() {
  const { values } = parseArgs({
    options: {
      postgres: { type: 'boolean' },
      source: { type: 'string', short: 's' },
      schema: { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });
  return values;
}

function printUsage() {
  console.log('Usage: node scripts/phase7-monitor-dashboard.js [--postgres] [--schema public] [--json]');
  console.log('       --postgres   Use DATABASE_URL-backed Postgres/Supabase store');
  console.log('       --schema     Optional table schema name (default: public)');
  console.log('       --source     Optional JSON file for in-memory seed in CLI demos');
  console.log('       --json       Output raw dashboard payload as JSON');
  console.log('       --help       Show this help text');
}

async function loadSeedFromFile(seedPath) {
  if (!seedPath) return {};
  const fs = require('node:fs/promises');
  const raw = await fs.readFile(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const result = {};
  for (const [key, value] of Object.entries(parsed)) {
    result[key] = Array.isArray(value) ? value.map((item) => toRecord(item)) : [];
  }
  return result;
}

function projectStoreRows(rows, limit) {
  const preview = Number.isFinite(Number(limit)) ? Number(limit) : rows.length;
  return rows.slice(-Math.max(1, preview));
}

async function run() {
  const args = parseArgsFromCli();
  if (args.help) {
    return printUsage();
  }

  const usePostgres = Boolean(args.postgres || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const schema = args.schema || process.env.SUPABASE_SCHEMA || 'public';

  const stateStore = usePostgres
    ? new PostgresStateStore({ connectionString, schema })
    : new InMemoryStateStore(await loadSeedFromFile(args.source));

  const collections = await readCollections(stateStore);

  const approvalRows = collections.approvalPackets;
  const approvalById = new Map(
    approvalRows
      .map((record) => [coerceRecord(record.value).approval_id || record.id, record])
      .filter(([approvalId]) => Boolean(approvalId))
  );

  const taskRows = collections.taskPackets;
  const taskById = new Map(taskRows.map((record) => [record.id, record]));
  const taskByApproval = new Map(
    taskRows
      .map((record) => [coerceRecord(record.value).approval_id, record])
      .filter(([approvalId]) => Boolean(approvalId))
  );

  const queueRows = buildApprovalQueueRows(collections.approvalQueues, taskById, taskByApproval);

  const blockedRows = buildBlockedRows(taskRows, collections.approvalQueues, collections.auditEvents);
  const procurementRows = buildProcurementRows(collections.procurementWorkflows, approvalById);
  const marketingRows = buildMarketingRows(taskRows, approvalById);
  const risks = buildRisks(taskRows, approvalRows);
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
      procurementWorkflows: collections.procurementWorkflows.length
    },
    repositoryHealthCards: healthCards,
    approvalQueue: queueRows,
    blockers: blockedRows,
    risks,
    procurementQueue: procurementRows,
    marketingQueue: marketingRows,
    auditLog: projectStoreRows(collections.auditEvents, 60)
  };

  if (args.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log('Portfolio Monitoring Dashboard');
  console.log(`Generated: ${payload.timestamp}`);
  console.log(`Data source: ${payload.source}`);
  console.log(
    `Counts: repos=${payload.totals.repositories}, snapshots=${payload.totals.projectHealthSnapshots}, tasks=${payload.totals.taskPackets}, approvals=${payload.totals.approvalPackets}, queues=${payload.totals.approvalQueues}`
  );

  printCards('Repository Health Cards', payload.repositoryHealthCards, (card) => {
    console.log(`  - ${pad(card.repository, 32)} | status=${pad(card.health, 14)} | owner=${pad(card.owner, 18)} | updated=${card.updatedAt}`);
  });

  printQueue(queueRows);

  printCards('Procurement Queue', payload.procurementQueue, (row) => {
    console.log(`  - ${pad(row.repository, 32)} | ${pad(row.intent, 12)} | status=${pad(row.status, 12)} | risk=${pad(row.risk, 8)} | id=${row.id}`);
  });

  printCards('Marketing Queue', payload.marketingQueue, (row) => {
    console.log(`  - ${pad(row.repository, 32)} | ${pad(row.action, 30)} | status=${pad(row.status, 12)} | risk=${pad(row.risk, 8)} | approval=${row.approvalId}`);
  });

  printCards('Risks', [
    { label: 'Tasks', values: risks.taskPackets },
    { label: 'Approvals', values: risks.approvalPackets }
  ], (row) => {
    const values = row.values || {};
    console.log(`  - ${row.label}: critical=${values.critical} high=${values.high} medium=${values.medium} low=${values.low} unknown=${values.unknown}`);
  });

  printBlocked(blockedRows);
  printAudit(payload.auditLog, 20);
}

run().catch((error) => {
  console.error(`Monitoring dashboard failed: ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
});
