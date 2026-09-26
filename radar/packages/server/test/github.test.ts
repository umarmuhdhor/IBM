// Fase 06 step 5: GitHub committer + commit message, GitHub API mocked with @msw/cloudflare (D-007).
// Unit tests call the committer directly (test-realm fetch, intercepted by msw); DO tests swap
// `inst.committer` with a committer whose `fetchImpl` closure keeps the test-realm (patched) fetch.
import { evictDurableObject, runInDurableObject } from 'cloudflare:test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PENDING_COMMIT_SHA, type CommitSnapshot } from '../src/committer';
import { ctxOf } from '../src/deps';
import { checkPaths } from '../src/services/check';
import { RealGitHubCommitter as GitHubCommitter } from '../src/services/github';
import { formatCommitMessage } from '../src/services/git-message';
import { decideProposalFlow } from '../src/services/proposals';
import { setCommitClaim } from '../src/db/repo/task';
import type { WorkspaceDO } from '../src/workspace-do';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex } from './helpers';
import { GitHubMock } from './github-mock';

const TOKEN = 'tok-test-fase06';
const COAUTHOR = 'IBM Bob <bob@ibm.com>';

const mock = new GitHubMock();
beforeAll(() => {
  mock.network.enable();
  mock.network.use(...mock.handlers());
});
afterAll(() => {
  mock.network.disable();
});
beforeEach(() => {
  mock.reset([{ path: 'src/checkout/checkout.ts', content: '// checkout\n' }]);
});

// Test-realm fetch (patched by msw). Defined here so the closure keeps this realm even when
// the committer runs inside the Durable Object isolate.
const testFetch = (...args: Parameters<typeof fetch>): Promise<Response> => fetch(...args);

const committer = () =>
  new GitHubCommitter({
    repo: 'demo/toko-demo',
    token: TOKEN,
    commitEnabled: true,
    coauthor: COAUTHOR,
    now: () => 1_700_000_000_000,
    fetchImpl: testFetch,
  });

const snap = (over: Partial<CommitSnapshot> = {}): CommitSnapshot => ({
  taskId: 'T-1',
  title: 'Kupon diskon',
  summary: 'Kupon diskon persen',
  author: { name: 'Andi', email: 'andi@example.com' },
  baseCommit: mock.head,
  branch: 'main',
  proposalId: 'P-9',
  reviewer: { name: 'Citra', role: 'pm', email: 'citra@example.com' },
  files: [{ path: 'src/checkout/checkout.ts', content: '// checkout with coupon\n' }],
  ...over,
});

describe('formatCommitMessage (R5 §3, Bob slice A3)', () => {
  it('matches the contract shape with all trailers', () => {
    expect(
      formatCommitMessage({
        taskId: 'T-1',
        title: 'Kupon diskon',
        summary: 'Kupon diskon persen',
        proposalId: 'P-7',
        reviewer: { name: 'Citra', role: 'pm', email: 'citra@example.com' },
        coauthor: COAUTHOR,
      }),
    ).toBe(
      'T-1: Kupon diskon\n\nKupon diskon persen\n\nRadar-Task: T-1\nRadar-Main-Agent-Proposal: P-7\nReviewed-by: Citra (PM) <citra@example.com>\nCo-authored-by: IBM Bob <bob@ibm.com>',
    );
  });

  it('omits empty summary, proposal and reviewer lines', () => {
    expect(
      formatCommitMessage({ taskId: 'T-2', title: 'Dark mode', summary: null, proposalId: null, reviewer: null, coauthor: COAUTHOR }),
    ).toBe('T-2: Dark mode\n\nRadar-Task: T-2\nCo-authored-by: IBM Bob <bob@ibm.com>');
  });
});

