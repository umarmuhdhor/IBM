// Fase 12 P1 endpoints: `POST /v1/ai-edits` (BC-05), `GET /v1/files/history` (UI-06) and
// `GET /v1/report/session` (MA-06), with their R3 §1 role rows.
import { runInDurableObject } from 'cloudflare:test';
import { FilesHistoryRes, SessionReportRes } from '@radar/common';
import { describe, expect, it } from 'vitest';
import { insertEvent } from '../src/db/repo/event';
import { insertMetric } from '../src/db/repo/metric';
import type { WorkspaceDO } from '../src/workspace-do';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex, type Ws } from './helpers';

type Stub = DurableObjectStub;

async function write(ws: Ws, id: string, path: string, baseVersion: number, content: string): Promise<void> {
  ws.send({ t: 'file.update', id, d: { path, baseVersion, content, hash: await sha256Hex(content), clientTs: 0 } });
  const ack = await ws.next((m) => m.t === 'file.ack' || m.t === 'file.rejected');
  if (ack.t !== 'file.ack') throw new Error(`update rejected: ${ack.raw}`);
}

const aiFlags = (stub: Stub, path: string) =>
  runInDurableObject(stub, (i: WorkspaceDO) =>
    i.db.all<{ version: number; ai: number }>('SELECT version, ai FROM file_version WHERE path = ? ORDER BY version', path).map((r) => [r.version, r.ai]),
  );

const countEvents = (stub: Stub, type: string) =>
  runInDurableObject(stub, (i: WorkspaceDO) => i.db.one<{ n: number }>('SELECT count(*) AS n FROM event WHERE type = ?', type)!.n);

describe('POST /v1/ai-edits (BC-05, R3 §2.20)', () => {
  it('marks the version the member saved just before the hook, and emits ai.edit', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    await write(a, 'u1', 'src/app.ts', 1, 'export const a = 2;\n');
    const r = await call(stub, 'POST', '/v1/ai-edits', { token: t.A, body: { paths: ['src/app.ts'], tool: 'write_file', sessionId: 's1' } });
    expect(r.status).toBe(204);
    expect(await aiFlags(stub, 'src/app.ts')).toEqual([
      [1, 0],
      [2, 1],
    ]);
    expect(await countEvents(stub, 'ai.edit')).toBe(1);
  });

  it('a hook that arrives before the upload marks the next version of that member (within 10 s)', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    const r = await call(stub, 'POST', '/v1/ai-edits', { token: t.A, body: { paths: ['./src/app.ts'], tool: 'apply_diff' } });
    expect(r.status).toBe(204);
    await write(a, 'u1', 'src/app.ts', 1, 'export const a = 2;\n');
    await write(a, 'u2', 'src/app.ts', 2, 'export const a = 3;\n');
    // Only the first version after the hook is Bob's; the manual save after it is not.
    expect(await aiFlags(stub, 'src/app.ts')).toEqual([
      [1, 0],
      [2, 1],
      [3, 0],
    ]);
  });

  it('a pending mark older than 10 s is dropped, and a version by another member is never marked', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub, [
      { path: 'src/app.ts', content: 'export const a = 1;\n' },
      { path: 'src/b.ts', content: 'export const b = 1;\n' },
    ]);
    const a = await hello(stub, t.A!, 'sync');
    const b = await hello(stub, t.B!, 'sync');
    await call(stub, 'POST', '/v1/ai-edits', { token: t.A, body: { paths: ['src/app.ts', 'src/b.ts'], tool: 'write_file' } });
    await runInDurableObject(stub, (i: WorkspaceDO) => i.db.run("UPDATE ai_mark SET ts = ts - 11000 WHERE path = 'src/app.ts'"));
    await write(a, 'u1', 'src/app.ts', 1, 'export const a = 2;\n');
    await write(b, 'u2', 'src/b.ts', 1, 'export const b = 2;\n');
    expect(await aiFlags(stub, 'src/app.ts')).toEqual([
      [1, 0],
      [2, 0],
    ]);
    expect(await aiFlags(stub, 'src/b.ts')).toEqual([
      [1, 0],
      [2, 0],
    ]);
  });

  it('only coders may call it; paths outside the workspace are 422', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const body = { paths: ['src/app.ts'], tool: 'write_file' };
    expect((await call(stub, 'POST', '/v1/ai-edits', { token: t.C, body })).status).toBe(403);
    expect((await call(stub, 'POST', '/v1/ai-edits', { token: t.mc, body })).status).toBe(403);
    expect((await call(stub, 'POST', '/v1/ai-edits', { token: t.A, body: { paths: ['../etc/passwd'], tool: 'x' } })).status).toBe(422);
  });
});

