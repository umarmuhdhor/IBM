// Integration: real Worker + Durable Object (phase 03) and three SyncAgents in temp folders (fase 04 step 11).
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, onTestFailed } from 'vitest';
import { SyncAgent, type SyncAgentOptions } from '../src/agent.js';
import { cleanupDirs, FAST, read, seedTestWorkspace, sleep, startServer, tempDir, waitFor, type TestServer } from './helpers.js';

const SEED = [
  { path: 'src/utils.ts', content: 'export const sum = (a: number, b: number) => a + b;\n' },
  { path: 'src/checkout/checkout.ts', content: 'export const checkout = () => 0;\n' },
  { path: 'README.md', content: '# toko-demo\n' },
];

let server: TestServer;
const agents: SyncAgent[] = [];

beforeAll(async () => {
  server = await startServer();
}, 60_000);
afterAll(async () => {
  await server?.close();
});
afterEach(async () => {
  await Promise.all(agents.splice(0).map((a) => a.stop()));
  cleanupDirs();
});

async function agent(token: string, member: string, opts: Partial<SyncAgentOptions> = {}): Promise<{ a: SyncAgent; root: string }> {
  const root = opts.root ?? tempDir();
  const lines: string[] = [];
  const a = new SyncAgent({ root, server: server.url, token, member, log: (l) => lines.push(l), notify: () => {}, ...FAST, ...opts });
  agents.push(a);
  // SYNC_DEBUG_FILE=<path>: append each agent's sync.log when a test fails (flake hunting).
  const debugFile = process.env.SYNC_DEBUG_FILE;
  if (debugFile) onTestFailed(({ task }) => appendFileSync(debugFile, `\n=== ${task.name} · ${member}\n${lines.join('\n')}`));
  await a.start();
  return { a, root };
}

