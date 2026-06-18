#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const { Pool } = require('pg');
const { loadRegistry } = require('../src/repository-registry.js');
const { buildTaskApprovalWorkflow } = require('../src/packet-workflow.js');
const { stableId } = require('../src/packet-utils.js');

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

class InMemoryStateStore {
  constructor(seedRecords = {}) {
    this.seed = seedRecords;
  }

  async list(collection) {
    return (this.seed[collection] || []).map((record) => toRecord(record));
  }

  async put(collection, id, value) {
    this.seed[collection] = this.seed[collection] || [];
    const now = new Date().toISOString();
    this.seed[collection] = this.seed[collection].filter((record) => record.id !== id);
    this.seed[collection].push({ id, value, created_at: now, updated_at: now, createdAt: now, updatedAt: now });
    return { id, value, created_at: now, updated_at: now, createdAt: now, updatedAt: now };
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
    const { rows } = await this.pool.query(`select id, value, created_at, updated_at from ${table} order by created_at asc`);
    return rows.map((row) => toRecord(row));
  }

  async put(collection, id, value) {
    const table = this.tableName(collection);
    const now = new Date().toISOString();
    await this.pool.query(
      `insert into ${table} (id, value, created_at, updated_at) values ($1, $2::jsonb, $3, $4)
       on conflict (id) do update set value = excluded.value, updated_at = excluded.updated_at`,
      [id, JSON.stringify(value), now, now]
    );
    return { id, value, created_at: now, updated_at: now };
  }
}

function getCollectionRows(records) {
  return records.filter(Boolean);
}

function repositoryList(inputList) {
  const list = Array.isArray(inputList) ? inputList.filter(Boolean) : [];
  return list.length
    ? list
    : loadRegistry().repositories.map((repo) => repo.repository_full_name);
}

function highRiskBlocked(records) {
  const entries = getCollectionRows(records);
  return entries
    .map((row) => ({ id: row.id, value: row.value }))
    .filter((entry) => {
      const value = entry.value;
      return value?.blocked === true || value?.execution_disposition === 'blocked' || value?.routing_status === 'blocked_by_policy';
    })
    .map((entry) => entry.id);
}

function isSensitiveIntegrationAction(actionType) {
  return ['activate_live_billing', 'commit_paid_marketing_spend', 'publish_public_marketing', 'procurement_vendor_award', 'approve_procurement_action'].includes(actionType);
}

function buildBackupRun({ repository, scope, retentionDays, operatorId, runCorrelationId }) {
  return {
    backup_plan_id: stableId('backup', { repository, scope, operatorId, timestamp: new Date().toISOString() }),
    repository,
    scope,
    operator_id: operatorId,
    retention_days: retentionDays,
    status: 'prepared',
    run_correlation_id: runCorrelationId || null,
    external_side_effect_executed: false,
    created_at: new Date().toISOString()
  };
}

function buildRollbackRun({ repository, targetRunId, triggerEventId, operatorId }) {
  return {
    rollback_plan_id: stableId('rollback', { repository, targetRunId, operatorId, timestamp: new Date().toISOString() }),
    repository,
    target_run_id: targetRunId,
    trigger_event_id: triggerEventId || null,
    status: 'prepared',
    approval_required: true,
    execution_mode: 'controlled_runbook_only',
    operator_id: operatorId,
    prepared_at: new Date().toISOString(),
    executed: false,
  };
}

function printSummary(payload) {
  console.log(`Phase 8 operating run: ${payload.mode}`);
  console.log(`Generated: ${payload.generated_at}`);
  console.log(`Mode summary: ${payload.summary}`);
  console.log('---');
  console.log(JSON.stringify(payload, null, 2));
}

