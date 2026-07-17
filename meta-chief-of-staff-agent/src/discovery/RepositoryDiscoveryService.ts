import { createHash } from 'node:crypto';
import type { RepositoryReader } from './RepositoryReader.js';

export const DEFAULT_DISCOVERY_PATHS = [
  'README.md',
  'package.json',
  'PRD.md',
  'ROADMAP.md',
  'TASKS.md',
  'docs/agents/SUBAGENTS.md',
  '.claude/agents/registry.json',
  '.codex/agents.registry.json',
] as const;

export interface RepositoryDiscoveryResult {
  repository: string;
  as_of: string;
  source_ref: string;
  source_digest: string;
  metadata: {
    default_branch: string;
    visibility: string;
    archived: boolean;
    disabled: boolean;
    pushed_at: string | null;
    html_url: string | null;
  };
  artifacts: Array<{
    path: string;
    status: 'found' | 'missing' | 'invalid';
    sha: string | null;
    size: number | null;
    html_url: string | null;
    parsed_evidence: Record<string, unknown>;
    error: string | null;
  }>;
  summary: {
    requested: number;
    found: number;
    missing: number;
    invalid: number;
    evidence_status: 'verified' | 'partial' | 'missing';
    confidence: number;
  };
}

function normalizePaths(paths: readonly string[]): string[] {
  return Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean))).sort();
}

function parsePackageJson(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('package.json must contain an object.');
  }
  const packageRecord = parsed as Record<string, unknown>;
  const scripts = packageRecord.scripts;
  return {
    name: typeof packageRecord.name === 'string' ? packageRecord.name : null,
    private: packageRecord.private === true,
    package_manager: typeof packageRecord.packageManager === 'string' ? packageRecord.packageManager : null,
    script_names:
      scripts && typeof scripts === 'object' && !Array.isArray(scripts)
        ? Object.keys(scripts as Record<string, unknown>).sort()
        : [],
  };
}

function parseJsonKeys(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON discovery artifact must contain an object.');
  }
  return { top_level_keys: Object.keys(parsed as Record<string, unknown>).sort() };
}

function parseMarkdown(content: string): Record<string, unknown> {
  const headingCount = content.split(/\r?\n/).filter((line) => /^#{1,6}\s+/.test(line)).length;
  return {
    line_count: content.split(/\r?\n/).length,
    heading_count: headingCount,
    has_mermaid: /```mermaid\b/.test(content),
  };
}

function parseEvidence(path: string, content: string): Record<string, unknown> {
  if (path === 'package.json') return parsePackageJson(content);
  if (path.endsWith('.json')) return parseJsonKeys(content);
  if (path.endsWith('.md')) return parseMarkdown(content);
  return { line_count: content.split(/\r?\n/).length };
}

function hashDiscoveryPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function discoverRepository(
  reader: RepositoryReader,
  repository: string,
  paths: readonly string[] = DEFAULT_DISCOVERY_PATHS,
): Promise<RepositoryDiscoveryResult> {
  const metadata = await reader.getRepository(repository);
  const normalizedPaths = normalizePaths(paths);
  const artifacts: RepositoryDiscoveryResult['artifacts'] = [];

  for (const path of normalizedPaths) {
    try {
      const file = await reader.readTextFile(repository, path, metadata.defaultBranch);
      if (!file) {
        artifacts.push({
          path,
          status: 'missing',
          sha: null,
          size: null,
          html_url: null,
          parsed_evidence: {},
          error: null,
        });
        continue;
      }
      try {
        artifacts.push({
          path,
          status: 'found',
          sha: file.sha,
          size: file.size,
          html_url: file.htmlUrl,
          parsed_evidence: parseEvidence(path, file.content),
          error: null,
        });
      } catch (error) {
        artifacts.push({
          path,
          status: 'invalid',
          sha: file.sha,
          size: file.size,
          html_url: file.htmlUrl,
          parsed_evidence: {},
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      artifacts.push({
        path,
        status: 'invalid',
        sha: null,
        size: null,
        html_url: null,
        parsed_evidence: {},
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const found = artifacts.filter((artifact) => artifact.status === 'found').length;
  const missing = artifacts.filter((artifact) => artifact.status === 'missing').length;
  const invalid = artifacts.filter((artifact) => artifact.status === 'invalid').length;
  const requested = artifacts.length;
  const confidence = requested === 0 ? 0 : Number((found / requested).toFixed(3));
  const evidenceStatus: RepositoryDiscoveryResult['summary']['evidence_status'] =
    found === 0 ? 'missing' : missing === 0 && invalid === 0 ? 'verified' : 'partial';
  const sourceDigest = hashDiscoveryPayload({
    repository,
    default_branch: metadata.defaultBranch,
    artifacts: artifacts.map(({ path, status, sha, size }) => ({ path, status, sha, size })),
  });

  return {
    repository,
    as_of: new Date().toISOString(),
    source_ref: metadata.defaultBranch,
    source_digest: sourceDigest,
    metadata: {
      default_branch: metadata.defaultBranch,
      visibility: metadata.visibility,
      archived: metadata.archived,
      disabled: metadata.disabled,
      pushed_at: metadata.pushedAt,
      html_url: metadata.htmlUrl,
    },
    artifacts,
    summary: {
      requested,
      found,
      missing,
      invalid,
      evidence_status: evidenceStatus,
      confidence,
    },
  };
}
