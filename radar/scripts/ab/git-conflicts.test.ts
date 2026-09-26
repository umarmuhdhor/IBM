import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { finishMerge, mergeBranches, replayCommits } from './git-conflicts.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]) =>
  execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();

/** A repo with checkout.ts (3 lines) and utils.ts on main; returns the base sha. */
function repo(): { dir: string; base: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ab-git-'));
  dirs.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'checkout.ts'), 'line1\nline2\nline3\n');
  writeFileSync(join(dir, 'utils.ts'), 'u1\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  return { dir, base: git(dir, 'rev-parse', 'HEAD') };
}

function branchWith(dir: string, base: string, name: string, file: string, content: string): string {
  git(dir, 'checkout', '-q', '-B', name, base);
  writeFileSync(join(dir, file), content);
  git(dir, 'commit', '-q', '-am', name);
  const sha = git(dir, 'rev-parse', 'HEAD');
  git(dir, 'checkout', '-q', 'main');
  return sha;
}

describe('mergeBranches (round A)', () => {
  it('counts conflicted files and hunks when both coders edit the same line', () => {
    const { dir, base } = repo();
    branchWith(dir, base, 'ab/a-coderA', 'checkout.ts', 'line1\nA\nline3\n');
    branchWith(dir, base, 'ab/a-coderB', 'checkout.ts', 'line1\nB\nline3\n');
    const r = mergeBranches(dir, base, ['ab/a-coderA', 'ab/a-coderB']);
    expect(r).toMatchObject({ conflictFiles: ['checkout.ts'], hunks: 1 });
    // the repo is left in the merge state so the human can resolve it with a stopwatch
    expect(readFileSync(join(dir, 'checkout.ts'), 'utf8')).toContain('<<<<<<<');
  });

  it('reports zero when the branches touch different files', () => {
    const { dir, base } = repo();
    branchWith(dir, base, 'ab/a-coderA', 'checkout.ts', 'line1\nA\nline3\n');
    branchWith(dir, base, 'ab/a-coderB', 'utils.ts', 'u2\n');
    expect(mergeBranches(dir, base, ['ab/a-coderA', 'ab/a-coderB'])).toMatchObject({ conflictFiles: [], hunks: 0 });
  });

  it('refuses to run on a dirty tree', () => {
    const { dir, base } = repo();
    writeFileSync(join(dir, 'utils.ts'), 'dirty\n');
    expect(() => mergeBranches(dir, base, ['main'])).toThrow(/clean/);
  });
});

describe('finishMerge (round A resolution)', () => {
  it('refuses while conflict markers remain, then commits once resolved', () => {
    const { dir, base } = repo();
    branchWith(dir, base, 'ab/a-coderA', 'checkout.ts', 'line1\nA\nline3\n');
    branchWith(dir, base, 'ab/a-coderB', 'checkout.ts', 'line1\nB\nline3\n');
    mergeBranches(dir, base, ['ab/a-coderA', 'ab/a-coderB']);
    expect(() => finishMerge(dir)).toThrow(/checkout\.ts/);
    writeFileSync(join(dir, 'checkout.ts'), 'line1\nAB\nline3\n');
    const r = finishMerge(dir);
    expect(r.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(git(dir, 'status', '--porcelain')).toBe('');
  });
});

describe('replayCommits (round B)', () => {
  it('applies the task commits in order on a scratch branch and counts conflicts', () => {
    const { dir, base } = repo();
    const a = branchWith(dir, base, 't1', 'checkout.ts', 'line1\nA\nline3\n');
    const b = branchWith(dir, base, 't2', 'utils.ts', 'u2\n');
    expect(replayCommits(dir, base, [a, b])).toMatchObject({ applied: 2, conflicts: [] });
  });

  it('records a commit that does not apply cleanly and keeps going', () => {
    const { dir, base } = repo();
    const a = branchWith(dir, base, 't1', 'checkout.ts', 'line1\nA\nline3\n');
    const b = branchWith(dir, base, 't2', 'checkout.ts', 'line1\nB\nline3\n');
    const r = replayCommits(dir, base, [a, b]);
    expect(r.applied).toBe(1);
    expect(r.conflicts).toEqual([{ sha: b, files: ['checkout.ts'] }]);
    // the caller's checkout is untouched
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main');
  });
});