async function runScheduledScan(stateStore, options) {
  const registry = loadRegistry();
  const targetRepos = repositoryList(options.repositories);

  const workflows = [];
  for (const repository of targetRepos) {
    const workflow = buildTaskApprovalWorkflow({
      registry,
      objective: 'Scheduled production health scan (read-only).',
      repository,
      action: { type: 'compute_project_health', summary: 'Scheduled scan for project health.' },
      actionType: 'compute_project_health',
      requestedOutputs: ['project_health', 'approval_gate_status', 'scan_report'],
      validationRequirements: ['read-only scan', 'no side effects'],
      evidenceBundle: { source: 'phase8-scan', scan_label: options.scanLabel },
      expectedOutcome: 'Produce deterministic evidence for operating readiness.',
      rollbackPlan: 'No external execution in scan mode.',
      createdAt: new Date().toISOString(),
    });

    const task = workflow.task_packet || {};
    if (task?.task_id) {
      await stateStore.put('taskPackets', task.task_id, task);
    }
    const approval = workflow.approval_packet || {};
    if (approval?.approval_id) {
      await stateStore.put('approvalPackets', approval.approval_id, approval);
    }
    const pending = workflow.pending_approval || {};
    if (pending?.queue_id) {
      await stateStore.put('approvalQueues', pending.queue_id, pending);
    }
    const run = workflow.agent_run || {};
    if (run?.run_id) {
      await stateStore.put('agentRuns', run.run_id, run);
    }

    workflows.push({
      repository,
      run_id: run.run_id || null,
      task_id: task.task_id || null,
      queue_id: pending?.queue_id || null,
    });
  }

  const scanEventId = stableId('scan', { label: options.scanLabel, at: new Date().toISOString() });
  const audit = {
    event_type: 'scheduled_scan_executed',
    scan_label: options.scanLabel,
    repository_count: targetRepos.length,
    workflow_count: workflows.length,
    operator_id: options.operatorId,
    generated_at: new Date().toISOString(),
    details: workflows
  };
  await stateStore.put('auditEvents', scanEventId, audit);

  return {
    mode: 'scan',
    generated_at: new Date().toISOString(),
    summary: `Scheduled scan complete. repositories=${targetRepos.length}, workflows=${workflows.length}`,
    scan_label: options.scanLabel,
    scan_audit_event_id: scanEventId,
    workflows
  };
}

async function runAlertCheck(stateStore, options) {
  const collections = {};
  for (const collection of COLLECTIONS) {
    collections[collection] = await stateStore.list(collection);
  }

  const blockedTasks = highRiskBlocked(collections.taskPackets);
  const blockedScans = blockedTasks.length;
  const criticalApprovals = getCollectionRows(collections.approvalDecisions).filter((row) => {
    const value = row.value || {};
    return value.decision_type === 'reject' || value.decision_type === 'always_reject';
  }).length;

  const alertPayload = {
    event_type: 'external_alert',
    alert_type: 'operations_health',
    severity: blockedScans > 0 || criticalApprovals > 0 ? 'critical' : 'warning',
    repository_count: collections.repositories.length,
    blocked_scan_count: blockedScans,
    blocked_approvals: criticalApprovals,
    generated_at: new Date().toISOString(),
  };
  const alertId = stableId('alert', { generated_at: alertPayload.generated_at, source: options.source, scanLabel: options.scanLabel });
  await stateStore.put('auditEvents', alertId, alertPayload);

  return {
    mode: 'alert',
    generated_at: alertPayload.generated_at,
    summary: `Alert emitted: severity=${alertPayload.severity}, blocked_scans=${blockedScans}, blocked_approvals=${criticalApprovals}`,
    alert_id: alertId,
    payload: alertPayload,
  };
}

async function runBackupOrRollback(mode, stateStore, options) {
  const eventId = stableId(mode, { repository: options.repository, targetRunId: options.targetRunId || options.scanLabel, timestamp: new Date().toISOString() });
  if (mode === 'backup') {
    const backup = buildBackupRun({
      repository: options.repository,
      scope: options.scope || 'full',
      retentionDays: options.retentionDays || 30,
      operatorId: options.operatorId,
    });
    await stateStore.put('agentRuns', backup.backup_plan_id, backup);
    await stateStore.put('auditEvents', eventId, {
      event_type: 'backup_plan_prepared',
      repository: options.repository,
      backup_plan_id: backup.backup_plan_id,
      operator_id: options.operatorId,
      recorded_at: new Date().toISOString(),
    });
    return { mode: 'backup', generated_at: new Date().toISOString(), summary: `backup prepared for ${options.repository}`, plan_id: backup.backup_plan_id };
  }

  const rollback = buildRollbackRun({
    repository: options.repository,
    targetRunId: options.targetRunId,
    triggerEventId: options.triggerEventId,
    operatorId: options.operatorId,
  });
  await stateStore.put('agentRuns', rollback.rollback_plan_id, rollback);
  await stateStore.put('auditEvents', eventId, {
    event_type: 'rollback_plan_prepared',
    repository: options.repository,
    rollback_plan_id: rollback.rollback_plan_id,
    operator_id: options.operatorId,
    recorded_at: new Date().toISOString(),
  });
  return { mode: 'rollback', generated_at: new Date().toISOString(), summary: `rollback prepared for run ${options.targetRunId}`, plan_id: rollback.rollback_plan_id };
}

