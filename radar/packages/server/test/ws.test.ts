import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { MAX_FILE_BYTES, StateRes, WS_PING_FRAME, WS_PONG_FRAME } from '@radar/common';
import { call, connect, freshWorkspace, hello, seedTestWorkspace, sha256Hex, sleep } from './helpers';

const update = async (id: string, path: string, baseVersion: number, content: string) => ({
  t: 'file.update',
  id,
  d: { path, baseVersion, content, hash: await sha256Hex(content), clientTs: 0 },
});

describe('WebSocket hello (R3 §3)', () => {
  it('a wrong token closes with 4401', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    const c = await connect(stub);
    c.send({ t: 'hello', d: { token: 'rdr_wrong', client: 'sync', clientVersion: 't' } });
    expect(await c.closed).toBe(4401);
  });

  it('a first message other than hello closes with 4401', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    const c = await connect(stub);
    c.send({ t: 'heartbeat', d: { ts: 0 } });
    expect(await c.closed).toBe(4401);
  });

  it('client mc needs the mc token; client sync needs a member token', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await connect(stub);
    a.send({ t: 'hello', d: { token: t.A, client: 'mc', clientVersion: 't' } });
    expect(await a.closed).toBe(4401);
    const m = await connect(stub);
    m.send({ t: 'hello', d: { token: t.mc, client: 'sync', clientVersion: 't' } });
    expect(await m.closed).toBe(4401);
  });

  it('the alarm closes a socket that never sent hello once its deadline passed', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    const c = await connect(stub);
    await runInDurableObject(stub, (_i, state) => {
      for (const ws of state.getWebSockets()) ws.serializeAttachment({ state: 'pending', helloDeadline: 0 });
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await c.closed).toBe(4401);
  });

  it('no alarm stays scheduled once every socket is ready (the DO may hibernate)', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await hello(stub, t.A!, 'app');
    await runDurableObjectAlarm(stub);
    const alarm = await runInDurableObject(stub, (_i, state) => state.storage.getAlarm());
    expect(alarm).toBeNull();
  });

  it('ping is answered with the exact pong frame (auto response)', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const c = await hello(stub, t.A!, 'app');
    c.send(WS_PING_FRAME);
    expect((await c.next((m) => m.raw === WS_PONG_FRAME)).raw).toBe('{"t":"pong"}');
  });

  it('sync gets welcome + snapshot with contents; knownVersions skips unchanged files', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub, [
      { path: 'a.ts', content: 'a' },
      { path: 'b.ts', content: 'b' },
    ]);
    const c = await connect(stub);
    c.send({ t: 'hello', d: { token: t.A, client: 'sync', clientVersion: 't' } });
    const welcome = await c.byType('welcome');
    expect(welcome.d).toMatchObject({ principal: { kind: 'member', memberId: 'A', role: 'coder' }, workspace: 'toko-demo' });
    const snap = await c.byType('snapshot');
    expect(snap.d.files).toEqual([
      { path: 'a.ts', version: 1, hash: await sha256Hex('a'), content: 'a', deleted: false },
      { path: 'b.ts', version: 1, hash: await sha256Hex('b'), content: 'b', deleted: false },
    ]);
    expect(snap.d.locks).toEqual([]);

    const k = await hello(stub, t.B!, 'sync', { 'a.ts': 1 });
    const snap2 = await k.byType('snapshot');
    expect(snap2.d.files.map((f: { path: string }) => f.path)).toEqual(['b.ts']);
  });

  it('app (member token) and mc get welcome + a valid state', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    for (const [tok, client] of [
      [t.A!, 'app'],
      [t.mc!, 'mc'],
    ] as const) {
      const c = await hello(stub, tok, client);
      const s = await c.byType('state');
      expect(StateRes.safeParse(s.d).success).toBe(true);
    }
  });
});

