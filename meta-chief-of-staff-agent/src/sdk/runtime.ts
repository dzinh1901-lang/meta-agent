import { randomUUID } from 'node:crypto';
import {
  RunContext,
  RunState,
  Runner,
  type RunToolApprovalItem,
} from '@openai/agents';
import type { MetaAgentContext } from './context.js';
import { assertAuthorizedApproverRole } from './context.js';
import {
  assertApprovalConstraints,
  assertExactActionMatch,
  createExactActionBinding,
  normalizeJson,
  stableJson,
  type ExactActionBinding,
} from './actionBinding.js';
import { metaChiefOfStaffAgent } from './metaChiefOfStaff.js';

const { classifyAction } = require('../policy-engine.js') as {
  classifyAction: (actionType: string, context?: Record<string, unknown>) => Record<string, any>;
};
const { buildApprovalPacket } = require('../approval-packet-builder.js') as {
  buildApprovalPacket: (input: Record<string, unknown>) => Record<string, any>;
};
const {
  createPendingApproval,
  recordApprovalDecision,
  applyApprovalDecision,
} = require('../run-state.js') as {
  createPendingApproval: (input: Record<string, unknown>) => Record<string, any>;
  recordApprovalDecision: (input: Record<string, unknown>) => Record<string, any>;
  applyApprovalDecision: (
    pendingApproval: Record<string, any>,
    decisionRecord: Record<string, any>,
  ) => Record<string, any>;
};
const { stableId } = require('../packet-utils.js') as {
  stableId: (prefix: string, payload: unknown) => string;
};

type ChiefRunResult = {
  state: RunState<MetaAgentContext, typeof metaChiefOfStaffAgent>;
  interruptions: RunToolApprovalItem[];
  finalOutput: unknown;
};

export interface ChiefRunSnapshot {
  run_id: string;
  root_agent: string;
  runtime_version: string;
  status: 'running' | 'paused_for_approval' | 'completed' | 'blocked';
  input_summary: string;
  final_output: unknown;
  sdk_state: string;
  interruptions: Array<{
    approval_id: string;
    queue_id: string;
    action_digest: string;
    action_type: string;
    tool_name: string;
    agent_name: string;
    required_approver_roles: string[];
    repository: string | null;
    environment: string | null;
  }>;
  created_at: string;
  updated_at: string;
  audit_correlation_id: string;
}

export interface RunChiefOfStaffOptions {
  context: MetaAgentContext;
  maxTurns?: number;
}

export interface ApprovalDecisionInput {
  approvalId: string;
  decisionType: 'approve_once' | 'approve_with_limits' | 'reject' | 'request_changes' | 'always_reject';
  approverRole: string;
  constraints?: Record<string, unknown>;
  notes?: string;
  decidedAt?: string;
}

export interface ResumeChiefOfStaffOptions {
  context: MetaAgentContext;
  runId: string;
  decisions: ApprovalDecisionInput[];
  maxTurns?: number;
}

function createRunner(runId: string): Runner {
  return new Runner({
    workflowName: 'COSMOS Meta Chief of Staff',
    groupId: runId,
    traceMetadata: {
      run_id: runId,
      runtime: 'meta-chief-of-staff-agent',
    },
    tracingDisabled: process.env.OPENAI_AGENTS_TRACING_DISABLED === '1',
    traceIncludeSensitiveData: false,
  });
}

function assertApiKeyPresent(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is required to run the Meta Chief of Staff Agent.');
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, label: string): Record<string, any> {
  if (!isRecord(value)) throw new Error(`${label} is malformed.`);
  return value;
}

function getToolName(interruption: RunToolApprovalItem): string {
  const toolName = interruption.name ?? interruption.toolName;
  if (!toolName) throw new Error('SDK approval interruption is missing a tool name.');
  return toolName;
}

function buildBinding(interruption: RunToolApprovalItem): ExactActionBinding {
  return createExactActionBinding({
    toolName: getToolName(interruption),
    agentName: interruption.agent.name,
    arguments: interruption.arguments ?? '{}',
  });
}

