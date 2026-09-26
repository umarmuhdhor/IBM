// Task diff + impact analysis (fase 06 step 4, R3 §2.15): unified patch per touched file, changed
// exports per line-scanned regex, and importers resolved against the current file set.
import type { TaskDiffRes } from '@radar/common';
import { createTwoFilesPatch } from 'diff';
import { getFile, getFileVersion, listFilesWithContent } from '../db/repo/file';
import { getLock } from '../db/repo/lock';
import { getMeta } from '../db/repo/meta';
import { touchesOf } from '../db/repo/touch';
import type { Db } from '../db/sql';
import { holderOf } from './locks';
import { taskOr404 } from './tasks';

/** R3 §2.15: total patch budget; the rest is `truncated: true`. */
export const DIFF_PATCH_BUDGET_BYTES = 60 * 1024;

export interface ExportChange {
  name: string;
  kind: string;
  before: string;
  after: string;
}

interface Signature {
  name: string;
  kind: string;
  sig: string;
}

function signaturesOf(src: string): Map<string, Signature> {
  const out = new Map<string, Signature>();
  const put = (name: string | undefined, kind: string | undefined, sig: string): void => {
    if (name && kind) out.set(name, { name, kind, sig });
  };
  for (const line of src.split('\n')) {
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s*export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/))) {
      put(m[1], 'function', `${m[1] ?? ''}(${m[2] ?? ''})`);
    } else if ((m = line.match(/^\s*export\s+const\s+(\w+)\s*=\s*(?:async\s*)\(([^)]*)\)\s*(?::[^=]+)?=>/))) {
      put(m[1], 'function', `${m[1] ?? ''}(${m[2] ?? ''})`);
    } else if ((m = line.match(/^\s*export\s+(class|interface|type|enum)\s+(\w+)/))) {
      put(m[2], m[1], `${m[1] ?? ''} ${m[2] ?? ''}`);
    } else if ((m = line.match(/^\s*export\s+default\s+function\s*(\w*)\s*\(([^)]*)\)/))) {
      put(m[1] || 'default', 'function', `${m[1] || 'default'}(${m[2] ?? ''})`);
    }
  }
  return out;
}

/** Export map diff (fase 06 step 4.2): added, removed, or signature-changed exports. */
export function extractExports(before: string, after: string): ExportChange[] {
  const b = signaturesOf(before);
  const a = signaturesOf(after);
  const names = [...new Set([...b.keys(), ...a.keys()])].sort();
  const out: ExportChange[] = [];
  for (const n of names) {
    const bb = b.get(n);
    const aa = a.get(n);
    if (!bb && aa) out.push({ name: n, kind: aa.kind, before: '', after: aa.sig });
    else if (bb && !aa) out.push({ name: n, kind: bb.kind, before: bb.sig, after: '' });
    else if (bb && aa && (bb.sig !== aa.sig || bb.kind !== aa.kind)) out.push({ name: n, kind: aa.kind, before: bb.sig, after: aa.sig });
  }
  return out;
}

function joinPosix(dir: string, spec: string): string {
  const out: string[] = [];
  for (const part of [...(dir ? dir.split('/') : []), ...spec.split('/')]) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

const RESOLVE_CANDIDATES = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '.css'];

/**
 * Resolves an import specifier to a workspace path (fase 06 step 4.3). Relative specs try the
 * candidate list; aliases use a one-level `tsconfig.json` paths map; anything else is skipped.
 */
export function resolveImportSpec(
  importerDir: string,
  spec: string,
  exists: (p: string) => boolean,
  alias: Record<string, string> = {},
): string | null {
  let base: string;
  if (spec.startsWith('./') || spec.startsWith('../')) {
    base = joinPosix(importerDir, spec);
  } else {
    const key = Object.keys(alias).find((k) => k.endsWith('/*') && spec.startsWith(k.slice(0, -1)));
    if (!key) return null;
    base = joinPosix('', `${alias[key]?.replace(/\*$/, '') ?? ''}${spec.slice(key.length - 1)}`);
  }
  for (const c of RESOLVE_CANDIDATES) {
    const p = base + c;
    if (exists(p)) return p;
  }
  return null;
}

export interface ParsedImport {
  spec: string;
  /** Imported symbol names (named originals, i.e. `a` in `import { a, b as c }`, plus defaults). */
  symbols: string[];
}

