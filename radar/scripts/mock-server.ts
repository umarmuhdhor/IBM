// Radar dev mock (fase 02 step 13): every R3 REST endpoint + the /ws hub, in memory, on port 8787.
// Lets the Bob kit (fase 07), the desktop app (fase 09/11) and the replay (fase 11D) run before the
// Cloudflare server exists. NOT the product server; fase 03 must not build on this file.
//
//   pnpm -C radar dev:mock                       # --scenario demo: replay the PRD §15 flow once mc/app connects
//   pnpm -C radar dev:mock -- --scenario none    # empty workspace with members A, B, C (hook tests)
//   pnpm -C radar dev:mock -- --instant          # apply the whole demo scenario at boot, no delays
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import {
  ActivityQuery,
  AiEditsReq,
  BobActivityReq,
  BriefQuery,
  CoreWsMessageSchema,
  DecisionReq,
  LockCheckReq,
  NotifyReq,
  ProposalCreateReq,
  ProposalsQuery,
  RequestFileReq,
  RequestsQuery,
  RevokeReq,
  SubmitReq,
  TasksQuery,
  WS_CLOSE_UNAUTHORIZED,
  WS_HELLO_TIMEOUT_MS,
  WS_PING_FRAME,
  WS_PONG_FRAME,
  type Principal,
  type RadarEvent,
  type Role,
  type WsMessage,
} from '../packages/common/src/index.js';
import { DEV_TOKENS, HttpError, MockHub, type MemberPrincipal } from './mock/hub.js';

type Who = 'coder' | 'pm' | 'mc';
type ZodLike<T> = { safeParse(v: unknown): { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } };

export interface ScenarioStep {
  delayMs: number;
  actor: string;
  type: string;
  payload: unknown;
}

export interface MockOptions {
  port?: number;
  scenario?: 'demo' | 'none';
  /** Apply the whole scenario at boot instead of playing it when the first mc/app client connects. */
  instant?: boolean;
  /** Multiplies scenario delays (0.1 = ten times faster). */
  speed?: number;
  adminSecret?: string;
  log?: (line: string) => void;
}

export interface MockServer {
  port: number;
  hub: MockHub;
  close(): Promise<void>;
}

const SCENARIO_DIR = fileURLToPath(new URL('./mock-scenarios/', import.meta.url));

const isStep = (x: unknown): x is ScenarioStep => {
  const s = x as Partial<ScenarioStep> | null;
  return typeof s === 'object' && s !== null && typeof s.delayMs === 'number' && typeof s.actor === 'string' && typeof s.type === 'string';
};

/** Shape check only; each payload is validated against the event schema when it is emitted. */
export function loadScenario(name: string): ScenarioStep[] {
  const file = `${SCENARIO_DIR}${name}.json`;
  const steps = (JSON.parse(readFileSync(file, 'utf8')) as { steps?: unknown } | null)?.steps;
  if (!Array.isArray(steps)) throw new Error(`${file}: expected { steps: [...] }`);
  const bad = steps.findIndex((s) => !isStep(s));
  if (bad >= 0) throw new Error(`${file}: steps[${bad}] needs delayMs, actor and type`);
  return steps as ScenarioStep[];
}

const errorBody = (code: string, message: string) => ({ error: { code, message } });

function whoOf(p: Principal): Who {
  return p.kind === 'mc' ? 'mc' : p.role;
}

function parse<T>(schema: ZodLike<T>, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new HttpError(422, 'VALIDATION', r.error.issues.map((i) => `${i.path.map(String).join('.') || '(root)'}: ${i.message}`).join('; '));
  }
  return r.data;
}

async function body(c: Context): Promise<unknown> {
  const text = await c.req.text();
  if (text === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, 'BAD_REQUEST', 'JSON rusak');
  }
}

// ---- WebSocket hub ---------------------------------------------------------------------------------------------

interface Conn {
  ws: WebSocket;
  state: 'pending' | 'ready';
  principal?: Principal;
  client?: 'sync' | 'mc' | 'app';
}

class WsHub {
  readonly conns = new Set<Conn>();
  private onFirstViewer: (() => void) | null;

  constructor(
    private readonly hub: MockHub,
    onFirstViewer: () => void,
  ) {
    this.onFirstViewer = onFirstViewer;
    hub.onEvent((ev) => this.onEvent(ev));
  }

  private send(c: Conn, msg: WsMessage | { t: string; id?: string; d: unknown }): void {
    if (c.ws.readyState === c.ws.OPEN) c.ws.send(JSON.stringify(msg));
  }

  private viewers(): Conn[] {
    return [...this.conns].filter((c) => c.state === 'ready' && (c.client === 'mc' || c.client === 'app'));
  }

