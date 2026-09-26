import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRadarClient } from '../src/client.js';
import type { LocalConfig } from '@radar/common/node';
import { createRadarServer } from '../src/server.js';

// Canned responses from R3 §2.10–§2.17 and §4.
// Edge cases use this canned server; mock_contract.test.ts runs the tools against the fase 02 mock server.
const PM_TOOLS = [
  'get_task_diff',
  'list_requests',
  'notify',
  'propose_decision',
  'propose_plan',
  'propose_review',
  'session_report',
  'team_status',
];

const TEAM = {
  members: [
    { id: 'A', name: 'Alice', role: 'coder', online: true, lastHeartbeatMs: 3200, activeTaskId: 'T-1' },
    { id: 'B', name: 'Budi', role: 'coder', online: false, lastHeartbeatMs: 400000, activeTaskId: 'T-2' },
  ],
  tasks: [
    { id: 'T-1', title: 'Kupon', ownerId: 'A', status: 'dikerjakan', files: ['src/checkout/checkout.ts'], editCount: 14 },
    { id: 'T-2', title: 'Dark mode', ownerId: 'B', status: 'review', files: ['src/ui/theme.css'], editCount: 3 },
  ],
  locks: [{ path: 'src/checkout/checkout.ts', taskId: 'T-1', memberId: 'A', state: 'dipegang', queue: ['T-2'] }],
  openRequests: 1,
  pendingProposals: 2,
  headCommit: '3f9a2c1',
};
const REQUESTS = {
  requests: [
    {
      id: 'R-3', path: 'src/checkout/checkout.ts', status: 'terbuka', source: 'hook', reason: '',
      requester: { memberId: 'B', taskId: 'T-2', taskTitle: 'Dark mode', taskDescription: 'Toggle tema gelap di header dan ringkasan total.' },
      holder: { memberId: 'A', taskId: 'T-1', taskTitle: 'Kupon', taskDescription: 'Tambah kode kupon persen di checkout.', state: 'dipegang', editCount: 14 },
      fileVersion: 9, createdAt: 1790000000000,
    },
  ],
};
const DIFF = {
  taskId: 'T-0', title: 'Setup ongkir', ownerId: 'A', status: 'review', baseCommit: '3f9a2c1', summary: 'Ongkir di checkout',
  files: [
    {
      path: 'src/checkout/checkout.ts', change: 'modified', fromVersion: 3, toVersion: 12,
      patch: `--- a/src/checkout/checkout.ts\n+++ b/src/checkout/checkout.ts\n@@ -1,3 +1,3 @@\n-export function calculateTotal(items: Item[]) {\n+export function calculateTotal(items: Item[], shipping: number) {\n${'+// filler\n'.repeat(1500)}`,
      exportsChanged: [{ name: 'calculateTotal', kind: 'function', before: 'calculateTotal(items: Item[])', after: 'calculateTotal(items: Item[], shipping: number)' }],
    },
    { path: 'src/checkout/shipping.ts', change: 'added', fromVersion: 0, toVersion: 1, patch: '+export const FLAT = 10000;\n', exportsChanged: [] },
  ],
  importers: [
    { path: 'src/ui/Header.tsx', imports: 'src/checkout/checkout.ts', symbols: ['calculateTotal'], lines: [14], holder: { memberId: 'B', taskId: 'T-2', state: 'dipegang' } },
  ],
  truncated: false,
};

type Rec = { method: string; url: string; body: unknown };
let http: Server;
let base: string;
const seen: Rec[] = [];
let planConflict = false;
let autoApply = false;
let reportMissing = true;

beforeAll(async () => {
  http = createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      const url = req.url ?? '/';
      const body = raw ? (JSON.parse(raw) as { kind?: string }) : undefined;
      seen.push({ method: req.method ?? 'GET', url, body });
      const send = (status: number, json: unknown) => {
        res.statusCode = status;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(json));
      };
      if (url === '/v1/team') return send(200, TEAM);
      if (url.startsWith('/v1/requests')) return send(200, REQUESTS);
      if (url === '/v1/proposals' && body?.kind === 'plan') {
        return planConflict
          ? send(422, { error: { code: 'plan_conflict', message: 'src/routes.ts ada di files T-1 dan T-2. Taruh di queuedFiles salah satu task.' } })
          : send(201, { proposalId: 'P-5', status: 'menunggu' });
      }
      if (url === '/v1/proposals' && body?.kind === 'decision') return send(201, { proposalId: 'P-6', status: autoApply ? 'diterapkan_otomatis' : 'menunggu' });
      if (url === '/v1/proposals' && body?.kind === 'review') return send(201, { proposalId: 'P-7', status: 'menunggu' });
      if (url === '/v1/tasks/T-0/diff') return send(200, DIFF);
      if (url === '/v1/notify') return send(201, { notificationId: 17 });
      if (url.startsWith('/v1/report/session')) {
        return reportMissing
          ? send(404, { error: { code: 'not_found', message: 'not found' } })
          : send(200, { markdown: '## Laporan sesi\n- 3 task', stats: { tasks: 3 } });
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
  planConflict = false;
  autoApply = false;
  reportMissing = true;
});

