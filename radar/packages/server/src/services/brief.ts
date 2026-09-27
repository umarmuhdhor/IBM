// Brief lines for Bob hooks (R4 §8, R3 §2.3): SessionStart (`start`) and UserPromptSubmit (`prompt`). Read-only:
// the brief never creates tasks or requests, and the cursor lives in the hook's state file.
import { clampBrief, type BriefRes, type LockState } from '@radar/common';
import { allocationsOf } from '../db/repo/allocation';
import { lastBlockFor } from '../db/repo/block';
import { eventsAfter, lastEventId } from '../db/repo/event';
import { listLocks, rangeOf, type LockRow } from '../db/repo/lock';
import { getMember, type MemberRow } from '../db/repo/member';
import { notificationsFor, type NotificationRow } from '../db/repo/notification';
import { listProposals } from '../db/repo/proposal';
import { listRequests } from '../db/repo/request';
import { firstOpenTask, getTask, latestWorkingTask, listTasks, type TaskRow } from '../db/repo/task';
import type { Db } from '../db/sql';
import { RadarError } from '../http/errors';
import { rowsToEvents } from './events';
import { lastBlock } from './requests';

/** D-alief-17: `:3-5` for a range lock, nothing for a whole-file lock. */
function lineSuffix(l: LockRow): string {
  const r = rangeOf(l);
  return r ? `:${r.start}-${r.end}` : '';
}

const ACTIVE: readonly TaskRow['status'][] = ['terbuka', 'dikerjakan', 'review'];
const MAX_EVENTS = 500;
const HELD_WORD: Record<LockState, string> = { dipegang: 'held by', dipesan: 'reserved for', review: 'in review for' };

/** R4 §4 steps 1–3 without side effects (no ad-hoc task is created for a brief). */
function currentTask(db: Db, m: MemberRow): TaskRow | null {
  const t = m.active_task_id ? getTask(db, m.active_task_id) : null;
  if (t && t.owner_id === m.id && ACTIVE.includes(t.status)) return t;
  return latestWorkingTask(db, m.id) ?? firstOpenTask(db, m.id);
}

const taskLine = (t: TaskRow | null) => (t ? `Active task: ${t.id} ${t.title} (${t.status}).` : null);

function myTasks(db: Db, memberId: string): TaskRow[] {
  return listTasks(db).filter((t) => t.owner_id === memberId && ACTIVE.includes(t.status));
}

function coderStart(db: Db, m: MemberRow): string[] {
  const task = currentTask(db, m);
  const lines = [task ? `You are ${m.id} (${m.role}). ${taskLine(task)}` : `You are ${m.id} (${m.role}). No task yet. Wait for the PM's plan or call radar my_tasks.`];

  const mine = myTasks(db, m.id);
  const mineIds = new Set(mine.map((t) => t.id));
  const allocs = mine.flatMap((t) => allocationsOf(db, t.id));
  if (allocs.length > 0) {
    const files = allocs
      .sort((a, b) => a.queue_pos - b.queue_pos || a.path.localeCompare(b.path))
      .map((a) => (a.queue_pos > 0 ? `${a.path} (queued #${a.queue_pos})` : a.path));
    lines.push(`Your files: ${files.join(', ')}`);
  }

  // Files allocated to me but held by someone else first, then the newest other locks.
  const wanted = new Set(allocs.map((a) => a.path));
  const others = listLocks(db).filter((l) => !mineIds.has(l.task_id));
  const ranked = [...others.filter((l) => wanted.has(l.path)), ...others.filter((l) => !wanted.has(l.path)).sort((a, b) => b.acquired_at - a.acquired_at)];
  if (ranked.length > 0) lines.push(`Held by others: ${ranked.slice(0, 4).map((l) => `${l.path}${lineSuffix(l)}→${l.member_id}(${l.task_id})`).join(', ')}`);

  const waiting = listRequests(db, ['terbuka', 'diusulkan']).filter((r) => r.requester_member === m.id);
  if (waiting.length > 0) lines.push(`Waiting for the PM: ${waiting.map((r) => `${r.path} (${r.id})`).join(', ')}.`);

  const note = latestNote(db, m.id);
  if (note) lines.push(`PM note: ${note.message}`);
  lines.push('Do not edit files others hold. If an edit is refused: radar why_blocked.');
  return lines;
}

function latestNote(db: Db, memberId: string): NotificationRow | null {
  const notes = notificationsFor(db, memberId, 0).filter((n) => n.kind === 'pm_note');
  return notes[notes.length - 1] ?? null;
}

function pmStart(db: Db, m: MemberRow): string[] {
  const open = listRequests(db, ['terbuka']);
  const pending = listProposals(db, 'menunggu');
  const inReview = listTasks(db).filter((t) => t.status === 'review' && !pending.some((p) => p.kind === 'review' && p.ref_id === t.id));
  const lines = [`You are ${m.id} (pm). Open requests: ${open.length}. Proposals waiting for a human decision: ${pending.length}.`];
  if (open.length > 0) lines.push(`Requests: ${open.slice(0, 4).map((r) => `${r.id} ${r.path} (${r.requester_member}→${r.holder_member})`).join(', ')}`);
  if (inReview.length > 0) lines.push(`Ready for review: ${inReview.map((t) => `${t.id} ${t.title}`).join(', ')}`);
  lines.push('The PM does not write code; it may add documents (.md, .txt) such as a brief. Propose with radar propose_*; a human approves in Mission Control.');
  return lines;
}

