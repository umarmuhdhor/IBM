import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { sha256Hex, StateRes, WS_PING_FRAME, WS_PONG_FRAME } from '../packages/common/src/index.js';
import { startMockServer, type MockServer } from './mock-server.js';

let mock: MockServer | undefined;
afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

const start = async (opts: Parameters<typeof startMockServer>[0] = {}) => {
  mock = await startMockServer({ port: 0, ...opts });
  return mock;
};

async function call(m: MockServer, method: string, path: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`http://127.0.0.1:${m.port}${path}`, {
    method,
    headers,
    body: body === undefined ? null : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : undefined };
}

/** Collects every JSON message of one socket; `next(t)` waits for the next message of type t. */
function client(m: MockServer) {
  const ws = new WebSocket(`ws://127.0.0.1:${m.port}/ws`);
  const seen: { t: string; d?: unknown; raw: string }[] = [];
  const waiters: { match: (x: { t: string; raw: string }) => boolean; resolve: (x: { t: string; d?: unknown; raw: string }) => void }[] = [];
  ws.on('message', (data) => {
    const raw = data.toString();
    const msg = raw.startsWith('{') ? { ...(JSON.parse(raw) as { t: string; d?: unknown }), raw } : { t: raw, raw };
    const w = waiters.findIndex((x) => x.match(msg));
    if (w >= 0) waiters.splice(w, 1)[0]!.resolve(msg);
    else seen.push(msg);
  });
  const next = (match: (x: { t: string; raw: string }) => boolean) =>
    new Promise<{ t: string; d?: unknown; raw: string }>((resolve, reject) => {
      const i = seen.findIndex(match);
      if (i >= 0) return resolve(seen.splice(i, 1)[0]!);
      const timer = setTimeout(() => reject(new Error('timeout waiting for ws message')), 2000);
      waiters.push({ match, resolve: (x) => (clearTimeout(timer), resolve(x)) });
    });
  const opened = new Promise<void>((resolve) => ws.on('open', () => resolve()));
  const closed = new Promise<number>((resolve) => ws.on('close', (code) => resolve(code)));
  const send = (msg: unknown) => ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  const hello = async (token: string, kind: 'sync' | 'mc' | 'app') => {
    await opened;
    send({ t: 'hello', d: { token, client: kind, clientVersion: 'test' } });
    return next((x) => x.t === 'welcome');
  };
  return { ws, next, send, hello, opened, closed, byType: (t: string) => next((x) => x.t === t) };
}

