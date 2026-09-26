// Fase 05 step 10 extras: queue order, pindahkan/pecah, revoke, cancel, the two-transaction commit, the R3 §1
// role matrix for the new endpoints, and the lock check latency (step 13).
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { CommitResult, GitHubCommitter } from '../src/committer';
import { getLock } from '../src/db/repo/lock';
import { RadarError } from '../src/http/errors';
import { revoke } from '../src/services/locks';
import { decideProposalFlow } from '../src/services/proposals';
import { cancelTask, closeTask } from '../src/services/tasks';
import type { WorkspaceDO } from '../src/workspace-do';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex } from './helpers';
import { withLocks } from './lock-fixture';

const P = 'src/shared.ts';
const Q = 'src/other.ts';
const R = 'src/third.ts';

const allocs = (f: { db: { all: <T extends Record<string, string | number | null>>(q: string, ...a: string[]) => T[] } }, path: string) =>
  f.db.all<{ task_id: string; queue_pos: number }>('SELECT task_id, queue_pos FROM allocation WHERE path = ? ORDER BY queue_pos', path);

describe('queue, revoke and cancel (R4 §5)', () => {
  it('a queue of three tasks advances one by one as holders finish', () =>
    withLocks((f) => {
      const t1 = f.task('A', 'review');
      const t2 = f.task('B');
      const t3 = f.task('A');
      f.lock(P, t1, 'review');
      f.queue(P, t2);
      f.queue(P, t3);
      closeTask(f.ctx, t1, 'selesai', 'mc');
      expect(getLock(f.db, P)).toMatchObject({ task_id: t2.id, member_id: 'B', state: 'dipesan' });
      expect(allocs(f, P)).toEqual([{ task_id: t2.id, queue_pos: 0 }, { task_id: t3.id, queue_pos: 1 }]);
      cancelTask(f.ctx, t2.id);
      expect(getLock(f.db, P)).toMatchObject({ task_id: t3.id, member_id: 'A', state: 'dipesan' });
      expect(allocs(f, P)).toEqual([{ task_id: t3.id, queue_pos: 0 }]);
      expect(f.events().filter((e) => e === 'lock.transferred')).toHaveLength(2);
    }));

  it('revoke frees the file, drops the holder allocation and advances the queue (SV-09)', () =>
    withLocks((f) => {
      const t1 = f.task('A', 'dikerjakan');
      const t2 = f.task('B');
      f.lock(P, t1, 'dipegang');
      f.queue(P, t2);
      expect(revoke(f.ctx, P, 'PC mati', 'mc')).toMatchObject({ task_id: t2.id, owner_id: 'B' });
      expect(getLock(f.db, P)).toMatchObject({ task_id: t2.id, state: 'dipesan' });
      expect(allocs(f, P)).toEqual([{ task_id: t2.id, queue_pos: 0 }]);
      expect(f.events()).toEqual(expect.arrayContaining(['lock.revoked', 'lock.transferred']));
      expect(f.count("SELECT count(*) AS n FROM notification WHERE member_id = 'A' AND kind = 'lock'")).toBe(1);
    }));

  it('revoke of a free file is 404', () =>
    withLocks((f) => {
      expect(() => revoke(f.ctx, P, 'x', 'mc')).toThrowError(RadarError);
    }));

  it('cancel releases every lock and queue place of the task, and refuses review/selesai', () =>
    withLocks((f) => {
      const t1 = f.task('A', 'dikerjakan');
      const t0 = f.task('B', 'dikerjakan');
      f.lock(P, t1, 'dipegang');
      f.lock(Q, t1, 'dipesan');
      f.lock(R, t0, 'dipegang');
      f.queue(R, t1);
      cancelTask(f.ctx, t1.id);
      expect(f.count('SELECT count(*) AS n FROM lock WHERE task_id = ?', t1.id)).toBe(0);
      expect(f.count('SELECT count(*) AS n FROM allocation WHERE task_id = ?', t1.id)).toBe(0);
      expect(f.count('SELECT count(*) AS n FROM task WHERE id = ? AND status = ?', t1.id, 'batal')).toBe(1);
      const inReview = f.task('A', 'review');
      expect(() => cancelTask(f.ctx, inReview.id)).toThrowError(expect.objectContaining({ status: 409 }));
    }));
});