describe('GitHubCommitter over the mocked Git Data API', () => {
  it('commits only the task files with inline content in exactly 4 requests, no blobs', async () => {
    const res = await committer().commitTask(snap());
    expect(res).toMatchObject({ sha: 'c-mock-1', pushed: true, url: 'https://github.com/demo/toko-demo/commit/c-mock-1' });
    expect(mock.apiCalls()).toBe(4);
    expect(mock.blobPosts).toBe(0);
    const tree = mock.calls.find((c) => c.pathname.endsWith('/git/trees'))?.body as { base_tree: string; tree: { path: string; mode: string; type: string; content?: string; sha?: string | null }[] };
    expect(tree.tree).toEqual([{ path: 'src/checkout/checkout.ts', mode: '100644', type: 'blob', content: '// checkout with coupon\n' }]);
    const commit = mock.calls.find((c) => c.pathname.endsWith('/git/commits'))?.body as { message: string; parents: string[]; author: { name: string; email: string } };
    expect(commit.author).toMatchObject({ name: 'Andi', email: 'andi@example.com' });
    expect(commit.parents).toEqual(['c0']);
    expect(commit.message).toContain('Radar-Task: T-1');
    expect(commit.message).toContain('Co-authored-by: IBM Bob <bob@ibm.com>');
    expect(mock.calls.every((c) => c.authed)).toBe(true);
    expect(mock.head).toBe('c-mock-1');
  });

  it('deletes with sha null and no content', async () => {
    const res = await committer().commitTask(snap({ files: [{ path: 'src/checkout/checkout.ts', content: null }] }));
    expect(res.sha).toBe('c-mock-1');
    const tree = mock.calls.find((c) => c.pathname.endsWith('/git/trees'))?.body as { tree: { path: string; sha: string | null; content?: string }[] };
    expect(tree.tree).toEqual([{ path: 'src/checkout/checkout.ts', mode: '100644', type: 'blob', sha: null }]);
  });

  it('chains parents across sequential commits', async () => {
    const first = await committer().commitTask(snap());
    const second = await committer().commitTask(
      snap({ taskId: 'T-2', title: 'Lagi', baseCommit: first.sha, proposalId: 'P-10', files: [{ path: 'src/checkout/checkout.ts', content: '// checkout v3\n' }] }),
    );
    const posted = mock.calls.filter((c) => c.pathname.endsWith('/git/commits'));
    const commit = posted[posted.length - 1]?.body as { parents: string[] };
    expect(commit.parents).toEqual([first.sha]);
    expect(second.sha).not.toBe(first.sha);
  });

  it('maps 409/422 to non_fast_forward, 403+retry-after to rate_limited, without leaking the token', async () => {
    mock.failNext('PATCH', '/git/refs/', 409, { message: 'Update is not a fast forward' });
    await expect(committer().commitTask(snap())).rejects.toMatchObject({ code: 'non_fast_forward' });
    mock.failNext('PATCH', '/git/refs/', 422, { message: 'bad ref' });
    await expect(committer().commitTask(snap())).rejects.toMatchObject({ code: 'non_fast_forward' });
    mock.failNext('POST', '/git/trees', 403, { message: 'secondary limit' }, { 'retry-after': '5' });
    const rate = await committer().commitTask(snap()).catch((e) => e);
    expect(rate).toMatchObject({ code: 'rate_limited' });
    mock.failNext('POST', '/git/trees', 500, { message: 'boom' });
    const err = (await committer().commitTask(snap()).catch((e: Error) => e)) as Error;
    expect(String(err)).not.toContain(TOKEN);
    expect(JSON.stringify(mock.calls.map((c) => c.body))).not.toContain(TOKEN);
  });

  it('rejects >100 files or >5 MB before any fetch', async () => {
    const files = Array.from({ length: 101 }, (_, i) => ({ path: `f${i}.ts`, content: 'x\n' }));
    await expect(committer().commitTask(snap({ files }))).rejects.toMatchObject({ code: 'too_many_files' });
    await expect(committer().commitTask(snap({ files: [{ path: 'big.ts', content: `x\n`.padEnd(6 * 1024 * 1024, 'y') }] }))).rejects.toMatchObject({
      code: 'too_many_files',
    });
    expect(mock.apiCalls()).toBe(0);
  });

  it('sends 60 files in exactly 4 requests', async () => {
    const files = Array.from({ length: 60 }, (_, i) => ({ path: `f${i}.ts`, content: 'x\n' }));
    const res = await committer().commitTask(snap({ files }));
    expect(res.pushed).toBe(true);
    expect(mock.apiCalls()).toBe(4);
  });

  it('returns the head sha with empty:true when nothing changed', async () => {
    const res = await committer().commitTask(snap({ files: [{ path: 'src/checkout/checkout.ts', content: '// checkout\n' }] }));
    expect(res).toMatchObject({ sha: 'c0', pushed: false, empty: true });
    expect(mock.apiCalls()).toBe(2);
    expect(res.url).toBeUndefined();
  });

  it('GITHUB_COMMIT=false returns a deterministic local sha without any fetch', async () => {
    const local = new GitHubCommitter({ repo: 'demo/toko-demo', commitEnabled: false, coauthor: COAUTHOR, now: () => 1 });
    const a = await local.commitTask(snap());
    const b = await local.commitTask(snap());
    expect(a).toMatchObject({ pushed: false });
    expect(a.sha).toBe(b.sha);
    expect(a.sha).toMatch(/^local-[0-9a-f]+$/);
    expect(a.sha).not.toBe(PENDING_COMMIT_SHA);
    expect(mock.apiCalls()).toBe(0);
  });
});

