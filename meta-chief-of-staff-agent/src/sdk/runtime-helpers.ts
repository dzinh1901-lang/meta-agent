import type { RunContext } from '@openai/agents';
import type { MetaAgentContext } from './context.js';

export function getMetaContext(runContext: RunContext<MetaAgentContext> | undefined): MetaAgentContext {
  if (!runContext?.context) throw new Error('MetaAgentContext is required.');
  return runContext.context;
}

export function requireAuthorizedRepository(context: MetaAgentContext, repository: string): void {
  if (!context.authorizedRepositories.includes(repository)) {
    throw new Error(`Repository is outside the authorized portfolio scope: ${repository}`);
  }
}

export function requireAuthorizedRepositories(context: MetaAgentContext, repositories: string[]): void {
  for (const repository of repositories) requireAuthorizedRepository(context, repository);
}

export function asRecord(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, any>;
}

export function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

export async function persistTaskWorkflow(context: MetaAgentContext, workflow: Record<string, any>): Promise<void> {
  const task = workflow.task_packet as Record<string, any> | undefined;
  const approval = workflow.approval_packet as Record<string, any> | null | undefined;
  const queue = workflow.pending_approval as Record<string, any> | null | undefined;
  const run = workflow.agent_run as Record<string, any> | undefined;
  const blocked = workflow.blocked_action as Record<string, any> | null | undefined;
  if (task?.task_id) await context.stateStore.put('taskPackets', task.task_id, task);
  if (approval?.approval_id) await context.stateStore.put('approvalPackets', approval.approval_id, approval);
  if (queue?.queue_id) await context.stateStore.put('approvalQueues', queue.queue_id, queue);
  if (run?.run_id) await context.stateStore.put('agentRuns', run.run_id, run);
  if (blocked?.blocked_action_id) {
    await context.stateStore.put('auditEvents', blocked.blocked_action_id, {
      event_type: 'blocked_action',
      ...blocked,
    });
  }
}
