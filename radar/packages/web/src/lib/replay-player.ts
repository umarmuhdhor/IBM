// Replay player (fase 11D1 langkah 15): play/pause/seek/speed over a static event log, reusing the
// shared reducer (@radar/common) so replay state matches live Mission Control exactly. Snapshots are
// taken every `intervalMs` of EVENT time (not wall-clock playback time), so seeking replays at most
// `intervalMs` worth of events regardless of playback speed. Each snapshot also records how many
// events were already applied (`eventIndex`), so `stateAtOffset` resumes from there instead of
// rescanning the whole array — this is what actually makes seeking cheap, not just the time bucketing.
import { applyEvent, initialState, type RadarEvent, type RadarState } from '@radar/common';

export interface Snapshot {
  offsetMs: number;
  state: RadarState;
  /** Number of `events` already applied to reach `state`. Defaults to 0 for a hand-built snapshot. */
  eventIndex?: number;
}

export function buildSnapshots(events: readonly RadarEvent[], intervalMs = 10_000): Snapshot[] {
  const first = events[0];
  if (!first) return [{ offsetMs: 0, state: initialState(), eventIndex: 0 }];
  const t0 = first.ts;
  const last = events[events.length - 1] as RadarEvent;
  const duration = last.ts - t0;

  let state = initialState();
  let idx = 0;
  const snapshots: Snapshot[] = [{ offsetMs: 0, state, eventIndex: 0 }];
  for (let mark = intervalMs; mark <= duration; mark += intervalMs) {
    while (idx < events.length && (events[idx] as RadarEvent).ts - t0 <= mark) {
      state = applyEvent(state, events[idx] as RadarEvent);
      idx++;
    }
    snapshots.push({ offsetMs: mark, state, eventIndex: idx });
  }
  return snapshots;
}

/** Pure: replays from the nearest snapshot at or before `offsetMs` up to exactly that offset. */
export function stateAtOffset(events: readonly RadarEvent[], snapshots: readonly Snapshot[], offsetMs: number): RadarState {
  if (snapshots.length === 0) throw new Error('stateAtOffset: snapshots must not be empty (pass at least buildSnapshots(events)[0])');
  const first = events[0];
  const t0 = first ? first.ts : 0;
  let best = snapshots[0] as Snapshot;
  for (const s of snapshots) {
    if (s.offsetMs <= offsetMs && s.offsetMs >= best.offsetMs) best = s;
  }
  let state = best.state;
  for (let i = best.eventIndex ?? 0; i < events.length; i++) {
    const ev = events[i] as RadarEvent;
    const offset = ev.ts - t0;
    if (offset > offsetMs) break;
    if (offset > best.offsetMs) state = applyEvent(state, ev);
  }
  return state;
}

export type Speed = 1 | 2 | 4 | 8;

export interface ReplayPlayer {
  play(): void;
  pause(): void;
  seek(offsetMs: number): void;
  setSpeed(speed: Speed): void;
  getOffsetMs(): number;
  getState(): RadarState;
  isPlaying(): boolean;
  getSpeed(): Speed;
  getDurationMs(): number;
  /** Notified on every offset change (play tick or seek). Returns an unsubscribe function. */
  subscribe(listener: (offsetMs: number) => void): () => void;
  destroy(): void;
}

const TICK_MS = 100;

export function createPlayer(events: readonly RadarEvent[], opts: { intervalMs?: number } = {}): ReplayPlayer {
  const snapshots = buildSnapshots(events, opts.intervalMs ?? 10_000);
  const first = events[0];
  const last = events[events.length - 1];
  const t0 = first ? first.ts : 0;
  const durationMs = first && last ? last.ts - t0 : 0;

  let offsetMs = 0;
  let speed: Speed = 1;
  let playing = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(offsetMs: number) => void>();
  const notify = () => {
    for (const l of listeners) l(offsetMs);
  };

  function pause(): void {
    playing = false;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function tick(): void {
    offsetMs = Math.min(durationMs, offsetMs + TICK_MS * speed);
    if (offsetMs >= durationMs) pause();
    notify();
  }

  function play(): void {
    if (playing || offsetMs >= durationMs) return;
    playing = true;
    timer = setInterval(tick, TICK_MS);
  }

  function seek(ms: number): void {
    offsetMs = Math.max(0, Math.min(durationMs, ms));
    notify();
  }

  return {
    play,
    pause,
    seek,
    setSpeed: (s) => {
      speed = s;
    },
    getOffsetMs: () => offsetMs,
    getState: () => stateAtOffset(events, snapshots, offsetMs),
    isPlaying: () => playing,
    getSpeed: () => speed,
    getDurationMs: () => durationMs,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy: () => {
      pause();
      listeners.clear();
    },
  };
}