  private onEvent(ev: RadarEvent): void {
    for (const c of this.viewers()) this.send(c, { t: 'event', d: ev });
    if (ev.type.startsWith('lock.') && ev.type !== 'lock.blocked' && 'path' in ev.payload) {
      const path = ev.payload.path;
      const lock = this.hub.state.locks[path];
      const d = lock
        ? { path, state: lock.state, taskId: lock.taskId, memberId: lock.memberId, queue: lock.queue }
        : { path, state: 'bebas' as const, taskId: null, memberId: null, queue: [] };
      for (const c of this.conns) if (c.state === 'ready') this.send(c, { t: 'lock.changed', d });
    }
    if (ev.type === 'proposal.created' || ev.type === 'proposal.decided') {
      const prop = this.hub.state.proposals[ev.payload.proposalId];
      if (prop) {
        const t = ev.type === 'proposal.created' ? 'proposal.new' : 'proposal.decided';
        for (const c of this.viewers()) if (c.client === 'mc') this.send(c, { t, d: { proposal: this.hub.proposalItem(prop) } });
      }
    }
  }

  accept(ws: WebSocket): void {
    const conn: Conn = { ws, state: 'pending' };
    this.conns.add(conn);
    const timer = setTimeout(() => {
      if (conn.state === 'pending') ws.close(WS_CLOSE_UNAUTHORIZED, 'hello timeout');
    }, WS_HELLO_TIMEOUT_MS);
    ws.on('message', (data: RawData) => {
      this.onMessage(conn, data.toString()).catch((err: unknown) => {
        this.send(conn, { t: 'error', d: { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) } });
      });
    });
    ws.on('close', () => {
      clearTimeout(timer);
      this.conns.delete(conn);
      const p = conn.principal;
      if (conn.client === 'sync' && p?.kind === 'member' && ![...this.conns].some((c) => c.client === 'sync' && c.principal === p)) {
        this.hub.emit(p.memberId, 'member.offline', { memberId: p.memberId });
      }
    });
  }

  private reject(conn: Conn, code: string, message: string): void {
    this.send(conn, { t: 'error', d: { code, message } });
    conn.ws.close(WS_CLOSE_UNAUTHORIZED, message);
  }

  private async onMessage(conn: Conn, raw: string): Promise<void> {
    if (raw === WS_PING_FRAME) {
      conn.ws.send(WS_PONG_FRAME);
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      this.send(conn, { t: 'error', d: { code: 'BAD_REQUEST', message: 'JSON rusak' } });
      return;
    }
    const parsed = CoreWsMessageSchema.safeParse(json);
    if (!parsed.success) {
      if (conn.state === 'pending') return this.reject(conn, 'UNAUTHORIZED', 'hello wajib dikirim lebih dulu');
      // term.* (P1) and unknown messages are ignored by the mock.
      return;
    }
    const msg = parsed.data;
    if (conn.state === 'pending') {
      if (msg.t !== 'hello') return this.reject(conn, 'UNAUTHORIZED', 'hello wajib dikirim lebih dulu');
      return this.hello(conn, msg.d);
    }
    const p = conn.principal;
    if (conn.client !== 'sync' || p?.kind !== 'member') return;
    switch (msg.t) {
      case 'file.update': {
        const r = await this.hub.applyUpdate(p, msg.d);
        if (!r.ok) {
          const cur = this.hub.state.files[msg.d.path];
          const f = this.hub.files.get(msg.d.path);
          this.send(conn, {
            t: 'file.rejected',
            d: {
              id: msg.id,
              path: msg.d.path,
              reason: r.reason,
              holder: r.holder ?? null,
              server: { version: cur?.version ?? 0, hash: f?.hash ?? null, content: f?.content ?? null, deleted: cur?.deleted ?? false },
            },
          });
          return;
        }
        this.send(conn, { t: 'file.ack', id: msg.id, d: { id: msg.id, path: msg.d.path, version: r.version, hash: r.hash } });
        if (r.changed) {
          const d = {
            path: msg.d.path,
            version: r.version,
            content: msg.d.content,
            hash: r.hash,
            deleted: false,
            by: p.memberId,
            taskId: r.taskId,
            serverTs: Date.now(),
          };
          for (const c of this.conns) if (c !== conn && c.state === 'ready' && c.client === 'sync') this.send(c, { t: 'file.changed', d });
        }
        return;
      }
      case 'heartbeat':
        this.hub.heartbeat(p.memberId);
        return;
      default:
        // file.delete / file.applied are P1 for the mock.
        return;
    }
  }

  private hello(conn: Conn, d: Extract<WsMessage, { t: 'hello' }>['d']): void {
    const principal = this.hub.principal(`Bearer ${d.token}`);
    if (!principal) return this.reject(conn, 'UNAUTHORIZED', 'token salah');
    if (d.client === 'sync' && principal.kind !== 'member') return this.reject(conn, 'FORBIDDEN', 'sync butuh token member');
    if (d.client === 'mc' && principal.kind !== 'mc') return this.reject(conn, 'FORBIDDEN', 'client mc butuh token mc');
    conn.state = 'ready';
    conn.principal = principal;
    conn.client = d.client;
    this.send(conn, { t: 'welcome', d: { principal, serverTime: Date.now(), workspace: this.hub.state.workspace.id } });

    if (d.client === 'sync' && principal.kind === 'member') {
      const known = d.knownVersions ?? {};
      const files = Object.values(this.hub.state.files)
        .filter((f) => known[f.path] !== f.version)
        .map((f) => {
          const rec = this.hub.files.get(f.path);
          return { path: f.path, version: f.version, hash: rec?.hash ?? null, content: rec?.content ?? null, deleted: f.deleted };
        });
      this.send(conn, { t: 'snapshot', d: { files, locks: Object.values(this.hub.state.locks), cursor: this.hub.state.cursor } });
      let replaced = false;
      for (const c of this.conns) {
        if (c !== conn && c.client === 'sync' && c.principal?.kind === 'member' && c.principal.memberId === principal.memberId) {
          replaced = true;
          c.ws.close(4000, 'replaced');
          this.conns.delete(c);
        }
      }
      this.hub.emit(principal.memberId, replaced ? 'member.reconnected' : 'member.online', { memberId: principal.memberId });
      this.hub.heartbeat(principal.memberId);
      return;
    }

    this.send(conn, { t: 'state', d: this.hub.snapshot() });
    if (this.onFirstViewer) {
      const start = this.onFirstViewer;
      this.onFirstViewer = null;
      start();
    }
  }
}

