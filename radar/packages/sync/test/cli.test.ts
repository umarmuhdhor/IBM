// `radar join` file side effects and `kit install` rules (fase 04 steps 1 and 8).
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadLocalConfig } from '@radar/common/node';
import { writeJoinFiles } from '../src/cli.js';
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

  it('skips the exclude when .gitignore already lists .radar/ or there is no git folder', () => {
    const root = tempDir();
    expect(writeJoinFiles({ root, server: 'http://x', workspace: 'w', member: 'A', token: 't', role: 'coder' }).excluded).toBeNull();
    const withIgnore = tempDir();
    mkdirSync(join(withIgnore, '.git/info'), { recursive: true });
    writeFileSync(join(withIgnore, '.gitignore'), '.radar/\n');
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

  it('reports a missing kit instead of failing', () => {
    const root = tempDir();
    expect(installKit({ root, role: 'coder', kitDir: join(root, 'nope') }).status).toBe('missing-kit');
    expect(readdirSync(root)).toEqual([]);
  });

  it('finds the kit from the flag, then RADAR_KIT_DIR, then the repo bob-kit', () => {
    const kitDir = fakeKit();
    expect(findKitDir(kitDir, {})).toBe(kitDir);
    expect(findKitDir(undefined, { RADAR_KIT_DIR: kitDir })).toBe(kitDir);
    expect(findKitDir(undefined, {})).toMatch(/bob-kit$/);
  });
});
