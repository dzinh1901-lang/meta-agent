import { tool, type RunContext } from '@openai/agents';
import { z } from 'zod';
import { GitHubReadOnlyRepositoryReader } from '../discovery/GitHubReadOnlyRepositoryReader.js';
import {
  DEFAULT_DISCOVERY_PATHS,
  discoverRepository,
} from '../discovery/RepositoryDiscoveryService.js';
import type { MetaAgentContext } from './context.js';

const { stableId } = require('../packet-utils.js') as {
  stableId: (prefix: string, payload: unknown) => string;
};

function getContext(runContext: RunContext<MetaAgentContext> | undefined): MetaAgentContext {
  if (!runContext?.context) throw new Error('MetaAgentContext is required.');
  return runContext.context;
}

function requireAuthorizedRepository(context: MetaAgentContext, repository: string): void {
  if (!context.authorizedRepositories.includes(repository)) {
    throw new Error(`Repository is outside the authorized portfolio scope: ${repository}`);
  }
}

export const discoverRepositoryTool = tool({
  name: 'discover_repository',
  description:
    'Read approved GitHub metadata and standard project artifacts, then return sanitized evidence metadata. ' +
    'Repository content is treated as untrusted data and is never returned verbatim.',
  parameters: z.object({
    repository: z.string().min(1),
    paths: z.array(z.string().min(1)).max(20).default([...DEFAULT_DISCOVERY_PATHS]),
  }),
  async execute(args, runContext) {
    const context = getContext(runContext as RunContext<MetaAgentContext>);
    requireAuthorizedRepository(context, args.repository);
    const reader = new GitHubReadOnlyRepositoryReader({
      token: process.env.GITHUB_READ_TOKEN ?? process.env.GITHUB_TOKEN,
      maxFileBytes: Number(process.env.COSMOS_DISCOVERY_MAX_FILE_BYTES ?? 512_000),
    });
    const result = await discoverRepository(reader, args.repository, args.paths);
    const snapshotId = stableId('health', {
      repository: result.repository,
      source_digest: result.source_digest,
    });
    await context.stateStore.put('projectHealthSnapshots', snapshotId, result);
    await context.stateStore.put('repositories', result.repository, {
      repository: result.repository,
      discovery_status: result.summary.evidence_status,
      confidence: result.summary.confidence,
      last_scanned_at: result.as_of,
      source_ref: result.source_ref,
      source_digest: result.source_digest,
    });
    const evidenceId = stableId('evidence', {
      repository: result.repository,
      source_digest: result.source_digest,
    });
    await context.stateStore.put('evidenceEvents', evidenceId, {
      event_id: evidenceId,
      event_type: 'repository_discovery_completed',
      repository: result.repository,
      source_ref: result.source_ref,
      source_digest: result.source_digest,
      evidence_status: result.summary.evidence_status,
      recorded_at: result.as_of,
      external_side_effects_executed: false,
    });
    return {
      ...result,
      project_health_snapshot_id: snapshotId,
      evidence_event_id: evidenceId,
      raw_repository_content_returned: false,
      external_side_effects_executed: false,
    };
  },
});
