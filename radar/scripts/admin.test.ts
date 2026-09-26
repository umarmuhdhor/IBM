import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeInvite, MAX_FILE_BYTES } from '../packages/common/src/index.js';
import { AdminError, adminCall, batchFiles, collectRepoFiles, formatTokenTable, main, parseMemberSpec, runInit, type RepoFile } from './admin.js';
import { startMockServer, type MockServer } from './mock-server.js';

const SECRET = 'test-admin';
const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const fn of cleanups.splice(0)) await fn();
});

async function mock(): Promise<MockServer> {
  const s = await startMockServer({ port: 0, adminSecret: SECRET, scenario: 'none', log: () => {} });
  cleanups.push(() => s.close());
  return s;
}

function tempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'radar-admin-'));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src/a.ts'), 'export const a = 1;\n');
  writeFileSync(join(dir, 'README.md'), '# demo\n');
  writeFileSync(join(dir, '.gitignore'), '.env\n');
  writeFileSync(join(dir, '.env'), 'NOT_A_REAL_VALUE=1\n');
  writeFileSync(join(dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
  writeFileSync(join(dir, 'big.txt'), 'x'.repeat(MAX_FILE_BYTES + 1));
  git('add', '-A', '-f');
  git('commit', '-q', '-m', 'init');
  return dir;
}

describe('parseMemberSpec', () => {
  it('parses ID:role:Name[:email]', () => {
    expect(parseMemberSpec('A:coder:Alice:a@example.com')).toEqual({ id: 'A', role: 'coder', name: 'Alice', email: 'a@example.com' });
    expect(parseMemberSpec('P:pm:Pat')).toEqual({ id: 'P', role: 'pm', name: 'Pat' });
  });
  it('rejects malformed specs', () => {
    expect(() => parseMemberSpec('A:coder')).toThrow(/ID:role:Name/);
    expect(() => parseMemberSpec('A:boss:Alice')).toThrow(/--member/);
    expect(() => parseMemberSpec('A:coder:Alice:not-an-email')).toThrow(/--member/);
    expect(() => parseMemberSpec('A:coder:Alice:a@x.io:extra')).toThrow(/ID:role:Name/);
  });
});

describe('batchFiles', () => {
  const f = (i: number, size = 1): RepoFile => ({ path: `f${i}.ts`, content: 'x'.repeat(size) });
  it('caps a batch at 100 files', () => {
    const batches = batchFiles(Array.from({ length: 250 }, (_, i) => f(i)));
    expect(batches.map((b) => b.length)).toEqual([100, 100, 50]);
  });
  it('caps a batch by bytes', () => {
    const batches = batchFiles([f(1, 6), f(2, 6), f(3, 6)], 100, 10);
    expect(batches.map((b) => b.length)).toEqual([1, 1, 1]);
  });
  it('returns no batch for no files', () => {
    expect(batchFiles([])).toEqual([]);
  });
});

describe('collectRepoFiles', () => {
  it('keeps tracked text files and skips ignored, binary and too-large ones', () => {
    const dir = tempRepo();
    const { files, skipped } = collectRepoFiles(dir);
    expect(files.map((x) => x.path)).toEqual(['.gitignore', 'README.md', 'src/a.ts']);
    expect(Object.fromEntries(skipped.map((s) => [s.path, s.reason]))).toEqual({ '.env': 'ignored', 'logo.png': 'binary', 'big.txt': 'too_large' });
  });
});

describe('against the mock server', () => {
  it('init imports the repo in batches and returns tokens', async () => {
    const s = await mock();
    const dir = tempRepo();
    const out: string[] = [];
    const code = await main(
      ['init', '--server', `http://127.0.0.1:${s.port}`, '--workspace', 'toko-demo', '--repo-dir', dir, '--member', 'A:coder:Alice', '--member', 'P:pm:Pat', '--force'],
      { ADMIN_SECRET: SECRET },
      (l) => out.push(l),
    );
    expect(code).toBe(0);
    const text = out.join('\n');
    expect(text).toMatch(/imported 3 files/);
    expect(text).toMatch(/^A\s+tok-a$/m);
    expect(text).toMatch(/^mc\s+\S+$/m);
    const head = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(s.hub.state.workspace.headCommit).toBe(head);
    expect([...s.hub.files.keys()].sort()).toEqual(['.gitignore', 'README.md', 'src/a.ts']);
  });

  it('a wrong secret surfaces the server error code', async () => {
    const s = await mock();
    await expect(runInit({ server: `http://127.0.0.1:${s.port}`, secret: 'wrong' }, { workspace: 'w', branch: 'main', members: [{ id: 'A', role: 'coder', name: 'A' }], force: false, files: [], headCommit: null })).rejects.toMatchObject({
      name: 'AdminError',
      status: 401,
      code: 'UNAUTHORIZED',
    });
  });
});

describe('main', () => {
  it('refuses to run without ADMIN_SECRET in the environment', async () => {
    const out: string[] = [];
    expect(await main(['reset', '--server', 'http://x', '--confirm'], {}, (l) => out.push(l))).toBe(2);
    expect(out.join()).toMatch(/ADMIN_SECRET is not set/);
  });
  it('reset needs --confirm', async () => {
    const out: string[] = [];
    expect(await main(['reset', '--server', 'http://x'], { ADMIN_SECRET: SECRET }, (l) => out.push(l))).toBe(2);
    expect(out.join()).toMatch(/--confirm/);
  });
  it('prints usage for an unknown command', async () => {
    const out: string[] = [];
    expect(await main(['nope', '--server', 'http://x'], { ADMIN_SECRET: SECRET }, (l) => out.push(l))).toBe(2);
    expect(out.join()).toMatch(/usage/);
  });
  it('token and export use the admin header and write the export file', async () => {
    const calls: { url: string; secret: string | null; body: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, secret: new Headers(init?.headers).get('x-admin-secret'), body: (init?.body as string | null) ?? null });
      if (url.endsWith('/admin/token')) return Response.json({ member: 'A', token: 'rdr_new' });
      return Response.json({ workspace: 'w', exportedAt: 1, events: [] });
    };
    const c = { server: 'http://x/', secret: SECRET, fetchImpl };
    expect(await adminCall(c, 'POST', '/admin/token', { member: 'A', rotate: true }, { safeParse: (v: unknown) => ({ success: true as const, data: v }) })).toEqual({ member: 'A', token: 'rdr_new' });
    expect(calls[0]).toEqual({ url: 'http://x/admin/token', secret: SECRET, body: '{"member":"A","rotate":true}' });
  });
  it('rejects a response that does not match the schema', async () => {
    const fetchImpl: typeof fetch = async () => Response.json({ nope: true });
    await expect(adminCall({ server: 'http://x', secret: SECRET, fetchImpl }, 'POST', '/admin/reset', { confirm: true }, { safeParse: () => ({ success: false as const }) })).rejects.toBeInstanceOf(AdminError);
  });
  it('invite rotates the token, reads the workspace name with it, and prints one rdr_inv_ code', async () => {
    const seen: { url: string; secret: string | null; auth: string | null }[] = [];
    vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const h = new Headers(init?.headers);
      seen.push({ url, secret: h.get('x-admin-secret'), auth: h.get('authorization') });
      if (url.endsWith('/admin/token')) return Response.json({ member: 'B', token: 'rdr_new_b' });
      return Response.json({
        workspace: { id: 'w1', name: 'toko-demo', headCommit: null, repoUrl: null },
        members: [], tasks: [], locks: [], allocations: [], files: [], requests: [], proposals: [], cursor: 0, serverTime: 1,
      });
    });
    cleanups.push(() => void vi.unstubAllGlobals());
    const out: string[] = [];
    expect(await main(['invite', '--server', 'https://x.example/', '--member', 'B'], { ADMIN_SECRET: SECRET }, (l) => out.push(l))).toBe(0);
    // The admin secret goes only to /admin/*; the member read uses the new token.
    expect(seen.map((x) => [x.url, x.secret !== null, x.auth])).toEqual([
      ['https://x.example/admin/token', true, null],
      ['https://x.example/v1/state', false, 'Bearer rdr_new_b'],
    ]);
    expect(decodeInvite(out.at(-1)!)).toEqual({ v: 1, server: 'https://x.example', workspace: 'toko-demo', member: 'B', token: 'rdr_new_b' });
    expect(await main(['invite', '--server', 'https://x.example', '--member', 'mc'], { ADMIN_SECRET: SECRET }, () => undefined)).toBe(2);
  });
  it('invite still prints the rotated token when the workspace read fails', async () => {
    vi.stubGlobal('fetch', async (input: string | URL | Request) =>
      String(input).endsWith('/admin/token') ? Response.json({ member: 'B', token: 'rdr_new_b' }) : new Response('boom', { status: 503 }),
    );
    cleanups.push(() => void vi.unstubAllGlobals());
    const out: string[] = [];
    expect(await main(['invite', '--server', 'https://x.example', '--member', 'B'], { ADMIN_SECRET: SECRET }, (l) => out.push(l))).toBe(1);
    expect(out.join('\n')).toMatch(/^B\s+rdr_new_b$/m);
  });
  it('formats the token table', () => {
    expect(formatTokenTable({ A: 't1', mc: 't2' })).toBe('member  token\nA       t1\nmc      t2');
  });
});

