// In-memory GitHub Git Data API for fase 06 tests (msw + @msw/cloudflare, D-007).
// Mimics the four calls the committer makes (GET commit, POST trees, POST commit, PATCH ref).
// Tree shas are content-addressed, so posting an unchanged tree returns the base sha (empty commit).
import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupNetwork } from '@msw/cloudflare';

export interface MockTreeEntry {
  path: string;
  mode: string;
  type: string;
  sha: string | null;
  content?: string;
}

export interface RecordedCall {
  method: string;
  pathname: string;
  authed: boolean;
  body: unknown;
}

export interface InjectedFailure {
  method: string;
  matches: (pathname: string) => boolean;
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

function hashText(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

function treeHash(entries: MockTreeEntry[]): string {
  const canon = [...entries]
    .sort((a, b) => (a.path < b.path ? -1 : 1))
    .map((e) => `${e.mode} ${e.type} ${e.path} ${e.content ?? `sha:${e.sha}`}`)
    .join('\n');
  return `t-mock-${hashText(canon)}`;
}

export class GitHubMock {
  readonly network = setupNetwork();
  owner = 'demo';
  repo = 'toko-demo';
  branch = 'main';
  head = 'c0';
  commits = new Map<string, { sha: string; message: string; tree: string; parents: string[] }>();
  trees = new Map<string, { sha: string; base: string | null; entries: MockTreeEntry[] }>();
  blobPosts = 0;
  calls: RecordedCall[] = [];
  failures: InjectedFailure[] = [];
  private holds: { matches: (p: string) => boolean; wait: Promise<void> }[] = [];
  private seq = 0;

  /** Seed one base commit with the given files. Resets all state. */
  reset(seed: { path: string; content: string }[] = []): void {
    this.commits.clear();
    this.trees.clear();
    this.calls = [];
    this.failures = [];
    this.holds = [];
    this.seq = 0;
    this.blobPosts = 0;
    const entries: MockTreeEntry[] = seed.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: `b-${hashText(f.content)}`, content: f.content }));
    const t0 = treeHash(entries);
    this.trees.set(t0, { sha: t0, base: null, entries });
    this.commits.set('c0', { sha: 'c0', message: 'seed', tree: t0, parents: [] });
    this.head = 'c0';
  }

  baseTree(): string {
    return this.commits.get(this.head)?.tree ?? '';
  }

  /** Adopt an external head (e.g. the workspace `head_commit` from `/admin/files`) as known state. */
  adoptHead(sha: string, seed: { path: string; content: string }[]): void {
    const entries: MockTreeEntry[] = seed.map((f) => ({ path: f.path, mode: '100644', type: 'blob', sha: `b-${hashText(f.content)}`, content: f.content }));
    const t = treeHash(entries);
    this.trees.set(t, { sha: t, base: null, entries });
    this.commits.set(sha, { sha, message: 'adopted', tree: t, parents: [] });
    this.head = sha;
  }

  baseEntries(): MockTreeEntry[] {
    return this.trees.get(this.baseTree())?.entries ?? [];
  }

  apiCalls(): number {
    return this.calls.length;
  }

  /** Fail the next matching request once (consumed). */
  failNext(method: string, pathIncludes: string, status: number, body?: unknown, headers?: Record<string, string>): void {
    this.failures.push({ method, matches: (p) => p.includes(pathIncludes), status, body, headers });
  }

  /** Hold matching requests until the returned release is called. */
  hold(pathIncludes: string): () => void {
    let release!: () => void;
    const wait = new Promise<void>((r) => {
      release = r;
    });
    const entry = { matches: (p: string) => p.includes(pathIncludes), wait };
    this.holds.push(entry);
    return () => {
      release();
      this.holds = this.holds.filter((h) => h !== entry);
    };
  }

  /** Simulate someone else pushing: a commit on top of the current head. */
  pushExternal(message: string, entries: MockTreeEntry[]): string {
    const base = this.baseEntries();
    const merged = new Map(base.map((e) => [e.path, e]));
    for (const e of entries) {
      if (e.sha === null) merged.delete(e.path);
      else merged.set(e.path, e);
    }
    const list = [...merged.values()];
    const t = treeHash(list);
    this.trees.set(t, { sha: t, base: this.baseTree(), entries: list });
    const sha = `c-external-${++this.seq}`;
    this.commits.set(sha, { sha, message, tree: t, parents: [this.head] });
    this.head = sha;
    return sha;
  }

  handlers(): HttpHandler[] {
    const api = 'https://api.github.com';
    interface Recordable {
      readonly url: string;
      readonly method: string;
      readonly headers: Headers;
      clone(): { json(): Promise<unknown> };
    }
    const record = async (request: Recordable): Promise<{ pathname: string; body: unknown; authed: boolean }> => {
      const url = new URL(request.url);
      let body: unknown;
      try {
        body = await request.clone().json();
      } catch {
        body = null;
      }
      const authed = (request.headers.get('authorization') ?? '').startsWith('Bearer ');
      this.calls.push({ method: request.method, pathname: url.pathname, authed, body });
      return { pathname: url.pathname, body, authed };
    };
    const injected = (pathname: string, method: string): InjectedFailure | null => {
      const i = this.failures.findIndex((f) => f.method === method && f.matches(pathname));
      if (i < 0) return null;
      return this.failures.splice(i, 1)[0] ?? null;
    };
    const maybeHold = async (pathname: string): Promise<void> => {
      const h = this.holds.find((x) => x.matches(pathname));
      if (h) await h.wait;
    };
    const fail = (f: InjectedFailure): Response =>
      new Response(JSON.stringify(f.body ?? { message: 'injected' }), {
        status: f.status,
        headers: { 'content-type': 'application/json', ...(f.headers ?? {}) },
      });
    return [
      http.post(`${api}/repos/:owner/:repo/git/blobs`, async ({ request }) => {
        await record(request);
        this.blobPosts++;
        return HttpResponse.json({ message: 'blobs are never used (fase 06)' }, { status: 500 });
      }),
      http.get(`${api}/repos/:owner/:repo/git/commits/:sha`, async ({ request, params }) => {
        const { pathname } = await record(request);
        const f = injected(pathname, 'GET');
        if (f) return fail(f);
        const c = this.commits.get(params.sha as string);
        if (!c) return HttpResponse.json({ message: 'Not Found' }, { status: 404 });
        return HttpResponse.json({ sha: c.sha, tree: { sha: c.tree }, parents: c.parents, message: c.message });
      }),
      http.post(`${api}/repos/:owner/:repo/git/trees`, async ({ request }) => {
        const { pathname, body } = await record(request);
        await maybeHold(pathname);
        const f = injected(pathname, 'POST');
        if (f) return fail(f);
        const b = body as { base_tree?: unknown; tree?: unknown };
        const base = typeof b.base_tree === 'string' ? b.base_tree : '';
        const changes = Array.isArray(b.tree) ? (b.tree as MockTreeEntry[]) : [];
        const baseEntries = this.trees.get(base)?.entries;
        if (!baseEntries) return HttpResponse.json({ message: 'base_tree unknown' }, { status: 422 });
        const merged = new Map(baseEntries.map((e) => [e.path, { ...e }]));
        for (const e of changes) {
          if (e.sha === null) {
            if (!merged.has(e.path)) return HttpResponse.json({ message: `delete of unknown path ${e.path}` }, { status: 422 });
            merged.delete(e.path);
          } else {
            merged.set(e.path, { path: e.path, mode: e.mode || '100644', type: e.type || 'blob', sha: null, content: e.content });
          }
        }
        const list = [...merged.values()];
        const sha = treeHash(list);
        if (!this.trees.has(sha)) this.trees.set(sha, { sha, base, entries: list });
        return HttpResponse.json({ sha });
      }),
      http.post(`${api}/repos/:owner/:repo/git/commits`, async ({ request }) => {
        const { pathname, body } = await record(request);
        await maybeHold(pathname);
        const f = injected(pathname, 'POST');
        if (f) return fail(f);
        const b = body as { message?: unknown; tree?: unknown; parents?: unknown; author?: unknown; committer?: unknown };
        if (typeof b.tree !== 'string' || !this.trees.has(b.tree)) return HttpResponse.json({ message: 'tree unknown' }, { status: 422 });
        const sha = `c-mock-${++this.seq}`;
        this.commits.set(sha, {
          sha,
          message: typeof b.message === 'string' ? b.message : '',
          tree: b.tree,
          parents: Array.isArray(b.parents) ? (b.parents as string[]) : [],
        });
        return HttpResponse.json({ sha });
      }),
      http.patch(`${api}/repos/:owner/:repo/git/refs/heads/:branch`, async ({ request }) => {
        const { pathname, body } = await record(request);
        await maybeHold(pathname);
        const f = injected(pathname, 'PATCH');
        if (f) return fail(f);
        const b = body as { sha?: unknown; force?: unknown };
        if (b.force !== false) return HttpResponse.json({ message: 'force updates are forbidden' }, { status: 422 });
        const c = typeof b.sha === 'string' ? this.commits.get(b.sha) : undefined;
        if (!c) return HttpResponse.json({ message: 'commit unknown' }, { status: 422 });
        if (c.parents[0] !== this.head) return HttpResponse.json({ message: 'Update is not a fast forward' }, { status: 409 });
        this.head = c.sha;
        return HttpResponse.json({ ref: `refs/heads/${this.branch}`, object: { sha: c.sha } });
      }),
      http.get(`${api}/repos/:owner/:repo/git/ref/heads/:branch`, async ({ request }) => {
        const { pathname } = await record(request);
        const f = injected(pathname, 'GET');
        if (f) return fail(f);
        return HttpResponse.json({ ref: `refs/heads/${this.branch}`, object: { sha: this.head } });
      }),
    ];
  }
}
