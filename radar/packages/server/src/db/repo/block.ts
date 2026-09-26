// `block` rows (R2 §2): every refused write, the source of `why_blocked` and the brief's block line.
import type { BlockVia } from '@radar/common';
import type { Db } from '../sql';

export interface BlockRow {
  [k: string]: string | number | null;
  id: number;
  member_id: string;
  task_id: string | null;
  path: string;
  holder_member: string;
  holder_task: string;
  via: BlockVia;
  request_id: string | null;
  ts: number;
}

export function insertBlock(
  db: Db,
  b: { memberId: string; taskId: string | null; path: string; holderMember: string; holderTask: string; via: BlockVia; requestId: string | null; now: number },
): BlockRow {
  const row = db.one<BlockRow>(
    'INSERT INTO block (member_id, task_id, path, holder_member, holder_task, via, request_id, ts) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *',
    b.memberId,
    b.taskId,
    b.path,
    b.holderMember,
    b.holderTask,
    b.via,
    b.requestId,
    b.now,
  );
  if (!row) throw new Error('block insert returned no row');
  return row;
}

export function lastBlockFor(db: Db, memberId: string): BlockRow | null {
  return db.one<BlockRow>('SELECT * FROM block WHERE member_id = ? ORDER BY id DESC LIMIT 1', memberId);
}
