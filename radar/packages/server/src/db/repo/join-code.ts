// `join_code` rows (IN-03, D-alief-09). Only the sha256 of a code is stored, like tokens.
import type { Db } from '../sql';

export function insertJoinCode(
  db: Db,
  c: { hash: string; memberId: string; now: number; expiresAt: number },
): void {
  db.run(
    'INSERT INTO join_code (hash, member_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    c.hash,
    c.memberId,
    c.now,
    c.expiresAt,
  );
}

/** Member id of a live code, or null when the code is unknown or expired. */
export function memberForJoinCode(db: Db, hash: string, now: number): string | null {
  return (
    db.one<{ member_id: string }>(
      'SELECT member_id FROM join_code WHERE hash = ? AND expires_at > ?',
      hash,
      now,
    )?.member_id ?? null
  );
}

export function deleteExpiredJoinCodes(db: Db, now: number): void {
  db.run('DELETE FROM join_code WHERE expires_at <= ?', now);
}
