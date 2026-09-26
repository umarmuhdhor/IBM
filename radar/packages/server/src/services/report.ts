// `GET /v1/report/session` (R3 §2.17, MA-06): one summary of a demo session from the event log and the metric
// table, as numbers for the deck and as Markdown for the `session_report` tool. Only aggregates: no file content.
import { formatClock, TASK_STATUSES, type RadarEvent, type RadarEventOf, type SessionReportRes } from '@radar/common';
import { eventRange } from '../db/repo/event';
import { listTasks } from '../db/repo/task';
import type { Db } from '../db/sql';
import { rowsToEvents } from './events';

/** Events read per report; a demo session is a few hundred. */
export const REPORT_MAX_EVENTS = 10_000;
/** Samples read per metric: a demo session writes a few thousand lock checks; percentiles over the newest are enough. */
export const REPORT_MAX_METRIC_SAMPLES = 20_000;

export function percentile(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))]!;
}

function metricValues(db: Db, name: string, from: number, to: number): number[] {
  return db
    .all<{ value: number }>('SELECT value FROM metric WHERE name = ? AND ts >= ? AND ts <= ? ORDER BY ts DESC LIMIT ?', name, from, to, REPORT_MAX_METRIC_SAMPLES)
    .map((r) => r.value);
}

function ofType<T extends RadarEvent['type']>(events: readonly RadarEvent[], type: T): RadarEventOf<T>[] {
  return events.filter((e): e is RadarEventOf<T> => e.type === type);
}

const ms = (v: number | null): string =>
  v === null ? '–' : v < 1000 ? `${Math.round(v)} ms` : v < 60_000 ? `${(v / 1000).toFixed(1)} s` : `${(v / 60_000).toFixed(1)} min`;

/** Pipe and newline would break a Markdown table cell. */
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export function buildSessionReport(db: Db, range: { from?: number | undefined; to?: number | undefined }): SessionReportRes {
  const events = rowsToEvents(eventRange(db, range.from ?? 0, range.to ?? Number.MAX_SAFE_INTEGER, REPORT_MAX_EVENTS));
  const first = events[0]?.ts ?? 0;
  const last = events.at(-1)?.ts ?? 0;

  const created = ofType(events, 'task.created');
  const createdIds = new Set(created.map((e) => e.payload.taskId));
  const tasks = listTasks(db).filter((t) => createdIds.has(t.id));
  const commits = ofType(events, 'commit.created');
  const pushFailed = ofType(events, 'commit.push_failed');
  const blocks = ofType(events, 'lock.blocked');
  const decisions = ofType(events, 'request.decided');
  const flagged = ofType(events, 'review.flagged');
  const reviews = ofType(events, 'review.created');
  const syncMs = ofType(events, 'sync.applied').map((e) => e.payload.latencyMs).filter((v) => v >= 0);
  const blockToDecision = events.length > 0 ? metricValues(db, 'block_to_decision_ms', first, last) : [];
  const lockCheck = events.length > 0 ? metricValues(db, 'lock_check_ms', first, last) : [];
  const hookRtt = events.length > 0 ? metricValues(db, 'hook_rtt_ms', first, last) : [];

  const stats: SessionReportRes['stats'] = {
    tasks: tasks.length,
    commits: commits.length,
    blocks: blocks.length,
    decisions: decisions.length,
    medianBlockToDecisionMs: percentile(blockToDecision, 50),
    syncP95Ms: percentile(syncMs, 95),
    lockCheckP95Ms: percentile(lockCheck, 95),
  };

  const lines: string[] = [];
  lines.push('## Laporan sesi');
  lines.push('');
  lines.push(
    events.length === 0
      ? 'Belum ada event di rentang ini.'
      : `${formatClock(first)}–${formatClock(last)} WITA · ${ms(last - first)} · ${events.length} event (#${events[0]!.id}–#${events.at(-1)!.id})`,
  );
  lines.push('');
  lines.push('| Ukuran | Nilai |', '|---|---|');
  lines.push(`| Task | ${stats.tasks} |`);
  lines.push(`| Commit | ${stats.commits}${pushFailed.length > 0 ? ` (gagal push: ${pushFailed.length})` : ''} |`);
  lines.push(`| Blokir | ${stats.blocks} |`);
  lines.push(`| Keputusan PM | ${stats.decisions} |`);
  lines.push(`| Median blokir → keputusan | ${ms(stats.medianBlockToDecisionMs)} |`);
  lines.push(`| Review (ditandai) | ${reviews.length} (${flagged.length}) |`);
  lines.push(`| p95 sinkron | ${ms(stats.syncP95Ms)} |`);
  lines.push(`| p95 cek kunci (server) | ${ms(stats.lockCheckP95Ms)} |`);
  if (hookRtt.length > 0) lines.push(`| p95 cek kunci (RTT hook) | ${ms(percentile(hookRtt, 95))} |`);

  if (tasks.length > 0) {
    const byStatus = TASK_STATUSES.map((s) => [s, tasks.filter((t) => t.status === s).length] as const).filter(([, n]) => n > 0);
    lines.push('', '### Task', '', `Per status: ${byStatus.map(([s, n]) => `${s} ${n}`).join(' · ')}`, '');
    lines.push('| Task | Judul | Pemilik | Status |', '|---|---|---|---|');
    for (const t of tasks) lines.push(`| ${t.id} | ${cell(t.title)} | ${t.owner_id} | ${t.status} |`);
  }
  if (commits.length > 0) {
    lines.push('', '### Commit', '', '| Task | Commit | File |', '|---|---|---|');
    for (const c of commits) {
      const short = c.payload.sha.slice(0, 7);
      const sha = c.payload.url ? `[${short}](${c.payload.url})` : short;
      lines.push(`| ${c.payload.taskId} | ${sha}${c.payload.pushed ? '' : ' (lokal)'} | ${c.payload.files.length} |`);
    }
  }
  if (flagged.length > 0) {
    lines.push('', '### Temuan review', '');
    for (const f of flagged) for (const x of f.payload.flags) lines.push(`- ${f.payload.taskId} · \`${x.path}\`: ${cell(x.issue)}`);
  }
  return { markdown: `${lines.join('\n')}\n`, stats };
}
