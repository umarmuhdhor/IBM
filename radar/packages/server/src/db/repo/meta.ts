// `meta` key/value rows (R2 §2): schema_version, workspace_id, workspace_name, repo_url, head_commit, created_at.
import type { Db } from '../sql';

export type MetaKey = 'schema_version' | 'workspace_id' | 'workspace_name' | 'repo_url' | 'head_commit' | 'created_at' | 'branch';

export function getMeta(db: Db, key: MetaKey): string | null {
  return db.one<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)?.value ?? null;
}

export function setMeta(db: Db, key: MetaKey, value: string): void {
  db.run('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export function deleteMeta(db: Db, key: MetaKey): void {
  db.run('DELETE FROM meta WHERE key = ?', key);
}
