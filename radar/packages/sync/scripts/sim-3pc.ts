// Fase 10 (lane Core): `pnpm -C radar sim [-- --server <url|local>] [--until plan|live|block|decision|review] [--runs N] [--writes N]`
// End-to-end demo story (PRD §15) without Bob: three real SyncAgents (A, B, C) against a real Worker,
// the real bundled `lock_guard` hook for the block step, and a raw WebSocket for the layer-2 rejection.
// Local mode boots the Worker with wrangler's createTestHarness and GITHUB_COMMIT=false (the commit is
// recorded as local-<hash>, GitHub is never called). Remote mode runs against a URL with tokens from
// RADAR_TOKEN_A / RADAR_TOKEN_B / RADAR_TOKEN_C / RADAR_TOKEN_MC and a pre-reset scratch workspace:
// it runs `admin init --force`, so NEVER point it at production during the milestone window.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { WebSocket } from 'ws';
import { createTestHarness } from 'wrangler';
import { SyncAgent } from '../src/agent.js';
import { bundleHooks, makeWorkspace, prePayload, runHook, type HookName } from '../../hooks/test/helpers.js';
import {
  CHECKOUT,
  HEADER,
  PLAN_BODY,
  ROUTES,
  SEED_FILES,
  THEME,
  computeMetrics,
  normalizeExport,
  type SimEvent,
} from '../../../scripts/sim/scenario-demo.js';

const STAGES = ['plan', 'live', 'block', 'decision', 'review'] as const;
type Stage = (typeof STAGES)[number];

const ADMIN_SECRET_LOCAL = 'sim-local-only';
const SERVER_CONFIG = fileURLToPath(new URL('../../server/wrangler.jsonc', import.meta.url));

function fail(step: string, detail: string): never {
  // The repo is public: never let a token slip into an error message.
  throw new Error(`sim failed at ${step}: ${detail.replace(/rdr_[A-Za-z0-9_-]+/g, 'rdr_REDACTED')}`);
}

function expectOk(step: string, cond: boolean, detail: string): void {
  if (!cond) fail(step, detail);
}

/** Typed extractors: fail loudly (via expectOk shape) instead of throwing TypeError on drift. */
function needStr(step: string, v: unknown, what: string): string {
  if (typeof v !== 'string' || v.length === 0) fail(step, `${what} missing in response`);
  return v as string;
}

function needLines(step: string, v: unknown): string[] {
  if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) fail(step, 'brief lines missing or malformed');
  return v as string[];
}

function needCursor(step: string, v: unknown): number {
  if (typeof v !== 'number') fail(step, 'brief cursor missing or malformed');
  return v;
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

interface Http {
  (method: string, path: string, opts?: { token?: string; admin?: boolean; body?: unknown }): Promise<{ status: number; json: Record<string, unknown> }>;
}

async function waitFor(fn: () => boolean, what: string, timeoutMs = 15_000): Promise<void> {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > timeoutMs) fail('wait', `timeout after ${timeoutMs}ms: ${what}`);
    await new Promise((r) => setTimeout(r, 25));
  }
}

export interface SimOptions {
  server: string;
  until: Stage;
  writes: number;
  /** Remote mode wipes the target workspace (admin init --force): require explicit consent. */
  allowRemoteWipe?: boolean;
  /** Write the normalized export to the replay fixture (web lane). Off in tests so they leave the tree clean. */
  writeReplay?: boolean;
}

