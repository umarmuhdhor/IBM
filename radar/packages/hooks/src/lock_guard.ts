// PreToolUse hook (BC-04). Checks whether the tool's target paths are locked by another member.
// Any error or timeout fails open (exit 0) and is logged — only a real `block` decision exits 2.
// Never prints to stdout. The block message goes to stderr: Bob IDE 2.2.0 passes it to the model (D-umar-01).
import { sendActivity } from './activity.js';
import { loadContext, logLine, radarFetch, settleWithin } from './_shared.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EDIT_TOOLS_REGEX, HOOK_SERVER_TIMEOUT_MS, touchedLines, type LineRange, type LockCheckRes, type NormalizedHook } from '@radar/common';
import { saveState } from '@radar/common/node';

// Whole-hook budget from process start (stdin + server call); keeps the hook under the 1.8 s fail-open target
// even when the host is slow to close stdin. Budget is 1.2 s so the measured wall time (spawn + node
// startup + budget) stays under 1.8 s even on loaded CI runners running parallel suites.
export const LOCK_GUARD_BUDGET_MS = 1_200;
const MAX_SAVED_MESSAGE = 2_000;

function readText(root: string, path: string): string | null {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

/** D-alief-17: lines each path's edit touches. Paths whose lines are unknown are left out (= whole file). */
export function linesFor(hook: NormalizedHook, tool: string, root: string): Record<string, LineRange[]> {
  const out: Record<string, LineRange[]> = {};
  // Single-file tool input only; a multi-file apply_diff counts as whole-file edits.
  if (hook.paths.length !== 1) return out;
  const path = hook.paths[0]!;
  const lines = touchedLines(tool, hook.input, readText(root, path));
  if (lines) out[path] = lines;
  return out;
}

async function main(): Promise<void> {
  const ctx = await loadContext('lock_guard');
  if (!ctx) return;
  const { cfg, hook, started } = ctx;
  const tool = hook.tool ?? '';

  if (!EDIT_TOOLS_REGEX.test(tool) || hook.paths.length === 0) return;

  let lines: Record<string, LineRange[]> = {};
  try {
    lines = linesFor(hook, tool, cfg.root);
  } catch (err) {
    logLine(cfg.root, 'lock_guard', `lines unknown: ${String(err)}`);
  }

  let res: LockCheckRes;
  try {
    res = await radarFetch<LockCheckRes>(
      cfg,
      'POST',
      '/v1/locks/check',
      { paths: hook.paths, tool, sessionId: hook.sessionId, clientTs: Date.now(), ...(Object.keys(lines).length > 0 ? { lines } : {}) },
      Math.max(100, Math.min(HOOK_SERVER_TIMEOUT_MS, LOCK_GUARD_BUDGET_MS - (Date.now() - started))),
    );
  } catch (err) {
    logLine(cfg.root, 'lock_guard', `locks/check failed: ${String(err)}`);
    return;
  }

  const decision = res.decision;
  const durationMs = Date.now() - started;
  logLine(cfg.root, 'lock_guard', `decision=${decision} tool=${tool} ms=${durationMs}`);

  await settleWithin(
    sendActivity(cfg, {
      kind: 'tool.pre',
      sessionId: hook.sessionId,
      tool,
      paths: hook.paths,
      decision,
    }),
    300,
  );

  if (decision === 'block') {
    process.stderr.write(res.message + '\n');
    try {
      const blocked = res.results.find((r) => r.decision === 'block')?.path ?? hook.paths[0] ?? '';
      saveState(cfg.root, { lastBlock: { path: blocked, message: res.message.slice(0, MAX_SAVED_MESSAGE), ts: Date.now() } });
    } catch (err) {
      // a local state file must never turn a block into an allow
      logLine(cfg.root, 'lock_guard', `lastBlock not saved: ${String(err)}`);
    }
    process.exit(2);
  }
}

main()
  .catch(() => undefined)
  .finally(() => process.exit(0));
