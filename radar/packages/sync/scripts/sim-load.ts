// Fase 12 step 9 load test: `pnpm -C radar sim -- --load [--members 5] [--duration 120] [--rate 2]`.
// N coder SyncAgents on this machine against the local Worker; each checks its lock (like the hook) and writes
// its own file `rate` times per second. Every other agent must receive every version it saw (NFR-01): pass when
// no update is rejected, all disks end identical, sync p95 < 1000 ms and locks/check p95 < 300 ms.
// Latency = appliedTs(receiver) − writeTs(writer), one clock (R4 §9). Local only: it runs admin init --force.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createTestHarness } from 'wrangler';
import { SyncAgent } from '../src/agent.js';
import { percentile } from './bench-sync.js';

const ADMIN_SECRET_LOCAL = 'load-local-only';
const SERVER_CONFIG = fileURLToPath(new URL('../../server/wrangler.jsonc', import.meta.url));
/** PRD §04: a workspace has at most 5 members. */
export const LOAD_MAX_MEMBERS = 5;

export interface LoadOptions {
  members: number;
  durationS: number;
  /** Writes per member per second. */
  rate: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runLoad(opts: LoadOptions): Promise<number> {
  const ids = Array.from({ length: opts.members }, (_, i) => String.fromCharCode(65 + i));
  const harness = createTestHarness({ workers: [{ configPath: SERVER_CONFIG, vars: { GITHUB_COMMIT: 'false' }, secrets: { ADMIN_SECRET: ADMIN_SECRET_LOCAL } }] });
  const { url } = await harness.listen();
  const base = url.origin;
  const dirs = Object.fromEntries(ids.map((id) => [id, mkdtempSync(join(tmpdir(), `radar-load-${id}-`))])) as Record<string, string>;
  const agents: Record<string, SyncAgent> = {};
  const errors: string[] = [];
  try {
    const post = async (path: string, body: unknown, headers: Record<string, string>) => {
      const t0 = Date.now();
      const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
      const text = await res.text();
      return { status: res.status, json: (text ? JSON.parse(text) : {}) as Record<string, unknown>, ms: Date.now() - t0 };
    };
    const admin = { 'x-admin-secret': ADMIN_SECRET_LOCAL };
    const init = await post('/admin/init', { workspace: 'sim-load', members: ids.map((id) => ({ id, role: 'coder', name: `Load ${id}` })), force: true }, admin);
    const tokens = init.json.tokens as Record<string, string> | undefined;
    if (init.status !== 201 || !tokens) throw new Error(`admin init: HTTP ${init.status}`);
    const files = ids.map((id) => ({ path: `load/${id}.txt`, content: `seed ${id}\n` }));
    const seeded = await post('/admin/files', { headCommit: null, files }, admin);
    if (seeded.status !== 200) throw new Error(`admin files: HTTP ${seeded.status}`);

    const writeTs = new Map<string, number>(); // "<id> <n>" → write time
    const syncMs: number[] = [];
    const lockMs: number[] = [];
    for (const id of ids) {
      const agent = new SyncAgent({ root: dirs[id]!, server: base, token: tokens[id]!, member: id, log: () => undefined, notify: () => undefined });
      agent.on('applied', (e: { path: string; appliedTs: number }) => {
        const p = join(dirs[id]!, e.path);
        const m = existsSync(p) ? /^load (\S+ \d+) /.exec(readFileSync(p, 'utf8')) : null;
        const t = m ? writeTs.get(m[1]!) : undefined;
        if (t !== undefined) syncMs.push(e.appliedTs - t);
      });
      agents[id] = agent;
      await agent.start();
    }
    // Wait until every agent has the seeded files (snapshot applied).
    const deadline = Date.now() + 15_000;
    while (!ids.every((id) => files.every((f) => existsSync(join(dirs[id]!, f.path)))) && Date.now() < deadline) await sleep(50);
    if (Date.now() >= deadline) throw new Error('seed files never reached every agent');

    const gap = Math.round(1000 / opts.rate);
    const rounds = Math.round(opts.durationS * opts.rate);
    const writer = async (id: string) => {
      const path = `load/${id}.txt`;
      for (let n = 0; n < rounds; n++) {
        const t0 = Date.now();
        const check = await post('/v1/locks/check', { paths: [path], tool: 'write_file', clientTs: 0 }, { authorization: `Bearer ${tokens[id]}` });
        lockMs.push(check.ms);
        if (check.status !== 200 || check.json.decision !== 'allow') errors.push(`${id} lock check ${n}: HTTP ${check.status} ${String(check.json.decision)}`);
        writeTs.set(`${id} ${n}`, Date.now());
        writeFileSync(join(dirs[id]!, path), `load ${id} ${n} ${Math.random().toString(36).slice(2)}\n`);
        await sleep(Math.max(0, gap - (Date.now() - t0)));
      }
    };
    const started = Date.now();
    await Promise.all(ids.map(writer));
    const wroteMs = Date.now() - started;

    // Settle: every disk holds every writer's last content.
    const lastOf = (id: string) => readFileSync(join(dirs[id]!, `load/${id}.txt`), 'utf8');
    const same = () => ids.every((w) => ids.every((r) => existsSync(join(dirs[r]!, `load/${w}.txt`)) && readFileSync(join(dirs[r]!, `load/${w}.txt`), 'utf8') === lastOf(w)));
    const settleBy = Date.now() + 10_000;
    while (!same() && Date.now() < settleBy) await sleep(100);

    const stats = ids.map((id) => ({ id, ...agents[id]!.stats }));
    const sortedSync = [...syncMs].sort((a, b) => a - b);
    const sortedLock = [...lockMs].sort((a, b) => a - b);
    const result = {
      target: 'local createTestHarness (wrangler dev runtime)',
      members: opts.members,
      durationS: Math.round(wroteMs / 1000),
      writesPlanned: rounds * opts.members,
      updatesSent: stats.reduce((s, x) => s + x.updatesSent, 0),
      applied: syncMs.length,
      rejected: stats.reduce((s, x) => s + x.rejected, 0),
      conflicts: stats.reduce((s, x) => s + x.conflicts, 0),
      syncP50Ms: percentile(sortedSync, 50),
      syncP95Ms: percentile(sortedSync, 95),
      syncMaxMs: sortedSync.at(-1) ?? Number.NaN,
      lockCheckP95Ms: percentile(sortedLock, 95),
      converged: same(),
    };
    console.log(JSON.stringify(result, null, 2));
    if (result.rejected > 0) errors.push(`${result.rejected} updates rejected`);
    if (result.conflicts > 0) errors.push(`${result.conflicts} conflicts`);
    if (!result.converged) errors.push('disks did not converge within 10 s');
    if (!(result.syncP95Ms < 1000)) errors.push(`sync p95 ${result.syncP95Ms} ms is not < 1000 ms`);
    if (!(result.lockCheckP95Ms < 300)) errors.push(`locks/check p95 ${result.lockCheckP95Ms} ms is not < 300 ms`);
  } finally {
    await Promise.allSettled(Object.values(agents).map((a) => a.stop()));
    await harness.close();
    for (const d of Object.values(dirs)) rmSync(d, { recursive: true, force: true });
  }
  for (const e of errors.slice(0, 20)) console.error(`load failed: ${e}`);
  return errors.length === 0 ? 0 : 1;
}

