// Member token rotation shared by `/admin/token` and the short join code (IN-03, D-alief-09),
// and the member an open join code creates (D-alief-10).
import { JOIN_MEMBER_IDS, MEMBER_COLORS, WS_CLOSE_REASON_REMOVED, WS_CLOSE_REASON_ROTATED, WS_CLOSE_UNAUTHORIZED, type Role } from '@radar/common';
import { newToken, sha256Hex } from '../crypto';
import type { WorkspaceDeps } from '../deps';
import { insertToken, revokeTokens } from '../db/repo/access';
import { claimJoinCode, deleteMemberJoinCodes } from '../db/repo/join-code';
import { getMeta } from '../db/repo/meta';
import { listTasks } from '../db/repo/task';
import { activePm, getMember, insertMember, markRemoved, renameMember, reseatMember, seatIds } from '../db/repo/member';
import { ctxOf } from '../deps';
import { closeTask } from './tasks';
import { RadarError } from '../http/errors';
import { appendEvent } from './events';

/** Revokes the live tokens of `member` (or of Mission Control for `null`), stores a new one, returns it once. */
export function rotateToken(deps: WorkspaceDeps, member: string | null): string {
  const token = newToken();
  const now = deps.now();
  deps.transact(() => {
    revokeTokens(deps.db, member, now);
    insertToken(deps.db, {
      hash: sha256Hex(token),
      kind: member === null ? 'mc' : 'member',
      memberId: member,
      now,
    });
  });
  // Sessions opened with the old token end now.
  for (const { ws, att } of deps.hub.ready()) {
    const p = att.principal;
    if (member === null ? p.kind === 'mc' : p.kind === 'member' && p.memberId === member)
      deps.hub.close(ws, WS_CLOSE_UNAUTHORIZED, WS_CLOSE_REASON_ROTATED);
  }
  return token;
}

/** Redeeming an open code: adds the teammate under the first free id and binds the code to them. */
export function addMemberForCode(deps: WorkspaceDeps, codeHash: string, name: string, role: Role): string {
  return deps.transact((uow) => {
    const seats = seatIds(deps.db);
    const taken = new Set(seats.map((m) => m.id));
    const removed = new Set(seats.filter((m) => m.removed).map((m) => m.id));
    const free = JOIN_MEMBER_IDS.find((m) => !taken.has(m));
    // D-alief-20: a removed seat's id comes back only when no fresh id is left.
    const id = free ?? JOIN_MEMBER_IDS.find((m) => removed.has(m));
    if (!id) throw new RadarError(409, 'CONFLICT', `This workspace already has ${JOIN_MEMBER_IDS.length} members.`);
    const gitEmail = `${id.toLowerCase()}@users.noreply.radar`;
    if (role === 'pm') {
      const existing = activePm(deps.db);
      if (existing) throw new RadarError(409, 'CONFLICT', `This room already has a PM (${existing.name}). Join as a coder.`);
    }
    if (free) {
      const palette = Object.values(MEMBER_COLORS);
      const color = (MEMBER_COLORS as Record<string, string>)[id] ?? palette[JOIN_MEMBER_IDS.indexOf(id) % palette.length]!;
      insertMember(deps.db, { id, name, role, color, gitName: name, gitEmail });
    } else {
      reseatMember(deps.db, { id, name, role, gitName: name, gitEmail });
    }
    claimJoinCode(deps.db, codeHash, id);
    appendEvent(deps.db, uow, { ts: deps.now(), actor: 'server', type: 'member.created', payload: { memberId: id, name, role } });
    return id;
  });
}

/**
 * D-alief-20: a new open code redeemed with the app's current seat token keeps that seat instead of adding one, so
 * rejoining (e.g. as PM after coder) does not leave an old seat behind. Only the holder of the live token can do this.
 */
export function reuseSeatForCode(deps: WorkspaceDeps, codeHash: string, memberId: string, name: string, role: Role): void {
  deps.transact((uow) => {
    if (role === 'pm') {
      const existing = activePm(deps.db, memberId);
      if (existing) throw new RadarError(409, 'CONFLICT', `This room already has a PM (${existing.name}). Join as a coder.`);
    }
    renameMember(deps.db, memberId, name, role);
    claimJoinCode(deps.db, codeHash, memberId);
    appendEvent(deps.db, uow, { ts: deps.now(), actor: 'server', type: 'member.created', payload: { memberId, name, role } });
  });
}

/**
 * D-alief-20: Mission Control removes a seat. The member's open tasks are cancelled (their locks go to the next in
 * line), their tokens and join codes stop working, and their sockets close with "member removed". The owner's own
 * seat (the member who shared the folder) cannot be removed.
 */
export function removeMember(deps: WorkspaceDeps, memberId: string): void {
  deps.transact((uow) => {
    const member = getMember(deps.db, memberId);
    if (!member) throw new RadarError(404, 'NOT_FOUND', `There is no member ${memberId}.`);
    if (getMeta(deps.db, 'owner_member') === memberId)
      throw new RadarError(409, 'CONFLICT', `${member.name} shares this workspace, so their seat cannot be removed.`);
    const ctx = ctxOf(deps, uow);
    for (const task of listTasks(deps.db)) {
      if (task.owner_id !== memberId) continue;
      if (task.status === 'terbuka' || task.status === 'draf' || task.status === 'dikerjakan') closeTask(ctx, task, 'batal', 'mc');
    }
    const now = deps.now();
    revokeTokens(deps.db, memberId, now);
    deleteMemberJoinCodes(deps.db, memberId);
    markRemoved(deps.db, memberId, now);
    appendEvent(deps.db, uow, { ts: now, actor: 'mc', type: 'member.removed', payload: { memberId } });
  });
  for (const { ws, att } of deps.hub.ready()) {
    if (att.principal.kind === 'member' && att.principal.memberId === memberId)
      deps.hub.close(ws, WS_CLOSE_UNAUTHORIZED, WS_CLOSE_REASON_REMOVED);
  }
}