// ---- REST ------------------------------------------------------------------------------------------------------

function createApp(hub: MockHub, adminSecret: string): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json(errorBody(err.code, err.message), err.status as 400);
    return c.json(errorBody('INTERNAL', err instanceof Error ? err.message : 'error'), 500);
  });
  app.notFound((c) => c.json(errorBody('NOT_FOUND', `${c.req.method} ${c.req.path} tidak ada`), 404));

  const auth = (c: Context, allowed: readonly Who[]): Principal => {
    const p = hub.principal(c.req.header('authorization'));
    if (!p) throw new HttpError(401, 'UNAUTHORIZED', 'token hilang atau salah');
    if (!allowed.includes(whoOf(p))) {
      const msg = allowed.length === 1 && allowed[0] === 'mc' ? 'Hanya Mission Control yang dapat memutuskan.' : 'Role tidak berhak.';
      throw new HttpError(403, 'FORBIDDEN', msg);
    }
    return p;
  };
  const member = (c: Context, allowed: readonly Role[]): MemberPrincipal => auth(c, allowed) as MemberPrincipal;
  const actorOf = (p: Principal) => (p.kind === 'mc' ? 'mc' : p.memberId);

  app.get('/healthz', (c) => c.json(hub.health()));

  app.post('/v1/locks/check', async (c) => {
    const p = member(c, ['coder', 'pm']);
    const req = parse(LockCheckReq, await body(c));
    return c.json(hub.locksCheck(p, req.paths));
  });

  app.get('/v1/brief', (c) => {
    const p = member(c, ['coder', 'pm']);
    const q = parse(BriefQuery, c.req.query());
    return c.json(hub.brief(p, q.kind, q.since));
  });

  app.get('/v1/tasks', (c) => {
    const p = member(c, ['coder']);
    const q = parse(TasksQuery, c.req.query());
    return c.json(hub.tasks(p, q.owner, q.status));
  });

  app.post('/v1/tasks/:id/activate', (c) => c.json(hub.activate(member(c, ['coder']), c.req.param('id'))));

  app.get('/v1/blocks/last', (c) => c.json(hub.blocksLast(member(c, ['coder']))));

  app.post('/v1/requests', async (c) => {
    const p = member(c, ['coder']);
    const req = parse(RequestFileReq, await body(c));
    const r = hub.requestFile(p, req.path, req.reason);
    return c.json(r.body, r.status as 200);
  });

  app.get('/v1/activity', (c) => {
    member(c, ['coder', 'pm']);
    const q = parse(ActivityQuery, c.req.query());
    return c.json(hub.activity(q.path, q.limit));
  });

  app.post('/v1/tasks/:id/submit', async (c) => {
    const p = member(c, ['coder']);
    const req = parse(SubmitReq, await body(c));
    return c.json(hub.submit(p, c.req.param('id'), req.summary));
  });

  app.get('/v1/team', (c) => {
    auth(c, ['pm', 'mc']);
    return c.json(hub.team());
  });

  app.get('/v1/requests', (c) => {
    auth(c, ['pm', 'mc']);
    return c.json(hub.requests(parse(RequestsQuery, c.req.query()).status));
  });

  app.post('/v1/proposals', async (c) => {
    const p = auth(c, ['pm']);
    const req = parse(ProposalCreateReq, await body(c));
    return c.json(hub.createProposal(actorOf(p), req), 201);
  });

  app.get('/v1/proposals', (c) => {
    auth(c, ['pm', 'mc']);
    return c.json(hub.proposals(parse(ProposalsQuery, c.req.query()).status));
  });

  app.post('/v1/proposals/:id/decision', async (c) => {
    auth(c, ['mc']);
    const req = parse(DecisionReq, await body(c));
    return c.json(hub.decide(c.req.param('id'), req.approve, req.note));
  });

  app.get('/v1/tasks/:id/diff', (c) => {
    auth(c, ['pm', 'mc']);
    return c.json(hub.taskDiff(c.req.param('id')));
  });

  app.post('/v1/notify', async (c) => {
    const p = auth(c, ['pm']);
    const req = parse(NotifyReq, await body(c));
    return c.json(hub.notify(actorOf(p), req.memberId, req.message), 201);
  });

  app.get('/v1/report/session', (c) => {
    auth(c, ['pm', 'mc']);
    return c.json(hub.sessionReport());
  });

  app.post('/v1/locks/revoke', async (c) => {
    auth(c, ['mc']);
    const req = parse(RevokeReq, await body(c));
    return c.json(hub.revoke(req.path, req.reason));
  });

  app.post('/v1/tasks/:id/cancel', (c) => {
    auth(c, ['mc']);
    return c.json(hub.cancel(c.req.param('id')));
  });

  app.post('/v1/ai-edits', async (c) => {
    const p = member(c, ['coder']);
    const req = parse(AiEditsReq, await body(c));
    hub.aiEdits(p, req.paths, req.tool);
    return c.body(null, 204);
  });

  app.get('/v1/state', (c) => {
    auth(c, ['coder', 'pm', 'mc']);
    return c.json(hub.snapshot());
  });

  app.get('/v1/files/history', (c) => {
    auth(c, ['coder', 'pm', 'mc']);
    const path = c.req.query('path');
    if (!path) throw new HttpError(422, 'VALIDATION', 'path wajib');
    const limit = Number(c.req.query('limit') ?? 5);
    return c.json(hub.fileHistory(path, Number.isFinite(limit) && limit > 0 ? limit : 5));
  });

  app.get('/v1/events/export', (c) => {
    auth(c, ['coder', 'pm', 'mc']);
    const from = Number(c.req.query('from') ?? 0);
    const to = Number(c.req.query('to') ?? Number.MAX_SAFE_INTEGER);
    return c.json(hub.exportEvents(from, to));
  });

  app.post('/v1/bob/activity', async (c) => {
    const p = member(c, ['coder', 'pm']);
    const req = parse(BobActivityReq, await body(c));
    hub.bobActivity(p, req);
    return c.body(null, 204);
  });

  // ---- admin (same shape as fase 03 step 8, in memory) ----------------------------------------------------------

  const admin = (c: Context) => {
    if (c.req.header('x-admin-secret') !== adminSecret) throw new HttpError(401, 'UNAUTHORIZED', 'admin secret salah');
  };

  app.post('/admin/init', async (c) => {
    admin(c);
    const b = (await body(c)) as {
      workspace?: string;
      members?: { id: string; role: Role; name?: string }[];
      force?: boolean;
    };
    if (!b.workspace || !Array.isArray(b.members) || b.members.length === 0) throw new HttpError(422, 'VALIDATION', 'workspace dan members wajib');
    if (hub.events.length > 0 && !b.force) throw new HttpError(409, 'CONFLICT', 'workspace sudah ada; kirim force:true');
    hub.reset();
    hub.tokens.clear();
    const tokens: Record<string, string> = {};
    for (const m of b.members) {
      const tok = `tok-${m.id.toLowerCase()}`;
      hub.tokens.set(tok, { kind: 'member', memberId: m.id, role: m.role });
      tokens[m.id] = tok;
    }
    hub.tokens.set('mc-dev', { kind: 'mc' });
    tokens.mc = 'mc-dev';
    hub.seed(b.workspace, b.members.map((m) => ({ id: m.id, name: m.name ?? m.id, role: m.role })));
    return c.json({ workspace: b.workspace, tokens }, 201);
  });

  app.post('/admin/files', async (c) => {
    admin(c);
    const b = (await body(c)) as { headCommit?: string | null; files?: { path: string; content: string }[] };
    if (!Array.isArray(b.files)) throw new HttpError(422, 'VALIDATION', 'files wajib');
    if (b.files.length > 100) throw new HttpError(422, 'VALIDATION', 'maks 100 file per batch');
    const bytes = b.files.reduce((n, f) => n + new TextEncoder().encode(f.content ?? '').byteLength, 0);
    if (bytes > 4 * 1024 * 1024) throw new HttpError(422, 'VALIDATION', 'maks 4 MB per batch');
    const inserted = await hub.importFiles(b.headCommit ?? null, b.files);
    return c.json({ inserted, headCommit: hub.state.workspace.headCommit });
  });

  return app;
}

