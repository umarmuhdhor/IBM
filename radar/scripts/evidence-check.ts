#!/usr/bin/env tsx
// R7 §4 evidence checker (fase 14).
//
// pnpm -C radar evidence:check
//
// Exits nonzero when any R7 violation is found:
//   - a member in plan/team.json has < 3 PNG …_summary.png files
//   - a PNG filename does not match the §1 naming pattern
//   - a Bob-Assisted trailer in git log --all points to a missing file
//   - bob_sessions/index/<nama>.md does not list every PNG owned by that member
//   - a file under bob_sessions/ is git-ignored (would not be committed)
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ── locate repo root ────────────────────────────────────────────────────────
const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

// ── load plan/team.json ─────────────────────────────────────────────────────
const teamFile = join(root, 'plan', 'team.json');
if (!existsSync(teamFile)) {
  console.error('evidence-check: plan/team.json not found');
  process.exit(1);
}
const teamJson = JSON.parse(readFileSync(teamFile, 'utf8')) as {
  team: string;
  members: { id: string; lane: string }[];
};
const { team, members } = teamJson;

const sessionsDir = join(root, 'bob_sessions');

// ── helper ─────────────────────────────────────────────────────────────────
const violations: string[] = [];
function fail(msg: string) {
  violations.push(msg);
  console.error(`  ✗ ${msg}`);
}

// ── 1. collect PNGs in bob_sessions/ ──────────────────────────────────────
let allPngs: string[] = [];
if (existsSync(sessionsDir)) {
  allPngs = readdirSync(sessionsDir).filter((f) => f.toLowerCase().endsWith('.png'));
}

// §1 pattern: <team>_<nama>_task<NN>_<slug>_summary.png
const memberIds = members.map((m) => m.id);
const pngPattern = new RegExp(
  `^${team}_(?<nama>${memberIds.join('|')})_task(?<nn>[0-9]{2})_(?<slug>[a-z0-9_]+)_summary\\.png$`,
);

// ── 2. validate each PNG name matches §1 ──────────────────────────────────
for (const png of allPngs) {
  if (!pngPattern.test(png)) {
    fail(`PNG name does not match §1 pattern: bob_sessions/${png}`);
  }
}

// ── 3. check per-member PNG count (≥ 3) ───────────────────────────────────
for (const member of members) {
  const ownedPngs = allPngs.filter((f) => {
    const m = pngPattern.exec(f);
    return m?.groups?.nama === member.id;
  });
  if (ownedPngs.length < 3) {
    fail(
      `${member.id} has ${ownedPngs.length} summary PNG(s) in bob_sessions/ — need ≥ 3`,
    );
  }

  // ── 4. check per-member index lists every owned PNG ──────────────────────
  const indexFile = join(sessionsDir, 'index', `${member.id}.md`);
  if (!existsSync(indexFile)) {
    if (ownedPngs.length > 0) {
      fail(`bob_sessions/index/${member.id}.md is missing`);
    }
  } else {
    const indexContent = readFileSync(indexFile, 'utf8');
    for (const png of ownedPngs) {
      if (!indexContent.includes(`[${png}]`)) {
        fail(`bob_sessions/index/${member.id}.md does not list ${png}`);
      }
    }
  }
}

// ── 5. Bob-Assisted trailers pointing to missing files ────────────────────
let gitLog = '';
try {
  gitLog = execSync('git log --all --format=%B', { encoding: 'utf8', cwd: root });
} catch {
  // no commits yet — skip
}
const trailerRe = /^Bob-Assisted:\s+(.+)$/gm;
let match: RegExpExecArray | null;
while ((match = trailerRe.exec(gitLog)) !== null) {
  const ref = (match[1] ?? '').trim();
  const full = resolve(root, ref);
  if (!existsSync(full)) {
    fail(`Bob-Assisted trailer points to missing file: ${ref}`);
  }
}

// ── 6. git-ignored files under bob_sessions/ ─────────────────────────────
let ignoredOut = '';
try {
  ignoredOut = execSync(
    'git ls-files --others --ignored --exclude-standard -- bob_sessions',
    { encoding: 'utf8', cwd: root },
  );
} catch {
  // outside a git repo or no ignored files
}
const ignoredFiles = ignoredOut
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean);
for (const f of ignoredFiles) {
  fail(`bob_sessions file is git-ignored (would not be committed): ${f}`);
}

// ── summary ────────────────────────────────────────────────────────────────
if (violations.length === 0) {
  console.log('evidence:check OK — no R7 violations found');
  process.exit(0);
} else {
  console.error(`\nevidence:check FAILED — ${violations.length} violation(s)`);
  process.exit(1);
}
