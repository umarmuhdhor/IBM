// Contract test: radar-mcp tools against the fase 02 mock server (radar/scripts/mock-server.ts), which answers with
// the @radar/common shapes. The demo scenario is applied at boot (T-0 in review, T-1 held by A, T-2 held by B).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { LocalConfig } from '@radar/common/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMockServer, type MockServer } from '../../../scripts/mock-server.js';
import { createRadarClient } from '../src/client.js';
import { createRadarServer } from '../src/server.js';

let mock: MockServer;

beforeAll(async () => {
  mock = await startMockServer({ port: 0, scenario: 'demo', instant: true });
});

afterAll(async () => {
  await mock.close();
});

const cfg = (member: 'B' | 'C'): LocalConfig => ({
  root: '/tmp/ws',
  server: `http://127.0.0.1:${mock.port}`,
  workspace: 'toko-demo',
  member,
  token: member === 'B' ? 'tok-b' : 'tok-c',
  role: member === 'B' ? 'coder' : 'pm',
  shareprompts: false,
});

async function call(member: 'B' | 'C', name: string, args: Record<string, unknown> = {}) {
  const c = cfg(member);
  const server = createRadarServer(createRadarClient(c, 2_000), c.role);
  const client = new Client({ name: 'test', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const res = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  await client.close();
  return { text: res.content.map((x) => x.text).join('\n'), isError: res.isError === true };
}

describe('coder tools against the fase 02 mock server', () => {
  it('my_tasks lists T-2 for B', async () => {
    const r = await call('B', 'my_tasks');
    expect(r).toMatchObject({ isError: false });
    expect(r.text).toContain('T-2');
  });

  it('team_activity answers', async () => {
    const r = await call('B', 'team_activity');
    expect(r.isError).toBe(false);
  });

  it('why_blocked answers', async () => {
    const r = await call('B', 'why_blocked');
    expect(r.isError).toBe(false);
  });
});

describe('pm tools against the fase 02 mock server', () => {
  it('team_status passes the TeamRes schema and names members and tasks', async () => {
    const r = await call('C', 'team_status');
    expect(r.isError).toBe(false);
    for (const s of ['Andi', 'Budi', 'T-1', 'T-2', 'src/checkout/checkout.ts']) expect(r.text).toContain(s);
  });

  it('get_task_diff passes the TaskDiffRes schema for T-0', async () => {
    const r = await call('C', 'get_task_diff', { task_id: 'T-0' });
    expect(r.isError).toBe(false);
    expect(r.text).toMatch(/file berubah/);
  });

  it('list_requests answers', async () => {
    const r = await call('C', 'list_requests');
    expect(r.isError).toBe(false);
  });

  it('notify reaches B', async () => {
    const r = await call('C', 'notify', { member: 'B', message: 'calculateTotal() kini butuh parameter ongkir.' });
    expect(r.isError).toBe(false);
  });
});