describe('mock REST (R3 §2, fase 02 Verifikasi)', () => {
  it('reproduces the PRD block for B on checkout.ts after the demo scenario', async () => {
    const m = await start({ instant: true });
    const r = await call(m, 'POST', '/v1/locks/check', 'tok-b', { paths: ['src/checkout/checkout.ts'], tool: 'apply_diff', clientTs: 0 });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ decision: 'block', activeTaskId: 'T-2', results: [{ reason: 'held_by_other', queuePos: 1 }] });
  });

  it('enforces the authorization matrix', async () => {
    const m = await start({ instant: true });
    expect((await call(m, 'POST', '/v1/proposals/P-2/decision', 'tok-c', { approve: true })).status).toBe(403);
    expect((await call(m, 'GET', '/v1/state')).status).toBe(401);
    expect((await call(m, 'GET', '/v1/team', 'tok-a')).status).toBe(403);
    expect((await call(m, 'POST', '/v1/bob/activity', 'mc-dev', { kind: 'turn.end', sessionId: null, mode: 'coder' })).status).toBe(403);
    expect((await call(m, 'GET', '/healthz')).status).toBe(200);
  });

  it('bob/activity answers 204 and records the event', async () => {
    const m = await start({ scenario: 'none' });
    const r = await call(m, 'POST', '/v1/bob/activity', 'tok-a', { kind: 'turn.end', sessionId: 's1', mode: 'coder' });
    expect(r.status).toBe(204);
    expect(m.hub.events.at(-1)).toMatchObject({ type: 'bob.activity', payload: { memberId: 'A', kind: 'turn.end' } });
    expect((await call(m, 'POST', '/v1/bob/activity', 'tok-a', { kind: 'tool.pre', sessionId: null, mode: 'coder' })).status).toBe(422);
  });

  it('free file: grabbed, then own; a second coder is blocked with one deduplicated request', async () => {
    const m = await start({ scenario: 'none' });
    const check = (tok: string) => call(m, 'POST', '/v1/locks/check', tok, { paths: ['src/a.ts'], tool: 'write_file', clientTs: 0 });
    expect((await check('tok-a')).json).toMatchObject({ decision: 'allow', results: [{ reason: 'grabbed' }] });
    expect((await check('tok-a')).json).toMatchObject({ results: [{ reason: 'own' }] });
    const b1 = await check('tok-b');
    const b2 = await check('tok-b');
    expect(b1.json).toMatchObject({ decision: 'block', results: [{ reason: 'held_by_other' }] });
    const id = (x: typeof b1) => (x.json!.results as { requestId: string }[])[0]!.requestId;
    expect(id(b2)).toBe(id(b1));
    expect((await check('tok-c')).json).toMatchObject({ results: [{ reason: 'pm_readonly' }] });
    const ignored = await call(m, 'POST', '/v1/locks/check', 'tok-b', { paths: ['node_modules/x.js'], tool: 'write_file', clientTs: 0 });
    expect(ignored.json).toMatchObject({ decision: 'allow', results: [{ reason: 'ignored_path' }] });
  });

  it('paths outside the workspace are rejected cleanly, not with a 500', async () => {
    const m = await start({ scenario: 'none', adminSecret: 's3' });
    expect((await call(m, 'POST', '/v1/requests', 'tok-a', { path: '../secret.ts', reason: 'x' })).status).toBe(422);
    const files = await fetch(`http://127.0.0.1:${m.port}/admin/files`, {
      method: 'POST',
      headers: { 'x-admin-secret': 's3', 'content-type': 'application/json' },
      body: JSON.stringify({ headCommit: null, files: [{ path: '/etc/passwd', content: 'x' }, { path: 'src/ok.ts', content: 'y' }] }),
    });
    expect(await files.json()).toEqual({ inserted: 1, headCommit: null });
  });

  it('plan → approve → reserved locks; decision antre is applied automatically', async () => {
    const m = await start({ scenario: 'none' });
    const plan = {
      kind: 'plan',
      reason: 'r',
      payload: { goal: 'g', tasks: [{ ref: 'a', title: 'Kupon', ownerId: 'A', files: ['src/c.ts'] }, { ref: 'b', title: 'Tema', ownerId: 'B', files: ['src/t.css'] }] },
    };
    const created = await call(m, 'POST', '/v1/proposals', 'tok-c', plan);
    expect(created).toMatchObject({ status: 201, json: { proposalId: 'P-1', status: 'menunggu' } });
    expect((await call(m, 'POST', '/v1/proposals/P-1/decision', 'mc-dev', { approve: true })).json).toMatchObject({ status: 'disetujui' });
    expect(m.hub.state.locks['src/c.ts']).toMatchObject({ taskId: 'T-0', state: 'dipesan' });

    await call(m, 'POST', '/v1/locks/check', 'tok-b', { paths: ['src/c.ts'], tool: 'apply_diff', clientTs: 0 });
    const req = await call(m, 'GET', '/v1/requests', 'tok-c');
    const requestId = (req.json!.requests as { id: string }[])[0]!.id;
    const decision = await call(m, 'POST', '/v1/proposals', 'tok-c', { kind: 'decision', reason: 'r', payload: { requestId, option: 'antre' } });
    expect(decision.json).toMatchObject({ status: 'diterapkan_otomatis' });
    expect(m.hub.state.locks['src/c.ts']?.queue).toEqual(['T-1']);
    expect(m.hub.state.requests[requestId]).toMatchObject({ status: 'diputuskan', outcome: 'antre' });
  });

  it('admin init + files seed a workspace behind x-admin-secret', async () => {
    const m = await start({ scenario: 'none', adminSecret: 's3' });
    expect((await call(m, 'POST', '/admin/init', undefined, { workspace: 'w', members: [{ id: 'A', role: 'coder' }] })).status).toBe(401);
    const res = await fetch(`http://127.0.0.1:${m.port}/admin/init`, {
      method: 'POST',
      headers: { 'x-admin-secret': 's3', 'content-type': 'application/json' },
      body: JSON.stringify({ workspace: 'w', force: true, members: [{ id: 'A', role: 'coder', name: 'Andi' }] }),
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ workspace: 'w', tokens: { A: 'tok-a', mc: 'mc-dev' } });
    const files = await fetch(`http://127.0.0.1:${m.port}/admin/files`, {
      method: 'POST',
      headers: { 'x-admin-secret': 's3', 'content-type': 'application/json' },
      body: JSON.stringify({ headCommit: 'abc', files: [{ path: 'src/a.ts', content: 'x' }, { path: 'node_modules/y.js', content: 'y' }] }),
    });
    expect(await files.json()).toEqual({ inserted: 1, headCommit: 'abc' });
    expect(m.hub.state.files['src/a.ts']?.version).toBe(1);
  });
});

