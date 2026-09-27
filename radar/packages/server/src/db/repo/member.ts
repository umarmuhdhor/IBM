// `member` rows (R2 §2).
import type { Role } from '@radar/common';
import type { Db } from '../sql';

export interface MemberRow {
  [k: string]: string | number | null;
  id: string;
  name: string;
  role: Role;
  color: string;
  git_name: string;
  git_email: string;
  active_task_id: string | null;
  last_heartbeat: number | null;
  online: number;
  removed_at: number | null;
}

export function insertMember(db: Db, m: { id: string; name: string; role: Role; color: string; gitName: string; gitEmail: string }): void {
  db.run(
    'INSERT INTO member (id, name, role, color, git_name, git_email) VALUES (?, ?, ?, ?, ?, ?)',
    m.id,
    m.name,
    m.role,
    m.color,
    m.gitName,
    m.gitEmail,
  );
}

/** A seat taken again from the same app (D-alief-20): the teammate may pick a new name or role. */
export function renameMember(db: Db, id: string, name: string, role: Role): void {
  db.run('UPDATE member SET name = ?, role = ?, git_name = ? WHERE id = ?', name, role, name, id);
}

/** Active members; a seat the owner removed (D-alief-20) is left out. */
export function listMembers(db: Db): MemberRow[] {
  return db.all<MemberRow>('SELECT * FROM member WHERE removed_at IS NULL ORDER BY id');
}

/** Every id ever seated, removed ones too: a removed id is reused only when no other id is free. */
export function seatIds(db: Db): { id: string; removed: boolean }[] {
  return db.all<{ id: string; removed_at: number | null }>('SELECT id, removed_at FROM member ORDER BY id').map((r) => ({ id: r.id, removed: r.removed_at !== null }));
}

export function getMember(db: Db, id: string): MemberRow | null {
  return db.one<MemberRow>('SELECT * FROM member WHERE id = ? AND removed_at IS NULL', id);
}

/** D-alief-20: the seat leaves the team; its row stays so old tasks and events keep their author. */
export function markRemoved(db: Db, id: string, now: number): void {
  db.run('UPDATE member SET removed_at = ?, online = 0, active_task_id = NULL WHERE id = ?', now, id);
}

/** A removed id seats a newcomer when every other id is taken. */
export function reseatMember(db: Db, m: { id: string; name: string; role: Role; gitName: string; gitEmail: string }): void {
  db.run(
    'UPDATE member SET name = ?, role = ?, git_name = ?, git_email = ?, removed_at = NULL, online = 0, active_task_id = NULL, last_heartbeat = NULL WHERE id = ?',
    m.name,
    m.role,
    m.gitName,
    m.gitEmail,
    m.id,
  );
}

/** Whether `id` is a seat the owner removed (for the 401 reason). */
export function isRemovedMember(db: Db, id: string): boolean {
  return db.one<{ n: number }>('SELECT COUNT(*) AS n FROM member WHERE id = ? AND removed_at IS NOT NULL', id)!.n > 0;
}

export function setOnline(db: Db, id: string, online: boolean): void {
  db.run('UPDATE member SET online = ? WHERE id = ? AND online != ?', online ? 1 : 0, id, online ? 1 : 0);
}

/** Written only on socket close (R4 §7): heartbeats live in the WebSocket attachment. */
export function setOffline(db: Db, id: string, lastHeartbeat: number): void {
  db.run('UPDATE member SET online = 0, last_heartbeat = ? WHERE id = ?', lastHeartbeat, id);
}

export function setActiveTask(db: Db, id: string, taskId: string | null): void {
  db.run('UPDATE member SET active_task_id = ? WHERE id = ? AND active_task_id IS NOT ?', taskId, id, taskId);
}

/** The active PM seat, excluding `exceptId` (pass the seat being reused so it doesn't block itself). */
export function activePm(db: Db, exceptId?: string): MemberRow | null {
  if (exceptId !== undefined) {
    return db.one<MemberRow>("SELECT * FROM member WHERE role = 'pm' AND removed_at IS NULL AND id != ?", exceptId);
  }
  return db.one<MemberRow>("SELECT * FROM member WHERE role = 'pm' AND removed_at IS NULL");
}

/** An offline active seat (removed_at IS NULL, online = 0) whose name matches case-insensitively; lowest id first. */
export function offlineMemberNamed(db: Db, name: string): MemberRow | null {
  return db.one<MemberRow>(
    "SELECT * FROM member WHERE removed_at IS NULL AND online = 0 AND TRIM(LOWER(name)) = TRIM(LOWER(?)) ORDER BY id LIMIT 1",
    name,
  );
}