describe('GET /v1/files/history (UI-06, R3 §2.22)', () => {
  it('returns the newest versions first, each with its patch and ai flag', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    await write(a, 'u1', 'src/app.ts', 1, 'export const a = 2;\n');
    await call(stub, 'POST', '/v1/ai-edits', { token: t.A, body: { paths: ['src/app.ts'], tool: 'write_file' } });
    const r = await call(stub, 'GET', '/v1/files/history?path=src/app.ts&limit=5', { token: t.B });
    expect(r.status).toBe(200);
    const h = FilesHistoryRes.parse(r.json);
    expect(h.versions.map((v) => [v.version, v.by, v.ai])).toEqual([
      [2, 'A', true],
      [1, 'server', false],
    ]);
    expect(h.versions[0]!.taskId).toMatch(/^T-/);
    expect(h.versions[0]!.patch).toContain('-export const a = 1;');
    expect(h.versions[0]!.patch).toContain('+export const a = 2;');
    expect(h.versions[1]!.patch).toContain('+export const a = 1;');
  });

  it('limit cuts the list; an unknown path is 404; a missing path is 422', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    await write(a, 'u1', 'src/app.ts', 1, 'export const a = 2;\n');
    await write(a, 'u2', 'src/app.ts', 2, 'export const a = 3;\n');
    const r = await call(stub, 'GET', '/v1/files/history?path=src/app.ts&limit=1', { token: t.mc });
    expect(FilesHistoryRes.parse(r.json).versions.map((v) => v.version)).toEqual([3]);
    expect((await call(stub, 'GET', '/v1/files/history?path=src/none.ts', { token: t.A })).status).toBe(404);
    expect((await call(stub, 'GET', '/v1/files/history', { token: t.A })).status).toBe(422);
  });
});

