// `@radar/common/node`: Node-only helpers (file system). Sync agent, hooks and radar-mcp import this subpath.
import { readFileSync } from 'node:fs';
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

/** R5 §6 defaults plus `<root>/.gitignore` (a missing .gitignore means defaults only). */
export function createIgnoreMatcher(root: string): IgnoreMatcher {
  let text = '';
  try {
    text = readFileSync(join(root, '.gitignore'), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
  return createIgnoreMatcherFromText(text);
}