// ---- REST scenarios ------------------------------------------------------------------------------------------

const update = async (id: string, path: string, baseVersion: number, content: string) => ({
  t: 'file.update',
  id,
  d: { path, baseVersion, content, hash: await sha256Hex(content), clientTs: 0 },
});

async function setup(filesA: string[], filesB: string[], queuedB: string[] = []) {
  const { stub } = freshWorkspace();
  const t = await seedTestWorkspace(
    stub,
    [P, Q, R].map((path) => ({ path, content: `// ${path}\n` })),
  );
  const plan = await call(stub, 'POST', '/v1/proposals', {
    token: t.C,
    body: {
      kind: 'plan',
      reason: 'uji',
      payload: {
        goal: 'uji',
        tasks: [
          { ref: 'a', title: 'Tugas A', ownerId: 'A', files: filesA },
          { ref: 'b', title: 'Tugas B', ownerId: 'B', files: filesB, queuedFiles: queuedB },
        ],
      },
    },
  });
  expect(plan.status).toBe(201);
  expect((await call(stub, 'POST', `/v1/proposals/${plan.json.proposalId}/decision`, { token: t.mc, body: { approve: true } })).status).toBe(200);
  return { stub, t };
}

/** A takes and edits `path` over sync (one task_touch), then B is blocked on it: request R-1. */
async function editThenBlock(stub: DurableObjectStub, t: Record<string, string>, path: string) {
  const syncA = await hello(stub, t.A!, 'sync');
  await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: [path], tool: 'write_file', clientTs: 0 } });
  syncA.send(await update('a1', path, 1, `// ${path} by A\n`));
  await syncA.byType('file.ack');
  const b = await call(stub, 'POST', '/v1/locks/check', { token: t.B, body: { paths: [path], tool: 'write_file', clientTs: 0 } });
  expect(b.json.results[0].requestId).toBe('R-1');
  syncA.ws.close();
}

async function decide(stub: DurableObjectStub, t: Record<string, string>, payload: unknown) {
  const p = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'decision', reason: 'uji', payload } });
  expect(p.status).toBe(201);
  expect(p.json.status).toBe('menunggu');
  const d = await call(stub, 'POST', `/v1/proposals/${p.json.proposalId}/decision`, { token: t.mc, body: { approve: true } });
  expect(d.status).toBe(200);
  return d.json;
}

const sql = <T>(stub: DurableObjectStub, q: string, ...args: string[]) =>
  runInDurableObject(stub, (_i, st) => st.storage.sql.exec(q, ...args).toArray() as T[]);

describe('decisions (R4 §6.2)', () => {
  it('pindahkan moves the lock and the task_touch rows to the requester', async () => {
    const { stub, t } = await setup([P], [Q]);
    await editThenBlock(stub, t, P);
    await decide(stub, t, { requestId: 'R-1', option: 'pindahkan' });
    expect(await sql(stub, 'SELECT task_id, member_id, state FROM lock WHERE path = ?', P)).toEqual([{ task_id: 'T-2', member_id: 'B', state: 'dipesan' }]);
    expect(await sql(stub, 'SELECT task_id FROM task_touch WHERE path = ?', P)).toEqual([{ task_id: 'T-2' }]);
    expect(await sql(stub, "SELECT status FROM request WHERE id = 'R-1'")).toEqual([{ status: 'diputuskan' }]);
  });

  it('pecah creates a child task for the requester, queued behind the holder', async () => {
    const { stub, t } = await setup([P], [Q]);
    await editThenBlock(stub, t, P);
    await decide(stub, t, { requestId: 'R-1', option: 'pecah', newTask: { title: 'Bagian checkout untuk B' } });
    const child = await sql<{ id: string; owner_id: string; parent_task_id: string }>(stub, "SELECT id, owner_id, parent_task_id FROM task WHERE title = 'Bagian checkout untuk B'");
    expect(child).toEqual([{ id: 'T-3', owner_id: 'B', parent_task_id: 'T-2' }]);
    expect(await sql(stub, 'SELECT task_id, queue_pos FROM allocation WHERE path = ? ORDER BY queue_pos', P)).toEqual([
      { task_id: 'T-1', queue_pos: 0 },
      { task_id: 'T-3', queue_pos: 1 },
    ]);
  });
});

