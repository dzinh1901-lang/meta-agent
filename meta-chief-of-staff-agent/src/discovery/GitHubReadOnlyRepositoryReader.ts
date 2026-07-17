import { Buffer } from 'node:buffer';
import type {
  RepositoryFileEvidence,
  RepositoryMetadata,
  RepositoryReader,
} from './RepositoryReader.js';

export interface GitHubReadOnlyRepositoryReaderOptions {
  token?: string;
  apiBaseUrl?: string;
  userAgent?: string;
  maxFileBytes?: number;
  fetchImpl?: typeof fetch;
}

type GitHubRepositoryResponse = {
  full_name?: unknown;
  default_branch?: unknown;
  visibility?: unknown;
  private?: unknown;
  archived?: unknown;
  disabled?: unknown;
  pushed_at?: unknown;
  html_url?: unknown;
};

type GitHubContentResponse = {
  type?: unknown;
  path?: unknown;
  sha?: unknown;
  size?: unknown;
  html_url?: unknown;
  encoding?: unknown;
  content?: unknown;
};

const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function assertRepositoryName(repository: string): void {
  if (!REPOSITORY_PATTERN.test(repository)) {
    throw new Error(`Invalid GitHub repository name: ${repository}`);
  }
}

function assertSafePath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('..') || /[\0\r\n]/.test(path)) {
    throw new Error(`Invalid repository path: ${path}`);
  }
}

function assertSafeRef(ref: string): void {
  if (!ref || /[\0\r\n]/.test(ref)) throw new Error('GitHub ref must be a non-empty single-line string.');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export class GitHubReadOnlyRepositoryReader implements RepositoryReader {
  private readonly token?: string;
  private readonly apiBaseUrl: string;
  private readonly userAgent: string;
  private readonly maxFileBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitHubReadOnlyRepositoryReaderOptions = {}) {
    this.token = options.token;
    this.apiBaseUrl = (options.apiBaseUrl ?? 'https://api.github.com').replace(/\/$/, '');
    this.userAgent = options.userAgent ?? 'cosmos-meta-chief-of-staff-agent';
    this.maxFileBytes = options.maxFileBytes ?? 512_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getRepository(repository: string): Promise<RepositoryMetadata> {
    assertRepositoryName(repository);
    const payload = (await this.request(`/repos/${repository}`)) as GitHubRepositoryResponse;
    const defaultBranch = asString(payload.default_branch);
    if (!defaultBranch) throw new Error(`GitHub repository metadata is missing default_branch for ${repository}.`);
    const visibilityValue = asString(payload.visibility);
    const visibility: RepositoryMetadata['visibility'] =
      visibilityValue === 'public' || visibilityValue === 'private' || visibilityValue === 'internal'
        ? visibilityValue
        : payload.private === true
          ? 'private'
          : 'unknown';
    return {
      fullName: asString(payload.full_name) ?? repository,
      defaultBranch,
      visibility,
      archived: payload.archived === true,
      disabled: payload.disabled === true,
      pushedAt: asString(payload.pushed_at),
      htmlUrl: asString(payload.html_url),
    };
  }

  async readTextFile(repository: string, path: string, ref?: string): Promise<RepositoryFileEvidence | null> {
    assertRepositoryName(repository);
    assertSafePath(path);
    if (ref) assertSafeRef(ref);
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const payload = (await this.request(`/repos/${repository}/contents/${path}${query}`, true)) as
      | GitHubContentResponse
      | null;
    if (payload === null) return null;
    if (payload.type !== 'file') throw new Error(`GitHub content path is not a file: ${repository}/${path}`);
    if (payload.encoding !== 'base64' || typeof payload.content !== 'string') {
      throw new Error(`GitHub content is not an inline base64 text file: ${repository}/${path}`);
    }
    const size = typeof payload.size === 'number' ? payload.size : Buffer.byteLength(payload.content, 'base64');
    if (size > this.maxFileBytes) {
      throw new Error(`Repository file exceeds the ${this.maxFileBytes}-byte discovery limit: ${repository}/${path}`);
    }
    const sha = asString(payload.sha);
    if (!sha) throw new Error(`GitHub content response is missing sha: ${repository}/${path}`);
    const decoded = Buffer.from(payload.content.replace(/\s/g, ''), 'base64');
    if (decoded.includes(0)) throw new Error(`Repository discovery only supports text files: ${repository}/${path}`);
    return {
      path: asString(payload.path) ?? path,
      ref: ref ?? 'default',
      sha,
      size,
      htmlUrl: asString(payload.html_url),
      content: decoded.toString('utf8'),
    };
  }

  private async request(path: string, allowNotFound = false): Promise<unknown | null> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': this.userAgent,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, {
      method: 'GET',
      headers,
      redirect: 'error',
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      const rateHint = remaining === '0' ? ' GitHub API rate limit is exhausted.' : '';
      throw new Error(`GitHub read request failed with HTTP ${response.status}.${rateHint}`);
    }
    return response.json() as Promise<unknown>;
  }
}
