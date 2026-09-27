// `radar join` file side effects and `kit install` rules (fase 04 steps 1 and 8).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadLocalConfig } from '@radar/common/node';
import { encodeInvite } from '@radar/common';
import { EventEmitter } from 'node:events';
import { kitInstallExitCode, kitStatusLine, resolveJoin, wireJsonStatus, writeJoinFiles } from '../src/cli.js';
import { findKitDir, installKit } from '../src/kit.js';
import { cleanupDirs, read, tempDir } from './helpers.js';

afterEach(() => cleanupDirs());

describe('writeJoinFiles', () => {
  it('writes .radar/local.json with mode 0600 that loadLocalConfig reads back', () => {
    const root = tempDir();
    mkdirSync(join(root, '.git/info'), { recursive: true });
    const r = writeJoinFiles({ root, server: 'http://127.0.0.1:8787/', workspace: 'toko-demo', member: 'A', token: 'rdr_x', role: 'coder' });
    const file = join(root, '.radar/local.json');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ server: 'http://127.0.0.1:8787', workspace: 'toko-demo', member: 'A', token: 'rdr_x', role: 'coder', shareprompts: false });
    expect(loadLocalConfig(root, {})).toMatchObject({ root, member: 'A', role: 'coder', token: 'rdr_x' });
    expect(r.excluded).toBe('.git/info/exclude');
  });

  it('adds .radar/ to .git/info/exclude once, without touching the synced .gitignore', () => {
    const root = tempDir();
    mkdirSync(join(root, '.git/info'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
    const opts = { root, server: 'http://x', workspace: 'w', member: 'A', token: 't', role: 'coder' as const };
    writeJoinFiles(opts);
    writeJoinFiles(opts);
    expect(read(root, '.git/info/exclude')?.match(/^\.radar\/$/gm)).toHaveLength(1);
    expect(read(root, '.gitignore')).toBe('node_modules/\n');
  });

  it('also keeps the Bob kit and .radar-conflict / .radar-rejected copies out of git', () => {
    const root = tempDir();
    mkdirSync(join(root, '.git/info'), { recursive: true });
    const opts = { root, server: 'http://x', workspace: 'w', member: 'A', token: 't', role: 'coder' as const };
    writeJoinFiles(opts);
    writeJoinFiles(opts);
    const exclude = read(root, '.git/info/exclude') ?? '';
    for (const rule of ['.radar/', '.bob/', '*.radar-conflict', '*.radar-rejected']) {
      expect(exclude.split('\n').filter((l) => l === rule)).toHaveLength(1);
    }
  });

  it('skips rules .gitignore already has, and the exclude when there is no git folder', () => {
    const root = tempDir();
    expect(writeJoinFiles({ root, server: 'http://x', workspace: 'w', member: 'A', token: 't', role: 'coder' }).excluded).toBeNull();
    const withIgnore = tempDir();
    mkdirSync(join(withIgnore, '.git/info'), { recursive: true });
    writeFileSync(join(withIgnore, '.gitignore'), '.radar/\n.bob/\n*.radar-conflict\n*.radar-rejected\n');
    expect(writeJoinFiles({ root: withIgnore, server: 'http://x', workspace: 'w', member: 'A', token: 't', role: 'coder' }).excluded).toBeNull();
    expect(existsSync(join(withIgnore, '.git/info/exclude'))).toBe(false);
  });
});

function fakeKit(): string {
  const kit = tempDir('radar-kit-');
  for (const role of ['coder', 'pm']) {
    mkdirSync(join(kit, role, '.bob/hooks'), { recursive: true });
    writeFileSync(join(kit, role, '.bob/custom_modes.yaml'), `role: ${role}\n`);
    writeFileSync(join(kit, role, '.bob/hooks/pre.js'), '// hook\n');
  }
  return kit;
}