describe('two-transaction commit (R4 §6.3)', () => {
  async function inReview(stub: DurableObjectStub, t: Record<string, string>, token: string, taskId: string, path: string) {
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

  it('a failing commit keeps the task in review with its locks and releases the claim', async () => {
    const { stub, t } = await setup([P], [Q]);
    const pid = await inReview(stub, t, t.A!, 'T-1', P);
    await runInDurableObject(stub, async (inst: WorkspaceDO) => {
      const saved = inst.committer;
      inst.committer = { commitTask: () => Promise.reject(new Error('push ditolak')) };
      try {
        await expect(decideProposalFlow(inst, pid, { approve: true })).rejects.toMatchObject({ status: 409 });
      } finally {
        inst.committer = saved;
      }
    });
    expect(await sql(stub, "SELECT status, commit_started_at, commit_sha FROM task WHERE id = 'T-1'")).toEqual([{ status: 'review', commit_started_at: null, commit_sha: null }]);
    expect(await sql(stub, 'SELECT state FROM lock WHERE path = ?', P)).toEqual([{ state: 'review' }]);
    expect(await sql(stub, 'SELECT status FROM proposal WHERE id = ?', pid)).toEqual([{ status: 'menunggu' }]);
    expect(await sql(stub, "SELECT count(*) AS n FROM event WHERE type = 'commit.push_failed'")).toEqual([{ n: 1 }]);
    // "Coba lagi" works once the committer is healthy again.
    expect((await call(stub, 'POST', `/v1/proposals/${pid}/decision`, { token: t.mc, body: { approve: true } })).json.status).toBe('disetujui');
  });

  it('a second approval while a commit runs is 409, and both finish cleanly afterwards', async () => {
    const { stub, t } = await setup([P], [Q]);
    const p1 = await inReview(stub, t, t.A!, 'T-1', P);
    const p2 = await inReview(stub, t, t.B!, 'T-2', Q);
    await runInDurableObject(stub, async (inst: WorkspaceDO) => {
      const saved = inst.committer;
      let release!: (r: CommitResult) => void;
      const slow: GitHubCommitter = { commitTask: () => new Promise<CommitResult>((r) => (release = r)) };
      inst.committer = slow;
      try {
        const first = decideProposalFlow(inst, p1, { approve: true });
        // While T-1 commits, its files block every writer (R4 §3 row 12) and a second commit must wait.
        await expect(decideProposalFlow(inst, p2, { approve: true })).rejects.toMatchObject({ status: 409 });
        release({ sha: 'pending-fase-06', pushed: false });
        await expect(first).resolves.toMatchObject({ status: 'disetujui' });
      } finally {
        inst.committer = saved;
      }
    });
    expect((await call(stub, 'POST', `/v1/proposals/${p2}/decision`, { token: t.mc, body: { approve: true } })).json.status).toBe('disetujui');
    expect(await sql(stub, "SELECT id, status, commit_started_at FROM task WHERE id IN ('T-1','T-2') ORDER BY id")).toEqual([
      { id: 'T-1', status: 'selesai', commit_started_at: null },
      { id: 'T-2', status: 'selesai', commit_started_at: null },
    ]);
  });
});

describe('role matrix for fase 05 endpoints (R3 §1)', () => {
  it('each role gets 403 exactly where the matrix says ❌', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const check = { paths: ['src/app.ts'], tool: 'write_file', clientTs: 0 };
    const cases: { method: string; path: string; body?: unknown; allowed: ('A' | 'C' | 'mc')[] }[] = [
      { method: 'POST', path: '/v1/locks/check', body: check, allowed: ['A', 'C'] },
      { method: 'GET', path: '/v1/brief?kind=start', allowed: ['A', 'C'] },
      { method: 'GET', path: '/v1/tasks', allowed: ['A'] },
      { method: 'GET', path: '/v1/blocks/last', allowed: ['A'] },
      { method: 'POST', path: '/v1/tasks/T-9/submit', body: { summary: 'x' }, allowed: ['A'] },
      { method: 'POST', path: '/v1/tasks/T-9/activate', allowed: ['A'] },
      { method: 'POST', path: '/v1/requests', body: { path: 'src/app.ts' }, allowed: ['A'] },
      { method: 'GET', path: '/v1/activity', allowed: ['A', 'C'] },
      { method: 'GET', path: '/v1/team', allowed: ['C', 'mc'] },
      { method: 'GET', path: '/v1/requests', allowed: ['C', 'mc'] },
      { method: 'POST', path: '/v1/proposals', body: { kind: 'review', reason: 'x', payload: { taskId: 'T-9', verdict: 'setujui' } }, allowed: ['C'] },
      { method: 'GET', path: '/v1/proposals', allowed: ['C', 'mc'] },
      { method: 'POST', path: '/v1/notify', body: { memberId: 'A', message: 'hai' }, allowed: ['C'] },
      { method: 'POST', path: '/v1/proposals/P-9/decision', body: { approve: true }, allowed: ['mc'] },
      { method: 'POST', path: '/v1/locks/revoke', body: { path: 'src/app.ts', reason: 'x' }, allowed: ['mc'] },
      { method: 'POST', path: '/v1/tasks/T-9/cancel', allowed: ['mc'] },
    ];
    for (const c of cases) {
      for (const who of ['A', 'C', 'mc'] as const) {
        const r = await call(stub, c.method, c.path, { token: t[who], ...(c.body !== undefined ? { body: c.body } : {}) });
        if (c.allowed.includes(who)) expect(r.status, `${who} ${c.method} ${c.path}`).not.toBe(403);
        else expect(r.status, `${who} ${c.method} ${c.path}`).toBe(403);
      }
      expect((await call(stub, c.method, c.path, c.body !== undefined ? { body: c.body } : {})).status, `anon ${c.path}`).toBe(401);
    }
  });

  it('lock check: pm is always pm_readonly, more than 20 paths or a path outside the workspace is 422', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const pm = await call(stub, 'POST', '/v1/locks/check', { token: t.C, body: { paths: ['src/app.ts'], tool: 'write_file', clientTs: 0 } });
    expect(pm.json).toMatchObject({ decision: 'block', results: [{ reason: 'pm_readonly' }], activeTaskId: null });
    const many = Array.from({ length: 21 }, (_, i) => `src/f${i}.ts`);
    expect((await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: many, tool: 'write_file', clientTs: 0 } })).status).toBe(422);
    expect((await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: ['../etc/passwd'], tool: 'write_file', clientTs: 0 } })).status).toBe(422);
    const notify = await call(stub, 'POST', '/v1/notify', { token: t.C, body: { memberId: 'Z', message: 'hai' } });
    expect(notify.status).toBe(404);
  });
});

