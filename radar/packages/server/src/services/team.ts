// `GET /v1/team` (R3 §2.10) and `GET /v1/activity` (R3 §2.8).
import { feedText, type ActivityRes, type RadarEvent, type TeamRes } from '@radar/common';
import { listAllocations, queueOf } from '../db/repo/allocation';
import { recentEvents } from '../db/repo/event';
import { listLocks } from '../db/repo/lock';
import { getMeta } from '../db/repo/meta';
import { listMembers } from '../db/repo/member';
import { listProposals } from '../db/repo/proposal';
import { listRequests } from '../db/repo/request';
import { listTasks } from '../db/repo/task';
import type { Db } from '../db/sql';
import type { Hub } from '../ws/hub';
import { rowsToEvents } from './events';

/** Newest heartbeat per member from the live sockets (attachments survive hibernation). */
function liveHeartbeats(hub: Hub): Map<string, number> {
  const out = new Map<string, number>();
  for (const { att } of hub.ready()) {
    if (att.principal.kind !== 'member') continue;
    const id = att.principal.memberId;
    out.set(id, Math.max(out.get(id) ?? 0, att.lastHeartbeat));
  }
  return out;
}

export function buildTeam(db: Db, hub: Hub, now: number): TeamRes {
  const beats = liveHeartbeats(hub);
  const members = listMembers(db).map((m) => {
    const beat = beats.get(m.id) ?? m.last_heartbeat;
    return {
      id: m.id,
      name: m.name,
      role: m.role,
      online: m.online === 1,
      lastHeartbeatMs: beat === null ? null : Math.max(0, now - beat),
      activeTaskId: m.active_task_id,
    };
  });

  const filesByTask = new Map<string, string[]>();
  for (const a of listAllocations(db)) filesByTask.set(a.task_id, [...(filesByTask.get(a.task_id) ?? []), a.path]);
  const tasks = listTasks(db).map((t) => ({
    id: t.id,
    title: t.title,
    ownerId: t.owner_id,
    status: t.status,
    files: filesByTask.get(t.id) ?? [],
    editCount: t.edit_count,
  }));

  const locks = listLocks(db).map((l) => ({
    path: l.path,
    taskId: l.task_id,
    memberId: l.member_id,
    state: l.state,
    queue: queueOf(db, l.path)
      .filter((e) => e.task_id !== l.task_id)
      .map((e) => e.task_id),
  }));

  return {
    members,
    tasks,
    locks,
    openRequests: listRequests(db, ['terbuka', 'diusulkan']).length,
    pendingProposals: listProposals(db, 'menunggu').length,
    headCommit: getMeta(db, 'head_commit'),
  };
}

const ACTIVITY_SCAN = 500;
/** feedText starts with `HH:mm `; the activity summary has no clock (R3 §2.8). */
const CLOCK_PREFIX_CHARS = 'HH:mm '.length;

function pathOf(ev: RadarEvent): string | undefined {
  const p = (ev.payload as { path?: unknown }).path;
  return typeof p === 'string' ? p : undefined;
}

/** Newest first: events with a feed sentence, optionally only those about `path`. */
export function listActivity(db: Db, path: string | undefined, limit: number): ActivityRes {
  const items: ActivityRes['items'] = [];
  for (const ev of rowsToEvents(recentEvents(db, ACTIVITY_SCAN)).reverse()) {
    if (items.length === limit) break;
    const evPath = pathOf(ev);
    if (path !== undefined && evPath !== path) continue;
    const text = feedText(ev);
    if (text === null) continue;
    items.push({ ts: ev.ts, actor: ev.actor, type: ev.type, ...(evPath ? { path: evPath } : {}), summary: text.slice(CLOCK_PREFIX_CHARS) });
  }
  return { items };
}
