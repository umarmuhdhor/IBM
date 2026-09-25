// Stop hook: tells the team Bob finished a turn (JT-01 `turn.end`). Sends the session id only (Bob also passes
// `last_assistant_message`; it stays local, D-umar-01 P4). Never releases locks (PRD §06 rule 3). Always exits 0.
import { sendActivity } from './activity.js';
import { loadContext } from './_shared.js';

async function main(): Promise<void> {
  const ctx = await loadContext('stop');
  if (!ctx) return;
  await sendActivity(ctx.cfg, { kind: 'turn.end', sessionId: ctx.hook.sessionId });
}

main()
  .catch(() => undefined)
  .finally(() => process.exit(0));
