// Token hashes (R2 table `token`; module named access.ts per R5 §8). Plain tokens are never stored or logged.
import type { Principal, Role } from '@radar/common';
import type { Db } from '../sql';

export function insertToken(db: Db, t: { hash: string; kind: 'member' | 'mc'; memberId: string | null; now: number }): void {
  db.run('INSERT INTO token (hash, kind, member_id, created_at) VALUES (?, ?, ?, ?)', t.hash, t.kind, t.memberId, t.now);
}

/** Revokes every live token of a member (`memberId`) or of Mission Control (`null`). */
export function revokeTokens(db: Db, memberId: string | null, now: number): void {
  if (memberId === null) db.run("UPDATE token SET revoked_at = ? WHERE kind = 'mc' AND revoked_at IS NULL", now);
  else db.run("UPDATE token SET revoked_at = ? WHERE kind = 'member' AND member_id = ? AND revoked_at IS NULL", now, memberId);
}

/** Looks a token up by its sha256 hex (primary key). Revoked tokens and deleted members give null. */
export function principalByHash(db: Db, hash: string): Principal | null {
  const row = db.one<{ kind: string; member_id: string | null; role: Role | null }>(
    'SELECT t.kind, t.member_id, m.role FROM token t LEFT JOIN member m ON m.id = t.member_id WHERE t.hash = ? AND t.revoked_at IS NULL',
    hash,
  );
  if (!row) return null;
  if (row.kind === 'mc') return { kind: 'mc' };
  if (row.member_id === null || row.role === null) return null;
  return { kind: 'member', memberId: row.member_id, role: row.role };
}