// ---- bootstrap -------------------------------------------------------------------------------------------------

export async function startMockServer(opts: MockOptions = {}): Promise<MockServer> {
  const log = opts.log ?? (() => {});
  const hub = new MockHub();
  const scenario = opts.scenario ?? 'demo';
  const speed = opts.speed ?? 1;
  const timers = new Set<NodeJS.Timeout>();

  let pending: ScenarioStep[] = [];
  if (scenario === 'demo') {
    const steps = loadScenario('demo');
    // Zero-delay steps at the head (workspace + members) are applied at boot so REST works right away.
    let i = 0;
    while (i < steps.length && (opts.instant || steps[i]!.delayMs === 0)) {
      const s = steps[i]!;
      hub.emitRaw(s.actor, s.type, s.payload);
      i++;
    }
    pending = steps.slice(i);
  } else {
    hub.seed();
  }

  const play = () => {
    if (pending.length === 0) return;
    log(`[mock] memutar skenario demo (${pending.length} event)`);
    let at = 0;
    for (const s of pending) {
      at += s.delayMs * speed;
      const t = setTimeout(() => {
        timers.delete(t);
        hub.emitRaw(s.actor, s.type, s.payload);
      }, at);
      timers.add(t);
    }
    pending = [];
  };

  const app = createApp(hub, opts.adminSecret ?? 'dev-admin');
  const wsHub = new WsHub(hub, play);
  const wss = new WebSocketServer({ noServer: true });

  const server = await new Promise<Server>((resolve) => {
    const s = serve({ fetch: app.fetch, port: opts.port ?? 8787 }, () => resolve(s as Server)) as Server;
  });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wsHub.accept(ws));
  });

  const port = (server.address() as AddressInfo).port;
  return {
    port,
    hub,
    close: () =>
      new Promise<void>((resolve) => {
        for (const t of timers) clearTimeout(t);
        for (const c of wsHub.conns) c.ws.terminate();
        wss.close();
        server.close(() => resolve());
      }),
  };
}

