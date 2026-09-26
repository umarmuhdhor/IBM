// Unit tests for the small sync-agent modules (fase 04): known, writer, sidecar, notify, log.
import { chmodSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '@radar/common';
import { KnownStore } from '../src/known.js';
import { atomicWrite, hashText, readLocal, removeLocal, UnsafePathError } from '../src/writer.js';
import { writeSidecar } from '../src/sidecar.js';
import { formatRejection } from '../src/notify.js';
import { createSyncLog } from '../src/log.js';
import { cleanupDirs, read, tempDir } from './helpers.js';

afterEach(() => cleanupDirs());

describe('KnownStore', () => {
  it('never moves a path back to an older version', () => {
    const k = new KnownStore();
    expect(k.set('a.ts', { version: 3, hash: 'h3' })).toBe(true);
    expect(k.set('a.ts', { version: 2, hash: 'h2' })).toBe(false);
    expect(k.get('a.ts')).toEqual({ version: 3, hash: 'h3' });
    expect(k.set('a.ts', { version: 3, hash: 'h3b' })).toBe(true);
    expect(k.get('a.ts')?.hash).toBe('h3b');
  });

  it('reports knownVersions without version-0 entries and clears', () => {
    const k = new KnownStore();
    k.set('a.ts', { version: 2, hash: 'x' });
    k.set('b.ts', { version: 0, hash: 'y' });
    expect(k.versions()).toEqual({ 'a.ts': 2 });
    expect(k.size).toBe(2);
    k.delete('a.ts');
    expect(k.get('a.ts')).toBeUndefined();
    k.clear();
    expect(k.size).toBe(0);
  });
});

describe('writer', () => {
  it('hashText matches the common sha256Hex of the UTF-8 bytes', async () => {
    expect(hashText('héllo\n')).toBe(await sha256Hex('héllo\n'));
  });

  it('atomicWrite creates parent folders and leaves no temp file behind', () => {
    const root = tempDir();
    atomicWrite(root, 'src/deep/a.ts', 'x\n');
    expect(read(root, 'src/deep/a.ts')).toBe('x\n');
    expect(readdirSync(join(root, 'src/deep'))).toEqual(['a.ts']);
  });

  it('atomicWrite keeps the file mode of the file it replaces', () => {
    const root = tempDir();
    writeFileSync(join(root, 'run.sh'), 'echo 1\n');
    chmodSync(join(root, 'run.sh'), 0o755);
    atomicWrite(root, 'run.sh', 'echo 2\n');
    expect(statSync(join(root, 'run.sh')).mode & 0o777).toBe(0o755);
  });

  it('refuses paths outside the workspace and inside .git or .radar', () => {
    const root = tempDir();
    for (const p of ['../evil.ts', '/etc/passwd', '.git/config', '.radar/local.json', '']) {
      expect(() => atomicWrite(root, p, 'x'), p).toThrow(UnsafePathError);
    }
  });

  it('readLocal classifies missing, text, too large and binary files', () => {
    const root = tempDir();
    writeFileSync(join(root, 'a.ts'), 'a\n');
    writeFileSync(join(root, 'big.txt'), 'x'.repeat(1_048_577));
    writeFileSync(join(root, 'img.png'), Buffer.from([0x89, 0, 1]));
    expect(readLocal(root, 'nope.ts')).toEqual({ kind: 'missing' });
    expect(readLocal(root, 'a.ts')).toMatchObject({ kind: 'text', content: 'a\n', hash: hashText('a\n') });
    expect(readLocal(root, 'big.txt').kind).toBe('too_large');
    expect(readLocal(root, 'img.png').kind).toBe('binary');
  });

  it('removeLocal deletes a file and ignores a missing one', () => {
    const root = tempDir();
    writeFileSync(join(root, 'a.ts'), 'a');
    removeLocal(root, 'a.ts');
    removeLocal(root, 'a.ts');
    expect(existsSync(join(root, 'a.ts'))).toBe(false);
  });
});

describe('sidecar', () => {
  it('stores the content as is next to the file and overwrites an old sidecar', () => {
    const root = tempDir();
    mkdirSync(join(root, 'src'));
    expect(writeSidecar(root, 'src/a.ts', 'rejected', 'first')).toBe('src/a.ts.radar-rejected');
    writeSidecar(root, 'src/a.ts', 'rejected', 'second');
    expect(read(root, 'src/a.ts.radar-rejected')).toBe('second');
    expect(writeSidecar(root, 'src/a.ts', 'conflict', Buffer.from('bin'))).toBe('src/a.ts.radar-conflict');
    expect(read(root, 'src/a.ts.radar-conflict')).toBe('bin');
  });
});

describe('notify messages', () => {
  const holder = { memberId: 'A', memberName: 'Alice', taskId: 'T-1', taskTitle: 'Kupon', state: 'held' as const };
  it('names the holder for held_by_other', () => {
    expect(formatRejection({ path: 'src/checkout/checkout.ts', reason: 'held_by_other', holder, sidecar: 'src/checkout/checkout.ts.radar-rejected' })).toBe(
      '✖ Perubahanmu di src/checkout/checkout.ts ditolak: dipegang Alice (T-1 Kupon). Isimu disimpan di checkout.ts.radar-rejected.',
    );
  });
  it('explains pm_readonly and conflict', () => {
    expect(formatRejection({ path: 'README.md', reason: 'pm_readonly', holder: null, sidecar: 'README.md.radar-rejected' })).toBe(
      '✖ PM tidak menulis file. Perubahan disimpan di README.md.radar-rejected.',
    );
    expect(formatRejection({ path: 'src/a.ts', reason: 'conflict', holder: null, sidecar: 'src/a.ts.radar-conflict' })).toBe(
      '✖ Versi lokal tertinggal, isi server dipakai. Salinanmu: a.ts.radar-conflict',
    );
  });
  it('covers committing and a missing sidecar', () => {
    expect(formatRejection({ path: 'a.ts', reason: 'committing', holder, sidecar: null })).toMatch(/sedang di-commit/);
    expect(formatRejection({ path: 'a.ts', reason: 'held_by_other', holder: null, sidecar: null })).toMatch(/dipegang anggota lain/);
  });
});

describe('sync log', () => {
  it('writes one line per event under .radar and rotates above the size limit', () => {
    const root = tempDir();
    const log = createSyncLog(root, { maxBytes: 200 });
    log('send', 'src/a.ts v1');
    expect(read(root, '.radar/sync.log')).toMatch(/^\d{4}-\d\d-\d\dT.* send src\/a\.ts v1\n$/);
    for (let i = 0; i < 10; i++) log('recv', `src/b.ts v${i} ${'x'.repeat(20)}`);
    expect(existsSync(join(root, '.radar/sync.log.1'))).toBe(true);
    expect(statSync(join(root, '.radar/sync.log')).size).toBeLessThanOrEqual(200);
  });

  it('never writes a token', () => {
    const root = tempDir();
    const log = createSyncLog(root);
    log('hello', 'token rdr_abcdefghijklmnop sent');
    expect(read(root, '.radar/sync.log')).not.toMatch(/rdr_abcdefghijklmnop/);
  });
});
