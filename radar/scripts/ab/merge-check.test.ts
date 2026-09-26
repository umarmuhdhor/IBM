import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { main } from './merge-check.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const git = (dir: string, ...args: string[]) =>
  execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' }).trim();

function conflictingRepo(): { dir: string; base: string; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ab-cli-'));
  dirs.push(dir);
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'checkout.ts'), 'a\nb\nc\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'base');
  const base = git(dir, 'rev-parse', 'HEAD');
  for (const [branch, line] of [['ab/a-coderA', 'A'], ['ab/a-coderB', 'B']] as const) {
    git(dir, 'checkout', '-q', '-B', branch, base);
    writeFileSync(join(dir, 'checkout.ts'), `a\n${line}\nc\n`);
    git(dir, 'commit', '-q', '-am', branch);
  }
  git(dir, 'checkout', '-q', 'main');
  const outDir = mkdtempSync(join(tmpdir(), 'ab-out-'));
  dirs.push(outDir);
  return { dir, base, out: join(outDir, 'round-a.json') };
}

const log = () => {};

describe('merge-check CLI', () => {
  it('check writes the conflict count, finish records minutes and the build result', () => {
    const { dir, base, out } = conflictingRepo();
    expect(main(['check', '--repo', dir, '--base', base, '--out', out], log)).toBe(0);
    const checked = JSON.parse(readFileSync(out, 'utf8'));
    expect(checked).toMatchObject({ base, branches: ['ab/a-coderA', 'ab/a-coderB'], conflictFiles: ['checkout.ts'], hunks: 1 });
    expect(typeof checked.checkedAt).toBe('string');

    // still conflicted: finish refuses
    expect(main(['finish', '--repo', dir, '--minutes', '4', '--build', 'true', '--out', out], log)).toBe(1);

    writeFileSync(join(dir, 'checkout.ts'), 'a\nAB\nc\n');
    expect(main(['finish', '--repo', dir, '--minutes', '4', '--build', 'true', '--out', out], log)).toBe(0);
    const done = JSON.parse(readFileSync(out, 'utf8'));
    expect(done).toMatchObject({ conflictFiles: ['checkout.ts'], hunks: 1, resolutionMinutes: 4, build: { command: 'true', ok: true } });
    expect(done.mergeSha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('records a failing build instead of hiding it', () => {
    const { dir, base, out } = conflictingRepo();
    main(['check', '--repo', dir, '--base', base, '--out', out], log);
    writeFileSync(join(dir, 'checkout.ts'), 'a\nAB\nc\n');
    expect(main(['finish', '--repo', dir, '--minutes', '2', '--build', 'false', '--out', out], log)).toBe(0);
    expect(JSON.parse(readFileSync(out, 'utf8')).build).toMatchObject({ command: 'false', ok: false });
  });

  it('prints usage for missing arguments', () => {
    expect(main(['check'], log)).toBe(2);
  });
});
