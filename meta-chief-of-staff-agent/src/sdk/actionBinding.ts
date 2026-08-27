import { createHash } from 'node:crypto';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface ExactActionBinding {
  binding_version: '1.0';
  action_type: string;
  tool_name: string;
  agent_name: string;
  repository: string | null;
  environment: string | null;
  normalized_arguments: JsonValue;
  action_digest: string;
}

export interface CreateExactActionBindingInput {
  toolName: string;
  agentName: string;
  arguments: unknown;
  actionType?: string;
}

const SECRET_FIELD_NAMES = new Set([
  'apikey',
  'authorization',
  'bearertoken',
  'clientsecret',
  'credential',
  'credentials',
  'password',
  'privatekey',
  'refreshtoken',
  'secret',
  'servicerolekey',
  'token',
]);

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}={0,2}\b/i,
  /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/,
];

const TOOL_ACTION_MAP: Record<string, string> = {
  create_github_issue: 'create_github_issue',
  create_draft_pr: 'create_pull_request_draft',
  create_draft_pull_request: 'create_pull_request_draft',
  write_repository_file: 'write_repository_file',
};

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSecretField(field: string): boolean {
  const normalized = normalizeFieldName(field);
  return SECRET_FIELD_NAMES.has(normalized) || normalized.endsWith('secret') || normalized.endsWith('privatekey');
}

function assertStringDoesNotContainSecret(value: string, path: string): void {
  if (SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`Exact action arguments appear to contain a secret value at ${path}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeJson(value: unknown, path = '$'): JsonValue {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    assertStringDoesNotContainSecret(value, path);
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Exact action arguments contain a non-finite number at ${path}.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => normalizeJson(item, `${path}[${index}]`));
  if (isRecord(value)) {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      if (isSecretField(key)) {
        throw new Error(`Exact action arguments must not contain secret-bearing field '${key}' at ${path}.`);
      }
      const nested = value[key];
      if (typeof nested === 'undefined') {
        throw new Error(`Exact action arguments contain undefined at ${path}.${key}.`);
      }
      result[key] = normalizeJson(nested, `${path}.${key}`);
    }
    return result;
  }
  throw new Error(`Exact action arguments contain a non-JSON value at ${path}.`);
}

export function stableJson(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, JsonValue>)[key]!)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashJson(value: JsonValue): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function parseToolArguments(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    throw new Error(`SDK tool arguments must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function inferActionType(toolName: string, args: unknown): string {
  if (isRecord(args)) {
    const explicit = args.actionType ?? args.action_type;
    if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  }
  return TOOL_ACTION_MAP[toolName] ?? toolName;
}

export function createExactActionBinding(input: CreateExactActionBindingInput): ExactActionBinding {
  const toolName = input.toolName.trim();
  const agentName = input.agentName.trim();
  if (!toolName) throw new Error('toolName is required for exact action binding.');
  if (!agentName) throw new Error('agentName is required for exact action binding.');

  const parsedArguments = parseToolArguments(input.arguments);
  const normalizedArguments = normalizeJson(parsedArguments);
  const argumentRecord = isRecord(normalizedArguments) ? normalizedArguments : {};
  const repository = typeof argumentRecord.repository === 'string' ? argumentRecord.repository : null;
  const environment = typeof argumentRecord.environment === 'string' ? argumentRecord.environment : null;
  const actionType = (input.actionType ?? inferActionType(toolName, normalizedArguments)).trim();
  if (!actionType) throw new Error('actionType is required for exact action binding.');

  const digestPayload: Omit<ExactActionBinding, 'action_digest'> = {
    binding_version: '1.0',
    action_type: actionType,
    tool_name: toolName,
    agent_name: agentName,
    repository,
    environment,
    normalized_arguments: normalizedArguments,
  };

  return {
    ...digestPayload,
    action_digest: hashJson(digestPayload as unknown as JsonValue),
  };
}

export function assertExactActionMatch(expected: ExactActionBinding, candidate: ExactActionBinding): void {
  if (expected.binding_version !== candidate.binding_version) {
    throw new Error('Exact action binding version changed after approval was requested.');
  }
  if (expected.action_digest !== candidate.action_digest) {
    throw new Error('Exact action digest mismatch. The tool invocation changed after approval was requested.');
  }
}

export function assertApprovalConstraints(
  binding: ExactActionBinding,
  constraints: Record<string, unknown> = {},
): void {
  const allowedRepository = constraints.allowed_repository;
  const allowedRepositories = constraints.allowed_repositories;
  const targetEnvironment = constraints.target_environment;
  const forbiddenActions = constraints.forbidden_actions;
  const constrainedDigest = constraints.action_digest;

  if (typeof allowedRepository === 'string' && binding.repository !== allowedRepository) {
    throw new Error(`Approval is scoped to repository '${allowedRepository}', not '${binding.repository ?? 'none'}'.`);
  }
  if (
    Array.isArray(allowedRepositories) &&
    (!binding.repository || !allowedRepositories.some((repository) => repository === binding.repository))
  ) {
    throw new Error(`Repository '${binding.repository ?? 'none'}' is outside the approved repository scope.`);
  }
  if (typeof targetEnvironment === 'string' && binding.environment !== targetEnvironment) {
    throw new Error(`Approval is scoped to environment '${targetEnvironment}', not '${binding.environment ?? 'none'}'.`);
  }
  if (Array.isArray(forbiddenActions) && forbiddenActions.includes(binding.action_type)) {
    throw new Error(`Action '${binding.action_type}' is forbidden by the approval constraints.`);
  }
  if (typeof constrainedDigest === 'string' && constrainedDigest !== binding.action_digest) {
    throw new Error('Approval constraint digest does not match the exact action digest.');
  }
}
