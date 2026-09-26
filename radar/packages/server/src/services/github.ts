// GitHub Git Data API committer (fase 06 step 1, R4 §6.3 step 2). Four subrequests per commit
// (GET commit, POST trees with inline content, POST commit, PATCH ref) no matter how many files;
// binary files never reach a task snapshot (R5 §6), so there is no POST blobs call.
// The token travels only in the Authorization header: error messages and events carry stable
// codes, never secrets.
import type { CommitResult, CommitSnapshot, GitHubCommitter } from '../committer';
import { formatCommitMessage } from './git-message';

const API = 'https://api.github.com';
const GITHUB_TIMEOUT_MS = 10_000;
/** R4 §6.3 step 2 + D-007 point 6: task-local guard, stricter than any GitHub limit. */
const MAX_COMMIT_FILES = 100;
const MAX_COMMIT_BYTES = 5 * 1024 * 1024;

export type CommitErrorCode = 'too_many_files' | 'non_fast_forward' | 'rate_limited' | 'config_error' | 'network_error' | `http_${number}`;

export class CommitError extends Error {
  readonly code: CommitErrorCode;
  readonly status?: number;
  constructor(code: CommitErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'CommitError';
    this.code = code;
    this.status = status;
  }
}

/** Stable code for `commit.push_failed { error }`. Anything unexpected becomes `internal`. */
export function commitErrorCode(err: unknown): CommitErrorCode | 'internal' {
  return err instanceof CommitError ? err.code : 'internal';
}

export interface GitHubCommitterConfig {
  repo: string;
  token?: string | undefined;
  commitEnabled: boolean;
  coauthor: string;
  now?: () => number;
  /** Overridable for tests (mirrors `verifyHeadCommit`'s `fetchImpl`). */
  fetchImpl?: typeof fetch;
}

interface GithubCall {
  path: string;
  method: string;
  body?: unknown;
}

export class RealGitHubCommitter implements GitHubCommitter {
  private readonly repo: string;
  private readonly token: string | undefined;
  private readonly commitEnabled: boolean;
  private readonly coauthor: string;
  private readonly now: () => number;
  private readonly fetchImpl: typeof fetch;

  constructor(c: GitHubCommitterConfig) {
    this.repo = c.repo;
    this.token = c.token;
    this.commitEnabled = c.commitEnabled;
    this.coauthor = c.coauthor;
    this.now = c.now ?? Date.now;
    this.fetchImpl = c.fetchImpl ?? fetch;
  }

  /** Fresh head of `branch` (R4 §6.3: refresh before retrying after a non-fast-forward). */
  async refreshHead(branch: string): Promise<string | null> {
    if (!this.commitEnabled) return null;
    try {
      const res = await this.call('GET', `/repos/${this.repo}/git/ref/heads/${encodeURIComponent(branch)}`);
      const body = (await res.json()) as { object?: { sha?: unknown } };
      return typeof body.object?.sha === 'string' ? body.object.sha : null;
    } catch {
      return null;
    }
  }

