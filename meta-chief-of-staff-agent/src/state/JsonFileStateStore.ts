import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { StateCollection, StateStore, StoredRecord } from './StateStore.js';

type PersistedState = {
  version: 1;
  collections: Partial<Record<StateCollection, Record<string, StoredRecord>>>;
};

const EMPTY_STATE: PersistedState = { version: 1, collections: {} };

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isStoredRecord(value: unknown): value is StoredRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' &&
    Object.prototype.hasOwnProperty.call(record, 'value')
  );
}

export class JsonFileStateStore implements StateStore {
  readonly filePath: string;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(filePath = '.data/cosmos-state.json') {
    this.filePath = resolve(filePath);
  }

  async put(collection: StateCollection, id: string, value: unknown): Promise<StoredRecord> {
    if (!id.trim()) throw new Error('State record id must be a non-empty string.');
    return this.mutate(async (state) => {
      const bucket = (state.collections[collection] ??= {});
      const now = new Date().toISOString();
      const existing = bucket[id];
      const record: StoredRecord = {
        id,
        value: clone(value),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      bucket[id] = record;
      return clone(record);
    });
  }

  async get(collection: StateCollection, id: string): Promise<StoredRecord | null> {
    await this.writeChain;
    const state = await this.readState();
    const record = state.collections[collection]?.[id];
    return record ? clone(record) : null;
  }

  async list(collection: StateCollection): Promise<StoredRecord[]> {
    await this.writeChain;
    const state = await this.readState();
    return Object.values(state.collections[collection] ?? {})
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((record) => clone(record));
  }

  async delete(collection: StateCollection, id: string): Promise<boolean> {
    return this.mutate(async (state) => {
      const bucket = state.collections[collection];
      if (!bucket || !Object.prototype.hasOwnProperty.call(bucket, id)) return false;
      delete bucket[id];
      return true;
    });
  }

  async clear(): Promise<void> {
    await this.enqueueWrite(async () => {
      await this.writeState(clone(EMPTY_STATE));
    });
  }

  private async mutate<T>(operation: (state: PersistedState) => Promise<T> | T): Promise<T> {
    let result!: T;
    await this.enqueueWrite(async () => {
      const state = await this.readState();
      result = await operation(state);
      await this.writeState(state);
    });
    return result;
  }

  private async enqueueWrite(operation: () => Promise<void>): Promise<void> {
    const next = this.writeChain.then(operation, operation);
    this.writeChain = next.catch(() => undefined);
    await next;
  }

  private async readState(): Promise<PersistedState> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return this.validateState(parsed);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') return clone(EMPTY_STATE);
      if (error instanceof SyntaxError) {
        throw new Error(`State file is not valid JSON: ${this.filePath}`);
      }
      throw error;
    }
  }

  private validateState(value: unknown): PersistedState {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`State file must contain an object: ${this.filePath}`);
    }
    const state = value as Record<string, unknown>;
    if (state.version !== 1 || !state.collections || typeof state.collections !== 'object') {
      throw new Error(`Unsupported or malformed state file: ${this.filePath}`);
    }
    const collections = state.collections as Record<string, unknown>;
    for (const [collection, bucket] of Object.entries(collections)) {
      if (!bucket || typeof bucket !== 'object' || Array.isArray(bucket)) {
        throw new Error(`Malformed state collection '${collection}' in ${this.filePath}`);
      }
      for (const [id, record] of Object.entries(bucket as Record<string, unknown>)) {
        if (!isStoredRecord(record) || record.id !== id) {
          throw new Error(`Malformed state record '${collection}/${id}' in ${this.filePath}`);
        }
      }
    }
    return clone(value as PersistedState);
  }

  private async writeState(state: PersistedState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
