// Heartbeat expiry (SV-09, R4 §7): a coder who holds at least one lock and has not sent a heartbeat for
// HEARTBEAT_EXPIRE_MS gets one `member.stale` per episode, so Mission Control can offer "Cabut kunci" per file.
// Locks are never revoked here. The episode ends when the member comes back (`member.online`).
import { HEARTBEAT_EXPIRE_MS } from '@radar/common';
import type { WorkspaceDeps } from '../deps';
import { listLocks } from '../db/repo/lock';
import { listMembers } from '../db/repo/member';
import type { Db } from '../db/sql';
import type { Hub } from '../ws/hub';
import { appendEvent } from './events';

/** `HEARTBEAT_EXPIRE_MS` from env (demo: 60000), else the R4 default. Values under 1 s are ignored. */
export function heartbeatExpireMs(env: { HEARTBEAT_EXPIRE_MS?: string }): number {
  const v = Number(env.HEARTBEAT_EXPIRE_MS);
  return Number.isFinite(v) && v >= 1000 ? v : HEARTBEAT_EXPIRE_MS;
}

/** True while the member's latest presence event is `member.stale`. */
export function isStale(db: Db, memberId: string): boolean {
  const row = db.one<{ type: string }>(
    `SELECT type FROM event WHERE type IN ('member.stale','member.online','member.reconnected')
       AND json_extract(payload, '$.memberId') = ? ORDER BY id DESC LIMIT 1`,
    memberId,
  );
  return row?.type === 'member.stale';
}

interface Candidate {
  memberId: string;
  lastHeartbeat: number;
}

/** Coders holding a lock, with their newest heartbeat (live socket first, else the value saved on close). */
function lockHolders(db: Db, hub: Hub): Candidate[] {
  const holders = new Set(listLocks(db).map((l) => l.member_id));
  if (holders.size === 0) return [];
  const beats = new Map<string, number>();
  for (const { att } of hub.ready(['sync'])) {
    if (att.principal.kind !== 'member') continue;
    const id = att.principal.memberId;
    beats.set(id, Math.max(beats.get(id) ?? 0, att.lastHeartbeat));
  }
  const out: Candidate[] = [];
  for (const m of listMembers(db)) {
    if (m.role !== 'coder' || !holders.has(m.id)) continue;
    // A member who never connected has no heartbeat to expire (locks reserved by a plan before they joined).
    const beat = beats.get(m.id) ?? m.last_heartbeat;
    if (beat !== null) out.push({ memberId: m.id, lastHeartbeat: beat });
  }
  return out;
}

/** Alarm deadline provider: the earliest expiry among lock holders that are not stale yet, or null. */
export function staleDeadline(deps: WorkspaceDeps): number | null {
  const expire = heartbeatExpireMs(deps.env);
  let next: number | null = null;
  for (const c of lockHolders(deps.db, deps.hub)) {
    if (isStale(deps.db, c.memberId)) continue;
    const at = c.lastHeartbeat + expire + 1;
    if (next === null || at < next) next = at;
  }
  return next;
}

/** Alarm job (idempotent): emits `member.stale` for each holder past the expiry that is not stale yet. */
export function expireHeartbeats(deps: WorkspaceDeps): string[] {
  const now = deps.now();
  const expire = heartbeatExpireMs(deps.env);
  return deps.transact((uow) => {
    const marked: string[] = [];
    for (const c of lockHolders(deps.db, deps.hub)) {
      if (now - c.lastHeartbeat <= expire || isStale(deps.db, c.memberId)) continue;
      appendEvent(deps.db, uow, { ts: now, actor: 'server', type: 'member.stale', payload: { memberId: c.memberId, lastHeartbeat: c.lastHeartbeat } });
      marked.push(c.memberId);
    }
    return marked;
  });
}

/** A heartbeat from a stale member ends the episode (`member.online`), so a later silence is reported again. */
export function endStaleEpisode(deps: WorkspaceDeps, memberId: string): void {
  if (!isStale(deps.db, memberId)) return;
  deps.transact((uow) => appendEvent(deps.db, uow, { ts: deps.now(), actor: memberId, type: 'member.online', payload: { memberId } }));
}
