// public/demo/meta.json (fase 11D1 langkah 14): chapter markers + counters + jury links, computed once
// at export time so the static replay page never recomputes them from the (larger) events.json at runtime.
import type { RadarEvent } from '@radar/common';
import { buildChapters, type Chapter } from './chapters.js';
import { computeMetrics, type ReplayMetrics } from './metrics.js';

export interface ReplayLinks {
  repoUrl: string;
  bobSessions: string;
  video: string | null;
  deck: string | null;
}

export interface ReplayMeta {
  workspace: string;
  exportedAt: number;
  chapters: Chapter[];
  metrics: ReplayMetrics;
  links: ReplayLinks;
}

export function buildReplayMeta(workspace: string, exportedAt: number, events: readonly RadarEvent[], links: ReplayLinks): ReplayMeta {
  return { workspace, exportedAt, chapters: buildChapters(events), metrics: computeMetrics(events), links };
}
