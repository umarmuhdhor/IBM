// `POST /v1/ai-edits` (R3 §2.20, BC-05): the PostToolUse hook says "Bob wrote these paths". The matching
// `file_version` gets `ai=1`. The hook usually arrives before the sync agent uploads the save, so a path without
// a recent version is remembered in `ai_mark` and applied by the next update of that member within the window.
import type { Db } from '../db/sql';
import { appendEvent } from './events';
import type { UnitOfWork } from './uow';

/** How far apart the hook call and the saved version may be (fase 12 step 7). */
export const AI_MARK_WINDOW_MS = 10_000;

/** Marks the member's newest version of each path from the last 10 s, else remembers the path. Emits `ai.edit`. */
export function markAiEdits(db: Db, uow: UnitOfWork, now: number, memberId: string, paths: readonly string[], tool: string): void {
  // Marks whose save never came (edit cancelled, path not synced) can never apply: drop them so the table stays small.
  db.run('DELETE FROM ai_mark WHERE ts < ?', now - AI_MARK_WINDOW_MS);
  for (const path of paths) {
    const v = db.one<{ version: number }>(
      'SELECT version FROM file_version WHERE path = ? AND by = ? AND ts >= ? ORDER BY version DESC LIMIT 1',
      path,
      memberId,
      now - AI_MARK_WINDOW_MS,
    );
    if (v) db.run('UPDATE file_version SET ai = 1 WHERE path = ? AND version = ?', path, v.version);
    else db.run('INSERT INTO ai_mark (member_id, path, ts) VALUES (?, ?, ?) ON CONFLICT(member_id, path) DO UPDATE SET ts = excluded.ts', memberId, path, now);
  }
  appendEvent(db, uow, { ts: now, actor: memberId, type: 'ai.edit', payload: { memberId, paths: [...paths], tool } });
}

/** Called for every accepted update: a pending mark of this member and path turns this version into `ai=1`. */
export function applyPendingAiMark(db: Db, now: number, memberId: string, path: string, version: number): void {
  const mark = db.one<{ ts: number }>('SELECT ts FROM ai_mark WHERE member_id = ? AND path = ?', memberId, path);
  if (!mark) return;
  db.run('DELETE FROM ai_mark WHERE member_id = ? AND path = ?', memberId, path);
  if (now - mark.ts <= AI_MARK_WINDOW_MS) db.run('UPDATE file_version SET ai = 1 WHERE path = ? AND version = ?', path, version);
}
