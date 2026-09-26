// Merge-conflict counting for the A/B experiment (fase 13 steps 2–3). Measured with real git, never assumed.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (dir: string, ...args: string[]): string =>
  execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** Like `git`, but a non-zero exit (a conflict) is returned instead of thrown. */
function gitTry(dir: string, ...args: string[]): { ok: boolean; out: string } {
  try {
    return { ok: true, out: git(dir, ...args) };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string };
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

const unmerged = (dir: string): string[] => git(dir, 'diff', '--name-only', '--diff-filter=U').split('\n').filter(Boolean);

const countHunks = (dir: string, files: string[]): number =>
  files.reduce((n, f) => n + readFileSync(join(dir, f), 'utf8').split('\n').filter((l) => l.startsWith('<<<<<<<')).length, 0);

function assertClean(dir: string): void {
  if (git(dir, 'status', '--porcelain') !== '') throw new Error(`${dir}: working tree must be clean before the merge check`);
}

export interface MergeResult {
  branch: string;
  merged: string[];
  conflictFiles: string[];
  hunks: number;
}

/**
 * Round A: `ab/a-merge` = base, then each branch merged with `--no-ff --no-commit`, in order. Stops at the first
 * merge that conflicts and leaves the repo in that merge state, so the human resolves it (stopwatch) and runs
 * finishMerge. Without conflicts every merge is committed.
 */
export function mergeBranches(dir: string, base: string, branches: string[], mergeBranch = 'ab/a-merge'): MergeResult {
  assertClean(dir);
  git(dir, 'checkout', '-q', '-B', mergeBranch, base);
  const merged: string[] = [];
  for (const b of branches) {
    const r = gitTry(dir, '-c', 'user.name=ab-merge', '-c', 'user.email=ab-merge@example.com', 'merge', '--no-ff', '--no-commit', b);
    const files = unmerged(dir);
    if (files.length > 0) return { branch: mergeBranch, merged, conflictFiles: files, hunks: countHunks(dir, files) };
    if (!r.ok) throw new Error(`merge ${b} failed without conflicts: ${r.out}`);
    gitTry(dir, '-c', 'user.name=ab-merge', '-c', 'user.email=ab-merge@example.com', 'commit', '-q', '--no-edit', '--allow-empty');
    merged.push(b);
  }
  return { branch: mergeBranch, merged, conflictFiles: [], hunks: 0 };
}

/** Round A after the manual resolution: no conflict markers may remain; commits the merge. */
export function finishMerge(dir: string): { sha: string } {
  const files = git(dir, 'diff', '--name-only').split('\n').filter(Boolean);
  const markers = [...new Set([...unmerged(dir), ...files])].filter((f) => {
    try {
      return /^(<<<<<<<|>>>>>>>)/m.test(readFileSync(join(dir, f), 'utf8'));
    } catch {
      return false; // deleted in the resolution
    }
  });
  if (markers.length > 0) throw new Error(`conflict markers still in: ${markers.join(', ')}`);
  git(dir, 'add', '-A');
  git(dir, '-c', 'user.name=ab-merge', '-c', 'user.email=ab-merge@example.com', 'commit', '-q', '--no-edit', '--allow-empty');
  return { sha: git(dir, 'rev-parse', 'HEAD') };
}

export interface ReplayResult {
  applied: number;
  conflicts: { sha: string; files: string[] }[];
}

/**
 * Round B: cherry-pick the task commits (in commit.created order) onto base in a throwaway worktree. With one
 * writer per file this should be conflict-free; it is measured anyway. A commit that conflicts is recorded and
 * skipped. The caller's checkout is not touched.
 */
export function replayCommits(dir: string, base: string, shas: string[]): ReplayResult {
  const wt = mkdtempSync(join(tmpdir(), 'ab-replay-'));
  rmSync(wt, { recursive: true, force: true });
  git(dir, 'worktree', 'add', '-q', '--detach', wt, base);
  const result: ReplayResult = { applied: 0, conflicts: [] };
  try {
    for (const sha of shas) {
      const r = gitTry(wt, '-c', 'user.name=ab-replay', '-c', 'user.email=ab-replay@example.com', 'cherry-pick', '--allow-empty', sha);
      if (r.ok) {
        result.applied++;
        continue;
      }
      const files = unmerged(wt);
      if (files.length === 0) throw new Error(`cherry-pick ${sha} failed without conflicts: ${r.out}`);
      result.conflicts.push({ sha, files });
      git(wt, 'cherry-pick', '--abort');
    }
  } finally {
    git(dir, 'worktree', 'remove', '--force', wt);
  }
  return result;
}