describe('lock check latency (fase 05 step 13)', () => {
  it('1000 checks through the Durable Object: p95 under 20 ms', { timeout: 60_000 }, async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const ms: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const token = i % 2 === 0 ? t.A : t.B;
      const started = Date.now();
      const r = await call(stub, 'POST', '/v1/locks/check', { token, body: { paths: [`src/f${i % 12}.ts`], tool: 'write_file', clientTs: 0 } });
      ms.push(Date.now() - started);
      expect(r.status).toBe(200);
    }
    ms.sort((a, b) => a - b);
    const p95 = ms[Math.floor(ms.length * 0.95)]!;
    expect(p95).toBeLessThan(20);
  });
});

describe('brief (R4 §8)', () => {
  it('start lists identity, own files with queue marks, other holders and the rules line', async () => {
    const { stub, t } = await setup([P, R], [Q], [P]);
    const b = (await call(stub, 'GET', '/v1/brief?kind=start', { token: t.B })).json;
    expect(b.lines[0]).toBe('[Radar] Kamu B (coder). Task aktif: T-2 Tugas B (terbuka).');
    expect(b.lines).toContain(`[Radar] File kamu: ${Q}, ${P} (antre #1)`);
    expect(b.lines.find((l: string) => l.startsWith('[Radar] Dipegang orang lain:'))).toContain(`${P}→A(T-1)`);
    expect(b.lines.at(-1)).toBe('[Radar] Jangan edit file milik orang lain. Kalau ditolak: radar why_blocked.');
    expect(b.lines.length).toBeLessThanOrEqual(6);
    expect(b.cursor).toBeGreaterThan(0);
  });

  it('prompt is empty when nothing new happened, and leads with the block after one', async () => {
    const { stub, t } = await setup([P], [Q]);
    const cursor = (await call(stub, 'GET', '/v1/brief?kind=start', { token: t.B })).json.cursor as number;
    expect((await call(stub, 'GET', `/v1/brief?kind=prompt&since=${cursor}`, { token: t.B })).json).toEqual({ lines: [], cursor });
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: [P], tool: 'write_file', clientTs: 0 } });
    await call(stub, 'POST', '/v1/locks/check', { token: t.B, body: { paths: [P], tool: 'write_file', clientTs: 0 } });
    const lines = (await call(stub, 'GET', `/v1/brief?kind=prompt&since=${cursor}`, { token: t.B })).json.lines as string[];
    expect(lines[0]).toMatch(new RegExp(`^\\[Radar\\] Edit ${P} DITOLAK: dipegang Andi \\(T-1\\)\\. Jangan coba ulang`));
    expect(lines.at(-1)).toBe('[Radar] Task aktif: T-2 Tugas B (terbuka).');
  });

  it('pm start counts open requests and pending proposals', async () => {
    const { stub, t } = await setup([P], [Q]);
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: [P], tool: 'write_file', clientTs: 0 } });
    await call(stub, 'POST', '/v1/locks/check', { token: t.B, body: { paths: [P], tool: 'write_file', clientTs: 0 } });
    const lines = (await call(stub, 'GET', '/v1/brief?kind=start', { token: t.C })).json.lines as string[];
    expect(lines[0]).toBe('[Radar] Kamu C (pm). Permintaan terbuka: 1. Usulan menunggu keputusan manusia: 0.');
    expect(lines[1]).toContain(`R-1 ${P} (B→A)`);
  });
});

