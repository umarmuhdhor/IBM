// DESIGN.md §5.8 counter row: "near-misses prevented <n> · merge conflicts <n> · decisions <n> ·
// median decision <s> s" — every value is derived from the replayed event log, never typed in by hand.
import type { RadarEvent } from '@radar/common';

export interface ReplayMetrics {
  nearMisses: number;
  decisions: number;
  mergeConflicts: number;
  medianDecisionSeconds: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
}

export function computeMetrics(events: readonly RadarEvent[]): ReplayMetrics {
  let nearMisses = 0;
  let decisions = 0;
  let mergeConflicts = 0;
  const requestCreatedAt = new Map<string, number>();
  const decisionLatenciesMs: number[] = [];

  for (const ev of events) {
    switch (ev.type) {
      case 'lock.blocked':
        nearMisses++;
        break;
      case 'commit.push_failed':
        mergeConflicts++;
        break;
      case 'proposal.decided':
        decisions++;
        break;
      case 'request.created':
        requestCreatedAt.set(ev.payload.requestId, ev.ts);
        break;
      case 'request.decided': {
        // A request has one terminal outcome (R4 §2): only the first request.decided counts, so a
        // duplicated or replayed event can't double-count the same latency.
        const createdTs = requestCreatedAt.get(ev.payload.requestId);
        if (createdTs !== undefined) {
          decisionLatenciesMs.push(ev.ts - createdTs);
          requestCreatedAt.delete(ev.payload.requestId);
        }
        break;
      }
    }
  }

  const medianMs = median(decisionLatenciesMs);
  return { nearMisses, decisions, mergeConflicts, medianDecisionSeconds: medianMs === null ? null : medianMs / 1000 };
}
