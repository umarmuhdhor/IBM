// Ignore rules for sync and the initial import (R5 §6). Pure: the caller passes the root .gitignore text.
// `@radar/common/node` has `createIgnoreMatcher(root)`, which reads `<root>/.gitignore` from disk.
import ignore from 'ignore';
import { BINARY_SNIFF_BYTES, MAX_FILE_BYTES } from './constants.js';
import { normalizeRelative, PathOutsideWorkspaceError } from './paths.js';

export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  '.git/',
  '.github/workflows/',
  'node_modules/',
  '.radar/',
  '.bob/',
  // The kit install moves an existing .bob/ aside as .bob.bak-<time>/ (fase 12k).
  '.bob.bak-*/',
  'bob_sessions/',
  '.next/',
  'dist/',
  'build/',
  'coverage/',
  '.DS_Store',
  '*.radar-rejected',
  '*.radar-conflict',
  // Atomic-write temp files of the sync agent (`.<name>.radar-tmp-<rand>`, fase 04).
  '.*.radar-tmp-*',
  '*.swp',
  '*~',
  '.#*',
];

/**
 * D-alief-16: never synced, whatever the workspace .gitignore says. A `!` rule there cannot bring back the member
 * token (.radar/), the Bob kit, git internals, sync copies or .env files; shareable .env examples still sync.
 */
export const ALWAYS_IGNORED_PATTERNS: readonly string[] = [
  '.git/',
  '.radar/',
  '.bob/',
  // The kit install moves an existing .bob/ aside as .bob.bak-<time>/ (fase 12k).
  '.bob.bak-*/',
  '*.radar-rejected',
  '*.radar-conflict',
  '.*.radar-tmp-*',
  '.env',
  '.env.*',
  '!.env.example',
  '!.env.sample',
  '!.env.template',
];

export interface IgnoreMatcher {
  /** True for ignored workspace-relative paths. Paths outside the workspace count as ignored. */
  ignores(relPath: string): boolean;
}

/**
 * `nested` maps a workspace-relative folder to the text of its own .gitignore. As in git, those rules apply only
 * inside that folder, and a deeper file wins over a shallower one; ALWAYS_IGNORED_PATTERNS still win over all.
 */
export function createIgnoreMatcherFromText(
  gitignoreText = '',
  nested: Readonly<Record<string, string>> = {},
): IgnoreMatcher {
  const always = ignore().add([...ALWAYS_IGNORED_PATTERNS]);
  const ig = ignore().add([...DEFAULT_IGNORE_PATTERNS]).add(gitignoreText);
  const layers = Object.entries(nested)
    .map(([dir, text]) => ({ prefix: `${normalizeRelative(dir)}/`, ig: ignore().add(text) }))
    .filter((layer) => layer.prefix !== '/')
    .sort((a, b) => a.prefix.length - b.prefix.length);
  return {
    ignores(relPath: string): boolean {
      let rel: string;
      try {
        rel = normalizeRelative(relPath);
      } catch (err) {
        if (err instanceof PathOutsideWorkspaceError) return true;
        throw err;
      }
      if (rel === '') return false;
      // A trailing slash marks a directory, so `dist/` rules can skip the whole folder.
      if (/[\\/]$/.test(relPath)) rel += '/';
      if (always.ignores(rel)) return true;
      let ignored = ig.ignores(rel);
      for (const layer of layers) {
        const sub = rel.startsWith(layer.prefix) ? rel.slice(layer.prefix.length) : '';
        if (sub === '') continue;
        const result = layer.ig.test(sub);
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
      }
      return ignored;
    },
  };
}

/** Binary heuristic from R5 §6: a NUL byte in the first 8 KB. */
export function isProbablyBinary(buf: Uint8Array): boolean {
  const end = Math.min(buf.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < end; i++) if (buf[i] === 0) return true;
  return false;
}

export function exceedsMaxSize(bytes: number): boolean {
  return bytes > MAX_FILE_BYTES;
}