function assertCompatibleConstraints(
  existing: Record<string, unknown>,
  candidate: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(candidate)) {
    if (!Object.prototype.hasOwnProperty.call(existing, key)) continue;
    const existingValue = existing[key];
    if (stableJson(normalizeJson(existingValue)) !== stableJson(normalizeJson(value))) {
      throw new Error(`Approval constraint '${key}' conflicts with an existing approval constraint.`);
    }
  }
}

async function recordAudit(
  context: MetaAgentContext,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  const recordedAt = new Date().toISOString();
  const eventId = stableId('audit', { eventType, payload, recordedAt, nonce: randomUUID() });
  await context.stateStore.put('auditEvents', eventId, {
    event_id: eventId,
    event_type: eventType,
    operator_id: context.operatorId,
    recorded_at: recordedAt,
    ...payload,
  });
  return eventId;
}

async function settleHardBlockedInterruptions(
  initialResult: ChiefRunResult,
  context: MetaAgentContext,
  runner: Runner,
  maxTurns: number,
): Promise<ChiefRunResult> {
  let result = initialResult;
  for (let pass = 0; pass < 5; pass += 1) {
    let rejected = 0;
    for (const interruption of result.interruptions) {
      const binding = buildBinding(interruption);
      const policy = classifyAction(binding.action_type, {});
      if (!policy.blocked) continue;
      result.state.reject(interruption, {
        alwaysReject: true,
        message: `Blocked by deterministic portfolio policy: ${String(policy.reason)}`,
      });
      await recordAudit(context, 'sdk_interruption_hard_blocked', {
        action_type: binding.action_type,
        action_digest: binding.action_digest,
        tool_name: binding.tool_name,
        agent_name: binding.agent_name,
        reason: String(policy.reason),
      });
      rejected += 1;
    }
    if (rejected === 0) return result;
    result = await runner.run(metaChiefOfStaffAgent, result.state, {
      maxTurns,
      toolExecution: { preApprovalInputGuardrails: true },
      toolNotFoundBehavior: 'return_error_to_model',
    });
  }
  throw new Error('Agent repeatedly requested hard-blocked actions. Run stopped fail-closed.');
}

async function markConsumedApprovals(
  context: MetaAgentContext,
  previousRun: Record<string, any> | null,
  currentDigests: Set<string>,
): Promise<void> {
  const previousInterruptions = Array.isArray(previousRun?.interruptions) ? previousRun.interruptions : [];
  for (const prior of previousInterruptions) {
    if (!isRecord(prior) || typeof prior.action_digest !== 'string' || currentDigests.has(prior.action_digest)) continue;
    if (typeof prior.approval_id !== 'string' || typeof prior.queue_id !== 'string') continue;
    const [packetRow, queueRow] = await Promise.all([
      context.stateStore.get('approvalPackets', prior.approval_id),
      context.stateStore.get('approvalQueues', prior.queue_id),
    ]);
    const consumedAt = new Date().toISOString();
    if (packetRow) {
      const packet = asRecord(packetRow.value, 'Approval packet');
      if (packet.status === 'approved') {
        await context.stateStore.put('approvalPackets', prior.approval_id, {
          ...packet,
          status: 'consumed',
          consumed_at: consumedAt,
          consumed_action_digest: prior.action_digest,
        });
      }
    }
    if (queueRow) {
      const queue = asRecord(queueRow.value, 'Approval queue');
      if (queue.status === 'approved') {
        await context.stateStore.put('approvalQueues', prior.queue_id, {
          ...queue,
          status: 'consumed',
          consumed_at: consumedAt,
        });
      }
    }
  }
}

