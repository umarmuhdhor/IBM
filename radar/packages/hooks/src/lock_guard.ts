// PreToolUse hook (BC-04). Checks whether the tool's target paths are locked by another member.
// Any error or timeout fails open (exit 0) and is logged — only a real `block` decision exits 2.
// Never prints to stdout. The block message goes to stderr: Bob IDE 2.2.0 passes it to the model (D-umar-01).
import { sendActivity } from './activity.js';
import { loadContext, logLine, radarFetch, settleWithin } from './_shared.js';
import { EDIT_TOOLS_REGEX, HOOK_SERVER_TIMEOUT_MS, type LockCheckRes, saveState } from './placeholder/common.js';

async function main(): Promise<void> {
  const ctx = await loadContext('lock_guard');
  if (!ctx) return;
  const { cfg, hook, started } = ctx;
  const tool = hook.tool ?? '';

  if (!EDIT_TOOLS_REGEX.test(tool) || hook.paths.length === 0) return;

  let res: LockCheckRes;
  try {
    res = await radarFetch<LockCheckRes>(
      cfg,
      'POST',
      '/v1/locks/check',
      { paths: hook.paths, tool, sessionId: hook.sessionId, clientTs: Date.now() },
      HOOK_SERVER_TIMEOUT_MS,
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
      saveState(cfg.root, { lastBlock: { path: blocked, message: res.message, ts: Date.now() } });
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
