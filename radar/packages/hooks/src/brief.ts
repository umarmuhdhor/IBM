// SessionStart / UserPromptSubmit hook (BC-02, BC-03). Fetches the Radar brief and prints it to stdout
// so Bob sees workspace context at the top of every session and prompt.
// process.argv[2] is 'start' (SessionStart) or 'prompt' (UserPromptSubmit).
// Always exits 0; server errors print nothing (fail-open).
import { sendActivity } from './activity.js';
import { loadContext, logLine, radarFetch, settleWithin } from './_shared.js';
import { ACTIVITY_TIMEOUT_MS, BRIEF_MAX_LINES, HOOK_SERVER_TIMEOUT_MS, type BriefRes } from '@radar/common';
import { loadState, saveState } from '@radar/common/node';

async function main(): Promise<void> {
  const arg = process.argv[2] as 'start' | 'prompt' | undefined;
  const ctx = await loadContext('brief');
  if (!ctx) return;
  const { cfg, hook } = ctx;

  const isStart = arg === 'start';
  const since = isStart ? undefined : (loadState(cfg.root).briefCursor ?? 0);
  const path = isStart ? '/v1/brief?kind=start' : `/v1/brief?kind=prompt&since=${since}`;

  let brief: BriefRes | null = null;
  try {
    brief = await radarFetch<BriefRes>(cfg, 'GET', path, undefined, HOOK_SERVER_TIMEOUT_MS);
  } catch (err) {
    logLine(cfg.root, 'brief', `brief fetch failed: ${String(err)}`);
  }

  if (brief) {
    const lines = brief.lines.slice(0, BRIEF_MAX_LINES);
    if (lines.length > 0) process.stdout.write(lines.join('\n') + '\n');
    try {
      saveState(cfg.root, { briefCursor: brief.cursor });
    } catch (err) {
      logLine(cfg.root, 'brief', `cursor not saved: ${String(err)}`);
    }
  }

  await settleWithin(
    sendActivity(cfg, {
      kind: isStart ? 'session.start' : 'prompt',
      sessionId: hook.sessionId,
      ...(isStart ? {} : { text: hook.prompt }),
    }),
    ACTIVITY_TIMEOUT_MS + 100,
  );
}

main()
  .catch(() => undefined)
  .finally(() => process.exit(0));
