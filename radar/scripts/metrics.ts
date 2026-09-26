// PRD §04 metrics from a Radar event export (fase 13 step 4).
// usage: tsx scripts/metrics.ts --events <export.json> [--metric-rows <rows.json>] [--out <metrics.json>]
// The export is the body of GET /v1/events/export or GET /admin/export ({ events: [...] }); several pages may be
// concatenated into one array. Metric rows ({ name, value }[]) are optional: the export does not carry them.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { RadarEvent } from '../packages/common/src/index.js';

export interface Series {
  n: number;
  p50: number;
  p95: number;
  max: number;
}

export interface WriterViolation {
  eventId: number;
  path: string;
  by: string;
  holder: string;
}

export interface Metrics {
  events: number;
  sync: Series;
  lockCheck: Series;
  writers: { changes: number; violations: WriterViolation[]; unlocked: number };
  blocks: { total: number; viaHook: number; rejectedWrites: number };
  requests: { created: number; decided: number; auto: number; decisionMs: Series & { median: number } };
  reviews: { created: number; flagged: number };
  proposals: { created: number; decided: number };
  commits: { total: number; pushed: number; pushFailed: number };
}

export interface MetricRow {
  name: string;
  value: number;
}

/** Nearest-rank percentile of an ascending array (same method as packages/sync/scripts/bench-sync.ts). */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] as number;
}

function series(values: number[]): Series {
  const s = [...values].sort((a, b) => a - b);
  return { n: s.length, p50: percentile(s, 50), p95: percentile(s, 95), max: s.length ? (s[s.length - 1] as number) : Number.NaN };
}

// Payload fields read here, loosely typed so one pass handles every event kind.
type P = Record<string, unknown>;
const str = (p: P, k: string): string | null => (typeof p[k] === 'string' ? (p[k] as string) : null);

export function computeMetrics(events: readonly RadarEvent[], opts: { metricRows?: readonly MetricRow[] } = {}): Metrics {
  const ordered = [...events].sort((a, b) => a.id - b.id);
  const holder = new Map<string, string>(); // path → member holding (or reserving) the lock
  const requestOpened = new Map<string, number>();
  const m: Metrics = {
    events: ordered.length,
    sync: series([]),
    lockCheck: series((opts.metricRows ?? []).filter((r) => r.name === 'lock_check_ms').map((r) => r.value)),
    writers: { changes: 0, violations: [], unlocked: 0 },
    blocks: { total: 0, viaHook: 0, rejectedWrites: 0 },
    requests: { created: 0, decided: 0, auto: 0, decisionMs: { ...series([]), median: Number.NaN } },
    reviews: { created: 0, flagged: 0 },
    proposals: { created: 0, decided: 0 },
    commits: { total: 0, pushed: 0, pushFailed: 0 },
  };
  const syncMs: number[] = [];
  const decisionMs: number[] = [];

  for (const e of ordered) {
    const p = e.payload as P;
    const path = str(p, 'path');
    switch (e.type) {
      case 'lock.reserved':
      case 'lock.acquired':
        if (path) holder.set(path, str(p, 'memberId') ?? '');
        break;
      case 'lock.transferred':
        if (path) holder.set(path, str(p, 'toMemberId') ?? '');
        break;
      case 'lock.released':
      case 'lock.revoked':
        if (path) holder.delete(path);
        break;
      case 'file.changed': {
        m.writers.changes++;
        const by = str(p, 'by') ?? e.actor;
        const h = path ? holder.get(path) : undefined;
        if (h === undefined) m.writers.unlocked++;
        else if (h !== by) m.writers.violations.push({ eventId: e.id, path: path ?? '', by, holder: h });
        break;
      }
      case 'sync.applied':
        if (typeof p.latencyMs === 'number') syncMs.push(p.latencyMs);
        break;
      case 'lock.blocked':
        m.blocks.total++;
        if (p.via === 'hook') m.blocks.viaHook++;
        break;
      case 'file.rejected':
        m.blocks.rejectedWrites++;
        break;
      case 'request.created':
        m.requests.created++;
        if (str(p, 'requestId')) requestOpened.set(str(p, 'requestId') as string, e.ts);
        break;
      case 'request.decided': {
        m.requests.decided++;
        if (p.auto === true) m.requests.auto++;
        const opened = requestOpened.get(str(p, 'requestId') ?? '');
        if (opened !== undefined) decisionMs.push(e.ts - opened);
        break;
      }
      case 'review.created':
        m.reviews.created++;
        break;
      case 'review.flagged':
        m.reviews.flagged++;
        break;
      case 'proposal.created':
        m.proposals.created++;
        break;
      case 'proposal.decided':
        m.proposals.decided++;
        break;
      case 'commit.created':
        m.commits.total++;
        if (p.pushed === true) m.commits.pushed++;
        break;
      case 'commit.push_failed':
        m.commits.pushFailed++;
        break;
    }
  }
  m.sync = series(syncMs);
  const d = series(decisionMs);
  m.requests.decisionMs = { ...d, median: d.p50 };
  return m;
}