describe('sync agent against the real server', () => {
  it('SY-01: join writes the same snapshot into every folder', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const [A, B, C] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B'), agent(t.C!, 'C')]);
    for (const { root } of [A, B, C]) for (const f of SEED) expect(read(root, f.path)).toBe(f.content);
    expect(A.a.stats.updatesSent).toBe(0);
  });

  it('SY-02/SY-03: a write in A reaches B and C in < 1 s, exactly one update, no echo', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const [A, B, C] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B'), agent(t.C!, 'C')]);
    const next = 'export const sum = (a: number, b: number) => a + b + 0;\n';
    writeFileSync(join(A.root, 'src/utils.ts'), next);
    const ms = await waitFor(() => read(B.root, 'src/utils.ts') === next && read(C.root, 'src/utils.ts') === next, 1000, 'B and C updated');
    expect(ms).toBeLessThan(1000);
    await sleep(2000);
    expect(A.a.stats.updatesSent).toBe(1);
    expect(B.a.stats.updatesSent).toBe(0);
    expect(C.a.stats.updatesSent).toBe(0);
    expect(A.a.known.get('src/utils.ts')?.version).toBe(2);
    expect(B.a.known.get('src/utils.ts')?.version).toBe(2);
  }, 10_000);

  it('debounces 20 saves in 100 ms into at most 3 updates; the last version wins everywhere', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const [A, B] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B')]);
    for (let i = 0; i < 20; i++) {
      writeFileSync(join(A.root, 'src/utils.ts'), `export const v = ${i};\n`);
      await sleep(5);
    }
    await waitFor(() => read(B.root, 'src/utils.ts') === 'export const v = 19;\n', 3000, 'final version in B');
    await sleep(500);
    expect(A.a.stats.updatesSent).toBeLessThanOrEqual(3);
    expect(A.a.known.get('src/utils.ts')).toEqual(B.a.known.get('src/utils.ts'));
  }, 10_000);

  it('SY-04: a PM write is rejected, restored, and saved to .radar-rejected; coders are untouched', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const notices: string[] = [];
    const [A, B] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B')]);
    const C = await agent(t.C!, 'C', { notify: (n) => notices.push(n.text) });
    writeFileSync(join(C.root, 'README.md'), '# PM edit\n');
    await waitFor(() => read(C.root, 'README.md.radar-rejected') === '# PM edit\n', 3000, 'sidecar');
    await waitFor(() => read(C.root, 'README.md') === '# toko-demo\n', 3000, 'restore');
    expect(C.a.stats.rejected).toBe(1);
    expect(notices.join('\n')).toMatch(/PM tidak menulis file/);
    await sleep(300);
    expect(read(A.root, 'README.md')).toBe('# toko-demo\n');
    expect(read(B.root, 'README.md')).toBe('# toko-demo\n');
    // the restore itself is not echoed back to the server
    expect(C.a.stats.updatesSent).toBe(1);
    // the sidecar is never synced
    expect(read(A.root, 'README.md.radar-rejected')).toBeNull();
  }, 10_000);

  it('a folder with different content at join keeps it as .radar-conflict; server wins; local-only files are sent', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const B = await agent(t.B!, 'B');
    const root = tempDir();
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/utils.ts'), '// mine\n');
    writeFileSync(join(root, 'src/new.ts'), 'export const n = 1;\n');
    const A = await agent(t.A!, 'A', { root });
    expect(read(root, 'src/utils.ts.radar-conflict')).toBe('// mine\n');
    expect(read(root, 'src/utils.ts')).toBe(SEED[0]!.content);
    expect(A.a.stats.conflicts).toBe(1);
    await waitFor(() => read(B.root, 'src/new.ts') === 'export const n = 1;\n', 3000, 'local-only file reaches B');
  }, 10_000);

  it('SY-05: heartbeats are sent on the configured interval', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const A = await agent(t.A!, 'A', { heartbeatMs: 50 });
    await sleep(300);
    expect(A.a.stats.heartbeatsSent).toBeGreaterThanOrEqual(3);
  });

  it('reconnects after a dropped connection and catches up via the snapshot', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const [A, B] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B')]);
    B.a.dropConnection();
    await waitFor(() => !B.a.connected, 1000, 'B disconnected');
    writeFileSync(join(A.root, 'src/utils.ts'), '// while B was away\n');
    await waitFor(() => A.a.known.get('src/utils.ts')?.version === 2, 3000, 'A acked');
    await waitFor(() => read(B.root, 'src/utils.ts') === '// while B was away\n', 5000, 'B caught up');
    expect(B.a.stats.reconnects).toBeGreaterThanOrEqual(1);
    expect(B.a.connected).toBe(true);
  }, 10_000);

  it('an edit made while disconnected is uploaded after the reconnect', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const notices: string[] = [];
    const [A, B] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B', { notify: (n) => notices.push(n.text) })]);
    B.a.dropConnection();
    await waitFor(() => !B.a.connected, 1000, 'B disconnected');
    writeFileSync(join(B.root, 'src/utils.ts'), '// B offline edit\n');
    await waitFor(() => read(A.root, 'src/utils.ts') === '// B offline edit\n', 5000, 'offline edit reaches A');
    expect(B.a.stats.updatesSent).toBe(1);
    // disconnect and reconnect are shown without --verbose
    expect(notices.join('\n')).toMatch(/terputus/);
    expect(notices.join('\n')).toMatch(/tersambung lagi/);
  }, 10_000);

  it('SY-07: offline edits after reconnect — own file is sent, a file changed on the server meanwhile becomes .radar-conflict', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    // A slow first retry keeps A offline while both sides edit.
    const [A, B] = await Promise.all([agent(t.A!, 'A', { reconnect: { minMs: 1500, maxMs: 1500 } }), agent(t.B!, 'B')]);
    A.a.dropConnection();
    await waitFor(() => !A.a.connected, 1000, 'A disconnected');
    writeFileSync(join(B.root, 'src/checkout/checkout.ts'), '// B online\n');
    await waitFor(() => B.a.known.get('src/checkout/checkout.ts')?.version === 2, 3000, 'B acked');
    writeFileSync(join(A.root, 'src/utils.ts'), '// A offline, own file\n');
    writeFileSync(join(A.root, 'src/checkout/checkout.ts'), '// A offline, B file\n');
    await waitFor(() => A.a.connected && read(B.root, 'src/utils.ts') === '// A offline, own file\n', 6000, 'own offline edit reaches B');
    await waitFor(() => read(A.root, 'src/checkout/checkout.ts') === '// B online\n', 3000, 'server copy wins in A');
    expect(read(A.root, 'src/checkout/checkout.ts.radar-conflict')).toBe('// A offline, B file\n');
    expect(A.a.stats.conflicts).toBe(1);
    await sleep(300);
    // The losing copy is never uploaded.
    expect(read(B.root, 'src/checkout/checkout.ts')).toBe('// B online\n');
    expect(existsSync(join(B.root, 'src/checkout/checkout.ts.radar-conflict'))).toBe(false);
  }, 12_000);

  it('a .gitignore edit is honoured at once: newly ignored files stop syncing', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const [A, B] = await Promise.all([agent(t.A!, 'A'), agent(t.B!, 'B')]);
    writeFileSync(join(A.root, '.gitignore'), 'local-notes.md\n');
    await waitFor(() => read(B.root, '.gitignore') === 'local-notes.md\n', 3000, '.gitignore reaches B');
    writeFileSync(join(A.root, 'local-notes.md'), 'private\n');
    writeFileSync(join(A.root, 'src/utils.ts'), '// after gitignore\n');
    await waitFor(() => read(B.root, 'src/utils.ts') === '// after gitignore\n', 3000, 'normal file still syncs');
    await sleep(300);
    expect(read(B.root, 'local-notes.md')).toBeNull();
    expect(A.a.stats.updatesSent).toBe(2);
  }, 10_000);

  it('a second agent for the same member replaces the first, which stops for good', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const first = await agent(t.A!, 'A');
    await agent(t.A!, 'A');
    await waitFor(() => first.a.stopped, 3000, 'first agent stopped');
    expect(first.a.stopReason).toMatch(/4000/);
  }, 10_000);

  it('a wrong token fails start() instead of retrying forever', async () => {
    await seedTestWorkspace(server.url, SEED);
    const a = new SyncAgent({ root: tempDir(), server: server.url, token: 'rdr_wrong', member: 'A', log: () => {}, notify: () => {}, ...FAST });
    agents.push(a);
    await expect(a.start()).rejects.toThrow(/4401|token/i);
  });

  it('ignored and oversized files are never sent', async () => {
    const t = await seedTestWorkspace(server.url, SEED);
    const A = await agent(t.A!, 'A');
    mkdirSync(join(A.root, 'node_modules/x'), { recursive: true });
    writeFileSync(join(A.root, 'node_modules/x/index.js'), 'x');
    writeFileSync(join(A.root, 'big.txt'), 'x'.repeat(1_048_577));
    writeFileSync(join(A.root, 'logo.png'), Buffer.from([0x89, 0x50, 0, 0]));
    await sleep(600);
    expect(A.a.stats.updatesSent).toBe(0);
    expect(existsSync(join(A.root, '.radar'))).toBe(true); // sync.log lives there
  });
});
