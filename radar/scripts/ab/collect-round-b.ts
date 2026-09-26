// Round B collector (fase 13 step 3): event export + session report + metrics, and the merge-conflict count
// measured by replaying the pushed task commits onto the start commit.
// usage: RADAR_TOKEN=<mc or pm token> tsx scripts/ab/collect-round-b.ts --server <url> --out <round-b.json>
//          [--events-out <events.json>] [--repo <toko-demo clone, pulled> --base <start sha>]
// The token comes from the environment so it stays out of shell history and of the output files.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { RadarEvent } from '../../packages/common/src/index.js';
import { computeMetrics, renderMarkdown, type Metrics } from '../metrics.js';
import { replayCommits, type ReplayResult } from './git-conflicts.js';

const PAGE_SIZE = 1000; // server cap (packages/server/src/services/export.ts)

async function getJson(url: string, token: string, fetchImpl: typeof fetch): Promise<{ status: number; body: unknown }> {
  const res = await fetchImpl(url, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  return { status: res.status, body: text ? (JSON.parse(text) as unknown) : null };
}

export async function fetchAllEvents(
  server: string,
  token: string,
  opts: { pageSize?: number; fetchImpl?: typeof fetch } = {},
): Promise<RadarEvent[]> {
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const all: RadarEvent[] = [];
  let from = 0;
  for (;;) {
    const { status, body } = await getJson(`${server}/v1/events/export?from=${from}&limit=${pageSize}`, token, fetchImpl);
    if (status < 200 || status >= 300) throw new Error(`GET /v1/events/export → ${status}`);
    const page = ((body as { events?: RadarEvent[] }).events ?? []).filter((e) => e.id >= from);
    all.push(...page);
    if (page.length < pageSize) return all;
    from = (page[page.length - 1] as RadarEvent).id + 1;
  }
}

export interface RoundB {
  collectedAt: string;
  server: string;
  events: RadarEvent[];
  metrics: Metrics;
  /** GET /v1/report/session, or null when the server does not have it yet (Worker: fase 12). */
  report: unknown;
  /** Pushed task commits replayed onto the start commit; null without --repo/--base. */
  replay: (ReplayResult & { base: string; shas: string[] }) | null;
}

export async function collectRoundB(o: { server: string; token: string; repo?: string; base?: string; fetchImpl?: typeof fetch }): Promise<RoundB> {
  const fetchImpl = o.fetchImpl ?? fetch;
  const events = await fetchAllEvents(o.server, o.token, { fetchImpl });
  const rep = await getJson(`${o.server}/v1/report/session`, o.token, fetchImpl);
  const report = rep.status === 200 ? rep.body : null;
  let replay: RoundB['replay'] = null;
  if (o.repo && o.base) {
    // local-… shas (GITHUB_COMMIT=false) never reach git, so only pushed commits can be replayed
    const shas = events
      .filter((e) => e.type === 'commit.created' && (e.payload as { pushed?: boolean }).pushed === true)
      .map((e) => (e.payload as { sha: string }).sha);
    replay = { base: o.base, shas, ...replayCommits(o.repo, o.base, shas) };
  }
  return { collectedAt: new Date().toISOString(), server: o.server, events, metrics: computeMetrics(events), report, replay };
}

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i > -1 ? argv[i + 1] : undefined;
  };
  const server = arg('--server');
  const out = arg('--out');
  const token = env.RADAR_TOKEN;
  if (!server || !out || !token) {
    console.error('usage: RADAR_TOKEN=<mc|pm token> tsx scripts/ab/collect-round-b.ts --server <url> --out <round-b.json> [--events-out <file>] [--repo <dir> --base <sha>]');
    return 2;
  }
  const repo = arg('--repo');
  const base = arg('--base');
  const r = await collectRoundB({ server: server.replace(/\/$/, ''), token, ...(repo ? { repo } : {}), ...(base ? { base } : {}) });
  const eventsOut = arg('--events-out');
  if (eventsOut) writeFileSync(eventsOut, `${JSON.stringify({ events: r.events }, null, 2)}\n`);
  // round-b.json keeps the numbers, not the raw log (that one can be large: --events-out)
  const { events, ...summary } = r;
  writeFileSync(out, `${JSON.stringify({ ...summary, eventCount: events.length }, null, 2)}\n`);
  console.log(renderMarkdown(r.metrics));
  if (r.replay) console.log(`\nKonflik merge putaran B: ${r.replay.conflicts.length} dari ${r.replay.shas.length} commit (diputar ulang dari ${r.replay.base.slice(0, 7)})`);
  if (r.report === null) console.log('\n/v1/report/session belum ada di server ini (fase 12): report = null');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    },
  );
}
