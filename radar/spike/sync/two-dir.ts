// Spike 4: does a chokidar watcher see Bob's writes and get them to a second folder/PC in < 1 s, without echo?
//
// usage (from radar/spike):
//   tsx sync/two-dir.ts                              A and B in this process, embedded relay on :8799
//   tsx sync/two-dir.ts --bench 50                   same, then write 50 files in A and print p50/p95/max
//   tsx sync/two-dir.ts --side A --relay ws://<ip>:8799   one side per PC (start `tsx sync/relay.ts` on one PC)
//   tsx sync/two-dir.ts --side B --relay ws://<ip>:8799
// "Bob" mode = run without --bench, let Bob IDE write into out/sync/A, watch out/sync/B.
// Cross-PC latency uses the writer's clock (t0 in the message); keep both Macs on network time.
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import chokidar from 'chokidar';
import WebSocket from 'ws';
import { DEFAULT_PORT, startRelay } from './relay';

const DEBOUNCE_MS = 150;
const TMP_MARK = '.radar-tmp-';
const BENCH_PREFIX = 'bench-';

type Msg = { from: string; path: string; content: string; hash: string; t0: number };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const sha = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
const root = resolve(__dirname, '..', 'out', 'sync');

const stats = { applied: 0, echoesSent: 0, latencies: [] as number[] };

class Side {
  private lastHash = new Map<string, string>(); // anti-echo: last hash written or applied per path
  private timers = new Map<string, NodeJS.Timeout>();
  private appliedByPeer = new Set<string>(); // paths whose current content came from the relay
  ws!: WebSocket;

  constructor(
    readonly name: string,
    readonly dir: string,
  ) {
    mkdirSync(dir, { recursive: true });
  }

  async connect(url: string): Promise<void> {
    this.ws = new WebSocket(url);
    await new Promise<void>((res, rej) => {
      this.ws.once('open', () => res());
      this.ws.once('error', rej);
    });
    this.ws.on('message', (data) => this.apply(JSON.parse(String(data)) as Msg));
  }

  watch(): Promise<void> {
    const watcher = chokidar.watch(this.dir, {
      ignoreInitial: true,
      ignored: (p: string) => p.includes(TMP_MARK),
    });
    const onChange = (abs: string) => {
      const rel = relative(this.dir, abs);
      clearTimeout(this.timers.get(rel));
      this.timers.set(rel, setTimeout(() => this.send(rel), DEBOUNCE_MS));
    };
    watcher.on('add', onChange).on('change', onChange);
    return new Promise((res) => watcher.on('ready', () => res()));
  }

  private send(rel: string): void {
    const abs = join(this.dir, rel);
    if (!existsSync(abs)) return;
    const buf = readFileSync(abs);
    const hash = sha(buf);
    if (this.lastHash.get(rel) === hash) return; // our own apply (or no change): do not echo
    if (this.appliedByPeer.has(rel)) stats.echoesSent++; // would be an echo if the hash check were missing
    this.lastHash.set(rel, hash);
    this.appliedByPeer.delete(rel);
    const t0 = rel.startsWith(BENCH_PREFIX) ? JSON.parse(buf.toString()).t0 : Date.now();
    const msg: Msg = { from: this.name, path: rel, content: buf.toString('base64'), hash, t0 };
    this.ws.send(JSON.stringify(msg));
    console.log(`[${this.name}] → ${rel} (${buf.length} B)`);
  }

  private apply(msg: Msg): void {
    const abs = join(this.dir, msg.path);
    mkdirSync(dirname(abs), { recursive: true });
    this.lastHash.set(msg.path, msg.hash);
    this.appliedByPeer.add(msg.path);
    const tmp = `${abs}${TMP_MARK}${randomBytes(4).toString('hex')}`;
    writeFileSync(tmp, Buffer.from(msg.content, 'base64'));
    renameSync(tmp, abs); // atomic replace
    const ms = Date.now() - msg.t0;
    stats.applied++;
    if (msg.path.startsWith(BENCH_PREFIX)) stats.latencies.push(ms);
    console.log(`[${this.name}] ← ${msg.path} from ${msg.from} in ${ms} ms`);
  }
}

function pct(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function bench(a: Side, n: number): Promise<void> {
  const runId = Date.now().toString(36);
  const t = performance.now();
  for (let i = 0; i < n; i++) {
    const file = join(a.dir, `${BENCH_PREFIX}${runId}-${String(i).padStart(3, '0')}.json`);
    writeFileSync(file, JSON.stringify({ i, t0: Date.now() }));
    await new Promise((r) => setTimeout(r, 20));
  }
  const deadline = Date.now() + 15_000;
  while (stats.latencies.length < n && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 1000)); // leave time for any echo to show up
  const s = [...stats.latencies].sort((x, y) => x - y);
  const lost = n - s.length;
  console.log(
    `\nBENCH files=${n} received=${s.length} lost=${lost} echoes=${stats.echoesSent} ` +
      `p50=${pct(s, 50)}ms p95=${pct(s, 95)}ms max=${s[s.length - 1]}ms ` +
      `(debounce ${DEBOUNCE_MS} ms, wall ${Math.round(performance.now() - t)} ms)`,
  );
  console.log(`GATE spike 4: ${pct(s, 95) < 1000 && lost === 0 && stats.echoesSent === 0 ? 'PASS' : 'FAIL'} (p95 < 1000 ms, 0 lost, 0 echo)`);
}

async function main(): Promise<void> {
  const side = arg('--side'); // A | B | undefined (both)
  const relayUrl = arg('--relay');
  const benchN = Number(arg('--bench') ?? 0);
  let relay: Awaited<ReturnType<typeof startRelay>> | undefined;
  if (!relayUrl) relay = await startRelay(DEFAULT_PORT);
  const url = relayUrl ?? `ws://127.0.0.1:${DEFAULT_PORT}`;

  const sides = (side ? [side] : ['A', 'B']).map((n) => new Side(n, join(root, n)));
  for (const s of sides) {
    await s.connect(url);
    await s.watch();
    console.log(`[${s.name}] watching ${s.dir}`);
  }

  if (benchN > 0) {
    const a = sides.find((s) => s.name === 'A');
    if (!a) throw new Error('--bench needs side A in this process');
    if (side === 'A') console.log('waiting 5 s for side B on the other PC…'), await new Promise((r) => setTimeout(r, 5000));
    await bench(a, benchN);
    for (const s of sides) s.ws.close();
    relay?.close();
    process.exit(0);
  }
}

main().catch((err: Error) => {
  console.error(err);
  process.exit(1);
});