async function runReport(stateStore, options) {
  const rows = {};
  for (const collection of COLLECTIONS) {
    rows[collection] = await stateStore.list(collection);
  }
  const alerts = getCollectionRows(rows.auditEvents).filter((row) => {
    const value = row.value || {};
    return value.event_type === 'external_alert' || value.event_type === 'scheduled_scan_executed';
  });

  return {
    mode: 'report',
    generated_at: new Date().toISOString(),
    summary: `Collections: repos=${rows.repositories.length}, tasks=${rows.taskPackets.length}, approvals=${rows.approvalPackets.length}, alerts=${alerts.length}`,
    latest_alerts: alerts.slice(-10),
    scan_collection_size: rows.approvalQueues.length,
  };
}

async function loadSeedFromFile(seedPath) {
  if (!seedPath) return {};
  const fs = require('node:fs/promises');
  const raw = await fs.readFile(seedPath, 'utf8');
  const parsed = JSON.parse(raw);
  const result = {};
  for (const [key, value] of Object.entries(parsed)) {
    result[key] = Array.isArray(value) ? value.map((record) => toRecord(record)).filter(Boolean) : [];
  }
  return result;
}

function parseArguments() {
  const { values } = parseArgs({
    options: {
      mode: { type: 'string', default: 'scan' },
      postgres: { type: 'boolean' },
      schema: { type: 'string' },
      scanLabel: { type: 'string', default: 'nightly_scan' },
      source: { type: 'string', short: 's' },
      operatorId: { type: 'string', default: 'local-operator' },
      repository: { type: 'string' },
      actionType: { type: 'string', default: 'compute_project_health' },
      triggerEventId: { type: 'string' },
      targetRunId: { type: 'string' },
      scope: { type: 'string' },
      retentionDays: { type: 'string', default: '30' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true
  });

  return values;
}

function printUsage() {
  console.log('Usage: node scripts/phase8-production-operations.js --mode [scan|alert|backup|rollback|report] [options]');
  console.log('       --mode scan            Run read-only scheduled scan and persist artifacts');
  console.log('       --mode alert           Emit operations alert from state');
  console.log('       --mode backup          Prepare backup plan for repository');
  console.log('       --mode rollback        Prepare rollback plan for a run id');
  console.log('       --mode report          Show latest operations summary');
  console.log('       --scan-label NAME       Label for scan runs (default: nightly_scan)');
  console.log('       --repository NAME       Repository for backup/rollback');
  console.log('       --target-run-id         Target run id for rollback');
  console.log('       --postgres              Store payloads in PostgreSQL/Supabase');
  console.log('       --help                 Show this help text');
}

async function run() {
  const args = parseArguments();
  if (args.help) {
    return printUsage();
  }

  const repository = args.repository || null;
  const operatorId = args.operatorId || 'local-operator';
  const usePostgres = Boolean(args.postgres || process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL);
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL;
  const schema = args.schema || process.env.SUPABASE_SCHEMA || 'public';
  const mode = String(args.mode || 'scan');

  const stateStore = usePostgres
    ? new PostgresStateStore({ connectionString, schema })
    : new InMemoryStateStore(await loadSeedFromFile(args.source));

  const retentionDays = Number.parseInt(String(args.retentionDays || '30'), 10);
  const common = {
    scanLabel: args.scanLabel,
    repository,
    targetRunId: args.targetRunId,
    triggerEventId: args.triggerEventId,
    scope: args.scope || 'full',
    retentionDays: Number.isFinite(retentionDays) ? retentionDays : 30,
    operatorId,
    actionType: args.actionType,
    source: usePostgres ? 'postgres' : 'memory',
  };

  const result =
    mode === 'scan'
      ? await runScheduledScan(stateStore, common)
      : mode === 'alert'
        ? await runAlertCheck(stateStore, common)
        : mode === 'backup'
          ? await runBackupOrRollback('backup', stateStore, common)
          : mode === 'rollback'
            ? await runBackupOrRollback('rollback', stateStore, common)
            : await runReport(stateStore, common);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printSummary(result);
  const sensitive = isSensitiveIntegrationAction(common.actionType);
  if (sensitive && mode === 'scan') {
    console.log(`Note: mode uses integration action ${common.actionType} only in approval-gated planning path.`);
  }
}

run().catch((error) => {
  console.error(`Phase 8 operations failed: ${error && error.message ? error.message : error}`);
  process.exitCode = 1;
});