const cfg = (role: 'coder' | 'pm'): LocalConfig => ({ root: '/tmp/ws', server: base, workspace: 'toko-demo', member: 'C', token: 'tok-c', role, shareprompts: false });

async function connect(role: 'coder' | 'pm') {
  const server = createRadarServer(createRadarClient(cfg(role), 1_000), role);
  const client = new Client({ name: 'test', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

async function call(name: string, args: Record<string, unknown> = {}) {
  const client = await connect('pm');
  const res = (await client.callTool({ name, arguments: args })) as { content: { type: string; text: string }[]; isError?: boolean };
  await client.close();
  return { text: res.content.map((c) => c.text).join('\n'), isError: res.isError === true };
}

describe('radar-mcp PM tools (MA-01..05, MA-07, R3 §7)', () => {
  it('role pm lists exactly the 8 PM tools, no approve/decide/revoke (MA-07)', async () => {
    const client = await connect('pm');
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    await client.close();
    expect(names).toEqual(PM_TOOLS);
    for (const n of names) expect(n).not.toMatch(/approve|decide|revoke/);
  });

  it('role coder sees none of the PM tools, role pm none of the coder tools', async () => {
    const coder = await connect('coder');
    const coderNames = (await coder.listTools()).tools.map((t) => t.name);
    await coder.close();
    expect(coderNames.filter((n) => PM_TOOLS.includes(n))).toEqual([]);
    const pm = await connect('pm');
    const pmNames = (await pm.listTools()).tools.map((t) => t.name);
    await pm.close();
    expect(pmNames).not.toContain('my_tasks');
    expect(pmNames).not.toContain('submit_task');
  });

  it('calling a tool named approve fails: the tool does not exist', async () => {
    const client = await connect('pm');
    const res = await client
      .callTool({ name: 'approve', arguments: { proposal_id: 'P-5' } })
      .then((r) => ({ isError: (r as { isError?: boolean }).isError === true, text: JSON.stringify(r) }))
      .catch((err: unknown) => ({ isError: true, text: String(err) }));
    await client.close();
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/approve/);
    expect(seen).toHaveLength(0);
  });

  it('team_status: members, tasks, locks with queue, counters in ≤ 25 lines', async () => {
    const { text, isError } = await call('team_status');
    expect(isError).toBe(false);
    expect(seen[0]?.url).toBe('/v1/team');
    for (const s of ['Alice', 'Budi', 'T-1', 'Kupon', 'T-2', 'src/checkout/checkout.ts']) expect(text).toContain(s);
    expect(text).toMatch(/offline/i);
    expect(text.split('\n').length).toBeLessThanOrEqual(25);
  });

  it('team_status: shows member ids next to names so notify/owner use ids, not names', async () => {
    const { text } = await call('team_status');
    expect(text).toMatch(/\bA\b.*Alice/);
    expect(text).toMatch(/\bB\b.*Budi/);
  });

  it('get_task_diff: stays near 8 KB when several files together pass the budget', async () => {
    const saved = DIFF.files.slice();
    DIFF.files.splice(0, DIFF.files.length,
      { ...saved[0]!, patch: 'X'.repeat(7_975) },
      { ...saved[1]!, path: `src/${'deep/'.repeat(20)}file.ts`, patch: 'Y'.repeat(20_000) },
    );
    try {
      const { text } = await call('get_task_diff', { task_id: 'T-0' });
      expect(text.length).toBeLessThan(9_000);
      expect(text).toMatch(/read_file/);
    } finally {
      DIFF.files.splice(0, DIFF.files.length, ...saved);
    }
  });

  it('team_status: a response that breaks the TeamRes contract is a friendly error, not a crash', async () => {
    const saved = TEAM.members;
    (TEAM as { members: unknown }).members = 'not-a-list';
    try {
      const { isError, text } = await call('team_status');
      expect(isError).toBe(true);
      expect(text).toMatch(/tidak sesuai kontrak/);
      expect(text).not.toMatch(/TypeError/);
    } finally {
      TEAM.members = saved;
    }
  });

  it('get_task_diff: a response that breaks the TaskDiffRes contract is a friendly error', async () => {
    const saved = DIFF.files;
    (DIFF as { files: unknown }).files = 'not-a-list';
    try {
      const { isError, text } = await call('get_task_diff', { task_id: 'T-0' });
      expect(isError).toBe(true);
      expect(text).toMatch(/tidak sesuai kontrak/);
    } finally {
      DIFF.files = saved;
    }
  });

  it('get_task_diff: tolerates a server without the optional exportsChanged/importers (schema defaults)', async () => {
    const saved = JSON.parse(JSON.stringify(DIFF));
    delete (DIFF.files[1] as { exportsChanged?: unknown }).exportsChanged;
    delete (DIFF as { importers?: unknown }).importers;
    try {
      const { isError, text } = await call('get_task_diff', { task_id: 'T-0' });
      expect(isError).toBe(false);
      expect(text).not.toContain('undefined');
    } finally {
      Object.assign(DIFF, saved);
    }
  });

  it('list_requests: caps a long queue and says how many are left', async () => {
    const saved = REQUESTS.requests.slice();
    for (let i = 4; i < 12; i++) REQUESTS.requests.push({ ...saved[0]!, id: `R-${i}` });
    try {
      const { text } = await call('list_requests');
      expect(text.split('\n').length).toBeLessThanOrEqual(14);
      expect(text).toMatch(/lagi/);
    } finally {
      REQUESTS.requests.splice(0, REQUESTS.requests.length, ...saved);
    }
  });

  it('propose_plan: rejects more than 8 tasks or empty titles before calling the server', async () => {
    const task = { title: 't', description: 'd', owner: 'A', files: ['a.ts'] };
    const tooMany = await call('propose_plan', { goal: 'g', reason: 'r', tasks: Array.from({ length: 9 }, () => task) });
    const empty = await call('propose_plan', { goal: 'g', reason: 'r', tasks: [{ ...task, title: '' }] });
    expect(tooMany.isError).toBe(true);
    expect(empty.isError).toBe(true);
    expect(seen).toHaveLength(0);
  });

  it('propose_plan: converts snake_case tasks to the R3 §4.1 payload and reports the proposal', async () => {
    const { text, isError } = await call('propose_plan', {
      goal: 'Tambah fitur kupon dan dark mode',
      reason: 'Dua task paralel tanpa file bersama',
      tasks: [
        { title: 'Kupon diskon', description: 'Kode kupon persen', owner: 'A', files: ['src/checkout/checkout.ts'], queued_files: [] },
        { title: 'Dark mode', description: 'Toggle tema', owner: 'B', files: ['src/ui/theme.css'], queued_files: ['src/routes.ts'] },
      ],
    });
    expect(isError).toBe(false);
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: '/v1/proposals',
      body: {
        kind: 'plan',
        reason: 'Dua task paralel tanpa file bersama',
        payload: {
          goal: 'Tambah fitur kupon dan dark mode',
          tasks: [
            { ref: 't1', title: 'Kupon diskon', description: 'Kode kupon persen', ownerId: 'A', files: ['src/checkout/checkout.ts'], queuedFiles: [] },
            { ref: 't2', title: 'Dark mode', description: 'Toggle tema', ownerId: 'B', files: ['src/ui/theme.css'], queuedFiles: ['src/routes.ts'] },
          ],
        },
      },
    });
    expect(text).toContain('P-5');
    expect(text).toMatch(/Mission Control/);
  });

  it('propose_plan: a 422 conflict is passed on with an instruction to fix and retry', async () => {
    planConflict = true;
    const { text, isError } = await call('propose_plan', {
      goal: 'x',
      reason: 'x',
      tasks: [{ title: 't', description: 'd', owner: 'A', files: ['src/routes.ts'] }],
    });
    expect(isError).toBe(true);
    expect(text).toContain('src/routes.ts ada di files T-1 dan T-2');
    expect(text).toContain('Perbaiki alokasi lalu panggil propose_plan lagi.');
  });

  it('list_requests: one line per request with both tasks, default status terbuka', async () => {
    const { text } = await call('list_requests');
    expect(new URL(seen[0]?.url ?? '', base).searchParams.get('status')).toBe('terbuka');
    const first = text.split('\n')[0] ?? '';
    for (const s of ['R-3', 'B', 'T-2', 'src/checkout/checkout.ts', 'A', 'T-1']) expect(first).toContain(s);
    expect(text).toContain('Tambah kode kupon persen');
    expect(text).toContain('Toggle tema gelap');
  });

  it('propose_decision: sends R3 §4.2 and tells whether it was applied automatically', async () => {
    autoApply = true;
    const { text } = await call('propose_decision', { request_id: 'R-3', option: 'antre', reason: 'T-1 hampir selesai di checkout.ts' });
    expect(seen[0]).toMatchObject({ url: '/v1/proposals', body: { kind: 'decision', payload: { requestId: 'R-3', option: 'antre' }, reason: 'T-1 hampir selesai di checkout.ts' } });
    expect(text).toContain('P-6');
    expect(text).toMatch(/otomatis/);
  });

  it('propose_decision: pecah requires new_task and forwards it as newTask', async () => {
    const missing = await call('propose_decision', { request_id: 'R-3', option: 'pecah', reason: 'x' });
    expect(missing.isError).toBe(true);
    expect(seen).toHaveLength(0);
    const { text } = await call('propose_decision', {
      request_id: 'R-3',
      option: 'pecah',
      reason: 'Rute kupon bisa terpisah',
      new_task: { title: 'Rute kupon', description: 'Tambah /coupon', owner: 'B' },
    });
    expect(seen[0]?.body).toMatchObject({ payload: { option: 'pecah', newTask: { title: 'Rute kupon', description: 'Tambah /coupon', ownerId: 'B' } } });
    expect(text).toMatch(/menunggu/);
  });

  it('get_task_diff: first line names the changed export and its importer with holder (MA-04)', async () => {
    const { text } = await call('get_task_diff', { task_id: 'T-0' });
    expect(seen[0]?.url).toBe('/v1/tasks/T-0/diff');
    const first = text.split('\n')[0] ?? '';
    expect(first).toMatch(/2 file berubah/);
    expect(first).toContain('calculateTotal(items: Item[], shipping: number)');
    expect(first).toContain('src/ui/Header.tsx:14');
    expect(first).toContain('T-2');
  });

  it('get_task_diff: patches are cut to about 8 KB with a hint to use read_file', async () => {
    const { text } = await call('get_task_diff', { task_id: 'T-0' });
    expect(text.length).toBeLessThan(10_000);
    expect(text).toMatch(/read_file/);
  });

  it('propose_review: sends R3 §4.3 with notify + flags mapped to memberId', async () => {
    const { text } = await call('propose_review', {
      task_id: 'T-0',
      verdict: 'setujui_beri_tahu',
      notes: 'calculateTotal() kini menerima parameter ongkir.',
      notify: [{ member: 'B', message: 'Header.tsx baris 14 perlu diperbarui.' }],
      flags: [{ path: 'src/ui/Header.tsx', issue: 'Memanggil calculateTotal() dengan 1 argumen' }],
    });
    expect(seen[0]?.body).toMatchObject({
      kind: 'review',
      payload: {
        taskId: 'T-0',
        verdict: 'setujui_beri_tahu',
        notify: [{ memberId: 'B', message: 'Header.tsx baris 14 perlu diperbarui.' }],
        flags: [{ path: 'src/ui/Header.tsx', issue: 'Memanggil calculateTotal() dengan 1 argumen' }],
      },
    });
    expect(text).toContain('P-7');
  });

  it('propose_review: rejects an unknown verdict', async () => {
    const client = await connect('pm');
    const res = (await client.callTool({ name: 'propose_review', arguments: { task_id: 'T-0', verdict: 'approve', notes: 'x' } })) as { isError?: boolean };
    await client.close();
    expect(res.isError).toBe(true);
  });

  it('notify: POST /v1/notify with memberId, message ≤ 200 chars', async () => {
    const { text } = await call('notify', { member: 'B', message: 'calculateTotal() kini butuh parameter ongkir.' });
    expect(seen[0]).toMatchObject({ url: '/v1/notify', body: { memberId: 'B', message: 'calculateTotal() kini butuh parameter ongkir.' } });
    expect(text).toContain('B');
    const client = await connect('pm');
    const long = (await client.callTool({ name: 'notify', arguments: { member: 'B', message: 'x'.repeat(201) } })) as { isError?: boolean };
    await client.close();
    expect(long.isError).toBe(true);
  });

  it('session_report: says it arrives in fase 12 while the endpoint is missing, returns markdown once it exists', async () => {
    expect((await call('session_report')).text).toContain('fase 12');
    reportMissing = false;
    expect((await call('session_report')).text).toContain('## Laporan sesi');
  });
});
