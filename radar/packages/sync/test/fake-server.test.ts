// Agent paths the real server cannot be driven into: a fake WS server answers every update with an
// unverifiable `conflict` (server file v0, no content), the half-written-read case of fase 04 step 6.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { SyncAgent } from '../src/agent.js';
import { cleanupDirs, FAST, sleep, tempDir, waitFor } from './helpers.js';

let wss: WebSocketServer | null = null;
const agents: SyncAgent[] = [];
afterEach(async () => {
  await Promise.all(agents.splice(0).map((a) => a.stop()));
  await new Promise<void>((r) => (wss ? wss.close(() => r()) : r()));
  wss = null;
  cleanupDirs();
});

async function fakeServer(): Promise<{ url: string; updates: string[] }> {
  const updates: string[] = [];
  wss = new WebSocketServer({ port: 0 });
  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', (raw) => {
      const text = raw.toString();
      if (text === '{"t":"ping"}') return;
      const m = JSON.parse(text) as { t: string; id?: string; d: { path: string } };
      if (m.t === 'hello') {
        ws.send(JSON.stringify({ t: 'welcome', d: { principal: { kind: 'member', memberId: 'A', role: 'coder' }, serverTime: Date.now(), workspace: 'toko-demo' } }));
        ws.send(JSON.stringify({ t: 'snapshot', d: { files: [], locks: [], cursor: 0 } }));
      } else if (m.t === 'file.update') {
        updates.push(m.d.path);
        ws.send(JSON.stringify({ t: 'file.rejected', id: m.id, d: { id: m.id, path: m.d.path, reason: 'conflict', holder: null, server: { version: 0, hash: null, content: null, deleted: false } } }));
      }
    });
  });
  await new Promise<void>((r) => wss!.once('listening', () => r()));
  const { port } = wss.address() as { port: number };
  return { url: `http://127.0.0.1:${port}`, updates };
}

describe('unverifiable conflict (server v0, no content)', () => {
  it('retries 3 times, then tells the user; a later edit gets a fresh retry budget', async () => {
    const srv = await fakeServer();
    const notices: string[] = [];
    const lines: string[] = [];
    const root = tempDir();
    const a = new SyncAgent({ root, server: srv.url, token: 'rdr_test', member: 'A', debounceMs: 20, log: (l) => lines.push(l), notify: (n) => notices.push(n.text), ...FAST });
    agents.push(a);
    await a.start();
    writeFileSync(join(root, 'a.ts'), 'one');
    await waitFor(() => lines.some((l) => l.includes('reject.giveup')), 3000, 'give-up');
    expect(srv.updates.filter((p) => p === 'a.ts')).toHaveLength(4);
    expect(notices.join('\n')).toMatch(/a\.ts/);
    await sleep(200);
    expect(srv.updates).toHaveLength(4);
    writeFileSync(join(root, 'a.ts'), 'two');
    await waitFor(() => srv.updates.length === 8, 3000, 'fresh budget after a new edit');
  });
});