async function persistResult(
  context: MetaAgentContext,
  result: ChiefRunResult,
  inputSummary: string,
  runId: string,
): Promise<ChiefRunSnapshot> {
  const existingRow = await context.stateStore.get('agentRuns', runId);
  const existing = existingRow ? asRecord(existingRow.value, 'Agent run') : null;
  const createdAt = typeof existing?.created_at === 'string' ? existing.created_at : new Date().toISOString();
  const serializedState = result.state.toString({ includeTracingApiKey: false });
  const interruptionRecords: ChiefRunSnapshot['interruptions'] = [];
  const currentDigests = new Set<string>();
  const previousInterruptions = Array.isArray(existing?.interruptions) ? existing.interruptions : [];

  for (const [index, interruption] of result.interruptions.entries()) {
    const binding = buildBinding(interruption);
    currentDigests.add(binding.action_digest);
    const policy = classifyAction(binding.action_type, {});
    if (policy.blocked) {
      throw new Error(`Hard-blocked interruption reached approval persistence: ${String(policy.reason)}`);
    }
    if (!policy.requiresHumanApproval) {
      throw new Error(`Tool '${binding.tool_name}' paused for approval without a human-approval policy.`);
    }

    const previous = previousInterruptions.find(
      (candidate: unknown) => isRecord(candidate) && candidate.action_digest === binding.action_digest,
    ) as Record<string, any> | undefined;
    let approvalId = typeof previous?.approval_id === 'string' ? previous.approval_id : '';
    let queueId = typeof previous?.queue_id === 'string' ? previous.queue_id : '';

    if (!approvalId || !queueId) {
      const approvalPacket = buildApprovalPacket({
        action: {
          type: binding.action_type,
          summary: `${binding.agent_name} requests ${binding.tool_name}.`,
        },
        decision: policy,
        repositories: binding.repository ? [binding.repository] : ['portfolio'],
        requestingAgent: binding.agent_name,
        evidenceBundle: {
          source: 'openai_agents_sdk_interruption',
          sdk_run_id: runId,
          tool_name: binding.tool_name,
          action_digest: binding.action_digest,
          runtime_version: context.runtimeVersion,
        },
        expectedOutcome: 'Execute only the exact approved SDK tool invocation once.',
        rollbackPlan: 'Reject the interruption or stop the resumed run; never reuse the approval for changed arguments.',
        constraints: {
          ...(binding.repository ? { allowed_repository: binding.repository } : {}),
          ...(binding.environment ? { target_environment: binding.environment } : {}),
          action_digest: binding.action_digest,
        },
        auditCorrelationId: runId,
        exactAction: binding,
      });
      approvalId = approvalPacket.approval_id;
      const queue = createPendingApproval({
        approvalPacket,
        run: { run_id: runId },
        createdAt: new Date().toISOString(),
      });
      queueId = queue.queue_id;
      await context.stateStore.put('approvalPackets', approvalId, {
        ...approvalPacket,
        sdk_run_id: runId,
        sdk_interruption_index: index,
      });
      await context.stateStore.put('approvalQueues', queueId, {
        ...queue,
        action_digest: binding.action_digest,
        exact_action: binding,
        constraints: approvalPacket.constraints,
      });
      await recordAudit(context, 'sdk_approval_requested', {
        run_id: runId,
        approval_id: approvalId,
        queue_id: queueId,
        action_type: binding.action_type,
        action_digest: binding.action_digest,
        tool_name: binding.tool_name,
      });
    }

    interruptionRecords.push({
      approval_id: approvalId,
      queue_id: queueId,
      action_digest: binding.action_digest,
      action_type: binding.action_type,
      tool_name: binding.tool_name,
      agent_name: binding.agent_name,
      required_approver_roles: Array.isArray(policy.approvals) ? policy.approvals : [],
      repository: binding.repository,
      environment: binding.environment,
    });
  }

  await markConsumedApprovals(context, existing, currentDigests);

  const status: ChiefRunSnapshot['status'] = interruptionRecords.length ? 'paused_for_approval' : 'completed';
  const snapshot: ChiefRunSnapshot = {
    run_id: runId,
    root_agent: metaChiefOfStaffAgent.name,
    runtime_version: context.runtimeVersion,
    status,
    input_summary: inputSummary,
    final_output: result.finalOutput ?? null,
    sdk_state: serializedState,
    interruptions: interruptionRecords,
    created_at: createdAt,
    updated_at: new Date().toISOString(),
    audit_correlation_id: runId,
  };
  await context.stateStore.put('agentRuns', runId, snapshot);
  await recordAudit(context, status === 'completed' ? 'sdk_run_completed' : 'sdk_run_paused', {
    run_id: runId,
    interruption_count: interruptionRecords.length,
    final_output_recorded: result.finalOutput != null,
  });
  return snapshot;
}

