// Local file IO for the sync agent: atomic writes (tmp file + rename), classified reads, hashing.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync, type Dirent } from 'node:fs';
import { basename, dirname, join, sep } from 'node:path';
import { DIR_MARKER, dirMarkerFolder, isDirMarker, isProbablyBinary, MAX_FILE_BYTES, normalizeRelative, PathOutsideWorkspaceError } from '@radar/common';

export class UnsafePathError extends Error {
  override readonly name = 'UnsafePathError';
  constructor(readonly path: string) {
    super(`refusing to touch ${JSON.stringify(path)}: outside the workspace or inside .git/.radar`);
  }
}

/** Temp names of atomicWrite: `.<name>.radar-tmp-<hex>` (also in DEFAULT_IGNORE_PATTERNS). */
export const isTmpName = (name: string): boolean => name.startsWith('.') && name.includes('.radar-tmp-');

/** A path the agent never syncs. An empty-folder marker (`<folder>/.radar-dir`) follows its folder's rule. */
export function isIgnored(ignores: (rel: string) => boolean, rel: string, isDir: boolean | undefined): boolean {
  if (rel === '') return false;
  if (isDirMarker(rel)) return isIgnored(ignores, dirMarkerFolder(rel), true);
  if (isTmpName(basename(rel))) return true;
  if (ignores(rel)) return true;
  // `ignore` only matches 'dist/' style rules against a path ending in '/'.
  return isDir !== false && ignores(`${rel}/`);
}

/** True when a folder entry is something the agent syncs: a non-ignored file or folder. A real file named
 * like the marker never syncs, so it cannot fake a folder. */
export function isSyncedEntry(ignores: (rel: string) => boolean, rel: string, e: Dirent): boolean {
  return (e.isFile() || e.isDirectory()) && e.name !== DIR_MARKER && !isIgnored(ignores, rel, e.isDirectory());
}

const EMPTY_TEXT_HASH = createHash('sha256').update('').digest('hex');

/**
 * Validates a workspace-relative path from the server or the watcher. Throws UnsafePathError for
 * absolute paths, '..' escapes, the root itself, and anything under `.git/` or `.radar/`.
 */
export function safeRelative(rel: string): string {
  let norm: string;
  try {
    norm = normalizeRelative(rel);
  } catch (err) {
    if (err instanceof PathOutsideWorkspaceError) throw new UnsafePathError(rel);
    throw err;
  }
  const top = norm.split('/')[0];
  if (norm === '' || top === '.git' || top === '.radar') throw new UnsafePathError(rel);
  return norm;
}

/** SHA-256 hex of the UTF-8 bytes; equals `sha256Hex` in @radar/common and the server's hash. */
export function hashText(content: string): string {
  return createHash('sha256').update(Buffer.from(content, 'utf8')).digest('hex');
}

export type LocalFile =
  | { kind: 'missing' }
  | { kind: 'too_large'; bytes: Buffer }
  | { kind: 'binary'; bytes: Buffer }
  | { kind: 'text'; content: string; hash: string; bytes: Buffer };

/**
 * Real path of `abs` with every symlink followed. A missing tail is appended as is to the real path of
 * its nearest existing ancestor, so a file about to be created still resolves through linked folders.
 */
function realPathOf(abs: string): string {
  const rest: string[] = [];
  let cur = abs;
  for (;;) {
    try {
      return join(realpathSync(cur), ...rest);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const parent = dirname(cur);
      if ((code !== 'ENOENT' && code !== 'ENOTDIR') || parent === cur) throw err;
      rest.unshift(basename(cur));
      cur = parent;
    }
  }
}

/**
 * Resolves `<root>/<rel>` through symlinks and throws UnsafePathError if the result leaves the
 * workspace. A file or folder symlinked out of the workspace must never be read, written or deleted.
 */
function resolveInside(root: string, rel: string, followLast: boolean): string {
  const abs = join(root, safeRelative(rel));
  const realRoot = realpathSync(root);
  const real = followLast ? realPathOf(abs) : join(realPathOf(dirname(abs)), basename(abs));
  if (!real.startsWith(realRoot + sep)) throw new UnsafePathError(rel);
  return real;
}

/**
 * Reads `<root>/<rel>`. A directory or a file that vanished counts as missing. An empty-folder marker reads
 * as an empty text file while its folder exists and holds nothing that syncs (fase 12k bug 1), else missing.
 */