describe('merged ack (D-alief-17)', () => {
  it('writes the merged text from file.ack back to disk and does not echo it', async () => {
    const { createHash } = await import('node:crypto');
    const merged = 'alice 3\nbudi 10\n';
    const hash = createHash('sha256').update(merged).digest('hex');
    const updates: string[] = [];
    wss = new WebSocketServer({ port: 0 });
    wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (raw) => {
        const text = raw.toString();
        if (text === '{"t":"ping"}') return;
        const m = JSON.parse(text) as { t: string; id?: string; d: { path: string } };
        if (m.t === 'hello') {
          ws.send(JSON.stringify({ t: 'welcome', d: { principal: { kind: 'member', memberId: 'B', role: 'coder' }, serverTime: Date.now(), workspace: 'toko-demo' } }));
          ws.send(JSON.stringify({ t: 'snapshot', d: { files: [], locks: [], cursor: 0 } }));
        } else if (m.t === 'file.update') {
          updates.push(m.d.path);
          ws.send(JSON.stringify({ t: 'file.ack', id: m.id, d: { id: m.id, path: m.d.path, version: 3, hash, merged: true, content: merged } }));
        }
      });
    });
    await new Promise<void>((r) => wss!.once('listening', () => r()));
    const { port } = wss.address() as { port: number };
    const root = tempDir();
    const a = new SyncAgent({ root, server: `http://127.0.0.1:${port}`, token: 'rdr_test', member: 'B', debounceMs: 20, log: () => {}, notify: () => {}, ...FAST });
    agents.push(a);
    await a.start();
    writeFileSync(join(root, 'a.ts'), 'budi 10\n');
    await waitFor(() => readFileSync(join(root, 'a.ts'), 'utf8') === merged, 3000, 'merged text on disk');
    expect(a.known.get('a.ts')).toEqual({ version: 3, hash });
    await sleep(300);
    expect(updates).toHaveLength(1);
  });

  it('keeps a newer local edit instead of overwriting it with the merged text', async () => {
    const merged = 'alice 3\nbudi 10\n';
    wss = new WebSocketServer({ port: 0 });
    let sent = 0;
    wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (raw) => {
        const text = raw.toString();
        if (text === '{"t":"ping"}') return;
        const m = JSON.parse(text) as { t: string; id?: string; d: { path: string } };
        if (m.t === 'hello') {
          ws.send(JSON.stringify({ t: 'welcome', d: { principal: { kind: 'member', memberId: 'B', role: 'coder' }, serverTime: Date.now(), workspace: 'toko-demo' } }));
          ws.send(JSON.stringify({ t: 'snapshot', d: { files: [], locks: [], cursor: 0 } }));
        } else if (m.t === 'file.update' && sent++ === 0) {
          // The user types again before the ack arrives.
          writeFileSync(join(root, 'a.ts'), 'budi 10 and more\n');
          ws.send(JSON.stringify({ t: 'file.ack', id: m.id, d: { id: m.id, path: m.d.path, version: 3, hash: 'h', merged: true, content: merged } }));
        }
      });
    });
    await new Promise<void>((r) => wss!.once('listening', () => r()));
    const { port } = wss.address() as { port: number };
    const root = tempDir();
    const a = new SyncAgent({ root, server: `http://127.0.0.1:${port}`, token: 'rdr_test', member: 'B', debounceMs: 20, log: () => {}, notify: () => {}, ...FAST });
    agents.push(a);
    await a.start();
    writeFileSync(join(root, 'a.ts'), 'budi 10\n');
    await waitFor(() => sent >= 1, 3000, 'first update');
    await sleep(300);
    expect(readFileSync(join(root, 'a.ts'), 'utf8')).toBe('budi 10 and more\n');
  });

  it('a teammate change that lands while our save is in flight does not undo our save (prod e2e 12j)', async () => {
    const { createHash } = await import('node:crypto');
    const sha = (s: string) => createHash('sha256').update(s).digest('hex');
    const base = 'line 4\nline 12\n';
    const alice = 'alice 4\nline 12\n';
    const merged = 'alice 4\nbudi 12\n';
    const contents: string[] = [];
    wss = new WebSocketServer({ port: 0 });
    wss.on('connection', (ws: WebSocket) => {
      ws.on('message', (raw) => {
        const text = raw.toString();
        if (text === '{"t":"ping"}') return;
        const m = JSON.parse(text) as { t: string; id?: string; d: { path: string; content: string } };
        if (m.t === 'hello') {
          ws.send(JSON.stringify({ t: 'welcome', d: { principal: { kind: 'member', memberId: 'B', role: 'coder' }, serverTime: Date.now(), workspace: 'toko-demo' } }));
          ws.send(JSON.stringify({ t: 'snapshot', d: { files: [{ path: 'a.ts', version: 1, hash: sha(base), content: base, deleted: false }], locks: [], cursor: 0 } }));
        } else if (m.t === 'file.update') {
          contents.push(m.d.content);
          if (contents.length > 1) return;
          // Alice's save (v2) was processed first; ours (base v1) is merged into v3.
          ws.send(JSON.stringify({ t: 'file.changed', d: { path: 'a.ts', version: 2, hash: sha(alice), content: alice, deleted: false, by: 'A', taskId: null, serverTs: Date.now() } }));
          ws.send(JSON.stringify({ t: 'file.ack', id: m.id, d: { id: m.id, path: 'a.ts', version: 3, hash: sha(merged), merged: true, content: merged } }));
        }
      });
    });
    await new Promise<void>((r) => wss!.once('listening', () => r()));
    const { port } = wss.address() as { port: number };
    const root = tempDir();
    const a = new SyncAgent({ root, server: `http://127.0.0.1:${port}`, token: 'rdr_test', member: 'B', debounceMs: 20, log: () => {}, notify: () => {}, ...FAST });
    agents.push(a);
    await a.start();
    await waitFor(() => existsSync(join(root, 'a.ts')), 3000, 'snapshot on disk');
    writeFileSync(join(root, 'a.ts'), 'line 4\nbudi 12\n');
    await waitFor(() => readFileSync(join(root, 'a.ts'), 'utf8') === merged, 3000, 'merged text on disk');
    await sleep(300);
    expect(contents).toEqual(['line 4\nbudi 12\n']);
    expect(a.known.get('a.ts')).toEqual({ version: 3, hash: sha(merged) });
  });

  it('an unsent local edit is sent for merging before a teammate change is applied (prod e2e 12j)', async () => {
    const { createHash } = await import('node:crypto');
    const sha = (s: string) => createHash('sha256').update(s).digest('hex');
    const base = 'line 4\nline 12\n';
    const alice = 'alice 4\nline 12\n';
    const merged = 'alice 4\nbudi 12\n';
    const updates: { baseVersion: number; content: string }[] = [];
    let sock: WebSocket | null = null;
    wss = new WebSocketServer({ port: 0 });
    wss.on('connection', (ws: WebSocket) => {
      sock = ws;
      ws.on('message', (raw) => {
        const text = raw.toString();
        if (text === '{"t":"ping"}') return;
        const m = JSON.parse(text) as { t: string; id?: string; d: { path: string; content: string; baseVersion: number } };
        if (m.t === 'hello') {
          ws.send(JSON.stringify({ t: 'welcome', d: { principal: { kind: 'member', memberId: 'B', role: 'coder' }, serverTime: Date.now(), workspace: 'toko-demo' } }));
          ws.send(JSON.stringify({ t: 'snapshot', d: { files: [{ path: 'a.ts', version: 1, hash: sha(base), content: base, deleted: false }], locks: [], cursor: 0 } }));
        } else if (m.t === 'file.update') {
          updates.push({ baseVersion: m.d.baseVersion, content: m.d.content });
          ws.send(JSON.stringify({ t: 'file.ack', id: m.id, d: { id: m.id, path: 'a.ts', version: 3, hash: sha(merged), merged: true, content: merged } }));
        }
      });
    });
    await new Promise<void>((r) => wss!.once('listening', () => r()));
    const { port } = wss.address() as { port: number };
    const root = tempDir();
    const a = new SyncAgent({ root, server: `http://127.0.0.1:${port}`, token: 'rdr_test', member: 'B', debounceMs: 2000, log: () => {}, notify: () => {}, ...FAST });
    agents.push(a);
    await a.start();
    await waitFor(() => existsSync(join(root, 'a.ts')), 3000, 'snapshot on disk');
    writeFileSync(join(root, 'a.ts'), 'line 4\nbudi 12\n');
    // Alice's v2 arrives before the debounce sends Budi's edit.
    sock!.send(JSON.stringify({ t: 'file.changed', d: { path: 'a.ts', version: 2, hash: sha(alice), content: alice, deleted: false, by: 'A', taskId: null, serverTs: Date.now() } }));
    await waitFor(() => readFileSync(join(root, 'a.ts'), 'utf8') === merged, 3000, 'merged text on disk');
    expect(updates[0]).toEqual({ baseVersion: 1, content: 'line 4\nbudi 12\n' });
    expect(existsSync(join(root, 'a.ts.radar-conflict'))).toBe(false);
  });
});