  async commitTask(snapshot: CommitSnapshot): Promise<CommitResult> {
    const bytes = snapshot.files.reduce((n, f) => n + (f.content === null ? 0 : new TextEncoder().encode(f.content).byteLength), 0);
    if (snapshot.files.length > MAX_COMMIT_FILES || bytes > MAX_COMMIT_BYTES) {
      throw new CommitError('too_many_files', `Task ${snapshot.taskId} too large for one commit (${snapshot.files.length} files, ${bytes} bytes).`);
    }
    if (!this.commitEnabled) return { sha: localSha(snapshot), pushed: false };
    if (!snapshot.baseCommit) throw new CommitError('config_error', `Task ${snapshot.taskId} has no base commit.`);
    if (!this.repo) throw new CommitError('config_error', 'GITHUB_REPO is not configured.');
    const iso = new Date(this.now()).toISOString();

    const head = await this.getCommit(snapshot.baseCommit);
    const tree = await this.post<{ sha?: unknown }>('POST', `/repos/${this.repo}/git/trees`, {
      base_tree: head.tree,
      tree: snapshot.files.map((f) =>
        f.content === null
          ? { path: f.path, mode: '100644', type: 'blob', sha: null }
          : { path: f.path, mode: '100644', type: 'blob', content: f.content },
      ),
    });
    if (typeof tree.sha !== 'string' || !tree.sha) throw new CommitError('http_422', 'GitHub returned no tree sha.');
    if (tree.sha === head.tree) return { sha: snapshot.baseCommit, pushed: false, empty: true };

    const message = formatCommitMessage({
      taskId: snapshot.taskId,
      title: snapshot.title,
      summary: snapshot.summary,
      proposalId: snapshot.proposalId,
      reviewer: snapshot.reviewer,
      coauthor: this.coauthor,
    });
    const commit = await this.post<{ sha?: unknown }>('POST', `/repos/${this.repo}/git/commits`, {
      message,
      tree: tree.sha,
      parents: [snapshot.baseCommit],
      author: { name: snapshot.author.name, email: snapshot.author.email, date: iso },
      committer: { name: 'Live Collab', email: 'live-collab@users.noreply.github.com', date: iso },
    });
    if (typeof commit.sha !== 'string' || !commit.sha) throw new CommitError('http_422', 'GitHub returned no commit sha.');
    await this.pushRef(snapshot.branch, commit.sha);
    return { sha: commit.sha, pushed: true, url: `https://github.com/${this.repo}/commit/${commit.sha}` };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'live-collab', 'content-type': 'application/json' };
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    return headers;
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${API}${path}`, {
        method,
        headers: this.headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
    } catch (err) {
      throw new CommitError('network_error', `GitHub unreachable (${err instanceof Error ? err.message : 'network error'}).`);
    }
    return res;
  }

  private async getCommit(sha: string): Promise<{ tree: string }> {
    const res = await this.call('GET', `/repos/${this.repo}/git/commits/${encodeURIComponent(sha)}`);
    if (!res.ok) throw new CommitError(`http_${res.status}`, `GitHub rejected GET commit (HTTP ${res.status}).`, res.status);
    const body = (await res.json()) as { tree?: { sha?: unknown } };
    if (typeof body.tree?.sha !== 'string' || !body.tree.sha) throw new CommitError(`http_${res.status}`, 'GitHub returned no base tree.', res.status);
    return { tree: body.tree.sha };
  }

  private async post<T>(method: string, path: string, body: unknown): Promise<T> {
    const res = await this.call(method, path, body);
    if (!res.ok) throw await commitErrorFromResponse(res, await readMessage(res), path);
    return (await res.json()) as T;
  }

  private async pushRef(branch: string, sha: string): Promise<void> {
    const call: GithubCall = { path: `/repos/${this.repo}/git/refs/heads/${encodeURIComponent(branch)}`, method: 'PATCH', body: { sha, force: false } };
    const res = await this.call(call.method, call.path, call.body);
    if (res.ok) return;
    throw await commitErrorFromResponse(res, await readMessage(res), call.path);
  }
}

async function readMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    return typeof body.message === 'string' && body.message ? body.message : `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

/** Maps a failed Git Data API call to a stable code (D-007 point 6). Never carries the token. */
async function commitErrorFromResponse(res: Response, message: string, path: string): Promise<CommitError> {
  const status = res.status;
  const isRef = path.includes('/git/refs/');
  if (isRef && (status === 409 || status === 422)) {
    return new CommitError('non_fast_forward', `Ref update rejected (HTTP ${status}): ${message}`, status);
  }
  if ((status === 403 || status === 429) && res.headers.has('retry-after')) {
    return new CommitError('rate_limited', `GitHub secondary rate limit (HTTP ${status}).`, status);
  }
  return new CommitError(`http_${status}`, `GitHub rejected ${path} (HTTP ${status}): ${message}`, status);
}

/** Deterministic workspace-local sha for `GITHUB_COMMIT=false` (dev/test, no network). */
function localSha(snapshot: CommitSnapshot): string {
  const canon = JSON.stringify({ t: snapshot.taskId, title: snapshot.title, summary: snapshot.summary, files: snapshot.files });
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < canon.length; i++) {
    const ch = canon.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `local-${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

/** Builds the production committer from worker env (R5 §5). Local mode needs neither repo nor token. */
export function createCommitter(env: Env): GitHubCommitter {
  return new RealGitHubCommitter({
    repo: env.GITHUB_REPO ?? '',
    token: env.GITHUB_TOKEN,
    commitEnabled: env.GITHUB_COMMIT === 'true',
    coauthor: env.BOB_COAUTHOR || 'IBM Bob <bob@ibm.com>',
  });
}
