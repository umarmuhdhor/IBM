// `file` (current version) and `file_version` (every version) rows (R2 §2, invariant I6).
import type { Db } from '../sql';

export interface FileMetaRow {
  [k: string]: string | number | null;
  path: string;
  version: number;
  hash: string;
  deleted: number;
  size: number;
  updated_by: string | null;
  updated_task_id: string | null;
  updated_at: number;
}

export interface FileRow extends FileMetaRow {
  content: string | null;
}

export interface FileVersionRow {
  [k: string]: string | number | null;
  path: string;
  version: number;
  hash: string;
  content: string | null;
  deleted: number;
  by: string | null;
  task_id: string | null;
  ai: number;
  ts: number;
}

export function getFile(db: Db, path: string): FileRow | null {
  return db.one<FileRow>('SELECT * FROM file WHERE path = ?', path);
}

/** Metadata only (no content), ordered by path. */
export function listFileMeta(db: Db): FileMetaRow[] {
  return db.all<FileMetaRow>('SELECT path, version, hash, deleted, size, updated_by, updated_task_id, updated_at FROM file ORDER BY path');
}

export function listFilesWithContent(db: Db): FileRow[] {
  return db.all<FileRow>('SELECT * FROM file ORDER BY path');
}

export interface FileWrite {
  path: string;
  version: number;
  hash: string;
  content: string | null;
  size: number;
  by: string | null;
  taskId: string | null;
  now: number;
}

/** Writes the current row and the matching `file_version` row. Call inside `db.tx`. */
export function writeFileVersion(db: Db, w: FileWrite): void {
  const deleted = w.content === null ? 1 : 0;
  db.run(
    `INSERT INTO file (path, version, hash, content, deleted, size, updated_by, updated_task_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET version = excluded.version, hash = excluded.hash, content = excluded.content,
       deleted = excluded.deleted, size = excluded.size, updated_by = excluded.updated_by,
       updated_task_id = excluded.updated_task_id, updated_at = excluded.updated_at`,
    w.path,
    w.version,
    w.hash,
    w.content,
    deleted,
    w.size,
    w.by,
    w.taskId,
    w.now,
  );
  db.run(
    `INSERT INTO file_version (path, version, hash, content, deleted, by, task_id, ai, ts) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(path, version) DO UPDATE SET hash = excluded.hash, content = excluded.content, deleted = excluded.deleted,
       by = excluded.by, task_id = excluded.task_id, ts = excluded.ts`,
    w.path,
    w.version,
    w.hash,
    w.content,
    deleted,
    w.by,
    w.taskId,
    w.now,
  );
}

export function getFileVersion(db: Db, path: string, version: number): FileVersionRow | null {
  return db.one<FileVersionRow>('SELECT * FROM file_version WHERE path = ? AND version = ?', path, version);
}
