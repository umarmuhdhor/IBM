// `GET /v1/files/history?path=&limit=` (R3 §2.22, UI-06): the newest versions of one file, each with its patch
// against the version before it, for the diff viewer.
import type { FilesHistoryRes } from '@radar/common';
import { createTwoFilesPatch } from 'diff';
import type { FileVersionRow } from '../db/repo/file';
import type { Db } from '../db/sql';
import { RadarError } from '../http/errors';

export const HISTORY_DEFAULT_LIMIT = 5;
export const HISTORY_MAX_LIMIT = 20;
/** Per-version patch cap, same order as the task diff (R3 §2.15). */
const HISTORY_MAX_PATCH_BYTES = 30 * 1024;

export function fileHistory(db: Db, path: string, limit: number): FilesHistoryRes {
  // One extra row: the oldest shown version still needs its predecessor for the patch.
  const rows = db.all<FileVersionRow>('SELECT * FROM file_version WHERE path = ? ORDER BY version DESC LIMIT ?', path, limit + 1);
  if (rows.length === 0) throw new RadarError(404, 'NOT_FOUND', `File ${path} tidak ada.`);
  const versions = rows.slice(0, limit).map((v, i) => {
    const prev = rows[i + 1];
    const before = prev && !prev.deleted ? (prev.content ?? '') : '';
    const after = v.deleted ? '' : (v.content ?? '');
    let patch = createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after, prev ? `v${prev.version}` : '', `v${v.version}`, { context: 3 });
    if (patch.length > HISTORY_MAX_PATCH_BYTES) patch = `${patch.slice(0, HISTORY_MAX_PATCH_BYTES)}\n… (dipotong)\n`;
    return { version: v.version, by: v.by ?? 'server', taskId: v.task_id, ai: v.ai === 1, ts: v.ts, patch };
  });
  return { path, versions };
}