describe('file.update (R4 "Penerimaan file.update", SV-01)', () => {
  it('A update → A file.ack, B file.changed v+1, A does not get its own change, mc gets the event', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    const b = await hello(stub, t.B!, 'sync');
    const mc = await hello(stub, t.mc!, 'mc');
    const content = 'export const a = 2;\n';
    a.send(await update('u1', 'src/app.ts', 1, content));
    const ack = await a.byType('file.ack');
    expect(ack.d).toMatchObject({ id: 'u1', path: 'src/app.ts', version: 2, hash: await sha256Hex(content) });
    const changed = await b.byType('file.changed');
    expect(changed.d).toMatchObject({ path: 'src/app.ts', version: 2, content, by: 'A', deleted: false, taskId: null });
    expect((await mc.next((m) => m.t === 'event' && m.d?.type === 'file.changed')).d.payload).toMatchObject({ path: 'src/app.ts', version: 2 });
    await sleep(50);
    expect(a.seen.some((m) => m.t === 'file.changed')).toBe(false);
  });

  it('same hash → ack with the same version, no new file_version', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    a.send(await update('u1', 'src/app.ts', 1, 'export const a = 1;\n'));
    expect((await a.byType('file.ack')).d.version).toBe(1);
    const n = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ n: number }>('SELECT count(*) AS n FROM file_version').one().n);
    expect(n).toBe(1);
  });

  it('pm update → file.rejected pm_readonly with the server copy', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const c = await hello(stub, t.C!, 'sync');
    c.send(await update('u1', 'src/app.ts', 1, 'hack'));
    const r = await c.byType('file.rejected');
    expect(r.d).toMatchObject({ id: 'u1', path: 'src/app.ts', reason: 'pm_readonly', server: { version: 1, content: 'export const a = 1;\n', deleted: false } });
  });

  it('too large, binary, wrong hash and outside-workspace paths are rejected', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    a.send(await update('big', 'big.txt', 0, 'x'.repeat(MAX_FILE_BYTES + 1)));
    expect((await a.byType('file.rejected')).d).toMatchObject({ id: 'big', reason: 'too_large' });
    a.send(await update('bin', 'bin.dat', 0, 'a\u0000b'));
    expect((await a.byType('file.rejected')).d).toMatchObject({ id: 'bin', reason: 'binary' });
    a.send({ t: 'file.update', id: 'h', d: { path: 'x.ts', baseVersion: 0, content: 'x', hash: 'f'.repeat(64), clientTs: 0 } });
    expect((await a.byType('file.rejected')).d).toMatchObject({ id: 'h', reason: 'conflict' });
    a.send(await update('esc', '../escape.ts', 0, 'x'));
    expect((await a.byType('file.rejected')).d).toMatchObject({ id: 'esc', reason: 'conflict' });
  });

  it('a stale baseVersion from another member loses: conflict with the server copy (SY-07)', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    const b = await hello(stub, t.B!, 'sync');
    a.send(await update('u1', 'src/app.ts', 1, 'A2'));
    await a.byType('file.ack');
    b.send(await update('u2', 'src/app.ts', 1, 'B2'));
    expect((await b.byType('file.rejected')).d).toMatchObject({ reason: 'conflict', server: { version: 2, content: 'A2' } });
  });

  it('versions are monotonic over 100 updates', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    for (let i = 0; i < 100; i++) a.send(await update(`u${i}`, 'src/app.ts', i + 1, `v${i}`));
    const versions: number[] = [];
    for (let i = 0; i < 100; i++) versions.push((await a.next((m) => m.t === 'file.ack' && m.d?.id === `u${i}`)).d.version);
    expect(versions).toEqual(Array.from({ length: 100 }, (_, i) => i + 2));
    const n = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ n: number }>("SELECT count(*) AS n FROM file_version WHERE path = 'src/app.ts'").one().n);
    expect(n).toBe(101);
  });

  it('an invalid message gets an error frame without closing the socket', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    a.send({ t: 'file.update', d: { path: 1 } });
    expect((await a.byType('error')).d).toMatchObject({ code: 'VALIDATION' });
    a.send('not json');
    expect((await a.byType('error')).d).toMatchObject({ code: 'BAD_REQUEST' });
    a.send(await update('ok', 'src/app.ts', 1, 'still open'));
    expect((await a.byType('file.ack')).d.version).toBe(2);
  });

  it('app clients are read-only: file.update is refused', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const app = await hello(stub, t.A!, 'app');
    app.send(await update('u', 'src/app.ts', 1, 'x'));
    expect((await app.byType('error')).d).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('file.applied records sync.applied', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const b = await hello(stub, t.B!, 'sync');
    const mc = await hello(stub, t.mc!, 'mc');
    b.send({ t: 'file.applied', d: { path: 'src/app.ts', version: 1, serverTs: 1000, appliedTs: 1150 } });
    const ev = await mc.next((m) => m.t === 'event' && m.d?.type === 'sync.applied');
    expect(ev.d.payload).toEqual({ path: 'src/app.ts', version: 1, memberId: 'B', latencyMs: 150 });
  });
});

