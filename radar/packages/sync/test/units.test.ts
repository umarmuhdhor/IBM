// Unit tests for the small sync-agent modules (fase 04): known, writer, sidecar, notify, log.
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '@radar/common';
import { DELETED_HASH, KnownStore } from '../src/known.js';
import { atomicWrite, hashText, pruneEmptyParents, readLocal, removeLocal, UnsafePathError } from '../src/writer.js';
import { writeSidecar } from '../src/sidecar.js';
import { formatRejection, terminalNotifier } from '../src/notify.js';
import { fatalClose } from '../src/agent.js';
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

describe('KnownStore file count (fase 12k)', () => {
  it('counts files on the server, not deleted files or empty-folder markers', () => {
    const k = new KnownStore();
    k.set('a.ts', { version: 2, hash: 'x' });
    k.set('gone.ts', { version: 3, hash: DELETED_HASH });
    k.set('assets/.radar-dir', { version: 1, hash: 'e' });
    expect(k.fileCount()).toBe(1);
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

  it('never follows a symlink out of the workspace, for a file or a folder', () => {
    const root = tempDir();
    const outside = tempDir();
    writeFileSync(join(outside, 'victim.txt'), 'keep\n');
    symlinkSync(join(outside, 'victim.txt'), join(root, 'link.txt'));
    symlinkSync(outside, join(root, 'ext'));
    expect(() => atomicWrite(root, 'link.txt', 'pwned')).toThrow(UnsafePathError);
    expect(() => atomicWrite(root, 'ext/new.txt', 'pwned')).toThrow(UnsafePathError);
    expect(() => readLocal(root, 'link.txt')).toThrow(UnsafePathError);
    expect(() => removeLocal(root, 'ext/victim.txt')).toThrow(UnsafePathError);
    expect(read(outside, 'victim.txt')).toBe('keep\n');
    expect(existsSync(join(outside, 'new.txt'))).toBe(false);
    // Removing the link itself is fine: the link lives inside the workspace.
    removeLocal(root, 'link.txt');
    expect(existsSync(join(outside, 'victim.txt'))).toBe(true);
  });

  it('writes through a symlink that stays inside the workspace', () => {
    const root = tempDir();
    writeFileSync(join(root, 'real.ts'), 'old\n');
    symlinkSync('real.ts', join(root, 'alias.ts'));
    atomicWrite(root, 'alias.ts', 'new\n');
    expect(read(root, 'real.ts')).toBe('new\n');
    expect(lstatSync(join(root, 'alias.ts')).isSymbolicLink()).toBe(true);
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

  it('pruneEmptyParents drops folders a remote rename emptied, and keeps the rest', () => {
    const root = tempDir();
    mkdirSync(join(root, 'old dir/deep'), { recursive: true });
    mkdirSync(join(root, 'keep'), { recursive: true });
    writeFileSync(join(root, 'keep/x.ts'), 'x');
    pruneEmptyParents(root, 'old dir/deep/a.ts');
    pruneEmptyParents(root, 'keep/gone.ts');
    pruneEmptyParents(root, 'top.ts');
    expect(existsSync(join(root, 'old dir'))).toBe(false);
    expect(existsSync(join(root, 'keep/x.ts'))).toBe(true);
    expect(existsSync(root)).toBe(true);
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
  it('a file that never syncs says it stays on this Mac and what to do (fase 12k UI gate)', () => {
    const base = { holder: null, sidecar: null } as const;
    expect(formatRejection({ ...base, path: 'logo.png', reason: 'binary' })).toBe(
      '✖ logo.png is a binary file and does not sync. Only text files sync; it stays on this Mac.',
    );
    expect(formatRejection({ ...base, path: 'dump.sql', reason: 'too_large' })).toBe(
      '✖ dump.sql is larger than 1 MB and does not sync. It stays on this Mac; make it smaller to sync it.',
    );
  });
  const holder = { memberId: 'A', memberName: 'Alice', taskId: 'T-1', taskTitle: 'Kupon', state: 'dipegang' as const };
  it('names the holder for held_by_other', () => {
    expect(formatRejection({ path: 'src/checkout/checkout.ts', reason: 'held_by_other', holder, sidecar: 'src/checkout/checkout.ts.radar-rejected' })).toBe(
      '✖ Your change to src/checkout/checkout.ts was refused: held by Alice (T-1 Kupon). Your content is kept in checkout.ts.radar-rejected.',
    );
  });
  it('names the locked lines for a line-range lock (D-alief-17)', () => {
    expect(formatRejection({ path: 'src/app.ts', reason: 'held_by_other', holder: { ...holder, range: { start: 3, end: 5 } }, sidecar: 'src/app.ts.radar-rejected' })).toBe(
      '✖ Your change to src/app.ts was refused: lines 3–5 are held by Alice (T-1 Kupon). Your content is kept in app.ts.radar-rejected.',
    );
  });
  it('explains pm_readonly and conflict', () => {
    expect(formatRejection({ path: 'src/app.ts', reason: 'pm_readonly', holder: null, sidecar: 'src/app.ts.radar-rejected' })).toBe(
      '✖ A PM can only add documents (.md, .txt), not code. Your change is kept in app.ts.radar-rejected.',
    );
    expect(formatRejection({ path: 'src/a.ts', reason: 'conflict', holder: null, sidecar: 'src/a.ts.radar-conflict' })).toBe(
      '✖ Your copy was behind, so the server version is used. Your copy: a.ts.radar-conflict',
    );
  });
  it('covers committing and a missing sidecar', () => {
    expect(formatRejection({ path: 'a.ts', reason: 'committing', holder, sidecar: null })).toMatch(/being committed/);
    expect(formatRejection({ path: 'a.ts', reason: 'held_by_other', holder: null, sidecar: null })).toMatch(/held by another member/);
  });
});

describe('stop reasons (D-alief-15)', () => {
  it('maps fatal closes to a kind and keeps reconnecting otherwise', () => {
    expect(fatalClose(4401, 'workspace closed')?.kind).toBe('workspace-closed');
    expect(fatalClose(4401, 'token rotated')?.kind).toBe('signed-out');
    expect(fatalClose(4401, 'member removed')).toEqual({ kind: 'removed', message: 'The workspace owner removed you, so sync stopped.' });
    expect(fatalClose(4401, 'unauthorized')?.kind).toBe('rejected');
    expect(fatalClose(4000, '')?.kind).toBe('replaced');
    expect(fatalClose(1006, '')).toBeNull();
    expect(fatalClose(1012, 'reset')).toBeNull();
  });
  it('a plain notifier writes no bell or colors (the app reads it)', () => {
    const out: string[] = [];
    terminalNotifier((s) => out.push(s), { plain: true })({ level: 'error', text: '✖ Sync stopped: x' });
    expect(out).toEqual(['✖ Sync stopped: x\n']);
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
