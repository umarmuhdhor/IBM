// PostToolUse hook (JT-01 P0, BC-05 P1). Reports what Bob just did; never prints anything (stdout of PostToolUse
// shows up in the Bob transcript, fase 01 spike 3) and always exits 0. File content never leaves the machine.
import { sendActivity } from './activity.js';
import { loadContext, logLine, radarFetch, settleWithin } from './_shared.js';
import { ACTIVITY_TIMEOUT_MS, EDIT_TOOLS_REGEX } from '@radar/common';

const OWN_MCP_TOOL = /^mcp__radar__/;

const countLines = (s: string): number => (s.length === 0 ? 0 : s.replace(/\n$/, '').split('\n').length);

/** Best-effort count of changed lines from the tool input (no file reads). */
export function linesChanged(tool: string, input: Record<string, unknown>): number | undefined {
  if (tool === 'write_file') {
    if (typeof input.line_count === 'number') return input.line_count;
    return typeof input.content === 'string' ? countLines(input.content) : undefined;
  }
  if (tool === 'insert_content') return typeof input.content === 'string' ? countLines(input.content) : undefined;
  if (tool === 'apply_diff' && typeof input.diff === 'string') {
    let total = 0;
    for (const m of input.diff.matchAll(/\n=======\n([\s\S]*?)\n?>>>>>>> REPLACE/g)) total += countLines(m[1] ?? '');
    return total;
  }
  return undefined;
}

async function main(): Promise<void> {
  const ctx = await loadContext('mark_ai_edit');
  if (!ctx) return;
  const { cfg, hook } = ctx;
  const tool = hook.tool ?? 'unknown';
  if (OWN_MCP_TOOL.test(tool)) return;

  const changed = linesChanged(tool, hook.input);
  const sends: Promise<unknown>[] = [
    sendActivity(cfg, {
      kind: 'tool.post',
      sessionId: hook.sessionId,
      tool,
      paths: hook.paths,
      ...(changed === undefined ? {} : { linesChanged: changed }),
    }),
  ];
  if (EDIT_TOOLS_REGEX.test(tool) && hook.paths.length > 0) {
    // TODO(sync:alief): the real server route POST /v1/ai-edits lands in fase 12 (BC-05, P1); the fase 02 mock accepts it (mock_contract.test.ts). Until then a failure is only logged.
    sends.push(
      radarFetch(cfg, 'POST', '/v1/ai-edits', { paths: hook.paths, tool, sessionId: hook.sessionId }, ACTIVITY_TIMEOUT_MS).catch(
        (err: unknown) => logLine(cfg.root, 'mark_ai_edit', `ai-edits not sent: ${String(err)}`),
      ),
    );
  }
  await settleWithin(Promise.all(sends), ACTIVITY_TIMEOUT_MS + 100);
}

main()
  .catch(() => undefined)
  .finally(() => process.exit(0));
