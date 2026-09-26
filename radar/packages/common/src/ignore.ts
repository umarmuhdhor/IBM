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
  'bob_sessions/',
  '.next/',
  'dist/',
  'build/',
  'coverage/',
  '.DS_Store',
  '*.radar-rejected',
  '*.radar-conflict',
  '*.swp',
  '*~',
  '.#*',
];

export interface IgnoreMatcher {
  /** True for ignored workspace-relative paths. Paths outside the workspace count as ignored. */
  ignores(relPath: string): boolean;
}

export function createIgnoreMatcherFromText(gitignoreText = ''): IgnoreMatcher {
  const ig = ignore().add([...DEFAULT_IGNORE_PATTERNS]).add(gitignoreText);
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
      return ig.ignores(rel);
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
