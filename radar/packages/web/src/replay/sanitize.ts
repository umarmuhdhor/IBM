// Export sensor (fase 11D1 langkah 14): the replay bundle is public and static, so it must never carry a
// live secret. Scans the whole serialized event, not just known-risky fields, since the shape of hook
// payloads keeps changing (R3 §2.24 "provisional").
import type { RadarEvent } from '@radar/common';

// `sk-` alone would match ordinary identifiers ("desk-1", "risk-model.ts"); require a token-shaped
// tail so the sensor doesn't abort a legitimate export over a false positive.
const SECRET_PATTERNS = [/rdr_/, /ghp_/, /sk-[a-zA-Z0-9]{16,}/] as const;

export class SecretFoundError extends Error {
  constructor(eventId: number, pattern: string) {
    super(`sanitizeEvents: secret-shaped token (${pattern}) found in event id=${eventId}`);
    this.name = 'SecretFoundError';
  }
}

export function sanitizeEvents(events: readonly RadarEvent[]): RadarEvent[] {
  for (const ev of events) {
    const json = JSON.stringify(ev);
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(json)) throw new SecretFoundError(ev.id, pattern.source);
    }
  }
  return [...events];
}
