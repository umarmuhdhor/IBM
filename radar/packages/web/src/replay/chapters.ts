// Timeline chapter bar (DESIGN.md §5.8): "Plan · Live · Near-miss · Review · Commit". Each chapter is
// anchored to the first event of its kind; a chapter with no matching event in this session is omitted
// (not every recorded flow reaches a real commit, e.g. fase 11D1's synthetic fixture may stop earlier).
import type { RadarEvent } from '@radar/common';

export type ChapterId = 'plan' | 'live' | 'near-miss' | 'review' | 'commit';

export interface Chapter {
  id: ChapterId;
  label: string;
  ts: number;
}

const LABELS: Record<ChapterId, string> = {
  plan: 'Plan',
  live: 'Live',
  'near-miss': 'Near-miss',
  review: 'Review',
  commit: 'Commit',
};

function matches(ev: RadarEvent, id: ChapterId): boolean {
  switch (id) {
    case 'plan':
      return ev.type === 'proposal.created' && ev.payload.kind === 'plan';
    case 'live':
      return ev.type === 'file.changed';
    case 'near-miss':
      return ev.type === 'lock.blocked';
    case 'review':
      return ev.type === 'lock.review' || ev.type === 'review.created';
    case 'commit':
      return ev.type === 'commit.created';
  }
}

export function buildChapters(events: readonly RadarEvent[]): Chapter[] {
  const firstTs = new Map<ChapterId, number>();
  for (const ev of events) {
    for (const id of Object.keys(LABELS) as ChapterId[]) {
      if (!firstTs.has(id) && matches(ev, id)) firstTs.set(id, ev.ts);
    }
  }
  return [...firstTs.entries()]
    .map(([id, ts]) => ({ id, label: LABELS[id], ts }))
    .sort((a, b) => a.ts - b.ts);
}