export async function runSim(opts: SimOptions): Promise<number> {
  const remote = opts.server !== 'local';
  let base: string;
  let tokens: Record<string, string> = {};
  let closeHarness: () => Promise<void> = async () => undefined;
  let adminSecret = ADMIN_SECRET_LOCAL;

  if (!remote) {
    const harness = createTestHarness({ workers: [{ configPath: SERVER_CONFIG, vars: { GITHUB_COMMIT: 'false' }, secrets: { ADMIN_SECRET: ADMIN_SECRET_LOCAL } }] });
    const listening = await harness.listen();
    base = listening.url.origin;
    closeHarness = () => harness.close();
  } else {
    base = opts.server.replace(/\/+$/, '');
    if (!opts.allowRemoteWipe) fail('setup', `refusing to wipe ${base}: pass --allow-remote-wipe to confirm admin init --force (never point this at production)`);
    if (base.startsWith('http://')) console.error('[sim] WARNING: remote over plain http:// — tokens travel in cleartext; prefer https://');
    const env = (k: string) => process.env[k];
    tokens = { A: env('RADAR_TOKEN_A') ?? '', B: env('RADAR_TOKEN_B') ?? '', C: env('RADAR_TOKEN_C') ?? '', mc: env('RADAR_TOKEN_MC') ?? '' };
    for (const m of ['A', 'B', 'C', 'mc']) if (!tokens[m]) fail('setup', `remote mode needs RADAR_TOKEN_${m} in the environment`);
    adminSecret = env('RADAR_ADMIN_SECRET') ?? '';
    if (!adminSecret) fail('setup', 'remote mode needs RADAR_ADMIN_SECRET in the environment (admin init --force follows)');
  }

  const http: Http = async (method, path, o = {}) => {
    const headers: Record<string, string> = { connection: 'close' };
    if (o.admin) headers['x-admin-secret'] = adminSecret;
    else if (o.token) headers.authorization = `Bearer ${o.token}`;
    if (o.body !== undefined) headers['content-type'] = 'application/json';
    const bodyText = o.body === undefined ? undefined : JSON.stringify(o.body);
    if (process.env.SIM_DEBUG === '1') console.error(`[sim] ${method} ${path} body=${bodyText?.length ?? 0}B`);
    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, { method, headers, body: bodyText });
    } catch (e) {
      console.error(`[sim] FETCH FAILED ${method} ${path}: ${e instanceof Error ? e.message : String(e)}`);
      // Probe: is the harness still alive?
      try {
        const probe = await fetch(`${base}/v1/state`, { headers: { authorization: 'Bearer x' } });
        console.error(`[sim] probe state after failure: HTTP ${probe.status}`);
        await probe.text();
      } catch (e2) {
        console.error(`[sim] probe also failed: ${e2 instanceof Error ? e2.message : String(e2)}`);
      }
      throw e;
    }
    const ms = Date.now() - t0;
    const text = await res.text();
    if (process.env.SIM_DEBUG === '1') console.error(`[sim] <- ${res.status} ${path} ${text.length}B`);
    if (process.env.SIM_DEBUG === '1' && path !== '/v1/state') {
      try {
        const probe = await fetch(`${base}/v1/state`, { headers: { authorization: 'Bearer x' } });
        console.error(`[sim] probe after ${path}: HTTP ${probe.status}`);
        await probe.text();
      } catch (e) {
        console.error(`[sim] probe after ${path} FAILED: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { status: res.status, json: (text ? JSON.parse(text) : {}) as Record<string, unknown>, ms } as { status: number; json: Record<string, unknown> };
  };

  const lockCheckMs: number[] = [];
  const syncMs: number[] = [];
  let blockToDecisionMs: number | null = null;

  const check = async (token: string, path: string) => {
    const r = (await http('POST', '/v1/locks/check', { token, body: { paths: [path], tool: 'write_file', clientTs: 0 } })) as {
      status: number;
      json: { decision: string; results: { reason: string; requestId?: string; holder?: { memberId: string; taskId: string } }[]; message?: string };
      ms: number;
    };
    lockCheckMs.push(r.ms);
    return r;
  };

  // Bundles are built lazily: esbuild keeps a service process alive, so only
  // build the real hook bundles when a stage actually runs them.
  let bundles: Record<HookName, string> | null = null;
  const needBundles = async () => (bundles ??= await bundleHooks());
  const roots = {} as Record<'A' | 'B' | 'C', string>;
  const dirs = { A: mkdtempSync(join(tmpdir(), 'radar-sim-A-')), B: mkdtempSync(join(tmpdir(), 'radar-sim-B-')), C: mkdtempSync(join(tmpdir(), 'radar-sim-C-')) };

  const agents: SyncAgent[] = [];
  try {
    // 0. Reset + seed (local always; remote only with explicit env secrets set above).
    const initBody = {
      workspace: 'sim-3pc',
      members: [
        { id: 'A', role: 'coder', name: 'Andi' },
        { id: 'B', role: 'coder', name: 'Budi' },
        { id: 'C', role: 'pm', name: 'Citra' },
      ],
      force: true,
    };
    const init = await http('POST', '/admin/init', { admin: true, body: initBody });
    expectOk('init', init.status === 201, `admin init: HTTP ${init.status} ${JSON.stringify(init.json).slice(0, 200)}`);
    const got = init.json.tokens as Record<string, string> | undefined;
    expectOk('init', !!got?.A && !!got?.B && !!got?.C && !!got?.mc, 'admin init returned no tokens');
    if (!remote) tokens = got as Record<string, string>;
    const seeded = await http('POST', '/admin/files', { admin: true, body: { headCommit: null, files: SEED_FILES } });
    expectOk('seed', seeded.status === 200, `admin files: HTTP ${seeded.status} ${JSON.stringify(seeded.json).slice(0, 200)}`);

    for (const m of ['A', 'B', 'C'] as const) {
      roots[m] = makeWorkspace({ server: base, workspace: 'sim-3pc', member: m, token: tokens[m], role: m === 'C' ? 'pm' : 'coder', shareprompts: false });
    }
    const hookRun = async (m: 'A' | 'B' | 'C', name: HookName, args: string[], payload: unknown) =>
      runHook((await needBundles())[name], args, payload, {}, roots[m]);

    // 1. Plan: C proposes, Mission Control approves → T-1 (kupon, A) + T-2 (dark, B), routes.ts queued.
    const plan = await http('POST', '/v1/proposals', { token: tokens.C, body: PLAN_BODY });
    expectOk('plan', plan.status === 201, `propose plan: HTTP ${plan.status} ${JSON.stringify(plan.json).slice(0, 200)}`);
    const planId = needStr('plan', plan.json.proposalId, 'proposalId');
    const approvePlan = await http('POST', `/v1/proposals/${planId}/decision`, { token: tokens.mc, body: { approve: true } });
    expectOk('plan', approvePlan.status === 200 && approvePlan.json.status === 'disetujui', `approve plan: ${approvePlan.status} ${JSON.stringify(approvePlan.json).slice(0, 160)}`);
    const tasksB = await http('GET', '/v1/tasks', { token: tokens.B });
    expectOk('plan', tasksB.status === 200, `list tasks: HTTP ${tasksB.status}`);
    const bTasks = tasksB.json.tasks;
    expectOk('plan', Array.isArray(bTasks) && bTasks.length > 0, 'B has no open tasks after plan approve');
    const bFiles = bTasks as { files: { path: string; queuePos: number; waitingFor: string }[] }[];
    expectOk('plan', !!bFiles[0]?.files.some((f) => f.path === ROUTES && f.queuePos === 1 && f.waitingFor === 'T-1'), `routes.ts not queued for T-2: ${JSON.stringify(bFiles).slice(0, 200)}`);
    // NOTE: `return await` (not bare `return`) is required here: the try/finally
    // below closes the harness, and a bare `return finish()` would let finally
    // run concurrently with the export fetch still in flight (ECONNRESET).
    if (opts.until === 'plan') return await finish('plan');

    // Agents start after the plan so the first snapshot already carries the reserved locks.
    for (const m of ['A', 'B', 'C'] as const) {
      const agent = new SyncAgent({ root: dirs[m], server: base, token: tokens[m]!, member: m, log: () => {}, notify: () => {}, heartbeatMs: 60_000, pingMs: 60_000, reconnect: { minMs: 50, maxMs: 200 } });
      agents.push(agent);
      await agent.start();
    }
    const readDisk = (m: 'A' | 'B' | 'C', path: string) => (existsSync(join(dirs[m], path)) ? readFileSync(join(dirs[m], path), 'utf8') : null);

    // 2. Live: A writes checkout.ts N×, B writes theme.css N×, alternating; all three disks converge every time.
    // Each write is preceded by locks/check, like the real hook (gives the p95 sample + exercises checkWrite).
    for (let i = 0; i < opts.writes; i++) {
      const preA = await check(tokens.A!, CHECKOUT);
      expectOk('live', preA.json.decision === 'allow', `A checkout check ${i}: ${JSON.stringify(preA.json).slice(0, 160)}`);
      const aContent = `${readDisk('A', CHECKOUT) ?? ''}// sim-a${i}\n`;
      const t0a = Date.now();
      mkdirSync(join(dirs.A, dirname(CHECKOUT)), { recursive: true });
      writeFileSync(join(dirs.A, CHECKOUT), aContent);
      await waitFor(() => readDisk('B', CHECKOUT) === aContent && readDisk('C', CHECKOUT) === aContent, `checkout.ts write ${i} reaches B and C`);
      syncMs.push(Date.now() - t0a);
      const preB = await check(tokens.B!, THEME);
      expectOk('live', preB.json.decision === 'allow', `B theme check ${i}: ${JSON.stringify(preB.json).slice(0, 160)}`);
      const bContent = `${readDisk('B', THEME) ?? ''}/* sim-b${i} */\n`;
      const t0b = Date.now();
      mkdirSync(join(dirs.B, dirname(THEME)), { recursive: true });
      writeFileSync(join(dirs.B, THEME), bContent);
      await waitFor(() => readDisk('A', THEME) === bContent && readDisk('C', THEME) === bContent, `theme.css write ${i} reaches A and C`);
      syncMs.push(Date.now() - t0b);
    }
    if (opts.until === 'live') return await finish('live');

    // 3. Block: the real lock_guard bundle refuses B's edit; the server check agrees and names the request.
    const tBlock = Date.now();
    const blocked = await hookRun('B', 'lock_guard', [], prePayload(roots.B, CHECKOUT));
    expectOk('block', blocked.code === 2, `lock_guard exit ${blocked.code}, stderr: ${blocked.stderr.slice(0, 200)}`);
    expectOk('block', blocked.stderr.includes(CHECKOUT) && blocked.stderr.includes('Andi'), `hook message names file+holder: ${blocked.stderr.slice(0, 200)}`);
    const bCheck = await check(tokens.B!, CHECKOUT);
    expectOk('block', bCheck.json.decision === 'block' && bCheck.json.results[0]?.reason === 'held_by_other', `locks/check: ${JSON.stringify(bCheck.json).slice(0, 200)}`);
    const requestId = bCheck.json.results[0]?.requestId as string | undefined;
    expectOk('block', !!requestId, 'block carries no requestId');
    // B writes the free part instead (Header.tsx belongs to T-2).
    const headerEdit = `${readDisk('B', HEADER) ?? ''}{/* sim: dark toggle */}\n`;
    const headerCheck = await hookRun('B', 'lock_guard', [], prePayload(roots.B, HEADER));
    expectOk('block', headerCheck.code === 0, `Header.tsx should be allowed: ${headerCheck.stderr.slice(0, 160)}`);
    mkdirSync(join(dirs.B, dirname(HEADER)), { recursive: true });
    writeFileSync(join(dirs.B, HEADER), headerEdit);
    await waitFor(() => readDisk('A', HEADER) === headerEdit, 'Header.tsx from B reaches A');
    // Layer 2 (PRD §7.5): a raw socket write to A's file without the hook is rejected, server copy unchanged.
    const stateNow = await http('GET', '/v1/state', { token: tokens.mc });
    expectOk('block', stateNow.status === 200, `state before layer-2: HTTP ${stateNow.status}`);
    const serverFiles = (stateNow.json.files ?? []) as { path: string; version: number }[];
    const checkoutEntry = serverFiles.find((f) => f.path === CHECKOUT);
    expectOk('block', !!checkoutEntry, 'checkout.ts missing from server state');
    const beforeA = readDisk('A', CHECKOUT);
    const beforeC = readDisk('C', CHECKOUT);
    const rejected = await rawWrite(base, tokens.B!, CHECKOUT, checkoutEntry?.version ?? 1, 'B was here\n');
    expectOk('block', rejected.type === 'file.rejected' && (rejected.d as { reason?: string })?.reason === 'held_by_other', `layer-2: ${JSON.stringify(rejected).slice(0, 200)}`);
    const stateAfter = await http('GET', '/v1/state', { token: tokens.mc });
    const afterV = ((stateAfter.json.files ?? []) as { path: string; version: number }[]).find((f) => f.path === CHECKOUT)?.version;
    expectOk('block', afterV === checkoutEntry?.version && readDisk('A', CHECKOUT) === beforeA && readDisk('C', CHECKOUT) === beforeC, 'layer-2 changed the server copy or a peer disk');
    if (opts.until === 'block') return await finish('block');

    // 5. Decision: C proposes antre → auto-applied; B's prompt brief carries it.
    const cursorResp = await http('GET', '/v1/brief?kind=start', { token: tokens.B });
    expectOk('decision', cursorResp.status === 200, `brief start: HTTP ${cursorResp.status}`);
    const cursorB = needCursor('decision', cursorResp.json.cursor);
    const dec = await http('POST', '/v1/proposals', { token: tokens.C, body: { kind: 'decision', reason: 'T-1 hampir selesai, B antre', payload: { requestId, option: 'antre' } } });
    expectOk('decision', dec.status === 201 && dec.json.status === 'diterapkan_otomatis', `decision: HTTP ${dec.status} ${JSON.stringify(dec.json).slice(0, 200)}`);
    blockToDecisionMs = Date.now() - tBlock;
    const briefBResp = await http('GET', `/v1/brief?kind=prompt&since=${cursorB}`, { token: tokens.B });
    expectOk('decision', briefBResp.status === 200, `brief prompt: HTTP ${briefBResp.status}`);
    const briefB = needLines('decision', briefBResp.json.lines);
    expectOk('decision', briefB.join('\n').includes('Keputusan PM'), 'B brief misses the decision');
    if (opts.until === 'decision') return await finish('decision');

    // 6–7. Review + commit: A changes the calculateTotal signature, submits; C reviews
    // setujui_beri_tahu + notify B; the member token cannot decide (403); mc approves → local commit,
    // checkout.ts moves to T-2 (dipesan), B's brief carries the notice + Giliranmu.
    const sigEdit = "export function calculateTotal(items: { price: number }[], shipping: number): number {\n  return items.reduce((sum, item) => sum + item.price, 0) + shipping;\n}\n";
    const sigCheck = await hookRun('A', 'lock_guard', [], prePayload(roots.A, CHECKOUT));
    expectOk('review', sigCheck.code === 0, `A signature edit blocked: ${sigCheck.stderr.slice(0, 160)}`);
    writeFileSync(join(dirs.A, CHECKOUT), sigEdit);
    await waitFor(() => readDisk('C', CHECKOUT) === sigEdit, 'signature change reaches C');
    const submit = await http('POST', '/v1/tasks/T-1/submit', { token: tokens.A, body: { summary: 'Kupon diskon persen + ongkir' } });
    expectOk('review', submit.status === 200 && submit.json.status === 'review', `submit: HTTP ${submit.status} ${JSON.stringify(submit.json).slice(0, 160)}`);
    const diff = await http('GET', '/v1/tasks/T-1/diff', { token: tokens.C });
    expectOk('review', diff.status === 200 && JSON.stringify(diff.json).includes('Header.tsx'), `diff misses importer Header.tsx: ${JSON.stringify(diff.json).slice(0, 200)}`);
    const cursorB2Resp = await http('GET', '/v1/brief?kind=start', { token: tokens.B });
    expectOk('review', cursorB2Resp.status === 200, `brief start: HTTP ${cursorB2Resp.status}`);
    const cursorB2 = needCursor('review', cursorB2Resp.json.cursor);
    const review = await http('POST', '/v1/proposals', {
      token: tokens.C,
      body: { kind: 'review', reason: 'Kupon aman, Header ikut terdampak', payload: { taskId: 'T-1', verdict: 'setujui_beri_tahu', notify: [{ memberId: 'B', message: 'calculateTotal(items, shipping) berubah.' }] } },
    });
    expectOk('review', review.status === 201, `propose review: ${review.status} ${JSON.stringify(review.json).slice(0, 160)}`);
    const reviewId = needStr('review', review.json.proposalId, 'review proposalId');
    for (const tok of [tokens.C!, tokens.A!]) {
      const denied = await http('POST', `/v1/proposals/${reviewId}/decision`, { token: tok, body: { approve: true } });
      expectOk('review', denied.status === 403, `member decision should be 403, got ${denied.status}`);
    }
    const approve = await http('POST', `/v1/proposals/${reviewId}/decision`, { token: tokens.mc, body: { approve: true } });
    expectOk('review', approve.status === 200 && approve.json.status === 'disetujui', `mc approve: HTTP ${approve.status} ${JSON.stringify(approve.json).slice(0, 160)}`);
    const briefB2Resp = await http('GET', `/v1/brief?kind=prompt&since=${cursorB2}`, { token: tokens.B });
    expectOk('review', briefB2Resp.status === 200, `brief prompt: HTTP ${briefB2Resp.status}`);
    const briefB2 = needLines('review', briefB2Resp.json.lines).join('\n');
    expectOk('review', briefB2.includes('calculateTotal(items, shipping) berubah.'), 'B brief misses the notify');
    expectOk('review', briefB2.includes('Giliranmu'), 'B brief misses Giliranmu');

    return await finish('review');

    async function finish(reached: Stage): Promise<number> {
      const exp = await http('GET', '/v1/events/export', { token: tokens.mc });
      expectOk('export', exp.status === 200, `export: HTTP ${exp.status}`);
      const events = (exp.json.events ?? []) as SimEvent[];
      const m = computeMetrics(events, lockCheckMs, syncMs, blockToDecisionMs);
      console.log(JSON.stringify({ stage: reached, ...m }, null, 2));
      const problems: string[] = [];
      if (m.lockCheckCount > 0 && !(m.lockCheckP95Ms < 300)) problems.push(`p95 locks/check ${m.lockCheckP95Ms}ms is not < 300ms`);
      if (m.dualWriterViolations !== 0) problems.push(`${m.dualWriterViolations} file.changed events from a non-holder`);
      if (reached === 'review' && m.reviewsFlagged < 1) problems.push('no flagged review (review.flagged < 1)');
      if (reached === 'review' && opts.writeReplay !== false) {
        const out = normalizeExport({ events, exportedAt: exp.json.exportedAt as number | undefined });
        const dest = fileURLToPath(new URL('../../web/public/demo/events.sim.json', import.meta.url));
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
        console.log(`exported ${events.length} events → packages/web/public/demo/events.sim.json`);
      }
      for (const p of problems) console.error(`sim failed: ${p}`);
      return problems.length === 0 ? 0 : 1;
    }
  } finally {
    await Promise.allSettled(agents.map((a) => a.stop()));
    await closeHarness();
    for (const d of [dirs.A, dirs.B, dirs.C]) rmSync(d, { recursive: true, force: true });
    for (const m of ['A', 'B', 'C'] as const) if (roots[m]) rmSync(roots[m], { recursive: true, force: true });
  }
}

