// `join_code` rows (IN-03, D-alief-09). Only the sha256 of a code is stored, like tokens.
// `member_id` is NULL for an open code until someone redeems it (D-alief-10).
import type { Db } from '../sql';

export function insertJoinCode(
  db: Db,
  c: { hash: string; memberId: string | null; now: number; expiresAt: number },
): void {
  db.run(
    'INSERT INTO join_code (hash, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    c.hash,
    c.memberId,
    c.now,
    c.expiresAt,
  );
}

/** A live code (`memberId` null while it is still open), or null when the code is unknown or expired. */
export function findJoinCode(db: Db, hash: string, now: number): { memberId: string | null } | null {
  const row = db.one<{ member_id: string | null }>(
    'SELECT member_id FROM join_code WHERE hash = ? AND expires_at > ?',
    hash,
    now,
  );
  return row ? { memberId: row.member_id } : null;
}

/** Binds an open code to the member it created; later redeems sign that member in again. */
export function claimJoinCode(db: Db, hash: string, memberId: string): void {
  db.run('UPDATE join_code SET member_id = ? WHERE hash = ? AND member_id IS NULL', memberId, hash);
}

export function deleteExpiredJoinCodes(db: Db, now: number): void {
  db.run('DELETE FROM join_code WHERE expires_at <= ?', now);
}