describe('mock WebSocket (R3 §3)', () => {
  it('answers the ping frame with the pong frame', async () => {
    const m = await start({ scenario: 'none' });
    const c = client(m);
    await c.hello('tok-a', 'app');
    c.send(WS_PING_FRAME);
    expect((await c.next((x) => x.raw === WS_PONG_FRAME)).raw).toBe('{"t":"pong"}');
  });

  it('closes with 4401 for a wrong token', async () => {
    const m = await start({ scenario: 'none' });
    const c = client(m);
    await c.opened;
    c.send({ t: 'hello', d: { token: 'nope', client: 'app', clientVersion: 't' } });
    expect(await c.closed).toBe(4401);
  });

  it('client app gets welcome + a valid state, then events', async () => {
    const m = await start({ scenario: 'none' });
    const c = client(m);
    await c.hello('tok-a', 'app');
    const state = await c.byType('state');
    expect(StateRes.safeParse(state.d).success).toBe(true);
    await call(m, 'POST', '/v1/bob/activity', 'tok-a', { kind: 'prompt', sessionId: 's', mode: 'coder', text: 'halo' });
    const ev = await c.next((x) => x.t === 'event' && (x as { d?: { type?: string } }).d?.type === 'bob.activity');
    expect(ev.d).toMatchObject({ payload: { memberId: 'A', kind: 'prompt', text: 'halo' } });
  });

  it('sync file.update → ack for the sender, file.changed for the other sync client', async () => {
    const m = await start({ scenario: 'none' });
    const a = client(m);
    const b = client(m);
    await a.hello('tok-a', 'sync');
    await b.hello('tok-b', 'sync');
    await a.byType('snapshot');
    const content = 'export const x = 1;\n';
    a.send({ t: 'file.update', id: 'u1', d: { path: 'src/x.ts', baseVersion: 0, content, hash: await sha256Hex(content), clientTs: 0 } });
    expect((await a.byType('file.ack')).d).toMatchObject({ path: 'src/x.ts', version: 1 });
    expect((await b.byType('file.changed')).d).toMatchObject({ path: 'src/x.ts', version: 1, content, by: 'A' });

    b.send({ t: 'file.update', id: 'u2', d: { path: 'src/x.ts', baseVersion: 1, content: 'y', hash: await sha256Hex('y'), clientTs: 0 } });
    expect((await b.byType('file.rejected')).d).toMatchObject({ reason: 'held_by_other', server: { version: 1, content } });

    a.send({ t: 'file.update', id: 'u3', d: { path: '../escape.ts', baseVersion: 0, content: 'z', hash: await sha256Hex('z'), clientTs: 0 } });
    expect((await a.byType('file.rejected')).d).toMatchObject({ path: '../escape.ts', reason: 'conflict' });
  });

  it('plays the demo scenario once the first mc client connects', async () => {
    const m = await start({ scenario: 'demo', speed: 0 });
    const before = m.hub.state.cursor;
    const c = client(m);
    await c.hello('mc-dev', 'mc');
    await c.next((x) => x.t === 'event' && (x as { d?: { type?: string } }).d?.type === 'bob.activity');
    await new Promise((r) => setTimeout(r, 50));
    expect(m.hub.state.cursor).toBeGreaterThan(before);
    expect(m.hub.state.tasks['T-1']?.status).toBe('dikerjakan');
  });
});
