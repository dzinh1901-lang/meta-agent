export interface RepositoryMetadata {
  fullName: string;
  defaultBranch: string;
  visibility: 'public' | 'private' | 'internal' | 'unknown';
  archived: boolean;
  disabled: boolean;
  pushedAt: string | null;
  htmlUrl: string | null;
}

export interface RepositoryFileEvidence {
  path: string;
  ref: string;
  sha: string;
  size: number;
  htmlUrl: string | null;
  content: string;
}

export interface RepositoryReader {
  getRepository(repository: string): Promise<RepositoryMetadata>;
  readTextFile(repository: string, path: string, ref?: string): Promise<RepositoryFileEvidence | null>;
}
