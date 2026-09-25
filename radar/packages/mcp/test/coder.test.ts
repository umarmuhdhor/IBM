import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRadarClient, MSG_NOT_JOINED, MSG_UNAVAILABLE } from '../src/client.js';
import type { LocalConfig } from '../src/placeholder/config.js';
import { createRadarServer } from '../src/server.js';

// Canned responses copied from R3 §2.4–§2.9.
// TODO(sync:alief): run against the fase 02 mock server once it is in main.
const TASKS = {
  tasks: [
    {
      id: 'T-2', title: 'Dark mode', description: 'Tema gelap', ownerId: 'B', status: 'dikerjakan', adhoc: false,
      baseCommit: '3f9a2c1', editCount: 7,
      files: [
        { path: 'src/ui/theme.css', lock: 'dipegang', queuePos: 0 },
        { path: 'src/checkout/checkout.ts', lock: null, queuePos: 1, waitingFor: 'T-1' },
      ],
    },
  ],
  activeTaskId: 'T-2',
};
const BLOCK = {
  block: {
    path: 'src/checkout/checkout.ts', ts: 1790000000000, via: 'hook',
    holder: { memberId: 'A', memberName: 'Alice', taskId: 'T-1', taskTitle: 'Kupon', state: 'dipegang', sinceMs: 420000 },
    requestId: 'R-3', requestStatus: 'terbuka',
    queue: [{ taskId: 'T-1', memberId: 'A' }, { taskId: 'T-2', memberId: 'B' }],
    suggestion: 'File ini milik T-1. Permintaanmu R-3 sudah masuk antrean PM. Lanjutkan file lain di task T-2: src/ui/Header.tsx.',
  },
};
const ACTIVITY = {
  items: [{ ts: 1790000000000, actor: 'A', type: 'file.changed', path: 'src/checkout/checkout.ts', summary: 'A mengubah checkout.ts (v9, T-1)' }],
};

type Rec = { method: string; url: string; body: unknown };
let http: Server;
let base: string;
const seen: Rec[] = [];
let noBlockYet = false;
let submitConflict = false;

beforeAll(async () => {
  http = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const url = req.url ?? '/';
      seen.push({ method: req.method ?? 'GET', url, body: raw ? JSON.parse(raw) : undefined });
      const send = (status: number, json: unknown) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(json));
      };
      if (url.startsWith('/v1/tasks?')) return send(200, TASKS);
      if (url === '/v1/blocks/last') return send(200, noBlockYet ? { block: null } : BLOCK);
      if (url === '/v1/requests') {
        const path = (JSON.parse(raw) as { path: string }).path;
        return path === 'src/free.ts'
          ? send(200, { requestId: null, status: 'bebas', message: 'File bebas, langsung edit saja.' })
          : send(201, { requestId: 'R-4', status: 'terbuka', duplicate: false });
      }
      if (url.startsWith('/v1/activity')) return send(200, ACTIVITY);
      if (url === '/v1/tasks/T-2/submit') {
        return submitConflict
          ? send(409, { error: { code: 'nothing_changed', message: 'Task T-2 belum mengubah file apa pun.' } })
          : send(200, { taskId: 'T-2', status: 'review', files: ['src/ui/theme.css', 'src/ui/Header.tsx', 'src/ui/dark.css'] });
      }
      return send(404, { error: { code: 'not_found', message: 'not found' } });
    });
  });
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  http.closeAllConnections();
  await new Promise<void>((r) => http.close(() => r()));
});

beforeEach(() => {
  seen.length = 0;
  noBlockYet = false;
  submitConflict = false;
});

const cfg = (server: string): LocalConfig => ({ root: '/tmp/ws', server, workspace: 'toko-demo', member: 'B', token: 'tok-b', role: 'coder' });