// ---- Durable Object integration --------------------------------------------------------------------------------

const update = async (id: string, path: string, baseVersion: number, content: string) => ({
  t: 'file.update',
  id,
  d: { path, baseVersion, content, hash: await sha256Hex(content), clientTs: 0 },
});

/** T-1 (A) and T-2 (B) from an approved plan, T-1 edited and submitted, review proposed. Returns the proposal id. */
async function inReview(stub: DurableObjectStub, t: Record<string, string>, path: string, taskId: string): Promise<string> {
  const token = taskId === 'T-1' ? t.A! : t.B!;
  const sync = await hello(stub, token, 'sync');
  await call(stub, 'POST', '/v1/locks/check', { token, body: { paths: [path], tool: 'write_file', clientTs: 0 } });
  sync.send(await update(`${taskId}-1`, path, 1, `// ${path} ${taskId}\n`));
  await sync.byType('file.ack');
  sync.ws.close();
  expect((await call(stub, 'POST', `/v1/tasks/${taskId}/submit`, { token, body: { summary: 'selesai' } })).status).toBe(200);
  const p = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'review', reason: 'ok', payload: { taskId, verdict: 'setujui' } } });
  expect(p.status).toBe(201);
  return p.json.proposalId as string;
}

async function twoTasks(stub: DurableObjectStub): Promise<Record<string, string>> {
  const t = await seedTestWorkspace(stub, [
    { path: 'src/a.ts', content: '// a\n' },
    { path: 'src/b.ts', content: '// b\n' },
  ]);
  const plan = await call(stub, 'POST', '/v1/proposals', {
    token: t.C,
    body: {
      kind: 'plan',
      reason: 'uji',
      payload: {
        goal: 'uji',
        tasks: [
          { ref: 'a', title: 'Tugas A', ownerId: 'A', files: ['src/a.ts'] },
          { ref: 'b', title: 'Tugas B', ownerId: 'B', files: ['src/b.ts'] },
        ],
      },
    },
  });
  expect(plan.status).toBe(201);
  expect((await call(stub, 'POST', `/v1/proposals/${plan.json.proposalId}/decision`, { token: t.mc, body: { approve: true } })).status).toBe(200);
  return t;
}

const taskRow = (stub: DurableObjectStub, id: string) =>
  runInDurableObject(stub, (_i, st) =>
    st.storage.sql.exec<{ status: string; commit_sha: string | null; commit_started_at: number | null }>(`SELECT status, commit_sha, commit_started_at FROM task WHERE id = '${id}'`).one(),
  );

