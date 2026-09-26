// `radar kit install` (fase 04 step 8): copies bob-kit/<role>/.bob into <root>/.bob without clobbering
// a .bob folder that holds the user's own files.
import { cpSync, existsSync, readdirSync, renameSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type KitRole = 'coder' | 'pm';

export type KitResult =
  | { status: 'installed'; files: number; backup?: string }
  | { status: 'refused'; foreign: string[] }
  | { status: 'missing-kit'; kitDir: string | null };

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else out.push(relative(dir, abs).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/**
 * Kit location: `--kit-dir`, then `RADAR_KIT_DIR`, then the copy bundled in the packed package
 * (`<pkg>/bob-kit`), then the repo's `radar/bob-kit`. Returns null when none exists.
 */
export function findKitDir(explicit: string | undefined, env: Record<string, string | undefined> = process.env): string | null {
  if (explicit) return resolve(explicit);
  if (env.RADAR_KIT_DIR) return resolve(env.RADAR_KIT_DIR);
  for (const rel of ['../bob-kit', '../../../bob-kit']) {
    const p = fileURLToPath(new URL(rel, import.meta.url));
    if (isDir(p)) return p.replace(/[\\/]+$/, '');
  }
  return null;
}

export function installKit(o: { root: string; role: KitRole; kitDir: string | null; force?: boolean; now?: () => number }): KitResult {
  const src = o.kitDir ? join(o.kitDir, o.role, '.bob') : null;
  if (!src || !isDir(src)) return { status: 'missing-kit', kitDir: o.kitDir };
  const kitFiles = new Set(filesUnder(src));
  const dest = join(o.root, '.bob');
  let backup: string | undefined;
  if (existsSync(dest)) {
    // An older kit (every file is part of this kit) is replaced; anything else needs --force.
    const foreign = filesUnder(dest).filter((f) => !kitFiles.has(f));
    if (foreign.length > 0) {
      if (!o.force) return { status: 'refused', foreign };
      backup = `.bob.bak-${(o.now ?? Date.now)()}`;
      renameSync(dest, join(o.root, backup));
    }
  }
  cpSync(src, dest, { recursive: true, force: true });
  return backup ? { status: 'installed', files: kitFiles.size, backup } : { status: 'installed', files: kitFiles.size };
}
