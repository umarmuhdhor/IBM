// `GET /v1/events/export` and `GET /admin/export` (R3 §2.23, SV-08). `file.changed` events get a unified diff
// against the previous version here only; stored and live events never carry it.
import type { ExportRes, RadarEvent } from '@radar/common';
import { createTwoFilesPatch } from 'diff';
import { eventRange } from '../db/repo/event';
import { getFileVersion } from '../db/repo/file';
import type { Db } from '../db/sql';
import { rowsToEvents } from './events';

export const EXPORT_DEFAULT_LIMIT = 1000;

export interface ExportRange {
  from?: number | undefined;
  to?: number | undefined;
  limit?: number | undefined;
}

function withPatch(db: Db, ev: RadarEvent): RadarEvent {
  if (ev.type !== 'file.changed') return ev;
  const { path, version } = ev.payload;
  const after = getFileVersion(db, path, version)?.content ?? '';
  const before = version > 1 ? (getFileVersion(db, path, version - 1)?.content ?? '') : '';
  return { ...ev, payload: { ...ev.payload, patch: createTwoFilesPatch(`a/${path}`, `b/${path}`, before, after) } };
}

export function exportEvents(db: Db, workspace: string, range: ExportRange, now: number): ExportRes {
  const from = range.from ?? 0;
  const to = range.to ?? Number.MAX_SAFE_INTEGER;
  const limit = Math.min(range.limit ?? EXPORT_DEFAULT_LIMIT, EXPORT_DEFAULT_LIMIT);
  const events = rowsToEvents(eventRange(db, from, to, limit)).map((ev) => withPatch(db, ev));
  return { workspace, exportedAt: now, events };
}
