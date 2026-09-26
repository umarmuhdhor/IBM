// Member token rotation shared by `/admin/token` and the short join code (IN-03, D-alief-09).
import { newToken, sha256Hex } from '../crypto';
import type { WorkspaceDeps } from '../deps';
import { insertToken, revokeTokens } from '../db/repo/access';

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
