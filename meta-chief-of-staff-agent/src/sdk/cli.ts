#!/usr/bin/env node
import type { StateStore } from '../state/StateStore.js';
import { JsonFileStateStore } from '../state/JsonFileStateStore.js';
import { PostgresStateStore } from '../state/PostgresStateStore.js';
import { createMetaAgentContext } from './context.js';
import {
  resumeChiefOfStaff,
  runChiefOfStaff,
  type ApprovalDecisionInput,
  type ChiefRunSnapshot,
} from './runtime.js';

type ParsedArgs = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; args: ParsedArgs } {
  const [command = 'help', ...rest] = argv;
  const args: ParsedArgs = {};
  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index]!;
    if (!current.startsWith('--')) throw new Error(`Unexpected positional argument: ${current}`);
    const key = current.slice(2);
    if (!key) throw new Error('Argument names cannot be empty.');
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return { command, args };
}

function getString(args: ParsedArgs, key: string, required = false): string | undefined {
  const value = args[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (required) throw new Error(`--${key} is required.`);
  return undefined;
}

function getInteger(args: ParsedArgs, key: string): number | undefined {
  const value = getString(args, key);
  if (typeof value === 'undefined') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${key} must be a positive integer.`);
  return parsed;
}

function parseJsonObject(value: string | undefined, label: string): Record<string, unknown> {
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

function createStateStore(args: ParsedArgs): StateStore {
  if (args.postgres === true) {
    return new PostgresStateStore({
      schemaName: getString(args, 'schema') ?? process.env.COSMOS_DATABASE_SCHEMA ?? 'public',
      tablePrefix: getString(args, 'table-prefix') ?? process.env.COSMOS_DATABASE_TABLE_PREFIX ?? '',
    });
  }
  return new JsonFileStateStore(
    getString(args, 'state-file') ?? process.env.COSMOS_STATE_FILE ?? '.data/cosmos-state.json',
  );
}

function publicSnapshot(snapshot: ChiefRunSnapshot): Omit<ChiefRunSnapshot, 'sdk_state'> & {
  sdk_state_persisted: true;
} {
  const { sdk_state: _sdkState, ...publicFields } = snapshot;
  return { ...publicFields, sdk_state_persisted: true };
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printUsage(): void {
  process.stdout.write(`COSMOS Meta Chief of Staff Agent\n\n`);
  process.stdout.write(`Commands:\n`);
  process.stdout.write(`  run --objective <text> [--state-file <path>] [--max-turns <n>]\n`);
  process.stdout.write(`  decide --run-id <id> --approval-id <id> --decision <type> --role <role>\n`);
  process.stdout.write(`         [--constraints <json>] [--notes <text>] [--state-file <path>]\n`);
  process.stdout.write(`  status --run-id <id> [--state-file <path>]\n`);
  process.stdout.write(`  approvals [--state-file <path>]\n\n`);
  process.stdout.write(`Trusted server environment:\n`);
  process.stdout.write(`  OPENAI_API_KEY, COSMOS_OPERATOR_ID, COSMOS_APPROVER_ROLES\n`);
  process.stdout.write(`Optional read-only discovery:\n`);
  process.stdout.write(`  GITHUB_READ_TOKEN (or GITHUB_TOKEN)\n`);
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'help' || args.help === true) {
    printUsage();
    return;
  }

  const stateStore = createStateStore(args);
  const context = createMetaAgentContext({
    stateStore,
    mode: 'approval_gated',
  });
  const maxTurns = getInteger(args, 'max-turns');

  if (command === 'run') {
    const objective = getString(args, 'objective', true)!;
    const snapshot = await runChiefOfStaff(objective, { context, maxTurns });
    printJson(publicSnapshot(snapshot));
    return;
  }

  if (command === 'decide') {
    const decision = getString(args, 'decision', true)! as ApprovalDecisionInput['decisionType'];
    const allowedDecisions: ApprovalDecisionInput['decisionType'][] = [
      'approve_once',
      'approve_with_limits',
      'reject',
      'request_changes',
      'always_reject',
    ];
    if (!allowedDecisions.includes(decision)) throw new Error(`Unsupported --decision value: ${decision}`);
    const snapshot = await resumeChiefOfStaff({
      context,
      runId: getString(args, 'run-id', true)!,
      maxTurns,
      decisions: [
        {
          approvalId: getString(args, 'approval-id', true)!,
          decisionType: decision,
          approverRole: getString(args, 'role', true)!,
          constraints: parseJsonObject(getString(args, 'constraints'), '--constraints'),
          notes: getString(args, 'notes') ?? '',
          decidedAt: getString(args, 'decided-at'),
        },
      ],
    });
    printJson(publicSnapshot(snapshot));
    return;
  }

  if (command === 'status') {
    const runId = getString(args, 'run-id', true)!;
    const record = await stateStore.get('agentRuns', runId);
    if (!record) throw new Error(`Agent run not found: ${runId}`);
    const value = record.value as ChiefRunSnapshot;
    printJson(publicSnapshot(value));
    return;
  }

  if (command === 'approvals') {
    const records = await stateStore.list('approvalQueues');
    printJson(
      records.map((record) => ({
        id: record.id,
        ...(record.value && typeof record.value === 'object' && !Array.isArray(record.value)
          ? (record.value as Record<string, unknown>)
          : { value: record.value }),
      })),
    );
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`COSMOS error: ${message}\n`);
  process.exitCode = 1;
});
