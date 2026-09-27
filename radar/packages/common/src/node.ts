// `@radar/common/node`: Node-only helpers (file system). Sync agent, hooks and radar-mcp import this subpath.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createIgnoreMatcherFromText, type IgnoreMatcher } from './ignore.js';

export {
  ConfigInvalidError,
  ConfigMissingError,
  findLocalConfigFile,
  LocalConfigFile,
  loadLocalConfig,
  loadState,
  saveState,
  type HookState,
  type LocalConfig,
} from './config.js';

/** Folders read for nested .gitignore files; a larger tree keeps the rules found so far. */
const MAX_IGNORE_SCAN_DIRS = 20_000;

function readGitignore(dir: string): string | null {
  try {
    return readFileSync(join(dir, '.gitignore'), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/**
 * R5 §6 defaults plus `<root>/.gitignore` and every `.gitignore` in a subfolder that is not itself ignored
 * (D-alief-16). Symlinked folders are not followed.
 */
export function createIgnoreMatcher(root: string): IgnoreMatcher {
  const rootText = readGitignore(root) ?? '';
  const nested: Record<string, string> = {};
  let matcher = createIgnoreMatcherFromText(rootText);
  const queue = [''];
  for (let scanned = 0; queue.length > 0 && scanned < MAX_IGNORE_SCAN_DIRS; scanned++) {
    const dir = queue.shift()!;
    if (dir !== '') {
      const text = readGitignore(join(root, dir));
      if (text !== null) {
        nested[dir] = text;
        matcher = createIgnoreMatcherFromText(rootText, nested);
      }
    }
    let entries;
    try {
      entries = readdirSync(join(root, dir), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const rel = dir ? `${dir}/${entry.name}` : entry.name;
      if (entry.isDirectory() && !matcher.ignores(`${rel}/`)) queue.push(rel);
    }
  }
  return matcher;
}