describe('proposal validation and rejection (R3 §2.12–2.14, R4 §6)', () => {
  it('plan 422 names the offending path and task', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const plan = (tasks: unknown[]) => call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'plan', reason: 'x', payload: { goal: 'x', tasks } } });
    const dup = await plan([
      { ref: 'a', title: 'A', ownerId: 'A', files: [P] },
      { ref: 'b', title: 'B', ownerId: 'B', files: [P] },
    ]);
    expect(dup.status).toBe(422);
    expect(dup.json.error.message).toContain(P);
    const pmOwner = await plan([{ ref: 'a', title: 'A', ownerId: 'C', files: [P] }]);
    expect(pmOwner.status).toBe(422);
    expect(pmOwner.json.error.message).toContain('task a: C bukan coder');
    const outside = await plan([{ ref: 'a', title: 'A', ownerId: 'A', files: ['../x.ts'] }]);
    expect(outside.status).toBe(422);
    expect(outside.json.error.message).toContain('task a files: path ../x.ts tidak valid');
    // Normalising can create the overlap: ./src/shared.ts and src/shared.ts are the same file.
    const norm = await plan([
      { ref: 'a', title: 'A', ownerId: 'A', files: [`./${P}`] },
      { ref: 'b', title: 'B', ownerId: 'B', files: [P] },
    ]);
    expect(norm.status).toBe(422);
  });

  it('rejecting a plan creates nothing; a decided proposal cannot be decided again', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const p = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'plan', reason: 'x', payload: { goal: 'x', tasks: [{ ref: 'a', title: 'A', ownerId: 'A', files: [P] }] } } });
    const r = await call(stub, 'POST', `/v1/proposals/${p.json.proposalId}/decision`, { token: t.mc, body: { approve: false, note: 'belum' } });
    expect(r.json).toEqual({ proposalId: p.json.proposalId, status: 'ditolak' });
    expect(await sql(stub, 'SELECT count(*) AS n FROM task')).toEqual([{ n: 0 }]);
    expect(await sql(stub, 'SELECT count(*) AS n FROM lock')).toEqual([{ n: 0 }]);
    expect((await call(stub, 'POST', `/v1/proposals/${p.json.proposalId}/decision`, { token: t.mc, body: { approve: true } })).status).toBe(409);
    expect((await call(stub, 'POST', '/v1/proposals/P-99/decision', { token: t.mc, body: { approve: true } })).status).toBe(404);
  });

  it('rejecting a decision closes the request as ditolak and tells the requester; locks stay', async () => {
    const { stub, t } = await setup([P], [Q]);
    await editThenBlock(stub, t, P);
    const p = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'decision', reason: 'x', payload: { requestId: 'R-1', option: 'pindahkan' } } });
    expect((await call(stub, 'POST', `/v1/proposals/${p.json.proposalId}/decision`, { token: t.mc, body: { approve: false } })).json.status).toBe('ditolak');
    expect(await sql(stub, "SELECT status FROM request WHERE id = 'R-1'")).toEqual([{ status: 'ditolak' }]);
    expect(await sql(stub, 'SELECT task_id FROM lock WHERE path = ?', P)).toEqual([{ task_id: 'T-1' }]);
    expect(await sql(stub, "SELECT message FROM notification WHERE member_id = 'B' AND kind = 'decision'")).toEqual([{ message: `Permintaan ${P} ditolak PM.` }]);
    // A closed request cannot get another decision.
    const again = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'decision', reason: 'x', payload: { requestId: 'R-1', option: 'antre' } } });
    expect(again.status).toBe(409);
  });

  it('review kembalikan returns the task to dikerjakan with its locks held; rejecting a review keeps it in review', async () => {
    const { stub, t } = await setup([P], [Q]);
    const sync = await hello(stub, t.A!, 'sync');
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: [P], tool: 'write_file', clientTs: 0 } });
    sync.send(await update('a1', P, 1, '// a\n'));
    await sync.byType('file.ack');
    sync.ws.close();
    await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.A, body: { summary: 'x' } });
    const review = (verdict: string) => call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'review', reason: 'x', payload: { taskId: 'T-1', verdict, notes: 'tambah test' } } });

    const first = await review('setujui');
    expect((await call(stub, 'POST', `/v1/proposals/${first.json.proposalId}/decision`, { token: t.mc, body: { approve: false } })).json.status).toBe('ditolak');
    expect(await sql(stub, "SELECT status FROM task WHERE id = 'T-1'")).toEqual([{ status: 'review' }]);

    const back = await review('kembalikan');
    expect((await call(stub, 'POST', `/v1/proposals/${back.json.proposalId}/decision`, { token: t.mc, body: { approve: true } })).json.applied).toEqual({ taskId: 'T-1', verdict: 'kembalikan' });
    expect(await sql(stub, "SELECT status FROM task WHERE id = 'T-1'")).toEqual([{ status: 'dikerjakan' }]);
    expect(await sql(stub, 'SELECT state FROM lock WHERE path = ?', P)).toEqual([{ state: 'dipegang' }]);
    expect(await sql(stub, "SELECT message FROM notification WHERE member_id = 'A' AND kind = 'review'")).toEqual([{ message: 'Review T-1 dikembalikan: tambah test' }]);
  });

  it('a newer review proposal expires the pending one for the same task', async () => {
    const { stub, t } = await setup([P], [Q]);
    const sync = await hello(stub, t.A!, 'sync');
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: [P], tool: 'write_file', clientTs: 0 } });
    sync.send(await update('a1', P, 1, '// a\n'));
    await sync.byType('file.ack');
    sync.ws.close();
    await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.A, body: { summary: 'x' } });
    const body = { kind: 'review', reason: 'x', payload: { taskId: 'T-1', verdict: 'setujui' } };
    const a = await call(stub, 'POST', '/v1/proposals', { token: t.C, body });
    const b = await call(stub, 'POST', '/v1/proposals', { token: t.C, body });
    expect(await sql(stub, 'SELECT id, status FROM proposal WHERE id IN (?, ?) ORDER BY created_at, id', a.json.proposalId, b.json.proposalId)).toEqual([
      { id: a.json.proposalId, status: 'kedaluwarsa' },
      { id: b.json.proposalId, status: 'menunggu' },
    ]);
  });
});

