// `radar kit install` (fase 04 step 8): copies bob-kit/<role>/.bob into <root>/.bob without clobbering
// a .bob folder that holds the user's own files.
import { cpSync, existsSync, readdirSync, renameSync, rmdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
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

const KIT_ROLES: readonly KitRole[] = ['coder', 'pm'];

function removeWithEmptyParents(root: string, rel: string): void {
  rmSync(join(root, rel), { force: true });
  for (let dir = dirname(join(root, rel)); dir !== root && readdirSync(dir).length === 0; dir = dirname(dir)) rmdirSync(dir);
}

export function installKit(o: { root: string; role: KitRole; kitDir: string | null; force?: boolean; now?: () => number }): KitResult {
  const src = o.kitDir ? join(o.kitDir, o.role, '.bob') : null;
  if (!src || !isDir(src)) return { status: 'missing-kit', kitDir: o.kitDir };
  const kitFiles = new Set(filesUnder(src));
  // Files of any role's kit belong to the kit, so a coder kit is replaced by the pm kit and back.
  const kitOwned = new Set(KIT_ROLES.flatMap((r) => (o.kitDir && isDir(join(o.kitDir, r, '.bob')) ? filesUnder(join(o.kitDir, r, '.bob')) : [])));
  const dest = join(o.root, '.bob');
  let backup: string | undefined;
  if (existsSync(dest)) {
    // An older kit (every file is part of a kit) is replaced; anything else needs --force.
    const present = filesUnder(dest);
    const foreign = present.filter((f) => !kitOwned.has(f));
    if (foreign.length > 0) {
      if (!o.force) return { status: 'refused', foreign };
      backup = `.bob.bak-${(o.now ?? Date.now)()}`;
      renameSync(dest, join(o.root, backup));
    } else {
      for (const f of present.filter((p) => !kitFiles.has(p))) removeWithEmptyParents(dest, f);
    }
  }
  cpSync(src, dest, { recursive: true, force: true });
  return backup ? { status: 'installed', files: kitFiles.size, backup } : { status: 'installed', files: kitFiles.size };
}
