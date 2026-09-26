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

export function listMembers(db: Db): MemberRow[] {
  return db.all<MemberRow>('SELECT * FROM member ORDER BY id');
}

export function getMember(db: Db, id: string): MemberRow | null {
  return db.one<MemberRow>('SELECT * FROM member WHERE id = ?', id);
}

export function setOnline(db: Db, id: string, online: boolean): void {
  db.run('UPDATE member SET online = ? WHERE id = ? AND online != ?', online ? 1 : 0, id, online ? 1 : 0);
}

/** Written only on socket close (R4 §7): heartbeats live in the WebSocket attachment. */
export function setOffline(db: Db, id: string, lastHeartbeat: number): void {
  db.run('UPDATE member SET online = 0, last_heartbeat = ? WHERE id = ?', lastHeartbeat, id);
}