describe('presence (R3 §3, R4 §7)', () => {
  it('online, reconnected (old socket closed 4000) and offline events', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const mc = await hello(stub, t.mc!, 'mc');
    const a1 = await hello(stub, t.A!, 'sync');
    expect((await mc.next((m) => m.t === 'event' && m.d?.type === 'member.online')).d.payload).toEqual({ memberId: 'A' });
    const a2 = await hello(stub, t.A!, 'sync');
    expect(await a1.closed).toBe(4000);
    expect((await mc.next((m) => m.t === 'event' && m.d?.type === 'member.reconnected')).d.payload).toEqual({ memberId: 'A' });
    await sleep(50);
    expect(mc.seen.some((m) => m.t === 'event' && m.d?.type === 'member.offline')).toBe(false);
    a2.ws.close(1000, 'bye');
    expect((await mc.next((m) => m.t === 'event' && m.d?.type === 'member.offline')).d.payload).toEqual({ memberId: 'A' });
    const online = await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec<{ online: number; last_heartbeat: number | null }>("SELECT online, last_heartbeat FROM member WHERE id = 'A'").one(),
    );
    expect(online.online).toBe(0);
    expect(online.last_heartbeat).toBeGreaterThan(0);
  });

  it('a sync socket and an app socket of the same member live side by side', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const s = await hello(stub, t.A!, 'sync');
    const app = await hello(stub, t.A!, 'app');
    await sleep(50);
    s.send({ t: 'heartbeat', d: { ts: 1 } });
    app.send(WS_PING_FRAME);
    await app.next((m) => m.raw === WS_PONG_FRAME);
    expect(s.seen.some((m) => m.t === 'error')).toBe(false);
  });

  it('heartbeat touches only the socket attachment, not SQL', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    const before = await runInDurableObject(stub, (_i, st) => st.storage.sql.databaseSize);
    a.send({ t: 'heartbeat', d: { ts: 1 } });
    await sleep(50);
    const att = await runInDurableObject(stub, (_i, st) => st.getWebSockets().map((w) => w.deserializeAttachment() as { lastHeartbeat?: number }));
    expect(att.some((x) => (x.lastHeartbeat ?? 0) > 0)).toBe(true);
    const hb = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ h: number | null }>("SELECT last_heartbeat AS h FROM member WHERE id = 'A'").one().h);
    expect(hb).toBeNull();
    expect(await runInDurableObject(stub, (_i, st) => st.storage.sql.databaseSize)).toBe(before);
  });
});

describe('hibernation (fase 03 step 11)', () => {
  it('after eviction the socket still knows its member', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    const b = await hello(stub, t.B!, 'sync');
    await evictDurableObject(stub);
    a.send(await update('u1', 'src/app.ts', 1, 'after eviction'));
    expect((await a.byType('file.ack')).d.version).toBe(2);
    expect((await b.byType('file.changed')).d).toMatchObject({ by: 'A', content: 'after eviction' });
    const s = await call(stub, 'GET', '/v1/state', { token: t.mc });
    expect(s.json.files[0]).toMatchObject({ version: 2, updatedBy: 'A' });
  });
});
