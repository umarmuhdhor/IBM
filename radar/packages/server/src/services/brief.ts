// Brief lines for Bob hooks (R4 §8, R3 §2.3): SessionStart (`start`) and UserPromptSubmit (`prompt`). Read-only:
// the brief never creates tasks or requests, and the cursor lives in the hook's state file.
import { clampBrief, type BriefRes, type LockState } from '@radar/common';
import { allocationsOf } from '../db/repo/allocation';
import { lastBlockFor } from '../db/repo/block';
import { eventsAfter, lastEventId } from '../db/repo/event';
import { listLocks } from '../db/repo/lock';
import { getMember, type MemberRow } from '../db/repo/member';
import { notificationsFor, type NotificationRow } from '../db/repo/notification';
import { listProposals } from '../db/repo/proposal';
import { listRequests } from '../db/repo/request';
import { firstOpenTask, getTask, latestWorkingTask, listTasks, type TaskRow } from '../db/repo/task';
import type { Db } from '../db/sql';
import { RadarError } from '../http/errors';
import { rowsToEvents } from './events';
import { lastBlock } from './requests';

const ACTIVE: readonly TaskRow['status'][] = ['terbuka', 'dikerjakan', 'review'];
const MAX_EVENTS = 500;
const HELD_WORD: Record<LockState, string> = { dipegang: 'dipegang', dipesan: 'dipesan untuk', review: 'sedang di-review milik' };

/** R4 §4 steps 1–3 without side effects (no ad-hoc task is created for a brief). */
function currentTask(db: Db, m: MemberRow): TaskRow | null {
  const t = m.active_task_id ? getTask(db, m.active_task_id) : null;
  if (t && t.owner_id === m.id && ACTIVE.includes(t.status)) return t;
  return latestWorkingTask(db, m.id) ?? firstOpenTask(db, m.id);
}

const taskLine = (t: TaskRow | null) => (t ? `Task aktif: ${t.id} ${t.title} (${t.status}).` : null);

function myTasks(db: Db, memberId: string): TaskRow[] {
  return listTasks(db).filter((t) => t.owner_id === memberId && ACTIVE.includes(t.status));
}

function coderStart(db: Db, m: MemberRow): string[] {
  const task = currentTask(db, m);
  const lines = [task ? `Kamu ${m.id} (${m.role}). ${taskLine(task)}` : `Kamu ${m.id} (${m.role}). Belum ada task. Tunggu rencana PM atau panggil radar my_tasks.`];

  const mine = myTasks(db, m.id);
  const mineIds = new Set(mine.map((t) => t.id));
  const allocs = mine.flatMap((t) => allocationsOf(db, t.id));
  if (allocs.length > 0) {
    const files = allocs
      .sort((a, b) => a.queue_pos - b.queue_pos || a.path.localeCompare(b.path))
      .map((a) => (a.queue_pos > 0 ? `${a.path} (antre #${a.queue_pos})` : a.path));
    lines.push(`File kamu: ${files.join(', ')}`);
  }

  // Files allocated to me but held by someone else first, then the newest other locks.
  const wanted = new Set(allocs.map((a) => a.path));
  const others = listLocks(db).filter((l) => !mineIds.has(l.task_id));
  const ranked = [...others.filter((l) => wanted.has(l.path)), ...others.filter((l) => !wanted.has(l.path)).sort((a, b) => b.acquired_at - a.acquired_at)];
  if (ranked.length > 0) lines.push(`Dipegang orang lain: ${ranked.slice(0, 4).map((l) => `${l.path}→${l.member_id}(${l.task_id})`).join(', ')}`);

  const waiting = listRequests(db, ['terbuka', 'diusulkan']).filter((r) => r.requester_member === m.id);
  if (waiting.length > 0) lines.push(`Menunggu PM: ${waiting.map((r) => `${r.path} (${r.id})`).join(', ')}.`);

  const note = latestNote(db, m.id);
  if (note) lines.push(`Catatan PM: ${note.message}`);
  lines.push('Jangan edit file milik orang lain. Kalau ditolak: radar why_blocked.');
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
  const lines = [`Kamu ${m.id} (pm). Permintaan terbuka: ${open.length}. Usulan menunggu keputusan manusia: ${pending.length}.`];
  if (open.length > 0) lines.push(`Permintaan: ${open.slice(0, 4).map((r) => `${r.id} ${r.path} (${r.requester_member}→${r.holder_member})`).join(', ')}`);
  if (inReview.length > 0) lines.push(`Siap di-review: ${inReview.map((t) => `${t.id} ${t.title}`).join(', ')}`);
  lines.push('PM tidak menulis file. Usulkan lewat radar propose_*; manusia menyetujui di Mission Control.');
  return lines;
}

