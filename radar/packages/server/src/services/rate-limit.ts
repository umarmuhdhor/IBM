// Light rate limit for the mc and proposal writes (fase 12 step 9): 60 per minute per principal, fixed 1-minute
// windows, in memory. One DO per workspace, so the counter is consistent; it resets if the DO hibernates.
// Keys are principals (member id or `mc`), never raw tokens, so the map is bounded by the member count.

export const RATE_LIMIT_PER_MINUTE = 60;
const WINDOW_MS = 60_000;

export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly limit = RATE_LIMIT_PER_MINUTE) {}

  /** Counts one request. Returns 0 when allowed, else the seconds until the window ends (Retry-After). */
  hit(key: string, now: number): number {
    let w = this.windows.get(key);
    if (!w || now - w.start >= WINDOW_MS) {
      w = { start: now, count: 0 };
      this.windows.set(key, w);
    }
    w.count++;
    return w.count > this.limit ? Math.max(1, Math.ceil((w.start + WINDOW_MS - now) / 1000)) : 0;
  }

  clear(): void {
    this.windows.clear();
  }
}
