// `pnpm -C radar bench:sync [-- --server <url>] [--writes 100] [--gap 200]` (fase 04 step 12).
// Two SyncAgents on this machine; A writes a file N times, B reports when each version is on its disk.
// Latency = appliedTs(B) − writeTs(A), one clock, so no cross-PC clock skew (R4 §9).
// Local mode boots the real Worker with wrangler's createTestHarness; --server targets a deployed Worker and
// reads the member tokens from RADAR_TOKEN_A / RADAR_TOKEN_B (never from argv).
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createTestHarness } from 'wrangler';
import { SyncAgent } from '../src/agent.js';

const BENCH_ADMIN_SECRET = 'bench-local-only';

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] as number;
}

async function startLocal(): Promise<{ url: string; tokens: { A: string; B: string }; close: () => Promise<void> }> {
  const configPath = fileURLToPath(new URL('../../server/wrangler.jsonc', import.meta.url));
  const harness = createTestHarness({ workers: [{ configPath, vars: { GITHUB_COMMIT: 'false' }, secrets: { ADMIN_SECRET: BENCH_ADMIN_SECRET } }] });
  const { url } = await harness.listen();
  const post = async (path: string, body: unknown) => {
    const res = await fetch(new URL(path, url), { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-secret': BENCH_ADMIN_SECRET }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
    return res.json() as Promise<{ tokens?: Record<string, string> }>;
  };
  const init = await post('/admin/init', {
    workspace: 'bench',
    members: [
      { id: 'A', role: 'coder', name: 'Bench A' },
      { id: 'B', role: 'coder', name: 'Bench B' },
    ],
    force: true,
  });
  await post('/admin/files', { headCommit: null, files: [{ path: 'README.md', content: '# bench\n' }] });
  const A = init.tokens?.A;
  const B = init.tokens?.B;
  if (!A || !B) throw new Error('admin init returned no tokens');
  return { url: url.origin, tokens: { A, B }, close: () => harness.close() };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { values } = parseArgs({
    args: argv.filter((a) => a !== '--'),
    options: { server: { type: 'string' }, writes: { type: 'string', default: '100' }, gap: { type: 'string', default: '200' }, path: { type: 'string', default: 'radar-bench/latency.txt' } },
  });
  const writes = Number(values.writes);
  const gap = Number(values.gap);
  let server: { url: string; tokens: { A: string; B: string }; close: () => Promise<void> };
  if (values.server) {
    const A = process.env.RADAR_TOKEN_A;
    const B = process.env.RADAR_TOKEN_B;
    if (!A || !B) {
      console.error('--server needs RADAR_TOKEN_A and RADAR_TOKEN_B in the environment (two coder tokens).');
      return 2;
    }
    server = { url: values.server.replace(/\/+$/, ''), tokens: { A, B }, close: async () => undefined };
  } else {
    server = await startLocal();
  }

  const dirs = [mkdtempSync(join(tmpdir(), 'radar-bench-A-')), mkdtempSync(join(tmpdir(), 'radar-bench-B-'))] as const;
  // BENCH_LOG=<file>: append both agents' sync.log lines (debugging a failed run).
  const logFile = process.env.BENCH_LOG;
  const logTo = (m: string) => (line: string) => {
    if (logFile) appendFileSync(logFile, `${m} ${line}\n`);
  };
  const notify = () => undefined;
  const a = new SyncAgent({ root: dirs[0], server: server.url, token: server.tokens.A, member: 'A', log: logTo('A'), notify });
  const b = new SyncAgent({ root: dirs[1], server: server.url, token: server.tokens.B, member: 'B', log: logTo('B'), notify });
  const rel = values.path;
  const writeTs = new Map<number, number>();
  const latencies: number[] = [];
  let finalMatch: boolean | undefined;
  let sentBefore = 0;
  b.on('applied', (e: { path: string; appliedTs: number }) => {
    if (e.path !== rel) return;
    const m = /^bench (\d+) /.exec(readFileSync(join(dirs[1], rel), 'utf8'));
    const t = m ? writeTs.get(Number(m[1])) : undefined;
    if (t !== undefined) latencies.push(e.appliedTs - t);
  });
  try {
    await a.start();
    await b.start();
    const readB = () => (existsSync(join(dirs[1], rel)) ? readFileSync(join(dirs[1], rel), 'utf8') : null);
    // Warm-up write (not timed): creates the folder and waits until B has it. A folder created right after
    // start can miss its fs event on macOS and is then only found by the watcher's 2 s safety rescan.
    mkdirSync(join(dirs[0], rel, '..'), { recursive: true });
    writeFileSync(join(dirs[0], rel), 'warm-up\n');
    const warmDeadline = Date.now() + 10_000;
    while (readB() !== 'warm-up\n' && Date.now() < warmDeadline) await new Promise((r) => setTimeout(r, 20));
    if (readB() !== 'warm-up\n') throw new Error('warm-up write never reached B');
    sentBefore = a.stats.updatesSent;
    for (let i = 0; i < writes; i++) {
      writeTs.set(i, Date.now());
      writeFileSync(join(dirs[0], rel), `bench ${i} ${Math.random().toString(36).slice(2)}\n`);
      await new Promise((r) => setTimeout(r, gap));
    }
    const last = readFileSync(join(dirs[0], rel), 'utf8');
    const deadline = Date.now() + 5000;
    const settled = () => latencies.length >= a.stats.updatesSent - sentBefore && readB() === last;
    while (!settled() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 50));
    finalMatch = readB() === last;
  } finally {
    await a.stop();
    await b.stop();
    await server.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  }

  const sorted = [...latencies].sort((x, y) => x - y);
  const result = {
    target: values.server ? values.server : 'local createTestHarness (wrangler dev runtime)',
    writes,
    gapMs: gap,
    received: latencies.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.at(-1) ?? Number.NaN,
    updatesSentA: a.stats.updatesSent - sentBefore,
    updatesSentB: b.stats.updatesSent,
    // Writes closer together than SYNC_DEBOUNCE_MS (fs event jitter) merge into one update; the last content still wins.
    coalesced: writes - (a.stats.updatesSent - sentBefore),
    finalMatch,
  };
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `| ${new Date().toISOString().slice(0, 16)} | ${result.target} | ${writes} × ${gap} ms | ${result.received} (${result.coalesced} coalesced) | ${result.p50} | ${result.p95} | ${result.max} | A ${result.updatesSentA} / B ${result.updatesSentB} |`,
  );
  const failures: string[] = [];
  if (result.updatesSentB !== 0) failures.push(`B echoed ${result.updatesSentB} updates (expected 0)`);
  if (result.updatesSentA === 0 || result.updatesSentA > writes) failures.push(`A sent ${result.updatesSentA} updates for ${writes} writes`);
  if (result.received !== result.updatesSentA) failures.push(`B applied ${result.received} of ${result.updatesSentA} versions`);
  if (!finalMatch) failures.push("B's final content differs from A's last write");
  if (!(result.p95 < 1000)) failures.push(`p95 ${result.p95} ms is not < 1000 ms`);
  for (const f of failures) console.error(`bench failed: ${f}`);
  return failures.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.stack : String(err));
      process.exit(1);
    },
  );
}
