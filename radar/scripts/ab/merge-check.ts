// Round A merge check (fase 13 step 2). Two steps around a human stopwatch:
//   tsx scripts/ab/merge-check.ts check  --repo <toko-demo clone> --base <start sha> --out <round-a.json> [--a ab/a-coderA --b ab/a-coderB]
//     → ab/a-merge = base + coderA + coderB (--no-ff --no-commit). Counts conflicted files and hunks, leaves the
//       conflict in the working tree. Start the stopwatch, resolve by hand.
//   tsx scripts/ab/merge-check.ts finish --repo <dir> --minutes <n> --out <round-a.json> [--build "npm run build"]
//     → refuses while conflict markers remain, commits the merge, runs the build, records minutes + build result.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { finishMerge, mergeBranches } from './git-conflicts.js';

const USAGE = `usage:
  tsx scripts/ab/merge-check.ts check  --repo <dir> --base <sha> --out <round-a.json> [--a <branch>] [--b <branch>]
  tsx scripts/ab/merge-check.ts finish --repo <dir> --minutes <n> --out <round-a.json> [--build "<cmd>"]`;

export function main(argv: string[], log: (s: string) => void = console.log): number {
  const [cmd, ...rest] = argv;
  const arg = (name: string) => {
    const i = rest.indexOf(name);
    return i > -1 ? rest[i + 1] : undefined;
  };
  const repo = arg('--repo');
  const out = arg('--out');
  try {
    if (cmd === 'check') {
      const base = arg('--base');
      if (!repo || !base || !out) return usage(log);
      const branches = [arg('--a') ?? 'ab/a-coderA', arg('--b') ?? 'ab/a-coderB'];
      const r = mergeBranches(repo, base, branches);
      writeFileSync(out, `${JSON.stringify({ checkedAt: new Date().toISOString(), base, branches, ...r }, null, 2)}\n`);
      log(`${r.conflictFiles.length} file konflik, ${r.hunks} hunk: ${r.conflictFiles.join(', ') || '–'}`);
      if (r.conflictFiles.length > 0) log('Mulai stopwatch sekarang. Selesaikan konflik di editor, lalu jalankan "finish --minutes <n>".');
      return 0;
    }
    if (cmd === 'finish') {
      const minutes = Number(arg('--minutes'));
      if (!repo || !out || !Number.isFinite(minutes) || !existsSync(out)) return usage(log);
      const { sha } = finishMerge(repo);
      const command = arg('--build') ?? 'npm run build';
      let ok = true;
      try {
        execSync(command, { cwd: repo, stdio: 'ignore' });
      } catch {
        ok = false; // recorded, not hidden: a red build at the end is a result of the round
      }
      const prev = JSON.parse(readFileSync(out, 'utf8')) as Record<string, unknown>;
      writeFileSync(out, `${JSON.stringify({ ...prev, resolutionMinutes: minutes, mergeSha: sha, build: { command, ok } }, null, 2)}\n`);
      log(`merge ${sha.slice(0, 7)} · ${minutes} menit · build ${ok ? 'hijau' : 'MERAH'}`);
      return 0;
    }
    return usage(log);
  } catch (err) {
    log(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

function usage(log: (s: string) => void): number {
  log(USAGE);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));