async function persistPausedState(
  context: MetaAgentContext,
  storedRun: Record<string, any>,
  state: RunState<MetaAgentContext, typeof metaChiefOfStaffAgent>,
): Promise<ChiefRunSnapshot> {
  const snapshot: ChiefRunSnapshot = {
    ...(storedRun as ChiefRunSnapshot),
    status: 'paused_for_approval',
    sdk_state: state.toString({ includeTracingApiKey: false }),
    updated_at: new Date().toISOString(),
  };
  await context.stateStore.put('agentRuns', snapshot.run_id, snapshot);
  return snapshot;
}

async function allInterruptionsResolved(
  context: MetaAgentContext,
  storedRun: Record<string, any>,
): Promise<boolean> {
  const interruptions = Array.isArray(storedRun.interruptions) ? storedRun.interruptions : [];
  for (const interruption of interruptions) {
    if (!isRecord(interruption) || typeof interruption.queue_id !== 'string') return false;
    const queueRow = await context.stateStore.get('approvalQueues', interruption.queue_id);
    if (!queueRow) return false;
    const queue = asRecord(queueRow.value, 'Approval queue');
    if (!['approved', 'rejected', 'changes_requested'].includes(String(queue.status))) return false;
  }
  return true;
}

export async function runChiefOfStaff(
  input: string,
  options: RunChiefOfStaffOptions,
): Promise<ChiefRunSnapshot> {
  assertApiKeyPresent();
  const objective = input.trim();
  if (!objective) throw new Error('A portfolio objective is required.');
  const maxTurns = options.maxTurns ?? 20;
  const runId = `sdk_run_${randomUUID()}`;
  const runner = createRunner(runId);
  await recordAudit(options.context, 'sdk_run_started', {
    run_id: runId,
    input_summary: objective,
    runtime_version: options.context.runtimeVersion,
  });
  const initialResult = await runner.run(metaChiefOfStaffAgent, objective, {
    context: options.context,
    maxTurns,
    toolExecution: { preApprovalInputGuardrails: true },
    toolNotFoundBehavior: 'return_error_to_model',
  });
  const result = await settleHardBlockedInterruptions(initialResult, options.context, runner, maxTurns);
  return persistResult(options.context, result, objective, runId);
}

