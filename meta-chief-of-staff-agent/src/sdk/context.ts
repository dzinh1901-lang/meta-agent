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
  approverRoles: string[];
  runtimeVersion: string;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function resolveMode(value: unknown): MetaAgentContext['mode'] {
  if (value === 'approval_gated') return value;
  if (value === 'dry_run' || typeof value === 'undefined') return 'dry_run';
  throw new Error(`Unsupported COSMOS mode: ${String(value)}`);
}

export function createMetaAgentContext(options: Partial<MetaAgentContext> = {}): MetaAgentContext {
  const registry = options.registry ?? loadRegistry();
  const configuredRepositories = parseCsv(process.env.COSMOS_AUTHORIZED_REPOSITORIES);
  const authorizedRepositories =
    options.authorizedRepositories ??
    (configuredRepositories.length
      ? configuredRepositories
      : registry.repositories.map((repo) => repo.repository_full_name));
  const registryRepositories = new Set(registry.repositories.map((repo) => repo.repository_full_name));
  for (const repository of authorizedRepositories) {
    if (!registryRepositories.has(repository)) {
      throw new Error(`Authorized repository is not present in the portfolio registry: ${repository}`);
    }
  }

  return {
    operatorId: options.operatorId ?? process.env.COSMOS_OPERATOR_ID ?? 'local-operator',
    mode: resolveMode(options.mode ?? process.env.COSMOS_MODE),
    registry,
    stateStore: options.stateStore ?? new InMemoryStateStore(),
    authorizedRepositories,
    approverRoles: options.approverRoles ?? parseCsv(process.env.COSMOS_APPROVER_ROLES),
    runtimeVersion: options.runtimeVersion ?? '1.0.0',
  };
}

export function assertAuthorizedApproverRole(context: MetaAgentContext, role: string): void {
  if (!context.approverRoles.includes(role)) {
    throw new Error(
      `Approver role '${role}' is not authorized for operator '${context.operatorId}'. ` +
        'Configure COSMOS_APPROVER_ROLES in the trusted server environment.',
    );
  }
}