const fmt = (s: Series, unit = 'ms') => (s.n === 0 ? 'tidak ada data' : `p50 ${s.p50} ${unit} · p95 ${s.p95} ${unit} · max ${s.max} ${unit} (n=${s.n})`);

/** PRD §04 table: target vs measured. Merge conflicts come from round-a/round-b (merge-check, collect-round-b). */
export function renderMarkdown(m: Metrics): string {
  const d = m.requests.decisionMs;
  const rows: [string, string, string][] = [
    ['Latensi sinkron (event `sync.applied`)', 'p95 < 1000 ms', fmt(m.sync)],
    ['Latensi cek kunci (server `lock_check_ms`)', 'p95 < 300 ms', fmt(m.lockCheck)],
    [
      'Dua penulis bersamaan',
      '0',
      `${m.writers.violations.length} pelanggaran dari ${m.writers.changes} perubahan file (${m.writers.unlocked} tanpa kunci)`,
    ],
    ['Blokir', '–', `${m.blocks.total} (${m.blocks.viaHook} lewat hook), ${m.blocks.rejectedWrites} tulisan ditolak`],
    [
      'Blokir → keputusan',
      'tercatat',
      d.n === 0 ? 'tidak ada data' : `median ${Math.round(d.median / 1000)} s · max ${Math.round(d.max / 1000)} s (n=${d.n}, ${m.requests.auto} otomatis)`,
    ],
    ['Masalah antar-file tertangkap (`review.flagged`)', '≥ 1', String(m.reviews.flagged)],
    ['Commit', '–', `${m.commits.total} (${m.commits.pushed} ter-push, ${m.commits.pushFailed} gagal push)`],
  ];
  return ['| Metrik | Target | Hasil |', '|---|---|---|', ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function readEvents(file: string): RadarEvent[] {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as { events?: RadarEvent[] } | { events?: RadarEvent[] }[] | RadarEvent[];
  if (Array.isArray(raw)) return raw.flatMap((x) => ('events' in x && Array.isArray(x.events) ? x.events : [x as RadarEvent]));
  return raw.events ?? [];
}

export function main(argv: string[]): number {
  const arg = (name: string) => {
    const i = argv.indexOf(name);
    return i > -1 ? argv[i + 1] : undefined;
  };
  const eventsFile = arg('--events');
  if (!eventsFile) {
    console.error('usage: tsx scripts/metrics.ts --events <export.json> [--metric-rows <rows.json>] [--out <metrics.json>]');
    return 2;
  }
  const rowsFile = arg('--metric-rows');
  const metricRows = rowsFile ? (JSON.parse(readFileSync(rowsFile, 'utf8')) as MetricRow[]) : [];
  const m = computeMetrics(readEvents(eventsFile), { metricRows });
  const out = arg('--out');
  if (out) writeFileSync(out, `${JSON.stringify(m, null, 2)}\n`);
  console.log(renderMarkdown(m));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