/** Send one file.update over a raw WebSocket and resolve with the first ack/rejected frame. */
async function rawWrite(base: string, token: string, path: string, baseVersion: number, content: string): Promise<{ type: string; d?: unknown }> {
  const url = `${base.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws`;
  const ws = new WebSocket(url);
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('ws open timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(t);
        resolve();
      });
      ws.on('error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
    const frames: { t: string; d?: unknown }[] = [];
    ws.on('message', (data: Buffer) => {
      try {
        frames.push(JSON.parse(data.toString('utf8')) as { t: string; d?: unknown });
      } catch {
        /* ignore non-JSON */
      }
    });
    ws.send(JSON.stringify({ t: 'hello', d: { token, client: 'sync', clientVersion: 'sim', knownVersions: {} } }));
    const t0 = Date.now();
    while (Date.now() - t0 < 5000 && !frames.some((f) => f.t === 'welcome')) await new Promise((r) => setTimeout(r, 20));
    ws.send(JSON.stringify({ t: 'file.update', id: 'sim-layer2', d: { path, baseVersion, content, hash: sha256Hex(content), clientTs: 0 } }));
    const t1 = Date.now();
    while (Date.now() - t1 < 5000) {
      const hit = frames.find((f) => f.t === 'file.rejected' || f.t === 'file.ack');
      if (hit) return { type: hit.t, d: hit.d };
      await new Promise((r) => setTimeout(r, 20));
    }
    return { type: 'timeout' };
  } finally {
    ws.close();
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== '--'),
    options: {
      server: { type: 'string', default: 'local' },
      until: { type: 'string', default: 'review' },
      runs: { type: 'string', default: '1' },
      writes: { type: 'string', default: '5' },
      'allow-remote-wipe': { type: 'boolean', default: false },
    },
  });
  if (!STAGES.includes(values.until as Stage)) {
    console.error(`--until must be one of ${STAGES.join('|')}`);
    return 2;
  }
  const runs = Number(values.runs);
  const writes = Number(values.writes);
  if (!Number.isFinite(runs) || runs < 1 || !Number.isFinite(writes) || writes < 1) {
    console.error(`--runs and --writes must be integers >= 1 (got runs=${values.runs} writes=${values.writes})`);
    return 2;
  }
  for (let i = 0; i < runs; i++) {
    if (runs > 1) console.log(`--- sim run ${i + 1}/${runs} ---`);
    const code = await runSim({ server: values.server as string, until: values.until as Stage, writes, allowRemoteWipe: values['allow-remote-wipe'] });
    if (code !== 0) return code;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
