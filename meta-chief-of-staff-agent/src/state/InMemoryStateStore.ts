import type { StateCollection, StateStore, StoredRecord } from './StateStore.js';

export class InMemoryStateStore implements StateStore {
  private readonly collections = new Map<StateCollection, Map<string, StoredRecord>>();

  async put(collection: StateCollection, id: string, value: unknown): Promise<StoredRecord> {
    const now = new Date().toISOString();
    const bucket = this.getBucket(collection);
    const existing = bucket.get(id);
    const record: StoredRecord = {
      id,
      value: structuredClone(value),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    bucket.set(id, record);
    return structuredClone(record);
  }

  async get(collection: StateCollection, id: string): Promise<StoredRecord | null> {
    const record = this.getBucket(collection).get(id);
    return record ? structuredClone(record) : null;
  }

  async list(collection: StateCollection): Promise<StoredRecord[]> {
    return [...this.getBucket(collection).values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((record) => structuredClone(record));
  }

  async delete(collection: StateCollection, id: string): Promise<boolean> {
    return this.getBucket(collection).delete(id);
  }

  async clear(): Promise<void> {
    this.collections.clear();
  }

  private getBucket(collection: StateCollection): Map<string, StoredRecord> {
    let bucket = this.collections.get(collection);
    if (!bucket) {
      bucket = new Map<string, StoredRecord>();
      this.collections.set(collection, bucket);
    }
    return bucket;
  }
}