export async function resumeChiefOfStaff(
  options: ResumeChiefOfStaffOptions,
): Promise<ChiefRunSnapshot> {
  if (!options.decisions.length) throw new Error('At least one approval decision is required.');
  const runRow = await options.context.stateStore.get('agentRuns', options.runId);
  if (!runRow) throw new Error(`Agent run not found: ${options.runId}`);
  const storedRun = asRecord(runRow.value, 'Agent run');
  if (typeof storedRun.sdk_state !== 'string') throw new Error('Stored agent run does not contain resumable SDK state.');
  if (storedRun.status !== 'paused_for_approval') {
    throw new Error(`Agent run is not paused for approval: ${String(storedRun.status)}`);
  }

  const state = await RunState.fromStringWithContext(
    metaChiefOfStaffAgent,
    storedRun.sdk_state,
    new RunContext(options.context),
    { contextStrategy: 'replace' },
  );
  const interruptions = state.getInterruptions();

  for (const decisionInput of options.decisions) {
    assertAuthorizedApproverRole(options.context, decisionInput.approverRole);
    const packetRow = await options.context.stateStore.get('approvalPackets', decisionInput.approvalId);
    if (!packetRow) throw new Error(`Approval packet not found: ${decisionInput.approvalId}`);
    const packet = asRecord(packetRow.value, 'Approval packet');
    if (packet.status === 'consumed') {
      throw new Error(`Approval packet ${decisionInput.approvalId} has already been consumed.`);
    }
    if (packet.sdk_run_id !== options.runId) {
      throw new Error(`Approval packet ${decisionInput.approvalId} does not belong to run ${options.runId}.`);
    }
    if (!isRecord(packet.exact_action)) {
      throw new Error(`Approval packet ${decisionInput.approvalId} is not bound to an exact action.`);
    }
    const expectedBinding = packet.exact_action as ExactActionBinding;
    const interruption = interruptions.find((candidate) => {
      try {
        return buildBinding(candidate).action_digest === expectedBinding.action_digest;
      } catch {
        return false;
      }
    });
    if (!interruption) {
      throw new Error(`Exact action for approval ${decisionInput.approvalId} is no longer pending in SDK state.`);
    }
    const candidateBinding = buildBinding(interruption);
    assertExactActionMatch(expectedBinding, candidateBinding);

    const queues = await options.context.stateStore.list('approvalQueues');
    const queueRow = queues.find((candidate) => {
      const value = isRecord(candidate.value) ? candidate.value : {};
      return value.approval_id === decisionInput.approvalId;
    });
    if (!queueRow) throw new Error(`Approval queue not found for ${decisionInput.approvalId}.`);
    const queue = asRecord(queueRow.value, 'Approval queue');
    const fixedConstraints = isRecord(packet.constraints) ? packet.constraints : {};
    const existingConstraints = isRecord(queue.constraints) ? queue.constraints : {};
    const decisionConstraints = decisionInput.constraints ?? {};
    assertApprovalConstraints(candidateBinding, fixedConstraints);
    assertApprovalConstraints(candidateBinding, decisionConstraints);
    assertCompatibleConstraints({ ...fixedConstraints, ...existingConstraints }, decisionConstraints);

    const decisionRecord = recordApprovalDecision({
      pendingApproval: queue,
      decisionType: decisionInput.decisionType,
      approverRole: decisionInput.approverRole,
      decidedAt: decisionInput.decidedAt,
      constraints: decisionConstraints,
      notes: decisionInput.notes ?? '',
    });
    const updatedQueue = applyApprovalDecision(queue, decisionRecord);
    const mergedConstraints = {
      ...fixedConstraints,
      ...(isRecord(updatedQueue.constraints) ? updatedQueue.constraints : {}),
    };
    assertApprovalConstraints(candidateBinding, mergedConstraints);

    await options.context.stateStore.put('approvalDecisions', decisionRecord.decision_id, {
      ...decisionRecord,
      operator_id: options.context.operatorId,
      action_digest: candidateBinding.action_digest,
    });
    await options.context.stateStore.put('approvalQueues', queueRow.id, {
      ...updatedQueue,
      constraints: mergedConstraints,
      action_digest: candidateBinding.action_digest,
      exact_action: candidateBinding,
    });

    let packetStatus = 'partially_approved';
    if (updatedQueue.status === 'approved') {
      state.approve(interruption, { alwaysApprove: false });
      packetStatus = 'approved';
    } else if (updatedQueue.status === 'rejected') {
      state.reject(interruption, {
        alwaysReject: decisionInput.decisionType === 'always_reject',
        message: decisionInput.notes || 'Human approval was rejected.',
      });
      packetStatus = 'rejected';
    } else if (updatedQueue.status === 'changes_requested') {
      state.reject(interruption, {
        message: decisionInput.notes || 'Human reviewer requested changes.',
      });
      packetStatus = 'changes_requested';
    }

    await options.context.stateStore.put('approvalPackets', decisionInput.approvalId, {
      ...packet,
      status: packetStatus,
      constraints: mergedConstraints,
      approved_roles: updatedQueue.approved_roles,
      decision_ids: updatedQueue.decision_ids,
      updated_at: decisionRecord.decided_at,
    });
    await recordAudit(options.context, 'sdk_approval_decision_recorded', {
      run_id: options.runId,
      approval_id: decisionInput.approvalId,
      queue_id: queueRow.id,
      decision_id: decisionRecord.decision_id,
      decision_type: decisionInput.decisionType,
      approver_role: decisionInput.approverRole,
      action_digest: candidateBinding.action_digest,
      queue_status: updatedQueue.status,
    });
  }

  if (!(await allInterruptionsResolved(options.context, storedRun))) {
    return persistPausedState(options.context, storedRun, state);
  }

  assertApiKeyPresent();
  const maxTurns = options.maxTurns ?? 20;
  const runner = createRunner(options.runId);
  const resumedResult = await runner.run(metaChiefOfStaffAgent, state, {
    maxTurns,
    toolExecution: { preApprovalInputGuardrails: true },
    toolNotFoundBehavior: 'return_error_to_model',
  });
  const result = await settleHardBlockedInterruptions(resumedResult, options.context, runner, maxTurns);
  return persistResult(options.context, result, String(storedRun.input_summary), options.runId);
}