describe('tasks and requests edge cases (R3 §2.5, §2.7, §2.9)', () => {
  it('submit without any changed file is 409; someone else task is 403', async () => {
    const { stub, t } = await setup([P], [Q]);
    expect((await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.A, body: { summary: 'x' } })).status).toBe(409);
    expect((await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.B, body: { summary: 'x' } })).status).toBe(403);
    expect((await call(stub, 'POST', '/v1/tasks/T-1/activate', { token: t.B })).status).toBe(403);
    expect((await call(stub, 'POST', '/v1/tasks/T-1/activate', { token: t.A })).json).toEqual({ activeTaskId: 'T-1' });
  });

  it('a coder cannot list another member tasks via ?owner=', async () => {
    const { stub, t } = await setup([P], [Q]);
    expect((await call(stub, 'GET', '/v1/tasks?owner=A&status=all', { token: t.B })).status).toBe(403);
    expect((await call(stub, 'GET', '/v1/tasks?owner=B', { token: t.B })).json.tasks.map((x: { id: string }) => x.id)).toEqual(['T-2']);
  });

  it('request_file: free file → bebas; held file → 201 then duplicate 200 with the same id', async () => {
    const { stub, t } = await setup([P], [Q]);
    expect((await call(stub, 'POST', '/v1/requests', { token: t.B, body: { path: R } })).json).toMatchObject({ requestId: null, status: 'bebas' });
    const first = await call(stub, 'POST', '/v1/requests', { token: t.B, body: { path: P, reason: 'butuh' } });
    expect(first.status).toBe(201);
    expect(first.json).toEqual({ requestId: 'R-1', status: 'terbuka', duplicate: false });
    const again = await call(stub, 'POST', '/v1/requests', { token: t.B, body: { path: P } });
    expect(again.status).toBe(200);
    expect(again.json).toEqual({ requestId: 'R-1', status: 'terbuka', duplicate: true });
    const list = await call(stub, 'GET', '/v1/requests', { token: t.C });
    expect(list.json.requests).toHaveLength(1);
    expect(list.json.requests[0]).toMatchObject({ id: 'R-1', source: 'mcp', requester: { memberId: 'B', taskId: 'T-2' }, holder: { memberId: 'A', taskId: 'T-1', state: 'dipesan' } });
  });

  it('team and activity return the R3 shapes', async () => {
    const { stub, t } = await setup([P], [Q], [P]);
    const team = (await call(stub, 'GET', '/v1/team', { token: t.mc })).json;
    expect(team.members.map((m: { id: string }) => m.id)).toEqual(['A', 'B', 'C']);
    expect(team.tasks).toContainEqual({ id: 'T-1', title: 'Tugas A', ownerId: 'A', status: 'terbuka', files: [P], editCount: 0 });
    expect(team.locks).toContainEqual({ path: P, taskId: 'T-1', memberId: 'A', state: 'dipesan', queue: ['T-2'] });
    expect(team).toMatchObject({ openRequests: 0, pendingProposals: 0, headCommit: 'abc1234' });
    const act = (await call(stub, 'GET', `/v1/activity?path=${encodeURIComponent(P)}&limit=5`, { token: t.A })).json;
    expect(act.items.length).toBeGreaterThan(0);
    expect(act.items.every((i: { path?: string }) => i.path === P)).toBe(true);
    expect(act.items[0].summary).not.toMatch(/^\d\d:\d\d /);
  });
});
