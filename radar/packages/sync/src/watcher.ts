// Local change detection (fase 04 step 4): chokidar (SYNC=watch) or a 1 s stat poller (SYNC=poll-1s),
// both with a per-path debounce. Callbacks receive workspace-relative POSIX paths.
import { existsSync, readdirSync, statSync, type Stats } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { watch, type FSWatcher } from 'chokidar';
import { SYNC_DEBOUNCE_MS, tryWorkspaceRelative } from '@radar/common';
import { isTmpName } from './writer.js';

export type SyncMode = 'watch' | 'poll-1s';

export interface WatcherOptions {
  root: string;
  mode?: SyncMode;
  debounceMs?: number;
  /** Poll interval for `poll-1s` (tests shorten it). */
  pollMs?: number;
  /** `watch` mode safety rescan interval; 0 disables it. */
  rescanMs?: number;
  /** Ignore rule for a workspace-relative path; directories are also asked with a trailing '/'. */
  ignores: (rel: string) => boolean;
  onChange: (rel: string) => void;
  onUnlink: (rel: string) => void;
  onError?: (err: Error) => void;
}

/** Safety rescan in `watch` mode. macOS libuv shares one FSEvents stream per process and rebuilds it for
 * every newly watched folder, so events in that window are lost (a new folder can stay unwatched for good). */
export const WATCH_RESCAN_MS = 2000;

export interface WatcherDeps {
  watch: typeof watch;
}

export interface Watcher {
  ready: Promise<void>;
  close(): Promise<void>;
}

export function isIgnored(ignores: (rel: string) => boolean, rel: string, isDir: boolean | undefined): boolean {
  if (rel === '') return false;
  if (isTmpName(basename(rel))) return true;
  if (ignores(rel)) return true;
  // `ignore` only matches 'dist/' style rules against a path ending in '/'.
  return isDir !== false && ignores(`${rel}/`);
}

const isGone = (err: unknown): boolean => {
  const code = (err as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
};

/**
 * Every non-ignored file under `root`, as sorted workspace-relative paths. A folder that vanished
 * mid-walk is skipped quietly; any other unreadable folder is skipped and reported to `onError`.
 */
export function listFiles(root: string, ignores: (rel: string) => boolean, onError: (err: unknown) => void = () => {}): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      if (!isGone(err)) onError(err);
      return;
    }
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!isIgnored(ignores, rel, true)) walk(join(dir, e.name), rel);
      } else if (e.isFile() && !isIgnored(ignores, rel, false)) {
        out.push(rel);
      }
    }
  };
  walk(root, '');
  return out.sort();
}

/** mtime + size signature of every non-ignored file; `diff()` returns the paths that changed or vanished. */
function createScanner(root: string, ignores: (rel: string) => boolean, onError: (err: unknown) => void): { diff(): string[] } {
  let seen = new Map<string, string>();
  const scan = () => {
    const now = new Map<string, string>();
    for (const r of listFiles(root, ignores, onError)) {
      try {
        const st = statSync(join(root, r));
        now.set(r, `${st.mtimeMs}:${st.size}`);
      } catch (err) {
        // Vanished between readdir and stat: handled as a delete.
        if (!isGone(err)) onError(err);
      }
    }
    return now;
  };
  seen = scan();
  return {
    diff() {
      const now = scan();
      const out: string[] = [];
      for (const [r, sig] of now) if (seen.get(r) !== sig) out.push(r);
      for (const r of seen.keys()) if (!now.has(r)) out.push(r);
      seen = now;
      return out;
    },
  };
}

export function createWatcher(o: WatcherOptions, deps: WatcherDeps = { watch }): Watcher {
  const debounceMs = o.debounceMs ?? SYNC_DEBOUNCE_MS;
  const timers = new Map<string, NodeJS.Timeout>();
  let closed = false;

  // Settle a path after the quiet period: a save-by-rename (unlink + add) ends as a change.
  const schedule = (rel: string) => {
    const prev = timers.get(rel);
    if (prev) clearTimeout(prev);
    timers.set(
      rel,
      setTimeout(() => {
        timers.delete(rel);
        if (closed) return;
        if (existsSync(join(o.root, rel))) o.onChange(rel);
        else o.onUnlink(rel);
      }, debounceMs),
    );
  };
  const rel = (abs: string) => tryWorkspaceRelative(o.root, abs);
  const onError = (err: unknown) => o.onError?.(err instanceof Error ? err : new Error(String(err)));

  if ((o.mode ?? 'watch') === 'watch') {
    const scanner = createScanner(o.root, o.ignores, onError);
    const w: FSWatcher = deps.watch(o.root, {
      ignoreInitial: true,
      atomic: true,
      awaitWriteFinish: false,
      // chokidar v4 has no glob support: `ignored` must be a function.
      ignored: (abs: string, stats?: Stats) => {
        const r = rel(abs);
        return r !== null && isIgnored(o.ignores, r, stats ? stats.isDirectory() : undefined);
      },
    });
    const ready = new Promise<void>((resolve) => w.once('ready', () => resolve()));
    const onPath = (abs: string) => {
      const r = rel(abs);
      if (r) schedule(r);
    };
    w.on('add', onPath).on('change', onPath).on('unlink', onPath).on('error', onError);
    // Duplicates of real events are harmless: the agent skips content whose hash it already knows.
    const rescanMs = o.rescanMs ?? WATCH_RESCAN_MS;
    const rescan =
      rescanMs > 0
        ? setInterval(() => {
            try {
              const watched = w.getWatched();
              for (const r of scanner.diff()) {
                const dir = dirname(join(o.root, r));
                if (existsSync(dir) && !(dir in watched)) w.add(dir);
                schedule(r);
              }
            } catch (err) {
              onError(err);
            }
          }, rescanMs)
        : null;
    rescan?.unref();
    return {
      ready,
      async close() {
        closed = true;
        if (rescan) clearInterval(rescan);
        for (const t of timers.values()) clearTimeout(t);
        timers.clear();
        await w.close();
      },
    };
  }

  // poll-1s fallback (GATE 1): compare mtime + size of every file each tick.
  const pollMs = o.pollMs ?? 1000;
  const scanner = createScanner(o.root, o.ignores, onError);
  const interval = setInterval(() => {
    try {
      for (const r of scanner.diff()) schedule(r);
    } catch (err) {
      onError(err);
    }
  }, pollMs);
  return {
    ready: Promise.resolve(),
    async close() {
      closed = true;
      clearInterval(interval);
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    },
  };
}
