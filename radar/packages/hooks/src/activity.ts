// JT-01: every hook reports what Bob is doing to POST /v1/bob/activity (R3 §2.24). Fire-and-forget:
// 800 ms timeout, never throws, never sends file content. `text` only when the member opted in (shareprompts).
import { logLine, modeOf, radarFetch } from './_shared.js';
import { ACTIVITY_TIMEOUT_MS, type BobActivityReq, type LocalConfig } from './placeholder/common.js';

export const PROMPT_TEXT_MAX = 200;

export type ActivityFields = Omit<BobActivityReq, 'mode' | 'clientTs' | 'text'> & { text?: string | null };

export function buildActivity(cfg: LocalConfig, fields: ActivityFields, now = Date.now()): BobActivityReq {
  const { text, ...rest } = fields;
  const body: BobActivityReq = { ...rest, mode: modeOf(cfg), clientTs: now };
  if (cfg.shareprompts && text) body.text = text.length > PROMPT_TEXT_MAX ? `${text.slice(0, PROMPT_TEXT_MAX - 1)}…` : text;
  return body;
}

export async function sendActivity(cfg: LocalConfig, fields: ActivityFields): Promise<void> {
  try {
    await radarFetch(cfg, 'POST', '/v1/bob/activity', buildActivity(cfg, fields), ACTIVITY_TIMEOUT_MS);
  } catch (err) {
    logLine(cfg.root, 'activity', `${fields.kind} not sent: ${String(err)}`);
  }
}
