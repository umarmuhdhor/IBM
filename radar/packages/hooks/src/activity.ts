// JT-01: every hook reports what Bob is doing to POST /v1/bob/activity (R3 §2.24). Fire-and-forget:
// 800 ms timeout, never throws, never sends file content. `text` only when the member opted in (shareprompts).
import { logLine, modeOf, radarFetch } from './_shared.js';
import { ACTIVITY_TEXT_MAX_CHARS, ACTIVITY_TIMEOUT_MS, type BobActivityInput } from '@radar/common';
import type { LocalConfig } from '@radar/common/node';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a hook knows; `mode` and `clientTs` are filled in here. `text` is only sent for `prompt` with shareprompts on. */
export type ActivityFields = DistributiveOmit<BobActivityInput, 'mode' | 'clientTs' | 'text'> & { text?: string | null };

export function buildActivity(cfg: LocalConfig, fields: ActivityFields, now = Date.now()): BobActivityInput {
  const { text, ...rest } = fields;
  const body = { ...rest, mode: modeOf(cfg), clientTs: now } as BobActivityInput;
  if (body.kind === 'prompt' && cfg.shareprompts && text) {
    body.text = text.length > ACTIVITY_TEXT_MAX_CHARS ? `${text.slice(0, ACTIVITY_TEXT_MAX_CHARS - 1)}…` : text;
  }
  return body;
}

export async function sendActivity(cfg: LocalConfig, fields: ActivityFields): Promise<void> {
  try {
    await radarFetch(cfg, 'POST', '/v1/bob/activity', buildActivity(cfg, fields), ACTIVITY_TIMEOUT_MS);
  } catch (err) {
    logLine(cfg.root, 'activity', `${fields.kind} not sent: ${String(err)}`);
  }
}
