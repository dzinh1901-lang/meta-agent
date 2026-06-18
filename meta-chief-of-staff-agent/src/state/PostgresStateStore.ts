import type { StateCollection, StateStore, StoredRecord } from './StateStore.js';

type QueryResult = {
  rowCount: number;
  rows: Array<{
    id: string;
    value: unknown;
    created_at: string;
    updated_at: string;
  }>;
};

type PoolLike = {
  query: (text: string, params?: unknown[]) => Promise<QueryResult>;
};

type PostgresStateStoreOptions = {
  connectionString?: string;
  tablePrefix?: string;
  schemaName?: string;
};

const DEFAULT_TABLES: Record<StateCollection, string> = {
  repositories: 'repositories',
  projectHealth: 'project_health_snapshots',
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
  policyVersions: 'policy_versions',
};

const DEFAULT_TABLE_SUFFIX = '';

const normalizeDate = (value: string): string => new Date(value).toISOString();

export class PostgresStateStore implements StateStore {
  private readonly pool: PoolLike;
  private readonly schema: string;
  private readonly tablePrefix: string;

  constructor(options: PostgresStateStoreOptions = {}) {
    const conn = options.connectionString ?? process.env.DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL;
    if (!conn) {
      throw new Error('DATABASE_URL or SUPABASE_DATABASE_URL is required to initialize PostgresStateStore.');
    }

    const pg = require('pg') as {
      Pool: new (opts: { connectionString: string }) => PoolLike;
    };
    const { Pool } = pg;
    this.pool = new Pool({ connectionString: conn });
    this.schema = options.schemaName ?? 'public';
    this.tablePrefix = options.tablePrefix ?? '';
  }

  async put(collection: StateCollection, id: string, value: unknown): Promise<StoredRecord> {
    const now = normalizeDate(new Date().toISOString());
    const existing = await this.get(collection, id);
    const table = this.tableName(collection);
    const statement = `
      insert into ${table} (id, value, created_at, updated_at)
      values ($1, $2::jsonb, $3, $4)
      on conflict (id)
      do update set value = excluded.value, updated_at = excluded.updated_at
      returning id, created_at, updated_at, value
    `;
    const rows = await this.execute(statement, [id, JSON.stringify(value), existing ? existing.createdAt : now, now], collection);
    return rows[0];
  }

  async get(collection: StateCollection, id: string): Promise<StoredRecord | null> {
    const table = this.tableName(collection);
    const rows = await this.execute<Record<string, unknown>>(
      `select id, value, created_at, updated_at from ${table} where id = $1 limit 1`,
      [id],
      collection,
      false
    );
    if (!rows.length) return null;
    return this.adapt(rows[0]);
  }

  async list(collection: StateCollection): Promise<StoredRecord[]> {
    const table = this.tableName(collection);
    const rows = await this.execute<Record<string, unknown>>(
      `select id, value, created_at, updated_at from ${table} order by created_at asc`,
      [],
      collection,
      false
    );
    return rows.map((row) => this.adapt(row)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async delete(collection: StateCollection, id: string): Promise<boolean> {
    const table = this.tableName(collection);
    const rows = await this.execute(
      `delete from ${table} where id = $1 returning id, value, created_at, updated_at`,
      [id],
      collection,
      true
    );
    return rows.length > 0;
  }

  async clear(): Promise<void> {
    const tables = Array.from(new Set(Object.values(DEFAULT_TABLES))).map((name) => `${this.schema}.${this.prefixed(name)}`);
    const statement = `truncate table ${tables.join(', ')} restart identity`;
    await this.pool.query(statement, []);
  }

  private tableName(collection: StateCollection): string {
    return `${this.schema}.${this.prefixed(DEFAULT_TABLES[collection])}`;
  }

  private prefixed(name: string): string {
    return `${this.tablePrefix}${name}${DEFAULT_TABLE_SUFFIX}`;
  }

  private adapt(row: { id: string; value: unknown; created_at: string; updated_at: string }): StoredRecord {
    return {
      id: row.id,
      value: row.value,
      createdAt: normalizeDate(row.created_at),
      updatedAt: normalizeDate(row.updated_at),
    };
  }

  private async execute<T extends { id: string; value: unknown; created_at: string; updated_at: string } = {
    id: string;
    value: unknown;
    created_at: string;
    updated_at: string;
  }>(
    sql: string,
    params: unknown[],
    _collection: StateCollection,
    requireRowCount = false
  ): Promise<T[]> {
    try {
      const result = await this.pool.query(sql, params);
      if (!requireRowCount) return result.rows as T[];
      if (result.rows.length > 0) return result.rows as T[];
      return [];
    } catch (error) {
      throw new Error(`PostgresStateStore query failed: ${String(error instanceof Error ? error.message : error)}`);
    }
  }
}

export const createSupabaseStateStore = (options: PostgresStateStoreOptions = {}): PostgresStateStore =>
  new PostgresStateStore(options);
