import { InMemoryStateStore } from '../state/InMemoryStateStore.js';
import type { StateStore } from '../state/StateStore.js';

const { loadRegistry } = require('../repository-registry.js') as {
  loadRegistry: () => PortfolioRegistry;
};

export interface RepositoryRecord {
  repository_full_name: string;
  name: string;
  domain_guess?: string;
  visibility?: string;
  default_branch?: string;
  oversight_status?: string;
  orchestrator?: {
    known?: boolean;
    path?: string | null;
    approval_policy_known?: boolean;
  };
  required_next_discovery?: string[];
}

export interface PortfolioRegistry {
  schema_version: string;
  owner: string;
  repositories: RepositoryRecord[];
  portfolio_policy?: Record<string, unknown>;
}

export interface MetaAgentContext {
  operatorId: string;
  mode: 'dry_run' | 'approval_gated';
  registry: PortfolioRegistry;
  stateStore: StateStore;
  authorizedRepositories: string[];
}

export function createMetaAgentContext(options: Partial<MetaAgentContext> = {}): MetaAgentContext {
  const registry = options.registry ?? loadRegistry();
  return {
    operatorId: options.operatorId ?? 'local-operator',
    mode: options.mode ?? 'dry_run',
    registry,
    stateStore: options.stateStore ?? new InMemoryStateStore(),
    authorizedRepositories: options.authorizedRepositories ?? registry.repositories.map((repo) => repo.repository_full_name),
  };
}
