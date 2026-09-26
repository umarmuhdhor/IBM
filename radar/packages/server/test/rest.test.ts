import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ExportRes, StateRes } from '@radar/common';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex } from './helpers';

describe('auth (R3 §1)', () => {
  it('401 for a missing, malformed or unknown token', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    expect((await call(stub, 'GET', '/v1/state')).status).toBe(401);
    expect((await call(stub, 'GET', '/v1/state', { headers: { authorization: 'Basic abc' } })).json).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect((await call(stub, 'GET', '/v1/state', { token: 'rdr_nope' })).status).toBe(401);
  });

  it('403 when the role is not allowed', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const r = await call(stub, 'POST', '/v1/bob/activity', { token: t.mc, body: { kind: 'turn.end', sessionId: null, mode: 'coder' } });
    expect(r.status).toBe(403);
    expect(r.json).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('bad JSON is 400 BAD_REQUEST, schema failure is 422 VALIDATION', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    expect((await call(stub, 'POST', '/v1/bob/activity', { token: t.A, raw: '{' })).json).toMatchObject({ error: { code: 'BAD_REQUEST' } });
    const v = await call(stub, 'POST', '/v1/bob/activity', { token: t.A, body: { kind: 'nope' } });
    expect(v.status).toBe(422);
    expect(v.json.error.code).toBe('VALIDATION');
  });
});

describe('GET /v1/state (R3 §2.21)', () => {
  it('is readable by coder, pm and mc and matches StateRes', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    for (const tok of [t.A, t.C, t.mc]) {
      const r = await call(stub, 'GET', '/v1/state', { token: tok });
      expect(r.status).toBe(200);
      const s = StateRes.parse(r.json);
      expect(s.workspace).toMatchObject({ name: 'toko-demo', headCommit: 'abc1234', repoUrl: 'https://github.com/demo/toko-demo' });
      expect(s.members.map((m) => m.id)).toEqual(['A', 'B', 'C']);
      expect(s.files).toEqual([expect.objectContaining({ path: 'src/app.ts', version: 1 })]);
      expect(s.cursor).toBe(4);
      expect(s.recentEvents).toHaveLength(4);
    }
    expect(JSON.stringify((await call(stub, 'GET', '/v1/state', { token: t.mc })).json)).not.toContain('export const a');
  });
});

describe('GET /v1/events/export (R3 §2.23, SV-08)', () => {
  it('returns events in id order and adds a patch to file.changed', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    await a.byType('snapshot');
    const content = 'export const a = 2;\n';
    a.send({ t: 'file.update', id: 'u1', d: { path: 'src/app.ts', baseVersion: 1, content, hash: await sha256Hex(content), clientTs: 0 } });
    await a.byType('file.ack');

    const r = await call(stub, 'GET', '/v1/events/export', { token: t.B });
    expect(r.status).toBe(200);
    const ex = ExportRes.parse(r.json);
    const ids = ex.events.map((e) => e.id);
    expect(ids).toEqual([...ids].sort((x, y) => x - y));
    const changed = ex.events.find((e) => e.type === 'file.changed');
    expect(changed?.payload).toMatchObject({ path: 'src/app.ts', version: 2, by: 'A' });
    expect((changed?.payload as { patch?: string }).patch).toContain('-export const a = 1;');
    expect((changed?.payload as { patch?: string }).patch).toContain('+export const a = 2;');

    const ranged = await call(stub, 'GET', '/v1/events/export?from=2&to=3', { token: t.B });
    expect(ranged.json.events.map((e: { id: number }) => e.id)).toEqual([2, 3]);
  });

  it('needs a token unless PUBLIC_EXPORT=true', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    expect((await call(stub, 'GET', '/v1/events/export')).status).toBe(401);
  });
});

describe('POST /v1/bob/activity (R3 §2.24, JT-01)', () => {
  it('coder → 204, event bob.activity with memberId from the token, broadcast to app and mc', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const app = await hello(stub, t.B!, 'app');
    const mc = await hello(stub, t.mc!, 'mc');
    const r = await call(stub, 'POST', '/v1/bob/activity', {
      token: t.A,
      body: { kind: 'tool.pre', memberId: 'B', sessionId: 's1', mode: 'coder', tool: 'apply_diff', paths: ['src/app.ts'], decision: 'allow', clientTs: 5 },
    });
    expect(r.status).toBe(204);
    for (const c of [app, mc]) {
      const ev = await c.next((m) => m.t === 'event' && m.d?.type === 'bob.activity');
      expect(ev.d.payload).toEqual({ memberId: 'A', kind: 'tool.pre', sessionId: 's1', mode: 'coder', tool: 'apply_diff', paths: ['src/app.ts'], decision: 'allow' });
      expect(ev.d.actor).toBe('A');
    }
  });

  it('pm may post; long prompt text is cut to 200 characters', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const r = await call(stub, 'POST', '/v1/bob/activity', { token: t.C, body: { kind: 'prompt', sessionId: 's', mode: 'pm-lead', text: 'x'.repeat(500) } });
    expect(r.status).toBe(204);
    const ex = await call(stub, 'GET', '/v1/events/export', { token: t.C });
    const last = ex.json.events.at(-1);
    expect(last).toMatchObject({ type: 'bob.activity', payload: { memberId: 'C', kind: 'prompt' } });
    expect(last.payload.text).toHaveLength(200);
  });

  it('drops events above 20/s per member but still answers 204, counting activity_dropped', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const body = { kind: 'turn.end', sessionId: 's', mode: 'coder' };
    const statuses = await Promise.all(Array.from({ length: 45 }, () => call(stub, 'POST', '/v1/bob/activity', { token: t.A, body })));
    expect(statuses.every((s) => s.status === 204)).toBe(true);
    const n = await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec<{ n: number }>("SELECT count(*) AS n FROM event WHERE type = 'bob.activity'").one().n,
    );
    expect(n).toBeGreaterThanOrEqual(20);
    expect(n).toBeLessThan(45); // at most 2 windows × 20 even if the burst crosses a second boundary
  });
});
