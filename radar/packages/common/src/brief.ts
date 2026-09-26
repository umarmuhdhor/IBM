// Brief lines injected into Bob's context (NFR-06): at most 6 lines × 160 chars, '[Radar] ' prefix exactly once.
import { BRIEF_MAX_LINE_CHARS, BRIEF_MAX_LINES, BRIEF_PREFIX } from './constants.js';

const PREFIX_RE = /^(\s*\[Radar\]\s*)+/;

export function clampBrief(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (out.length === BRIEF_MAX_LINES) break;
    const body = line.replace(/[\r\n]+/g, ' ').replace(PREFIX_RE, '').trim();
    if (body === '') continue;
    const full = BRIEF_PREFIX + body;
    out.push(full.length > BRIEF_MAX_LINE_CHARS ? `${full.slice(0, BRIEF_MAX_LINE_CHARS - 1)}…` : full);
  }
  return out;
}