/** Import statements of one file (fase 06 step 4.3). Dynamic/bare imports carry no symbols. */
export function parseImports(content: string): ParsedImport[] {
  const out: ParsedImport[] = [];
  const fromRe = /import\s+([^'";]*?)\s+from\s*['"]([^'"]+)['"]/g;
  let m: RegExpMatchArray | null;
  while ((m = fromRe.exec(content)) !== null) {
    const clause = (m[1] ?? '').replace(/^\s*type\s+/, '');
    const spec = m[2] ?? '';
    const symbols: string[] = [];
    const named = clause.match(/\{([^}]*)\}/);
    if (named?.[1]) {
      for (const part of named[1].split(',')) {
        const orig = part.split(' as ')[0]?.trim();
        if (orig) symbols.push(orig);
      }
    }
    const trimmed = clause.trimStart();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('*')) {
      const def = trimmed.match(/^([A-Za-z_$][\w$]*)/);
      if (def?.[1]) symbols.push(def[1]);
    }
    out.push({ spec, symbols });
  }
  const pushBare = (re: RegExp): void => {
    let x: RegExpMatchArray | null;
    while ((x = re.exec(content)) !== null) out.push({ spec: x[1] ?? '', symbols: [] });
  };
  pushBare(/import\s*['"]([^'"]+)['"]/g);
  pushBare(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  pushBare(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  pushBare(/export\s+\*\s+from\s*['"]([^'"]+)['"]/g);
  pushBare(/@import\s+['"]([^'"]+)['"]/g);
  const reexportRe = /export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
  while ((m = reexportRe.exec(content)) !== null) {
    const symbols: string[] = [];
    for (const part of (m[1] ?? '').split(',')) {
      const orig = part.split(' as ')[0]?.trim();
      if (orig) symbols.push(orig);
    }
    out.push({ spec: m[2] ?? '', symbols });
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 1-based lines where a changed symbol is called (`\bname\s*\(`). */
export function usageLines(content: string, names: string[]): number[] {
  if (names.length === 0) return [];
  const res = names.map((n) => new RegExp(`\\b${escapeRegExp(n)}\\s*\\(`));
  const out: number[] = [];
  content.split('\n').forEach((line, i) => {
    if (res.some((re) => re.test(line))) out.push(i + 1);
  });
  return out;
}

const SCANNABLE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

/** One-level `tsconfig.json` paths (`{"@/*": ["src/*"]}`) from the workspace file set. */
function tsconfigAlias(db: Db): Record<string, string> {
  const row = getFile(db, 'tsconfig.json');
  if (!row || row.deleted || !row.content) return {};
  try {
    const parsed = JSON.parse(row.content) as { compilerOptions?: { paths?: Record<string, string[]> } };
    const paths = parsed.compilerOptions?.paths ?? {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(paths)) {
      const first = v[0];
      if (k.endsWith('/*') && first?.endsWith('/*')) out[k.slice(0, -1)] = first.slice(0, -1);
    }
    return out;
  } catch {
    return {};
  }
}

/** `GET /v1/tasks/:id/diff` body (R3 §2.15). Throws 404 for an unknown task. */
export function buildTaskDiff(db: Db, taskId: string, now: number): TaskDiffRes {
  const task = taskOr404(db, taskId);
  const touches = touchesOf(db, taskId);
  const alias = tsconfigAlias(db);

  const files: TaskDiffRes['files'] = [];
  const changedExports = new Map<string, ExportChange[]>();
  let used = 0;
  for (const t of touches) {
    const bv = t.first_version === 0 ? null : getFileVersion(db, t.path, t.first_version);
    const cur = getFile(db, t.path);
    const before = bv && !bv.deleted ? (bv.content ?? '') : '';
    const after = cur && !cur.deleted ? (cur.content ?? '') : '';
    const deleted = !cur || cur.deleted === 1;
    const change: 'added' | 'modified' | 'deleted' = deleted ? 'deleted' : t.first_version === 0 ? 'added' : 'modified';
    const full = createTwoFilesPatch(`a/${t.path}`, `b/${t.path}`, before, after, '', '', { context: 3 });
    const isCode = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(t.path);
    const exportsChanged = isCode ? extractExports(before, after) : [];
    changedExports.set(t.path, exportsChanged);
    let patch: string;
    if (used >= DIFF_PATCH_BUDGET_BYTES) {
      patch = '';
    } else if (full.length <= DIFF_PATCH_BUDGET_BYTES - used) {
      patch = full;
    } else {
      patch = `${full.slice(0, DIFF_PATCH_BUDGET_BYTES - used)}\n...[truncated]`;
    }
    used += patch.length;
    files.push({ path: t.path, change, fromVersion: t.first_version, toVersion: cur?.version ?? t.last_version, patch, exportsChanged });
  }
  const truncated = used >= DIFF_PATCH_BUDGET_BYTES;

  const current = listFilesWithContent(db).filter((f) => f.content !== null && !f.deleted && SCANNABLE_EXT.test(f.path));
  const existSet = new Set(current.map((f) => f.path));
  const exists = (p: string): boolean => existSet.has(p);
  const importers: TaskDiffRes['importers'] = [];
  for (const f of current) {
    const content = f.content ?? '';
    const byTarget = new Map<string, Set<string>>();
    for (const imp of parseImports(content)) {
      const target = resolveImportSpec(dirOf(f.path), imp.spec, exists, alias);
      if (!target || target === f.path || !changedExports.has(target)) continue;
      const set = byTarget.get(target) ?? new Set<string>();
      for (const s of imp.symbols) set.add(s);
      byTarget.set(target, set);
    }
    for (const [target, symbols] of byTarget) {
      if (symbols.size === 0) continue;
      const changedNames = new Set((changedExports.get(target) ?? []).map((e) => e.name));
      const lines = usageLines(
        content,
        [...symbols].filter((s) => changedNames.has(s)),
      );
      const lock = getLock(db, f.path);
      const holder = lock ? holderOf({ db, now }, lock) : null;
      importers.push({
        path: f.path,
        imports: target,
        symbols: [...symbols],
        lines,
        holder: holder ? { memberId: holder.memberId, taskId: holder.taskId, state: holder.state } : null,
      });
    }
  }

  return {
    taskId: task.id,
    title: task.title,
    ownerId: task.owner_id,
    status: task.status,
    baseCommit: task.base_commit ?? getMeta(db, 'head_commit'),
    summary: task.submit_summary,
    files,
    importers,
    truncated,
  };
}
