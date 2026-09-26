import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { ExportRes } from '@radar/common';
import { admin, call, DEFAULT_MEMBERS, freshWorkspace, seedTestWorkspace } from './helpers';

const INIT = { workspace: 'toko-demo', repo: 'demo/toko-demo', branch: 'main', members: DEFAULT_MEMBERS };

describe('/admin/* (fase 03 step 8)', () => {
  it('rejects a missing or wrong x-admin-secret with 401', async () => {
    const { stub } = freshWorkspace();
    expect((await call(stub, 'POST', '/admin/init', { body: INIT })).status).toBe(401);
    expect((await admin(stub, 'POST', '/admin/init', INIT, 'wrong')).status).toBe(401);
    expect((await admin(stub, 'POST', '/admin/init', INIT, '')).status).toBe(401);
  });

  it('init creates members + tokens, returns each token once and stores only hashes', async () => {
    const { stub } = freshWorkspace();
    const r = await admin(stub, 'POST', '/admin/init', INIT);
    expect(r.status).toBe(201);
    expect(r.json.workspace).toBe('toko-demo');
    const tokens = r.json.tokens as Record<string, string>;
    expect(Object.keys(tokens).sort()).toEqual(['A', 'B', 'C', 'mc']);
    for (const t of Object.values(tokens)) expect(t).toMatch(/^rdr_[A-Za-z0-9_-]{43}$/);

    const stored = await runInDurableObject(stub, (_i, state) => {
      const sql = state.storage.sql;
      return {
        hashes: sql.exec<{ hash: string; kind: string }>('SELECT hash, kind FROM token').toArray(),
        members: sql.exec<{ id: string; color: string; git_email: string }>('SELECT id, color, git_email FROM member ORDER BY id').toArray(),
        counters: sql.exec<{ name: string; value: number }>('SELECT name, value FROM counter ORDER BY name').toArray(),
        events: sql.exec<{ type: string }>('SELECT type FROM event ORDER BY id').toArray().map((e) => e.type),
      };
    });
    expect(stored.hashes).toHaveLength(4);
    for (const h of stored.hashes) {
      expect(h.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.values(tokens)).not.toContain(h.hash);
    }
    expect(stored.members).toEqual([
      { id: 'A', color: '#78A9FF', git_email: 'andi@example.com' },
      { id: 'B', color: '#BE95FF', git_email: 'budi@example.com' },
      { id: 'C', color: '#FF832B', git_email: 'citra@example.com' },
    ]);
    expect(stored.counters.map((c) => c.value)).toEqual([0, 0, 0, 0]);
    expect(stored.events).toEqual(['workspace.created', 'member.created', 'member.created', 'member.created']);

    // tokens work
    expect((await call(stub, 'GET', '/v1/state', { token: tokens.mc })).status).toBe(200);
  });

  it('a second init is 409 unless force:true', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    expect((await admin(stub, 'POST', '/admin/init', INIT)).status).toBe(409);
    const again = await admin(stub, 'POST', '/admin/init', { ...INIT, force: true });
    expect(again.status).toBe(201);
    const s = await call(stub, 'GET', '/v1/state', { token: again.json.tokens.mc });
    expect(s.json.files).toEqual([]);
  });

  it('init validates the body (422)', async () => {
    const { stub } = freshWorkspace();
    expect((await admin(stub, 'POST', '/admin/init', { workspace: 'x', members: [] })).status).toBe(422);
    expect((await admin(stub, 'POST', '/admin/init', { workspace: 'x', members: [{ id: 'A', role: 'boss', name: 'A' }] })).status).toBe(422);
    const bad = await call(stub, 'POST', '/admin/init', { raw: '{nope', headers: { 'x-admin-secret': 'test' } });
    expect(bad.status).toBe(400);
  });

  it('/admin/files in 3 batches imports every file at version 1 and sets head_commit', async () => {
    const { stub } = freshWorkspace();
    const tokens = await seedTestWorkspace(stub, []);
    const files = Array.from({ length: 250 }, (_, i) => ({ path: `src/f${i}.ts`, content: `export const v${i} = ${i};\n` }));
    let inserted = 0;
    for (let i = 0; i < files.length; i += 100) {
      const r = await admin(stub, 'POST', '/admin/files', { headCommit: 'abc1234', files: files.slice(i, i + 100) });
      expect(r.status).toBe(200);
      expect(r.json.headCommit).toBe('abc1234');
      inserted += r.json.inserted as number;
    }
    expect(inserted).toBe(250);
    const state = await call(stub, 'GET', '/v1/state', { token: tokens.mc });
    expect(state.json.files).toHaveLength(250);
    expect(state.json.files.every((f: { version: number }) => f.version === 1)).toBe(true);
    expect(state.json.workspace.headCommit).toBe('abc1234');
    const versions = await runInDurableObject(stub, (_i, st) => st.storage.sql.exec<{ n: number }>('SELECT count(*) AS n FROM file_version').one().n);
    expect(versions).toBe(250);
  });

  it('/admin/files skips ignored, outside-workspace and binary paths and caps a batch at 100 files', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub, []);
    const r = await admin(stub, 'POST', '/admin/files', {
      headCommit: null,
      files: [
        { path: 'src/ok.ts', content: 'x' },
        { path: 'node_modules/y.js', content: 'y' },
        { path: '../escape.ts', content: 'z' },
        { path: 'img.bin', content: 'a\u0000b' },
      ],
    });
    expect(r.json).toEqual({ inserted: 1, headCommit: null });
    const tooMany = Array.from({ length: 101 }, (_, i) => ({ path: `f${i}.ts`, content: '' }));
    expect((await admin(stub, 'POST', '/admin/files', { headCommit: null, files: tooMany })).status).toBe(422);
  });

  it('/admin/files before init is 409', async () => {
    const { stub } = freshWorkspace();
    expect((await admin(stub, 'POST', '/admin/files', { headCommit: null, files: [] })).status).toBe(409);
  });

  it('/admin/token rotates one token: the old one stops working', async () => {
    const { stub } = freshWorkspace();
    const tokens = await seedTestWorkspace(stub);
    const r = await admin(stub, 'POST', '/admin/token', { member: 'A', rotate: true });
    expect(r.status).toBe(200);
    expect(r.json.member).toBe('A');
    expect(r.json.token).toMatch(/^rdr_/);
    expect((await call(stub, 'GET', '/v1/state', { token: tokens.A })).status).toBe(401);
    expect((await call(stub, 'GET', '/v1/state', { token: r.json.token })).status).toBe(200);
    expect((await admin(stub, 'POST', '/admin/token', { member: 'Z', rotate: true })).status).toBe(404);
  });

  it('/admin/export returns every event; /admin/reset wipes the workspace', async () => {
    const { stub } = freshWorkspace();
    const tokens = await seedTestWorkspace(stub);
    const ex = await admin(stub, 'GET', '/admin/export');
    expect(ex.status).toBe(200);
    expect(ExportRes.parse(ex.json).events.map((e) => e.type)[0]).toBe('workspace.created');
    expect((await admin(stub, 'POST', '/admin/reset', {})).status).toBe(422);
    const reset = await admin(stub, 'POST', '/admin/reset', { confirm: true });
    expect(reset.json).toEqual({ ok: true });
    expect((await call(stub, 'GET', '/v1/state', { token: tokens.mc })).status).toBe(401);
    // fresh init works again after reset, event ids restart
    expect((await admin(stub, 'POST', '/admin/init', INIT)).status).toBe(201);
    const ex2 = await admin(stub, 'GET', '/admin/export');
    expect(ex2.json.events[0].id).toBe(1);
  });
});
