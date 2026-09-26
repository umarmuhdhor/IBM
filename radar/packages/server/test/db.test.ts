import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { freshWorkspace } from './helpers';

describe('SQLite schema in the Durable Object (R2)', () => {
  it('migrates on construction and records schema_version = 1', async () => {
    const { stub } = freshWorkspace();
    const v = await runInDurableObject(stub, (_i, state) =>
      state.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'").toArray(),
    );
    expect(v).toEqual([{ value: '1' }]);
  });

  it('enforces foreign keys (R2 §1)', async () => {
    const { stub } = freshWorkspace();
    await runInDurableObject(stub, (_i, state) => {
      const sql = state.storage.sql;
      expect(sql.exec<{ foreign_keys: number }>('PRAGMA foreign_keys').one().foreign_keys).toBe(1);
      expect(() =>
        sql.exec("INSERT INTO lock (path, task_id, member_id, state, acquired_at, updated_at) VALUES ('a.ts', 'T-404', 'Z', 'dipegang', 0, 0)"),
      ).toThrow(/FOREIGN KEY/i);
    });
  });

  it('every R2 table exists', async () => {
    const { stub } = freshWorkspace();
    const names = await runInDurableObject(stub, (_i, state) =>
      state.storage.sql
        .exec<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'")
        .toArray()
        .map((r) => r.name)
        .sort(),
    );
    expect(names).toEqual(
      ['allocation', 'block', 'counter', 'event', 'file', 'file_version', 'lock', 'member', 'meta', 'metric', 'notification', 'proposal', 'request', 'review', 'task', 'task_touch', 'token'].sort(),
    );
  });
});
