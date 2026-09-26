// Fase 05 step 12: the demo story end to end over REST + WebSocket on one real Durable Object.
// The event export is saved (timestamps normalised) to test/fixtures/flow-export.json as seed data for the replay.
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ExportRes, type LockCheckRes } from '@radar/common';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex } from './helpers';

const FILES = ['src/checkout/checkout.ts', 'src/checkout/coupon.ts', 'src/ui/theme.css', 'src/ui/Header.tsx', 'src/routes.ts', 'src/utils.ts'];
const [CHECKOUT, COUPON, THEME, HEADER, ROUTES, UTILS] = FILES as [string, string, string, string, string, string];

const update = async (id: string, path: string, baseVersion: number, content: string) => ({
  t: 'file.update',
  id,
  d: { path, baseVersion, content, hash: await sha256Hex(content), clientTs: 0 },
});

/** Fixed timeline so the committed fixture does not change between runs. */
const FIXTURE_T0 = 1_790_000_000_000;
const FIXTURE_STEP_MS = 1_500;

describe('flow: plan → block → decision → review → approve (fase 05 step 12)', () => {
  it('runs the demo story and exports the event log', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(
      stub,
      FILES.map((path) => ({ path, content: `// ${path}\n` })),
    );
    const check = async (token: string, path: string) =>
      (await call(stub, 'POST', '/v1/locks/check', { token, body: { paths: [path], tool: 'write_file', clientTs: 0 } })).json as LockCheckRes;
    const lockOf = (path: string) =>
      runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ task_id: string; state: string }>('SELECT task_id, state FROM lock WHERE path = ?', path).toArray()[0] ?? null);

    // 1. Plan proposed by the PM, approved by Mission Control: tasks created, files reserved, routes.ts queued.
    const plan = await call(stub, 'POST', '/v1/proposals', {
      token: t.C,
      body: {
        kind: 'plan',
        reason: 'Dua fitur paralel',
        payload: {
          goal: 'Kupon dan dark mode',
          tasks: [
            { ref: 'kupon', title: 'Kupon', ownerId: 'A', files: [CHECKOUT, COUPON, ROUTES] },
            { ref: 'dark', title: 'Dark mode', ownerId: 'B', files: [THEME, HEADER], queuedFiles: [ROUTES] },
          ],
        },
      },
    });
    expect(plan.status).toBe(201);
    expect(plan.json.status).toBe('menunggu');
    const approvePlan = await call(stub, 'POST', `/v1/proposals/${plan.json.proposalId}/decision`, { token: t.mc, body: { approve: true } });
    expect(approvePlan.status).toBe(200);
    expect(approvePlan.json.status).toBe('disetujui');
    expect(await lockOf(CHECKOUT)).toEqual({ task_id: 'T-1', state: 'dipesan' });
    expect(await lockOf(ROUTES)).toEqual({ task_id: 'T-1', state: 'dipesan' });
    expect(await lockOf(THEME)).toEqual({ task_id: 'T-2', state: 'dipesan' });
    const tasksB = await call(stub, 'GET', '/v1/tasks', { token: t.B });
    expect(tasksB.json.tasks[0].files).toContainEqual({ path: ROUTES, lock: null, queuePos: 1, waitingFor: 'T-1' });

    // 2. A's first edit takes its reserved file: dipesan → dipegang, T-1 dikerjakan.
    const a1 = await check(t.A!, CHECKOUT);
    expect(a1).toMatchObject({ decision: 'allow', results: [{ reason: 'own' }], activeTaskId: 'T-1' });
    expect(await lockOf(CHECKOUT)).toEqual({ task_id: 'T-1', state: 'dipegang' });

    // 3. B is blocked; repeated blocks reuse one request (SV-05).
    const b1 = await check(t.B!, CHECKOUT);
    expect(b1).toMatchObject({ decision: 'block', results: [{ reason: 'held_by_other', requestId: 'R-1', holder: { memberId: 'A', taskId: 'T-1' } }] });
    expect(b1.message).toContain('Jangan coba ulang');
    expect(b1.message).toContain('radar why_blocked');
    for (let i = 0; i < 3; i++) expect((await check(t.B!, CHECKOUT)).results[0]?.requestId).toBe('R-1');
    const why = await call(stub, 'GET', '/v1/blocks/last', { token: t.B });
    expect(why.json.block).toMatchObject({ path: CHECKOUT, requestId: 'R-1', requestStatus: 'terbuka' });

    // 4. The second layer: B's sync write to checkout.ts is rejected and the server copy is unchanged (SV-03).
    const syncA = await hello(stub, t.A!, 'sync');
    const syncB = await hello(stub, t.B!, 'sync');
    syncB.send(await update('b1', CHECKOUT, 1, 'B was here'));
    expect((await syncB.byType('file.rejected')).d).toMatchObject({ reason: 'held_by_other', server: { version: 1 } });

    // 5. A free file is grabbed for B's active task.
    expect(await check(t.B!, UTILS)).toMatchObject({ decision: 'allow', results: [{ reason: 'grabbed' }], activeTaskId: 'T-2' });

    // 6. PM decides "antre": applied at once (AUTO_APPLY_QUEUE), B queues behind T-1 and hears about it.
    const cursorB = (await call(stub, 'GET', '/v1/brief?kind=start', { token: t.B })).json.cursor as number;
    const dec = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: { kind: 'decision', reason: 'T-1 hampir selesai', payload: { requestId: 'R-1', option: 'antre' } } });
    expect(dec.json.status).toBe('diterapkan_otomatis');
    const tasksB2 = await call(stub, 'GET', '/v1/tasks', { token: t.B });
    expect(tasksB2.json.tasks[0].files).toContainEqual({ path: CHECKOUT, lock: null, queuePos: 1, waitingFor: 'T-1' });
    const briefB = await call(stub, 'GET', `/v1/brief?kind=prompt&since=${cursorB}`, { token: t.B });
    expect(briefB.json.lines.join('\n')).toContain('Keputusan PM');

    // 7. A edits, submits; PM proposes "setujui_beri_tahu"; Mission Control approves: T-1 selesai, the local
    //    commit (GITHUB_COMMIT=false) is recorded, and checkout.ts moves to B (SV-06) with a note in B's brief.
    syncA.send(await update('a1', CHECKOUT, 1, '// checkout with coupon\n'));
    await syncA.byType('file.ack');
    const submit = await call(stub, 'POST', '/v1/tasks/T-1/submit', { token: t.A, body: { summary: 'Kupon diskon persen' } });
    expect(submit.json).toEqual({ taskId: 'T-1', status: 'review', files: [CHECKOUT] });
    expect(await lockOf(CHECKOUT)).toEqual({ task_id: 'T-1', state: 'review' });
    const cursorB2 = (await call(stub, 'GET', '/v1/brief?kind=start', { token: t.B })).json.cursor as number;
    const review = await call(stub, 'POST', '/v1/proposals', {
      token: t.C,
      body: {
        kind: 'review',
        reason: 'Kupon aman',
        payload: { taskId: 'T-1', verdict: 'setujui_beri_tahu', notify: [{ memberId: 'B', message: 'calculateTotal() kini menerima kupon.' }] },
      },
    });
    expect(review.status).toBe(201);

    // 8. MA-07: no member token may decide, not even the PM's.
    for (const tok of [t.C, t.A]) expect((await call(stub, 'POST', `/v1/proposals/${review.json.proposalId}/decision`, { token: tok, body: { approve: true } })).status).toBe(403);

    const approve = await call(stub, 'POST', `/v1/proposals/${review.json.proposalId}/decision`, { token: t.mc, body: { approve: true } });
    expect(approve.status).toBe(200);
    expect(approve.json.status).toBe('disetujui');
    const t1 = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ status: string; commit_sha: string | null }>("SELECT status, commit_sha FROM task WHERE id = 'T-1'").one());
    expect(t1?.status).toBe('selesai');
    expect(t1?.commit_sha).toMatch(/^local-[0-9a-f]+$/);
    expect(await lockOf(CHECKOUT)).toEqual({ task_id: 'T-2', state: 'dipesan' });
    expect(await lockOf(ROUTES)).toEqual({ task_id: 'T-2', state: 'dipesan' });
    expect(await lockOf(COUPON)).toBeNull();
    const briefB2 = (await call(stub, 'GET', `/v1/brief?kind=prompt&since=${cursorB2}`, { token: t.B })).json.lines.join('\n') as string;
    expect(briefB2).toContain('calculateTotal() kini menerima kupon.');
    expect(briefB2).toContain('Giliranmu');

    // 9. The export holds the whole story in order.
    const exp = ExportRes.parse((await call(stub, 'GET', '/v1/events/export', { token: t.mc })).json);
    const types: string[] = exp.events.map((e) => e.type);
    const order = [
      'proposal.created', 'proposal.decided', 'task.created', 'lock.reserved', 'lock.queued', 'lock.acquired',
      'request.created', 'lock.blocked', 'file.rejected', 'request.decided', 'task.submitted', 'review.created',
      'lock.transferred', 'commit.created', 'notify.sent',
    ];
    let at = -1;
    for (const type of order) {
      const i = types.indexOf(type, at + 1);
      expect(i, `${type} after index ${at}`).toBeGreaterThan(at);
      at = i;
    }
    expect(types.filter((x) => x === 'request.created')).toHaveLength(1);

    const fixture = {
      ...exp,
      exportedAt: FIXTURE_T0 + exp.events.length * FIXTURE_STEP_MS,
      events: exp.events.map((e, i) => ({ ...e, ts: FIXTURE_T0 + i * FIXTURE_STEP_MS })),
    };
    await expect(`${JSON.stringify(fixture, null, 2)}\n`).toMatchFileSnapshot('./fixtures/flow-export.json');
    syncA.ws.close();
    syncB.ws.close();
  });
});