/** Point the mock at the workspace files seeded by `twoTasks` (head `abc1234`). */
function adoptWorkspace(): void {
  mock.adoptHead('abc1234', [
    { path: 'src/a.ts', content: '// a\n' },
    { path: 'src/b.ts', content: '// b\n' },
  ]);
}

describe('commit through the Durable Object', () => {
  it('default wiring never yields the fase 05 stub sha (DoD guard)', async () => {
    const { stub } = freshWorkspace();
    const t = await twoTasks(stub);
    const pid = await inReview(stub, t, 'src/a.ts', 'T-1');
    const approve = await call(stub, 'POST', `/v1/proposals/${pid}/decision`, { token: t.mc, body: { approve: true } });
    expect(approve.status).toBe(200);
    expect(approve.json.status).toBe('disetujui');
    const row = await taskRow(stub, 'T-1');
    expect(row?.status).toBe('selesai');
    expect(row?.commit_sha).toMatch(/^local-[0-9a-f]+$/);
    expect(row?.commit_sha).not.toBe(PENDING_COMMIT_SHA);
    expect(approve.json.applied).toMatchObject({ pushed: false });
    const head = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ v: string }>(`SELECT value AS v FROM meta WHERE key = 'head_commit'`).one());
    expect(head?.v).toBe('abc1234');
  });

  it('a held commit makes the second approval 409 and blocks writers with committing', async () => {
    const { stub } = freshWorkspace();
    const t = await twoTasks(stub);
    const p1 = await inReview(stub, t, 'src/a.ts', 'T-1');
    const p2 = await inReview(stub, t, 'src/b.ts', 'T-2');
    adoptWorkspace();
    await runInDurableObject(stub, async (inst: WorkspaceDO) => {
      const saved = inst.committer;
      inst.committer = committer();
      const release = mock.hold('/git/refs/');
      try {
        const first = decideProposalFlow(inst, p1, { approve: true });
        await expect(decideProposalFlow(inst, p2, { approve: true })).rejects.toMatchObject({ status: 409 });
        const checked = inst.transact((uow) => checkPaths(ctxOf(inst, uow), 'B', ['src/a.ts']));
        expect(checked.results[0]).toMatchObject({ decision: 'block', reason: 'committing' });
        release();
        await expect(first).resolves.toMatchObject({ status: 'disetujui' });
      } finally {
        inst.committer = saved;
      }
    });
    const t2 = await taskRow(stub, 'T-2');
    expect(t2?.status).toBe('review');
  });

  it('PATCH 409 refreshes the head, keeps state, and the retry succeeds', async () => {
    const { stub } = freshWorkspace();
    const t = await twoTasks(stub);
    const pid = await inReview(stub, t, 'src/a.ts', 'T-1');
    adoptWorkspace();
    const external = mock.pushExternal('someone else', [{ path: 'src/other.ts', mode: '100644', type: 'blob', sha: null, content: '// other\n' }]);
    await runInDurableObject(stub, async (inst: WorkspaceDO) => {
      const saved = inst.committer;
      inst.committer = committer();
      try {
        await expect(decideProposalFlow(inst, pid, { approve: true })).rejects.toMatchObject({ status: 409 });
      } finally {
        inst.committer = saved;
      }
    });
    const row = await taskRow(stub, 'T-1');
    expect(row).toMatchObject({ status: 'review', commit_started_at: null });
    const head = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ v: string }>(`SELECT value AS v FROM meta WHERE key = 'head_commit'`).one());
    expect(head?.v).toBe(external);
    const events = await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec<{ p: string }>(`SELECT payload AS p FROM event WHERE type = 'commit.push_failed'`).toArray(),
    );
    expect(events.map((e) => JSON.parse(e.p) as { error: string }).map((p) => p.error)).toEqual(['non_fast_forward']);
    // "Coba lagi" now commits on top of the fresh head.
    const retry = await runInDurableObject(stub, async (inst: WorkspaceDO) => {
      const saved = inst.committer;
      inst.committer = committer();
      try {
        return await decideProposalFlow(inst, pid, { approve: true });
      } finally {
        inst.committer = saved;
      }
    });
    expect(retry.status).toBe('disetujui');
    const commits = mock.calls.filter((c) => c.pathname.endsWith('/git/commits')).map((c) => c.body as { parents: string[] });
    expect(commits[commits.length - 1]?.parents).toEqual([external]);
    expect((await taskRow(stub, 'T-1'))?.commit_sha).toBe(mock.head);
  });

  it('rate limits and server errors release the claim with a stable code', async () => {
    for (const [status, headers, code] of [
      [403, { 'retry-after': '5' }, 'rate_limited'],
      [500, {}, 'http_500'],
    ] as const) {
      const { stub } = freshWorkspace();
      const t = await twoTasks(stub);
      const pid = await inReview(stub, t, 'src/a.ts', 'T-1');
      adoptWorkspace();
      mock.failNext('POST', '/git/trees', status, { message: 'x' }, headers);
      await runInDurableObject(stub, async (inst: WorkspaceDO) => {
        const saved = inst.committer;
        inst.committer = committer();
        try {
          await expect(decideProposalFlow(inst, pid, { approve: true })).rejects.toMatchObject({ status: 409 });
        } finally {
          inst.committer = saved;
        }
      });
      expect(await taskRow(stub, 'T-1')).toMatchObject({ status: 'review', commit_started_at: null });
      const events = await runInDurableObject(stub, (_i, st) =>
        st.storage.sql.exec<{ p: string }>(`SELECT payload AS p FROM event WHERE type = 'commit.push_failed'`).toArray(),
      );
      expect(events.map((e) => JSON.parse(e.p) as { error: string }).map((p) => p.error)).toEqual([code]);
    }
  });

  it('an evicted claim expires, unlocks the files, and the retry succeeds', async () => {
    const { stub } = freshWorkspace();
    const t = await twoTasks(stub);
    const pid = await inReview(stub, t, 'src/a.ts', 'T-1');
    await runInDurableObject(stub, (inst: WorkspaceDO) => inst.db.tx(() => setCommitClaim(inst.db, 'T-1', Date.now() - 61_000)));
    await evictDurableObject(stub);
    expect((await call(stub, 'GET', '/v1/state', { token: t.mc })).status).toBe(200);
    expect(await taskRow(stub, 'T-1')).toMatchObject({ status: 'review', commit_started_at: null });
    const events = await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec<{ p: string }>(`SELECT payload AS p FROM event WHERE type = 'commit.push_failed'`).toArray(),
    );
    expect(events.map((e) => JSON.parse(e.p) as { error: string }).map((p) => p.error)).toEqual(['claim_expired']);
    const retry = await call(stub, 'POST', `/v1/proposals/${pid}/decision`, { token: t.mc, body: { approve: true } });
    expect(retry.json.status).toBe('disetujui');
  });

  it('no token in events or responses', async () => {
    const { stub } = freshWorkspace();
    const t = await twoTasks(stub);
    const pid = await inReview(stub, t, 'src/a.ts', 'T-1');
    adoptWorkspace();
    const bodies: string[] = [];
    await runInDurableObject(stub, async (inst: WorkspaceDO) => {
      const saved = inst.committer;
      inst.committer = committer();
      try {
        bodies.push(JSON.stringify(await decideProposalFlow(inst, pid, { approve: true })));
      } finally {
        inst.committer = saved;
      }
    });
    const payloads = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ p: string }>('SELECT payload AS p FROM event').toArray());
    for (const p of payloads.map((r) => r.p)) expect(p).not.toContain(TOKEN);
    for (const b of bodies) expect(b).not.toContain(TOKEN);
  });
});