describe('kit install', () => {
  it('copies <kit>/<role>/.bob into an empty workspace', () => {
    const root = tempDir();
    const r = installKit({ root, role: 'pm', kitDir: fakeKit() });
    expect(r.status).toBe('installed');
    expect(read(root, '.bob/custom_modes.yaml')).toBe('role: pm\n');
    expect(read(root, '.bob/hooks/pre.js')).toBe('// hook\n');
  });

  it('overwrites an older kit whose files are all part of the new one', () => {
    const root = tempDir();
    const kitDir = fakeKit();
    mkdirSync(join(root, '.bob'));
    writeFileSync(join(root, '.bob/custom_modes.yaml'), 'old\n');
    expect(installKit({ root, role: 'coder', kitDir }).status).toBe('installed');
    expect(read(root, '.bob/custom_modes.yaml')).toBe('role: coder\n');
  });

  it('refuses a .bob with foreign files unless forced, then backs it up', () => {
    const root = tempDir();
    const kitDir = fakeKit();
    mkdirSync(join(root, '.bob'));
    writeFileSync(join(root, '.bob/mine.md'), 'keep me\n');
    expect(installKit({ root, role: 'coder', kitDir }).status).toBe('refused');
    expect(read(root, '.bob/custom_modes.yaml')).toBeNull();
    const r = installKit({ root, role: 'coder', kitDir, force: true, now: () => 1234 });
    expect(r).toMatchObject({ status: 'installed', backup: '.bob.bak-1234' });
    expect(read(root, '.bob.bak-1234/mine.md')).toBe('keep me\n');
    expect(read(root, '.bob/mine.md')).toBeNull();
  });

  it('switching coder to pm replaces the coder kit, including files only the coder kit has', () => {
    const root = tempDir();
    const kitDir = fakeKit();
    mkdirSync(join(kitDir, 'coder/.bob/rules-coder'), { recursive: true });
    writeFileSync(join(kitDir, 'coder/.bob/rules-coder/01-radar.md'), 'coder rule\n');
    writeFileSync(join(kitDir, 'coder/.bob/hooks/lock_guard.js'), '// guard\n');
    expect(installKit({ root, role: 'coder', kitDir }).status).toBe('installed');
    const r = installKit({ root, role: 'pm', kitDir });
    expect(r.status).toBe('installed');
    expect(read(root, '.bob/custom_modes.yaml')).toBe('role: pm\n');
    expect(read(root, '.bob/hooks/lock_guard.js')).toBeNull();
    expect(existsSync(join(root, '.bob/rules-coder'))).toBe(false);
  });

  it('reports a missing kit instead of failing', () => {
    const root = tempDir();
    expect(installKit({ root, role: 'coder', kitDir: join(root, 'nope') }).status).toBe('missing-kit');
    expect(readdirSync(root)).toEqual([]);
  });

  it('kit install fails unless the kit really was installed (fase 12k code review)', () => {
    expect(kitInstallExitCode({ status: 'installed' })).toBe(0);
    expect(kitInstallExitCode({ status: 'refused' })).toBe(1);
    expect(kitInstallExitCode({ status: 'missing-kit' })).toBe(1);
  });

  it('finds the kit from the flag, then RADAR_KIT_DIR, then the repo bob-kit', () => {
    const kitDir = fakeKit();
    expect(findKitDir(kitDir, {})).toBe(kitDir);
    expect(findKitDir(undefined, { RADAR_KIT_DIR: kitDir })).toBe(kitDir);
    expect(findKitDir(undefined, {})).toMatch(/bob-kit$/);
  });
});

