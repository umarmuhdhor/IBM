// Workspace path helpers. String-only (no node:path) because the Worker imports @radar/common too.
// Workspace-relative paths are POSIX, without a leading './', and never contain '..'.

export class PathOutsideWorkspaceError extends Error {
  override readonly name = 'PathOutsideWorkspaceError';
  constructor(readonly path: string) {
    super(`path is outside the workspace: ${path}`);
  }
}

/** Replace every backslash with a forward slash. */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

const DRIVE_RE = /^[A-Za-z]:(\/|$)/;

function isAbsolutePosix(p: string): boolean {
  return p.startsWith('/') || DRIVE_RE.test(p);
}

/** Resolve '.' and '..' segments. Returns null when '..' climbs above the start. */
function resolveSegments(segments: string[]): string[] | null {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (out.length === 0) return null;
      out.pop();
      continue;
    }
    out.push(seg);
  }
  return out;
}

/**
 * Normalise a workspace-relative path: POSIX separators, no './', '..' folded.
 * Throws PathOutsideWorkspaceError for absolute paths or paths that climb out of the workspace.
 * The workspace root itself normalises to ''.
 */
export function normalizeRelative(p: string): string {
  const posix = toPosix(p);
  if (isAbsolutePosix(posix)) throw new PathOutsideWorkspaceError(p);
  const segs = resolveSegments(posix.split('/'));
  if (segs === null) throw new PathOutsideWorkspaceError(p);
  return segs.join('/');
}

interface AbsParts {
  /** '' for POSIX roots, 'c:' (lower case) for Windows drives. */
  drive: string;
  segments: string[];
}

function splitAbsolute(p: string): AbsParts | null {
  const posix = toPosix(p);
  const drive = DRIVE_RE.test(posix) ? posix.slice(0, 2).toLowerCase() : '';
  const rest = drive ? posix.slice(2) : posix;
  const segs = resolveSegments(rest.split('/'));
  return segs === null ? null : { drive, segments: segs };
}

export interface RelativeOptions {
  /** Compare path segments case-insensitively. Defaults to true for Windows drive roots. */
  caseInsensitive?: boolean;
}

/**
 * Convert an absolute or workspace-relative path to a workspace-relative POSIX path.
 * Throws PathOutsideWorkspaceError when the path is outside `root`. The root itself returns ''.
 */
export function toWorkspaceRelative(root: string, p: string, opts: RelativeOptions = {}): string {
  const posix = toPosix(p);
  if (!isAbsolutePosix(posix)) return normalizeRelative(posix);

  const rootParts = splitAbsolute(root);
  const pathParts = splitAbsolute(posix);
  if (!rootParts || !pathParts || rootParts.drive !== pathParts.drive) throw new PathOutsideWorkspaceError(p);

  const ci = opts.caseInsensitive ?? rootParts.drive !== '';
  const eq = (a: string, b: string) => (ci ? a.toLowerCase() === b.toLowerCase() : a === b);
  const { segments: rs } = rootParts;
  const { segments: ps } = pathParts;
  if (ps.length < rs.length) throw new PathOutsideWorkspaceError(p);
  for (let i = 0; i < rs.length; i++) {
    if (!eq(rs[i] as string, ps[i] as string)) throw new PathOutsideWorkspaceError(p);
  }
  return ps.slice(rs.length).join('/');
}

/** Like toWorkspaceRelative, but returns null instead of throwing. The root itself ('') also returns null. */
export function tryWorkspaceRelative(root: string, p: string, opts: RelativeOptions = {}): string | null {
  try {
    const rel = toWorkspaceRelative(root, p, opts);
    return rel === '' ? null : rel;
  } catch (err) {
    if (err instanceof PathOutsideWorkspaceError) return null;
    throw err;
  }
}

/** True when `p` (absolute or relative) resolves to `root` or a path inside it. */
export function isInside(root: string, p: string, opts: RelativeOptions = {}): boolean {
  try {
    toWorkspaceRelative(root, p, opts);
    return true;
  } catch (err) {
    if (err instanceof PathOutsideWorkspaceError) return false;
    throw err;
  }
}

/** Last path segment ('src/checkout/checkout.ts' → 'checkout.ts'). */
export function basename(p: string): string {
  const posix = toPosix(p).replace(/\/+$/, '');
  const i = posix.lastIndexOf('/');
  return i === -1 ? posix : posix.slice(i + 1);
}
