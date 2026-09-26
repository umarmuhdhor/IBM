// Local file IO for the sync agent: atomic writes (tmp file + rename), classified reads, hashing.
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { isProbablyBinary, MAX_FILE_BYTES, normalizeRelative, PathOutsideWorkspaceError } from '@radar/common';

export class UnsafePathError extends Error {
  override readonly name = 'UnsafePathError';
  constructor(readonly path: string) {
    super(`refusing to touch ${JSON.stringify(path)}: outside the workspace or inside .git/.radar`);
  }
}

/** Temp names of atomicWrite: `.<name>.radar-tmp-<hex>` (also in DEFAULT_IGNORE_PATTERNS). */
export const isTmpName = (name: string): boolean => name.startsWith('.') && name.includes('.radar-tmp-');

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

/** Reads `<root>/<rel>`. A directory or a file that vanished counts as missing. */
export function readLocal(root: string, rel: string): LocalFile {
  let bytes: Buffer;
  try {
    bytes = readFileSync(join(root, safeRelative(rel)));
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

/** Resolves a symlinked target so the write replaces the link's file, not the link. */
function writeTarget(abs: string): string {
  try {
    return lstatSync(abs).isSymbolicLink() ? realpathSync(abs) : abs;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return abs;
    throw err;
  }
}

function renameWithRetry(from: string, to: string): void {
  for (let attempt = 0; ; attempt++) {
    try {
      renameSync(from, to);
      return;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // Windows: an editor or indexer may hold the target open for a moment.
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

/** Writes `content` to `<root>/<rel>` via a temp file + rename, keeping the old file mode. */
export function atomicWrite(root: string, rel: string, content: string | Buffer): void {
  const target = writeTarget(join(root, safeRelative(rel)));
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

/** Deletes `<root>/<rel>`; a missing file is fine. */
export function removeLocal(root: string, rel: string): void {
  rmSync(join(root, safeRelative(rel)), { force: true });
}
