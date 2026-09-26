// Agent paths the real server cannot be driven into: a fake WS server answers every update with an
// unverifiable `conflict` (server file v0, no content), the half-written-read case of fase 04 step 6.
import { writeFileSync } from 'node:fs';
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