const NOTE_LABEL: Record<NotificationRow['kind'], string> = { decision: 'Keputusan PM: ', review: 'Review: ', pm_note: 'Catatan PM: ', lock: '', system: '' };
const NOTE_ORDER: NotificationRow['kind'][] = ['decision', 'review', 'pm_note', 'lock', 'system'];

function coderPrompt(db: Db, m: MemberRow, since: number, now: number): string[] {
  const lines: string[] = [];
  const events = rowsToEvents(eventsAfter(db, since, ['lock.blocked', 'lock.reserved', 'file.changed'], MAX_EVENTS));

  // 0. The newest block for me, if it happened after the cursor.
  if (events.some((e) => e.type === 'lock.blocked' && e.payload.memberId === m.id)) {
    const b = lastBlock(db, m.id, now).block;
    const block = lastBlockFor(db, m.id);
    if (b && block) {
      const holder = b.holder ? `${HELD_WORD[b.holder.state]} ${b.holder.memberName} (${b.holder.taskId})` : `dipegang ${block.holder_member} (${block.holder_task})`;
      lines.push(`Edit ${b.path} DITOLAK: ${holder}. Jangan coba ulang, jangan lewat shell. ${b.suggestion}`);
    }
  }

  // 1–3. Decisions, reviews, PM notes and "your turn" messages for me.
  const notes = notificationsFor(db, m.id, since).sort((a, b) => NOTE_ORDER.indexOf(a.kind) - NOTE_ORDER.indexOf(b.kind) || a.event_id - b.event_id);
  for (const n of notes) lines.push(`${NOTE_LABEL[n.kind]}${n.message}`);

  const reserved = events.filter((e) => e.type === 'lock.reserved' && e.payload.memberId === m.id).map((e) => (e.type === 'lock.reserved' ? e.payload.path : ''));
  if (reserved.length > 0) lines.push(`Kunci baru untukmu (dipesan): ${[...new Set(reserved)].join(', ')}.`);

  // 4. Files teammates changed: mine first, at most 5 paths on one line.
  const mineTasks = myTasks(db, m.id);
  const minePaths = new Set(mineTasks.flatMap((t) => allocationsOf(db, t.id).map((a) => a.path)));
  const latest = new Map<string, { by: string; version: number }>();
  for (const e of events) if (e.type === 'file.changed' && e.payload.by !== m.id) latest.set(e.payload.path, { by: e.payload.by, version: e.payload.version });
  const changed = [...latest.entries()].sort(([a], [b]) => Number(minePaths.has(b)) - Number(minePaths.has(a)));
  if (changed.length > 0) lines.push(`Berubah: ${changed.slice(0, 5).map(([p, c]) => `${p} (${c.by},v${c.version})`).join(', ')}`);

  if (lines.length === 0) return [];
  const t = taskLine(currentTask(db, m));
  if (t) lines.push(t);
  return lines;
}

function pmPrompt(db: Db, since: number): string[] {
  const events = rowsToEvents(eventsAfter(db, since, ['request.created', 'task.submitted', 'commit.push_failed'], MAX_EVENTS));
  const lines: string[] = [];
  const requests = events.flatMap((e) => (e.type === 'request.created' ? [`${e.payload.requestId} ${e.payload.path} (${e.payload.requesterMemberId}→${e.payload.holderMemberId ?? '-'})`] : []));
  if (requests.length > 0) lines.push(`Permintaan baru: ${requests.join(', ')}`);
  const submitted = events.flatMap((e) => (e.type === 'task.submitted' ? [e.payload.taskId] : []));
  if (submitted.length > 0) lines.push(`Siap di-review: ${submitted.join(', ')}`);
  const failed = events.flatMap((e) => (e.type === 'commit.push_failed' ? [`${e.payload.taskId} (${e.payload.error})`] : []));
  if (failed.length > 0) lines.push(`Commit gagal: ${failed.join(', ')}`);
  return lines;
}

/** `GET /v1/brief`: at most 6 lines (clampBrief) and the newest event id as the next cursor. */
export function buildBrief(db: Db, memberId: string, kind: 'start' | 'prompt', since: number | undefined, now: number): BriefRes {
  const m = getMember(db, memberId);
  if (!m) throw new RadarError(404, 'NOT_FOUND', `Member ${memberId} tidak ada.`);
  const cursor = lastEventId(db);
  const from = since ?? 0;
  const lines =
    m.role === 'pm' ? (kind === 'start' ? pmStart(db, m) : pmPrompt(db, from)) : kind === 'start' ? coderStart(db, m) : coderPrompt(db, m, from, now);
  return { lines: clampBrief(lines), cursor };
}