function parseArgs(argv: readonly string[]): MockOptions {
  const opts: MockOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i] ?? '';
    if (a === '--scenario') {
      const v = next();
      if (v !== 'demo' && v !== 'none') throw new Error(`--scenario harus demo atau none, bukan ${v}`);
      opts.scenario = v;
    } else if (a === '--port') opts.port = Number(next());
    else if (a === '--speed') opts.speed = Number(next());
    else if (a === '--instant') opts.instant = true;
    else if (a !== '--') throw new Error(`argumen tidak dikenal: ${a}`);
  }
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv.slice(2));
  const adminSecret = process.env.ADMIN_SECRET ?? 'dev-admin';
  const mock = await startMockServer({ ...opts, adminSecret, log: (l) => console.log(l) });
  const rows = Object.entries(DEV_TOKENS)
    .map(([tok, p]) => `    ${p.kind === 'mc' ? 'mc' : `${p.memberId} (${p.role})`}`.padEnd(16) + tok)
    .join('\n');
  console.log(
    [
      `Radar MOCK server (bukan server produk) di http://localhost:${mock.port}  ·  ws://localhost:${mock.port}/ws`,
      `  skenario: ${opts.scenario ?? 'demo'}${opts.instant ? ' (instan)' : ' (diputar saat klien mc/app pertama terhubung)'}`,
      '  token dev (hanya untuk mock):',
      rows,
      `  admin: header x-admin-secret (default "dev-admin", atau env ADMIN_SECRET)`,
    ].join('\n'),
  );
  const stop = () => {
    void mock.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
