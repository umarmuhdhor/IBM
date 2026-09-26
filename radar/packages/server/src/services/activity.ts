// `POST /v1/bob/activity` helpers (R3 §2.24, fase 03 step 11b).
import { ACTIVITY_TEXT_MAX_CHARS } from '@radar/common';

export const ACTIVITY_PER_SECOND = 20;

/**
 * In-memory 20/s budget per member. Dropped requests are counted per window and reported once, when the
 * member's next window starts, as a single `metric(activity_dropped)` row (rows written are the scarce quota).
 * The counts are lost if the DO hibernates first; that is acceptable for a best-effort metric.
 */
export class ActivityLimiter {
  private readonly windows = new Map<string, { second: number; count: number; dropped: number }>();

  hit(memberId: string, now: number): { accepted: boolean; droppedToReport: number } {
    const second = Math.floor(now / 1000);
    let w = this.windows.get(memberId);
    let droppedToReport = 0;
    if (!w || w.second !== second) {
      droppedToReport = w?.dropped ?? 0;
      w = { second, count: 0, dropped: 0 };
      this.windows.set(memberId, w);
    }
    w.count++;
    if (w.count > ACTIVITY_PER_SECOND) {
      w.dropped++;
      return { accepted: false, droppedToReport };
    }
    return { accepted: true, droppedToReport };
  }

  clear(): void {
    this.windows.clear();
  }
}

/** Cuts `text` to the schema limit before validation, without splitting a surrogate pair. */
export function truncateActivityText(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body;
  const text = (body as { text?: unknown }).text;
  if (typeof text !== 'string' || text.length <= ACTIVITY_TEXT_MAX_CHARS) return body;
  let cut = text.slice(0, ACTIVITY_TEXT_MAX_CHARS);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return { ...body, text: cut };
}
