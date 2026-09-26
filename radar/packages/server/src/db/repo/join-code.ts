// `join_code` rows (IN-03, D-alief-09). Only the sha256 of a code is stored, like tokens.
// `member_id` is NULL for an open code until someone redeems it (D-alief-10), and always NULL for an owner code
// (`owner = 1`, D-alief-11), which is redeemed for a Mission Control token.
import type { Db } from '../sql';

export function insertJoinCode(
  db: Db,
  c: { hash: string; memberId: string | null; owner?: boolean; now: number; expiresAt: number },
): void {
  db.run(
    'INSERT INTO join_code (hash, member_id, owner, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    c.hash,
    c.memberId,
    c.owner ? 1 : 0,
    c.now,
    c.expiresAt,
  );
}

/** A live code (`memberId` null while it is still open), or null when the code is unknown or expired. */
export function findJoinCode(db: Db, hash: string, now: number): { memberId: string | null; owner: boolean } | null {
  const row = db.one<{ member_id: string | null; owner: number }>(
    'SELECT member_id, owner FROM join_code WHERE hash = ? AND expires_at > ?',
    hash,
    now,
  );
  return row ? { memberId: row.member_id, owner: row.owner === 1 } : null;
}

/** Binds an open code to the member it created; later redeems sign that member in again. */
export function claimJoinCode(db: Db, hash: string, memberId: string): void {
  db.run('UPDATE join_code SET member_id = ? WHERE hash = ? AND member_id IS NULL AND owner = 0', memberId, hash);
}

export function deleteExpiredJoinCodes(db: Db, now: number): void {
  db.run('DELETE FROM join_code WHERE expires_at <= ?', now);
}
