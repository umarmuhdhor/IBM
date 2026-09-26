// Test helpers shared by the server suites (and fase 04 sync integration tests).
// Every test talks to its own Durable Object (`t-<uuid>`): storage is only isolated per test file (D-007).
import { env } from 'cloudflare:workers';

export const ADMIN_SECRET = 'test';

export interface Ws {
  ws: WebSocket;
  /** Next message matching `match` (already received ones first). Rejects after 2 s. */
  next(match: (m: WsIn) => boolean): Promise<WsIn>;
  byType(t: string): Promise<WsIn>;
  send(msg: unknown): void;
  closed: Promise<number>;
  /** Messages received and not consumed by `next` yet. */
  seen: WsIn[];
}
export interface WsIn {
  t: string;
  id?: string;
  d?: any;
  raw: string;
}

export function freshWorkspace(): { id: string; stub: DurableObjectStub } {
  const id = `t-${crypto.randomUUID()}`;
  return { id, stub: env.WORKSPACE.getByName(id) };
}

export async function call(
  stub: { fetch: (input: string, init?: RequestInit) => Promise<Response> },
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {},
): Promise<{ status: number; json: any; text: string; headers: Headers }> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  let body: string | null = null;
  if (opts.raw !== undefined) body = opts.raw;
  else if (opts.body !== undefined) body = JSON.stringify(opts.body);
  if (body !== null) headers['content-type'] = 'application/json';
  const res = await stub.fetch(`http://radar.test${path}`, { method, headers, body });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.status, json, text, headers: res.headers };
}

export const admin = (stub: DurableObjectStub, method: string, path: string, body?: unknown, secret = ADMIN_SECRET) =>
  call(stub, method, path, { body, headers: { 'x-admin-secret': secret } });

export const DEFAULT_MEMBERS = [
  { id: 'A', role: 'coder', name: 'Andi', email: 'andi@example.com' },
  { id: 'B', role: 'coder', name: 'Budi', email: 'budi@example.com' },
  { id: 'C', role: 'pm', name: 'Citra', email: 'citra@example.com' },
] as const;

/** `/admin/init` + one `/admin/files` batch. Returns the tokens printed once by init. */
export async function seedTestWorkspace(
  stub: DurableObjectStub,
  files: { path: string; content: string }[] = [{ path: 'src/app.ts', content: 'export const a = 1;\n' }],
): Promise<Record<string, string>> {
  const init = await admin(stub, 'POST', '/admin/init', { workspace: 'toko-demo', repo: 'demo/toko-demo', branch: 'main', members: DEFAULT_MEMBERS });
  if (init.status !== 201) throw new Error(`init failed: ${init.status} ${init.text}`);
  if (files.length > 0) {
    const r = await admin(stub, 'POST', '/admin/files', { headCommit: 'abc1234', files });
    if (r.status !== 200) throw new Error(`files failed: ${r.status} ${r.text}`);
  }
  return init.json.tokens as Record<string, string>;
}

export async function connect(stub: DurableObjectStub): Promise<Ws> {
  const res = await stub.fetch('http://radar.test/ws', { headers: { Upgrade: 'websocket' } });
  const ws = res.webSocket;
  if (!ws) throw new Error(`no websocket: ${res.status}`);
  ws.accept();
  const seen: WsIn[] = [];
  const waiters: { match: (m: WsIn) => boolean; resolve: (m: WsIn) => void }[] = [];
  ws.addEventListener('message', (e) => {
    const raw = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as ArrayBuffer);
    const msg: WsIn = raw.startsWith('{') ? { ...(JSON.parse(raw) as { t: string }), raw } : { t: raw, raw };
    const i = waiters.findIndex((w) => w.match(msg));
    if (i >= 0) waiters.splice(i, 1)[0]!.resolve(msg);
    else seen.push(msg);
  });
  const closed = new Promise<number>((resolve) => ws.addEventListener('close', (e) => resolve(e.code)));
  const next = (match: (m: WsIn) => boolean) =>
    new Promise<WsIn>((resolve, reject) => {
      const i = seen.findIndex(match);
      if (i >= 0) return resolve(seen.splice(i, 1)[0]!);
      const timer = setTimeout(() => reject(new Error('timeout waiting for ws message')), 2000);
      waiters.push({ match, resolve: (m) => (clearTimeout(timer), resolve(m)) });
    });
  return {
    ws,
    next,
    byType: (t) => next((m) => m.t === t),
    send: (msg) => ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)),
    closed,
    seen,
  };
}

/** Connect and complete `hello`; resolves with the socket after `welcome`. */
export async function hello(stub: DurableObjectStub, token: string, client: 'sync' | 'mc' | 'app', knownVersions?: Record<string, number>): Promise<Ws> {
  const c = await connect(stub);
  c.send({ t: 'hello', d: { token, client, clientVersion: 'test', ...(knownVersions ? { knownVersions } : {}) } });
  await c.byType('welcome');
  return c;
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