async function connect(config: LocalConfig | null) {
  const server = createRadarServer(createRadarClient(config, 1_000), 'coder');
  const client = new Client({ name: 'test', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

async function call(name: string, args: Record<string, unknown> = {}, config: LocalConfig | null = cfg(base)) {
  const client = await connect(config);
  const res = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  await client.close();
  return { text: res.content.map((c) => c.text).join('\n'), isError: res.isError === true };
}

describe('radar-mcp coder tools (BC-07, R3 §7)', () => {
  it('registers exactly the 5 coder tools, each with a description for the model', async () => {
    const client = await connect(cfg(base));
    const { tools } = await client.listTools();
    await client.close();
    expect(tools.map((t) => t.name).sort()).toEqual(['my_tasks', 'request_file', 'submit_task', 'team_activity', 'why_blocked']);
    for (const t of tools) expect(t.description?.length ?? 0).toBeGreaterThan(20);
  });

  it('my_tasks: active task first, then its files with lock/queue state', async () => {
    const { text, isError } = await call('my_tasks');
    expect(isError).toBe(false);
    expect(seen[0]?.url).toBe('/v1/tasks?owner=me&status=open');
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/T-2/);
    expect(lines[0]).toMatch(/Dark mode/);
    expect(text).toContain('src/ui/theme.css');
    expect(text).toContain('src/checkout/checkout.ts');
    expect(text).toMatch(/T-1/); // waiting for T-1
    expect(lines.length).toBeLessThanOrEqual(12);
  });

  it('why_blocked: holder, task, request and suggestion', async () => {
    const { text, isError } = await call('why_blocked');
    expect(isError).toBe(false);
    expect(seen[0]?.url).toBe('/v1/blocks/last');
    expect(text.split('\n')[0]).toContain('src/checkout/checkout.ts');
    for (const s of ['Alice', 'T-1', 'Kupon', 'R-3', 'src/ui/Header.tsx']) expect(text).toContain(s);
    expect(text.split('\n').length).toBeLessThanOrEqual(12);
  });

  it('why_blocked: says so when nothing was blocked', async () => {
    noBlockYet = true;
    const { text, isError } = await call('why_blocked');
    expect(isError).toBe(false);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('undefined');
  });

  it('request_file: POST /v1/requests and reports the request id', async () => {
    const { text } = await call('request_file', { path: 'src/routes.ts', reason: 'Butuh rute /coupon' });
    expect(seen[0]).toMatchObject({ method: 'POST', url: '/v1/requests', body: { path: 'src/routes.ts', reason: 'Butuh rute /coupon' } });
    expect(text).toContain('R-4');
  });

  it('request_file: a free file needs no request', async () => {
    const { text } = await call('request_file', { path: 'src/free.ts', reason: 'x' });
    expect(text).toMatch(/bebas/i);
  });

  it('team_activity: GET /v1/activity with optional path and limit', async () => {
    const { text } = await call('team_activity', { path: 'src/checkout/checkout.ts', limit: 5 });
    const url = new URL(seen[0]?.url ?? '', base);
    expect(url.pathname).toBe('/v1/activity');
    expect(url.searchParams.get('path')).toBe('src/checkout/checkout.ts');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(text).toContain('A mengubah checkout.ts (v9, T-1)');
  });

  it('team_activity: rejects limit outside 1..50', async () => {
    const client = await connect(cfg(base));
    const res = (await client.callTool({ name: 'team_activity', arguments: { limit: 99 } })) as { isError?: boolean };
    await client.close();
    expect(res.isError).toBe(true);
  });

  it('submit_task: POST /v1/tasks/:id/submit with the summary, reports review + file count', async () => {
    const { text } = await call('submit_task', { task_id: 'T-2', summary: 'Tema gelap + toggle' });
    expect(seen[0]).toMatchObject({ method: 'POST', url: '/v1/tasks/T-2/submit', body: { summary: 'Tema gelap + toggle' } });
    expect(text).toContain('T-2');
    expect(text).toMatch(/review/i);
    expect(text).toContain('3');
  });

  it('submit_task: encodes the task id in the URL', async () => {
    await call('submit_task', { task_id: 'T-2/../../admin', summary: 'x' });
    expect(seen[0]?.url).toBe('/v1/tasks/T-2%2F..%2F..%2Fadmin/submit');
  });

  it('my_tasks: only the active task is called active, other lock states are named', async () => {
    const saved = TASKS.tasks.slice();
    TASKS.tasks.push({
      id: 'T-5', title: 'Footer', description: '', ownerId: 'B', status: 'terbuka', adhoc: false, baseCommit: 'x', editCount: 0,
      files: [{ path: 'src/ui/Footer.tsx', lock: 'dipesan', queuePos: 0 }],
    });
    try {
      const { text } = await call('my_tasks');
      expect(text.match(/Task aktif/g)).toHaveLength(1);
      expect(text).toMatch(/T-5 Footer/);
      expect(text).toMatch(/Footer\.tsx.*dipesan/);
    } finally {
      TASKS.tasks.splice(0, TASKS.tasks.length, ...saved);
    }
  });

  it('submit_task: a 409 from the server becomes a readable error, not a crash', async () => {
    submitConflict = true;
    const { text, isError } = await call('submit_task', { task_id: 'T-2', summary: 'x' });
    expect(isError).toBe(true);
    expect(text).toContain('belum mengubah file');
  });

  it('every tool degrades to a friendly message when the server is down', async () => {
    const { text, isError } = await call('my_tasks', {}, cfg('http://127.0.0.1:1'));
    expect(isError).toBe(true);
    expect(text).toBe(MSG_UNAVAILABLE);
  });

  it('tools tell the model to run radar join when the folder is not joined', async () => {
    const { text, isError } = await call('why_blocked', {}, null);
    expect(isError).toBe(true);
    expect(text).toBe(MSG_NOT_JOINED);
  });

  it('pm role gets none of the coder tools', async () => {
    const server = createRadarServer(createRadarClient(cfg(base)), 'pm');
    const client = new Client({ name: 'test', version: '0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);
    const names = await client.listTools().then((r) => r.tools.map((t) => t.name), () => [] as string[]);
    await client.close();
    expect(names).not.toContain('my_tasks');
  });
});