export function readLocal(root: string, rel: string, ignores: (rel: string) => boolean = () => false): LocalFile {
  if (isDirMarker(rel)) {
    const folder = dirMarkerFolder(rel);
    let entries: Dirent[];
    try {
      entries = readdirSync(resolveInside(root, folder, true), { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') return { kind: 'missing' };
      throw err;
    }
    if (entries.some((e) => isSyncedEntry(ignores, `${folder}/${e.name}`, e))) return { kind: 'missing' };
    return { kind: 'text', content: '', hash: EMPTY_TEXT_HASH, bytes: Buffer.alloc(0) };
  }
  let bytes: Buffer;
  try {
    bytes = readFileSync(resolveInside(root, rel, true));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR' || code === 'ENOTDIR') return { kind: 'missing' };
    throw err;
  }
  if (bytes.byteLength > MAX_FILE_BYTES) return { kind: 'too_large', bytes };
  if (isProbablyBinary(bytes)) return { kind: 'binary', bytes };
  // Hash the decoded text: invalid UTF-8 would otherwise never match the server's hash of the same string.
  const content = bytes.toString('utf8');
  return { kind: 'text', content, hash: hashText(content), bytes };
}

/**
 * Windows only in practice: an editor or indexer may hold the target open for a moment. The back-off
 * is synchronous on purpose (at most ~300 ms in total) so atomicWrite stays synchronous for its callers.
 */
function renameWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if ((code === 'EPERM' || code === 'EBUSY') && attempt < 5) {
        const until = Date.now() + 20 * (attempt + 1);
        while (Date.now() < until) {
          /* short synchronous back-off */
        }
        continue;
      }
      throw err;
    }
  }
}

/**
 * Writes `content` to `<root>/<rel>` via a temp file + rename, keeping the old file mode. A symlink
 * inside the workspace is written through (its target is replaced, not the link).
 */
export function atomicWrite(root: string, rel: string, content: string | Buffer): void {
  if (isDirMarker(rel)) {
    mkdirSync(resolveInside(root, dirMarkerFolder(rel), true), { recursive: true });
    return;
  }
  const target = resolveInside(root, rel, true);
  const dir = dirname(target);
  mkdirSync(dir, { recursive: true });
  let mode: number | undefined;
  try {
    mode = statSync(target).mode & 0o777;
  } catch {
    mode = undefined;
  }
  const tmp = join(dir, `.${basename(target)}.radar-tmp-${randomBytes(4).toString('hex')}`);
  try {
    writeFileSync(tmp, content);
    if (mode !== undefined) chmodSync(tmp, mode);
    renameWithRetry(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
}

/** Deletes `<root>/<rel>` (a symlink itself, not its target); a missing file is fine. */
export function removeLocal(root: string, rel: string): void {
  if (isDirMarker(rel)) {
    removeEmptyFolder(resolveInside(root, dirMarkerFolder(rel), true));
    return;
  }
  rmSync(resolveInside(root, rel, false), { force: true });
}

/** Files the OS drops into folders on its own; they do not keep a removed folder alive. */
const OS_JUNK = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);

/** Removes a folder that holds nothing, or only OS junk files. Anything else keeps the folder. */
function removeEmptyFolder(abs: string): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    return;
  }
  if (!entries.every((e) => e.isFile() && OS_JUNK.has(e.name))) return;
  for (const e of entries) rmSync(join(abs, e.name), { force: true });
  try {
    rmdirSync(abs);
  } catch {
    // Something appeared meanwhile: keep the folder.
  }
}

/**
 * After a remote delete: removes the folders it left empty, up to (not including) the root. `keep` names
 * folders (workspace-relative) that must stay, such as an empty folder a teammate shares on purpose.
 */
export function pruneEmptyParents(root: string, rel: string, keep: (folder: string) => boolean = () => false): void {
  const realRoot = realpathSync(root);
  const start = isDirMarker(rel) ? dirMarkerFolder(rel) : rel;
  let folder = dirname(start) === '.' ? '' : dirname(start);
  for (let dir = dirname(resolveInside(root, start, false)); dir.startsWith(realRoot + sep); dir = dirname(dir)) {
    if (keep(folder)) return;
    folder = dirname(folder) === '.' ? '' : dirname(folder);
    try {
      if (readdirSync(dir).length > 0) return;
      rmdirSync(dir);
    } catch {
      return;
    }
  }
}
