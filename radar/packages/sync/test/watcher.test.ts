// Watcher (fase 04 step 4): per-path debounce, ignore rules, temp files, and the poll-1s fallback.
import { EventEmitter } from 'node:events';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createIgnoreMatcherFromText } from '@radar/common';
import { createWatcher, type Watcher } from '../src/watcher.js';
import { cleanupDirs, sleep, tempDir, waitFor } from './helpers.js';

const watchers: Watcher[] = [];
afterEach(async () => {
  await Promise.all(watchers.splice(0).map((w) => w.close()));
  cleanupDirs();
});

function start(root: string, mode: 'watch' | 'poll-1s' = 'watch', pollMs?: number, rescanMs?: number) {
  const changed: string[] = [];
  const unlinked: string[] = [];
  const matcher = createIgnoreMatcherFromText('');
  const w = createWatcher({ root, mode, debounceMs: 100, pollMs, rescanMs, ignores: (rel) => matcher.ignores(rel), onChange: (p) => changed.push(p), onUnlink: (p) => unlinked.push(p) });
  watchers.push(w);
  return { w, changed, unlinked };
}

describe('watcher (chokidar)', () => {
  it('debounces a burst of writes to one callback per path', async () => {
    const root = tempDir();
    const { w, changed } = start(root);
    await w.ready;
    // One synchronous burst: gaps stay far below the debounce even on a loaded CI machine.
    for (let i = 0; i < 10; i++) writeFileSync(join(root, 'a.ts'), `v${i}`);
    writeFileSync(join(root, 'b.ts'), 'b');
    await waitFor(() => changed.includes('a.ts') && changed.includes('b.ts'), 3000, 'both paths');
    await sleep(200);
    expect(changed.filter((p) => p === 'a.ts')).toHaveLength(1);
  });

  it('skips ignored paths and atomic-write temp files', async () => {
    const root = tempDir();
    const { w, changed } = start(root);
    await w.ready;
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'node_modules/x.js'), 'x');
    writeFileSync(join(root, '.a.ts.radar-tmp-123'), 'x');
    writeFileSync(join(root, 'a.ts.radar-rejected'), 'x');
    writeFileSync(join(root, 'ok.ts'), 'x');
    await waitFor(() => changed.includes('ok.ts'), 3000, 'ok.ts');
    await sleep(200);
    expect(changed).toEqual(['ok.ts']);
  });

  it('rescan reports writes the fs watcher lost and re-watches their folder', async () => {
    // macOS: libuv shares one FSEvents stream per process and rebuilds it for every new watched folder;
    // events in that window are lost (bench: 3 of 8 runs lost a new folder). A silent fake stands in for it.
    const added: string[] = [];
    const silent = Object.assign(new EventEmitter(), {
      add(p: string) {
        added.push(p);
        return silent;
      },
      getWatched: () => ({}) as Record<string, string[]>,
      close: async () => undefined,
    });
    const root = tempDir();
    const changed: string[] = [];
    const w = createWatcher(
      { root, debounceMs: 20, rescanMs: 50, ignores: () => false, onChange: (p) => changed.push(p), onUnlink: () => {} },
      { watch: () => (setImmediate(() => silent.emit('ready')), silent) as never },
    );
    watchers.push(w);
    await w.ready;
    mkdirSync(join(root, 'gen'));
    writeFileSync(join(root, 'gen/a.ts'), 'a');
    await waitFor(() => changed.includes('gen/a.ts'), 2000, 'rescan reports gen/a.ts');
    expect(added).toContain(join(root, 'gen'));
    changed.length = 0;
    writeFileSync(join(root, 'gen/a.ts'), 'a-longer');
    await waitFor(() => changed.includes('gen/a.ts'), 2000, 'rescan reports the second write');
  });

  it('reports deletes separately', async () => {
    const root = tempDir();
    writeFileSync(join(root, 'gone.ts'), 'x');
    const { w, unlinked } = start(root);
    await w.ready;
    const { rmSync } = await import('node:fs');
    rmSync(join(root, 'gone.ts'));
    await waitFor(() => unlinked.includes('gone.ts'), 3000, 'unlink');
  });
});

describe('watcher (poll-1s fallback)', () => {
  it('detects new and changed files by mtime and size', async () => {
    const root = tempDir();
    writeFileSync(join(root, 'a.ts'), 'a');
    const { w, changed } = start(root, 'poll-1s', 50);
    await w.ready;
    writeFileSync(join(root, 'a.ts'), 'aa');
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/b.ts'), 'b');
    await waitFor(() => changed.includes('a.ts') && changed.includes('src/b.ts'), 3000, 'poll changes');
  });
});