describe('local files that never sync (fase 12k bug 2)', () => {
  it('a binary or too-large file is reported once as rejected instead of only in sync.log', async () => {
    const srv = await fakeServer();
    const rejected: { path: string; reason: string; sidecar: string | null }[] = [];
    const notices: string[] = [];
    const root = tempDir();
    const a = new SyncAgent({ root, server: srv.url, token: 'rdr_test', member: 'A', debounceMs: 20, log: () => {}, notify: (n) => notices.push(n.text), ...FAST });
    agents.push(a);
    a.on('rejected', (r: { path: string; reason: string; sidecar: string | null }) => rejected.push({ path: r.path, reason: r.reason, sidecar: r.sidecar }));
    await a.start();
    writeFileSync(join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]));
    writeFileSync(join(root, 'big.txt'), 'x'.repeat(1_048_577));
    await waitFor(() => rejected.length === 2, 3000, 'two rejections');
    expect(rejected).toEqual(expect.arrayContaining([
      { path: 'logo.png', reason: 'binary', sidecar: null },
      { path: 'big.txt', reason: 'too_large', sidecar: null },
    ]));
    expect(notices.join('\n')).toMatch(/logo\.png is a binary file/);
    expect(srv.updates).toEqual([]);
    // Saving the same file again does not repeat the notice.
    writeFileSync(join(root, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 0, 0, 0]));
    await sleep(200);
    expect(rejected).toHaveLength(2);
  });
});