describe('resolveJoin (IN-02 invite)', () => {
  const code = encodeInvite({ server: 'https://s.example', workspace: 'toko-demo', member: 'B', token: 'rdr_b' });
  const target = { server: 'https://s.example', workspace: 'toko-demo', member: 'B', token: 'rdr_b' };

  it('an invite from --invite or RADAR_INVITE fills every field', () => {
    expect(resolveJoin(undefined, { invite: code }, {})).toEqual(target);
    expect(resolveJoin(undefined, {}, { RADAR_INVITE: code })).toEqual(target);
  });

  it('explicit arguments still work, with the token from RADAR_TOKEN, and win over RADAR_INVITE', () => {
    expect(resolveJoin('https://o.example', { workspace: 'w', as: 'A' }, { RADAR_TOKEN: 'rdr_a', RADAR_INVITE: code })).toEqual({
      server: 'https://o.example',
      workspace: 'w',
      member: 'A',
      token: 'rdr_a',
    });
  });

  it('refuses --invite mixed with other arguments, a bad code, or missing arguments, without echoing secrets', () => {
    expect(resolveJoin('https://o.example', { invite: code }, {})).toMatchObject({ error: expect.stringContaining('--invite') });
    const bad = resolveJoin(undefined, { invite: `${code.slice(0, 12)}!!` }, {});
    expect(bad).toMatchObject({ error: expect.any(String) });
    expect(JSON.stringify(bad)).not.toContain(code.slice(8, 12));
    expect(resolveJoin('https://o.example', { workspace: 'w', as: 'A' }, {})).toMatchObject({ error: expect.stringContaining('RADAR_TOKEN') });
  });
});

describe('--json-status lines', () => {
  it('reports status and every file kept as .radar-conflict', () => {
    const agent = new EventEmitter();
    const lines: string[] = [];
    wireJsonStatus(agent, (l) => lines.push(l));
    agent.emit('status', { connected: true, files: 2 });
    agent.emit('conflict', { path: 'notes/a.md', sidecar: 'notes/a.md.radar-conflict' });
    agent.emit('rejected', { path: 'src/app.ts', reason: 'pm_readonly', holder: null, sidecar: 'src/app.ts.radar-rejected' });
    agent.emit('stopped', 'The owner stopped sharing this workspace.', 'workspace-closed');
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      expect.objectContaining({ type: 'status', connected: true, files: 2 }),
      expect.objectContaining({ type: 'conflict', path: 'notes/a.md', sidecar: 'notes/a.md.radar-conflict' }),
      expect.objectContaining({ type: 'rejected', path: 'src/app.ts', reason: 'pm_readonly', message: expect.stringContaining('A PM can only add documents') }),
      expect.objectContaining({ type: 'stopped', reason: 'workspace-closed', message: 'The owner stopped sharing this workspace.' }),
    ]);
  });
});

describe('rejected notice clears (fase 12k)', () => {
  it('says once when a refused path is accepted later, and says nothing for other saves', () => {
    const agent = new EventEmitter();
    const lines: string[] = [];
    wireJsonStatus(agent, (l) => lines.push(l));
    agent.emit('ack', { path: 'other.ts', version: 2 });
    agent.emit('rejected', { path: 'app.ts', reason: 'locked', holder: null, sidecar: 'app.ts.radar-rejected' });
    agent.emit('ack', { path: 'app.ts', version: 3 });
    agent.emit('ack', { path: 'app.ts', version: 4 });
    expect(lines.map((l) => JSON.parse(l))).toEqual([
      expect.objectContaining({ type: 'rejected', path: 'app.ts' }),
      expect.objectContaining({ type: 'accepted', path: 'app.ts' }),
    ]);
  });
});

describe('kit status line (fase 12k bug 4)', () => {
  it('tells the app the kit was refused, which files are in the way, and what --force does', () => {
    const line = JSON.parse(kitStatusLine({ status: 'refused', foreign: ['.bob/custom_modes.yaml', '.bob/notes.md'] }, 'coder'));
    expect(line).toMatchObject({ type: 'kit', status: 'refused', role: 'coder', foreign: ['.bob/custom_modes.yaml', '.bob/notes.md'] });
    expect(line.message).toContain('.bob/custom_modes.yaml');
    expect(line.message).toMatch(/backup/i);
    expect(line.message).toContain('.bob.bak-');
  });

  it('reports an installed kit and a missing kit', () => {
    expect(JSON.parse(kitStatusLine({ status: 'installed', files: 7 }, 'pm'))).toMatchObject({ type: 'kit', status: 'installed', role: 'pm' });
    expect(JSON.parse(kitStatusLine({ status: 'missing-kit', kitDir: null }, 'coder'))).toMatchObject({ type: 'kit', status: 'missing-kit', message: expect.stringContaining('Bob kit') });
  });
});
