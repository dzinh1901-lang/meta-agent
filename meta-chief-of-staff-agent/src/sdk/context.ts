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
  operatorRoles: string[];
  mode: 'dry_run' | 'approval_gated';
  registry: PortfolioRegistry;
  stateStore: StateStore;
  authorizedRepositories: string[];
  environment: string;
}

function parseOperatorRoles(value: string | undefined): string[] {
  if (!value) return ['principal_approver'];
  return Array.from(new Set(value.split(',').map((role) => role.trim()).filter(Boolean)));
}

export function createMetaAgentContext(options: Partial<MetaAgentContext> = {}): MetaAgentContext {
  const registry = options.registry ?? loadRegistry();
  return {
    operatorId: options.operatorId ?? process.env.META_AGENT_OPERATOR_ID ?? 'local-operator',
    operatorRoles: options.operatorRoles ?? parseOperatorRoles(process.env.META_AGENT_OPERATOR_ROLES),
    mode: options.mode ?? (process.env.META_AGENT_MODE === 'approval_gated' ? 'approval_gated' : 'dry_run'),
    registry,
    stateStore: options.stateStore ?? new InMemoryStateStore(),
    authorizedRepositories: options.authorizedRepositories ?? registry.repositories.map((repo) => repo.repository_full_name),
    environment: options.environment ?? process.env.META_AGENT_ENVIRONMENT ?? 'local',
  };
}
