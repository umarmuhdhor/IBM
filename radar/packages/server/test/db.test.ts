import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { migrate } from '../src/db/migrate';
import { createDb } from '../src/db/sql';
import { freshWorkspace } from './helpers';

describe('SQLite schema in the Durable Object (R2)', () => {
  it('migrates on construction and records schema_version = 5', async () => {
    const { stub } = freshWorkspace();
    const v = await runInDurableObject(stub, (_i, state) =>
      state.storage.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'").toArray(),
    );
    expect(v).toEqual([{ value: '5' }]);
  });

  it('v1 → v2 recreates join_code with a nullable member_id (D-alief-10)', async () => {
    const { stub } = freshWorkspace();
    const notNull = await runInDurableObject(stub, (_i, state) => {
      const sql = state.storage.sql;
      sql.exec('DROP TABLE join_code');
      sql.exec('CREATE TABLE join_code (hash TEXT PRIMARY KEY, member_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
      sql.exec("UPDATE meta SET value = '1' WHERE key = 'schema_version'");
      migrate(createDb(state.storage));
      return {
        version: sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'").one().value,
        notnull: sql.exec<{ notnull: number }>("SELECT \"notnull\" FROM pragma_table_info('join_code') WHERE name = 'member_id'").one().notnull,
      };
    });
    expect(notNull).toEqual({ version: '5', notnull: 0 });
  });

  it('v2 → v4 adds join_code.owner and open and keeps existing codes (D-alief-11, D-alief-13)', async () => {
    const { stub } = freshWorkspace();
    const after = await runInDurableObject(stub, (_i, state) => {
      const sql = state.storage.sql;
      sql.exec('DROP TABLE join_code');
      sql.exec('CREATE TABLE join_code (hash TEXT PRIMARY KEY, member_id TEXT REFERENCES member(id), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
      sql.exec("INSERT INTO join_code (hash, member_id, created_at, expires_at) VALUES ('h1', NULL, 0, 1)");
      sql.exec("UPDATE meta SET value = '2' WHERE key = 'schema_version'");
      migrate(createDb(state.storage));
      migrate(createDb(state.storage)); // idempotent
      return {
        version: sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'").one().value,
        rows: sql.exec<{ hash: string; owner: number; open: number }>('SELECT hash, owner, open FROM join_code').toArray(),
      };
    });
    expect(after).toEqual({ version: '5', rows: [{ hash: 'h1', owner: 0, open: 1 }] });
  });

  it('v3 → v4 marks every non-owner code open (D-alief-13)', async () => {
    const { stub } = freshWorkspace();
    const after = await runInDurableObject(stub, (_i, state) => {
      const sql = state.storage.sql;
      sql.exec('DROP TABLE join_code');
      sql.exec('CREATE TABLE join_code (hash TEXT PRIMARY KEY, member_id TEXT REFERENCES member(id), owner INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)');
      sql.exec("INSERT INTO join_code (hash, member_id, owner, created_at, expires_at) VALUES ('h1', NULL, 0, 0, 1), ('h2', NULL, 1, 0, 1)");
      sql.exec("UPDATE meta SET value = '3' WHERE key = 'schema_version'");
      migrate(createDb(state.storage));
      return {
        version: sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'").one().value,
        rows: sql.exec<{ hash: string; open: number }>('SELECT hash, open FROM join_code ORDER BY hash').toArray(),
      };
    });
    expect(after).toEqual({ version: '5', rows: [{ hash: 'h1', open: 1 }, { hash: 'h2', open: 0 }] });
  });

  it('v4 → v5 adds lock.start_line/end_line, NULL for existing locks (D-alief-17)', async () => {
    const { stub } = freshWorkspace();
    const after = await runInDurableObject(stub, (_i, state) => {
      const sql = state.storage.sql;
      sql.exec('DROP TABLE lock');
      sql.exec(
        "CREATE TABLE lock (path TEXT PRIMARY KEY, task_id TEXT NOT NULL, member_id TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('dipesan','dipegang','review')), acquired_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
      );
      sql.exec("INSERT INTO lock (path, task_id, member_id, state, acquired_at, updated_at) VALUES ('a.ts', 'T-1', 'A', 'dipegang', 0, 0)");
      sql.exec("UPDATE meta SET value = '4' WHERE key = 'schema_version'");
      migrate(createDb(state.storage));
      migrate(createDb(state.storage)); // idempotent
      return {
        version: sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version'").one().value,
        rows: sql.exec<{ path: string; start_line: number | null; end_line: number | null }>('SELECT path, start_line, end_line FROM lock').toArray(),
      };
    });
    expect(after).toEqual({ version: '5', rows: [{ path: 'a.ts', start_line: null, end_line: null }] });
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
      ['ai_mark', 'allocation', 'block', 'counter', 'event', 'file', 'file_version', 'join_code', 'lock', 'member', 'meta', 'metric', 'notification', 'proposal', 'request', 'review', 'task', 'task_touch', 'token'].sort(),
    );
  });
});