const NOTE_LABEL: Record<NotificationRow['kind'], string> = { decision: 'PM decision: ', review: 'Review: ', pm_note: 'PM note: ', lock: '', system: '' };
const NOTE_ORDER: NotificationRow['kind'][] = ['decision', 'review', 'pm_note', 'lock', 'system'];

function coderPrompt(db: Db, m: MemberRow, since: number, now: number): string[] {
  const lines: string[] = [];
  const events = rowsToEvents(eventsAfter(db, since, ['lock.blocked', 'lock.reserved', 'file.changed'], MAX_EVENTS));

  // 0. The newest block for me, if it happened after the cursor.
  if (events.some((e) => e.type === 'lock.blocked' && e.payload.memberId === m.id)) {
    const b = lastBlock(db, m.id, now).block;
    const block = lastBlockFor(db, m.id);
    if (b && block) {
      const holder = b.holder ? `${HELD_WORD[b.holder.state]} ${b.holder.memberName} (${b.holder.taskId})` : `held by ${block.holder_member} (${block.holder_task})`;
      lines.push(`Edit to ${b.path} REFUSED: ${holder}. Do not retry, do not go through the shell. ${b.suggestion}`);
    }
  }

  // 1–3. Decisions, reviews, PM notes and "your turn" messages for me.
  const notes = notificationsFor(db, m.id, since).sort((a, b) => NOTE_ORDER.indexOf(a.kind) - NOTE_ORDER.indexOf(b.kind) || a.event_id - b.event_id);
  for (const n of notes) lines.push(`${NOTE_LABEL[n.kind]}${n.message}`);

  const reserved = events.filter((e) => e.type === 'lock.reserved' && e.payload.memberId === m.id).map((e) => (e.type === 'lock.reserved' ? e.payload.path : ''));
  if (reserved.length > 0) lines.push(`New locks reserved for you: ${[...new Set(reserved)].join(', ')}.`);

  // 4. Files teammates changed: mine first, at most 5 paths on one line.
  const mineTasks = myTasks(db, m.id);
  const minePaths = new Set(mineTasks.flatMap((t) => allocationsOf(db, t.id).map((a) => a.path)));
  const latest = new Map<string, { by: string; version: number }>();
  for (const e of events) if (e.type === 'file.changed' && e.payload.by !== m.id) latest.set(e.payload.path, { by: e.payload.by, version: e.payload.version });
  const changed = [...latest.entries()].sort(([a], [b]) => Number(minePaths.has(b)) - Number(minePaths.has(a)));
  if (changed.length > 0) lines.push(`Changed: ${changed.slice(0, 5).map(([p, c]) => `${p} (${c.by},v${c.version})`).join(', ')}`);

  if (lines.length === 0) return [];
  const t = taskLine(currentTask(db, m));
  if (t) lines.push(t);
  return lines;
}

function pmPrompt(db: Db, since: number): string[] {
  const events = rowsToEvents(eventsAfter(db, since, ['request.created', 'task.submitted', 'commit.push_failed'], MAX_EVENTS));
  const lines: string[] = [];
  const requests = events.flatMap((e) => (e.type === 'request.created' ? [`${e.payload.requestId} ${e.payload.path} (${e.payload.requesterMemberId}→${e.payload.holderMemberId ?? '-'})`] : []));
  if (requests.length > 0) lines.push(`New requests: ${requests.join(', ')}`);
  const submitted = events.flatMap((e) => (e.type === 'task.submitted' ? [e.payload.taskId] : []));
  if (submitted.length > 0) lines.push(`Ready for review: ${submitted.join(', ')}`);
  const failed = events.flatMap((e) => (e.type === 'commit.push_failed' ? [`${e.payload.taskId} (${e.payload.error})`] : []));
  if (failed.length > 0) lines.push(`Commit failed: ${failed.join(', ')}`);
  return lines;
}

/** `GET /v1/brief`: at most 6 lines (clampBrief) and the newest event id as the next cursor. */
export function buildBrief(db: Db, memberId: string, kind: 'start' | 'prompt', since: number | undefined, now: number): BriefRes {
  const m = getMember(db, memberId);
  if (!m) throw new RadarError(404, 'NOT_FOUND', `There is no member ${memberId}.`);
  const cursor = lastEventId(db);
  const from = since ?? 0;
  const lines =
    m.role === 'pm' ? (kind === 'start' ? pmStart(db, m) : pmPrompt(db, from)) : kind === 'start' ? coderStart(db, m) : coderPrompt(db, m, from, now);
  return { lines: clampBrief(lines), cursor };
}

