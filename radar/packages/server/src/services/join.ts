// Member token rotation shared by `/admin/token` and the short join code (IN-03, D-alief-09),
// and the member an open join code creates (D-alief-10).
import { JOIN_MEMBER_IDS, MEMBER_COLORS, type Role } from '@radar/common';
import { newToken, sha256Hex } from '../crypto';
import type { WorkspaceDeps } from '../deps';
import { insertToken, revokeTokens } from '../db/repo/access';
import { claimJoinCode } from '../db/repo/join-code';
import { insertMember, listMembers } from '../db/repo/member';
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
      deps.hub.close(ws, 4401, 'token rotated');
  }
  return token;
}

/** Redeeming an open code: adds the teammate under the first free id and binds the code to them. */
export function addMemberForCode(deps: WorkspaceDeps, codeHash: string, name: string, role: Role): string {
  return deps.transact((uow) => {
    const taken = new Set(listMembers(deps.db).map((m) => m.id));
    const id = JOIN_MEMBER_IDS.find((m) => !taken.has(m));
    if (!id) throw new RadarError(409, 'CONFLICT', `This workspace already has ${JOIN_MEMBER_IDS.length} members.`);
    const palette = Object.values(MEMBER_COLORS);
    const color = (MEMBER_COLORS as Record<string, string>)[id] ?? palette[JOIN_MEMBER_IDS.indexOf(id) % palette.length]!;
    insertMember(deps.db, { id, name, role, color, gitName: name, gitEmail: `${id.toLowerCase()}@users.noreply.radar` });
    claimJoinCode(deps.db, codeHash, id);
    appendEvent(deps.db, uow, { ts: deps.now(), actor: 'server', type: 'member.created', payload: { memberId: id, name, role } });
    return id;
  });
}