describe('GET /v1/report/session (MA-06, R3 §2.17)', () => {
  const T0 = Date.UTC(2026, 8, 26, 13, 0, 0); // 21:00 WITA

  async function seedSession(stub: Stub): Promise<void> {
    await runInDurableObject(stub, (i: WorkspaceDO) => {
      const db = i.db;
      db.tx(() => {
        db.run('DELETE FROM event');
        db.run("DELETE FROM sqlite_sequence WHERE name = 'event'");
        db.run(
          "INSERT INTO task (id, seq, title, description, owner_id, status, adhoc, created_at, updated_at) VALUES ('T-1', 1, 'Header | nav', '', 'A', 'selesai', 0, ?, ?), ('T-2', 2, 'Checkout', '', 'B', 'dikerjakan', 0, ?, ?)",
          T0,
          T0,
          T0,
          T0,
        );
        const ev = (dt: number, actor: string, type: string, payload: unknown) => insertEvent(db, { ts: T0 + dt, actor, type, payload: JSON.stringify(payload) });
        ev(0, 'mc', 'task.created', { taskId: 'T-1', title: 'Header | nav', ownerId: 'A', status: 'terbuka', files: ['src/Header.tsx'], queuedFiles: [], adhoc: false });
        ev(1000, 'mc', 'task.created', { taskId: 'T-2', title: 'Checkout', ownerId: 'B', status: 'terbuka', files: ['src/checkout.ts'], queuedFiles: [], adhoc: false });
        ev(5000, 'B', 'sync.applied', { path: 'src/Header.tsx', version: 2, memberId: 'B', latencyMs: 120 });
        ev(6000, 'C', 'sync.applied', { path: 'src/Header.tsx', version: 2, memberId: 'C', latencyMs: 300 });
        ev(9000, 'B', 'lock.blocked', { path: 'src/Header.tsx', memberId: 'B', taskId: 'T-2', holderMemberId: 'A', holderTaskId: 'T-1', via: 'hook', requestId: 'R-1' });
        ev(50_000, 'mc', 'request.decided', { requestId: 'R-1', outcome: 'antre', proposalId: 'P-1', auto: false });
        ev(80_000, 'C', 'review.created', { reviewId: 1, taskId: 'T-1', verdict: 'setujui_beri_tahu' });
        ev(80_001, 'C', 'review.flagged', { reviewId: 1, taskId: 'T-1', flags: [{ path: 'src/Header.tsx', issue: 'import | lama' }] });
        ev(90_000, 'mc', 'commit.created', { taskId: 'T-1', sha: 'c0576499abcdef', author: 'Andi', files: ['src/Header.tsx'], pushed: true, url: 'https://github.com/demo/toko-demo/commit/c0576499abcdef' });
        insertMetric(db, { ts: T0 + 50_000, name: 'block_to_decision_ms', value: 41_000, tags: {} });
        insertMetric(db, { ts: T0 + 9000, name: 'lock_check_ms', value: 3, tags: {} });
        insertMetric(db, { ts: T0 + 9000, name: 'hook_rtt_ms', value: 38, tags: {} });
        // Outside the session window: not counted.
        insertMetric(db, { ts: T0 - 60_000, name: 'block_to_decision_ms', value: 999_000, tags: {} });
      });
    });
  }

  it('aggregates the session into stats and a Markdown summary', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await seedSession(stub);
    const r = await call(stub, 'GET', '/v1/report/session', { token: t.C });
    expect(r.status).toBe(200);
    const rep = SessionReportRes.parse(r.json);
    expect(rep.stats).toEqual({ tasks: 2, commits: 1, blocks: 1, decisions: 1, medianBlockToDecisionMs: 41_000, syncP95Ms: 300, lockCheckP95Ms: 3 });
    expect(rep.markdown).toMatchInlineSnapshot(`
      "## Laporan sesi

      21:00–21:01 WITA · 1.5 min · 9 event (#1–#9)

      | Ukuran | Nilai |
      |---|---|
      | Task | 2 |
      | Commit | 1 |
      | Blokir | 1 |
      | Keputusan PM | 1 |
      | Median blokir → keputusan | 41.0 s |
      | Review (ditandai) | 1 (1) |
      | p95 sinkron | 300 ms |
      | p95 cek kunci (server) | 3 ms |
      | p95 cek kunci (RTT hook) | 38 ms |

      ### Task

      Per status: dikerjakan 1 · selesai 1

      | Task | Judul | Pemilik | Status |
      |---|---|---|---|
      | T-1 | Header \\| nav | A | selesai |
      | T-2 | Checkout | B | dikerjakan |

      ### Commit

      | Task | Commit | File |
      |---|---|---|
      | T-1 | [c057649](https://github.com/demo/toko-demo/commit/c0576499abcdef) | 1 |

      ### Temuan review

      - T-1 · \`src/Header.tsx\`: import \\| lama
      "
    `);
  });

  it('from/to limit the event range; coders may not read it', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await seedSession(stub);
    const r = await call(stub, 'GET', '/v1/report/session?from=5&to=5', { token: t.mc });
    expect(SessionReportRes.parse(r.json).stats).toMatchObject({ tasks: 0, commits: 0, blocks: 1, decisions: 0 });
    expect((await call(stub, 'GET', '/v1/report/session', { token: t.A })).status).toBe(403);
  });
});
