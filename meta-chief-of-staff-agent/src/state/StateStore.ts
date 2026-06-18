export type StateCollection =
  | 'repositories'
  | 'projectHealth'
  | 'taskPackets'
  | 'approvalPackets'
  | 'approvalQueues'
  | 'approvalDecisions'
  | 'agentRuns'
  | 'routingPlans'
  | 'orchestratorResponses'
  | 'procurementWorkflows'
  | 'marketingWorkflows'
  | 'financeReviews'
  | 'securityReviews'
  | 'handoffEvents'
  | 'auditEvents';

export interface StoredRecord {
  id: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface StateStore {
  put(collection: StateCollection, id: string, value: unknown): Promise<StoredRecord>;
  get(collection: StateCollection, id: string): Promise<StoredRecord | null>;
  list(collection: StateCollection): Promise<StoredRecord[]>;
  delete(collection: StateCollection, id: string): Promise<boolean>;
  clear(): Promise<void>;
}
