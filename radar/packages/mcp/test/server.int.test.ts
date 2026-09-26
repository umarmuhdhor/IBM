// Integration (fase 10, lane Bob): the Bob kit against the REAL Worker + Durable Object (fase 03–05), not the mock.
// The bundled hooks run as child processes (like Bob IDE does) and radar-mcp tools run over MCP with real HTTP.
// The story follows PRD §15: plan → block → why_blocked → request → decision → notify → submit → review → approve.
// get_task_diff and the GitHub commit need fase 06 and are covered against the mock (mock_contract.test.ts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { LocalConfig } from '@radar/common/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness } from 'wrangler';
import { SyncAgent } from '../../sync/src/agent.js';
import { bundleHooks, makeWorkspace, prePayload, runHook, type HookName } from '../../hooks/test/helpers.js';
import { createRadarClient } from '../src/client.js';
import { createRadarServer } from '../src/server.js';

const ADMIN_SECRET = 'test';
const SERVER_CONFIG = join(import.meta.dirname, '../../server/wrangler.jsonc');

const CHECKOUT = 'src/checkout/checkout.ts';
const COUPON = 'src/checkout/coupon.ts';
const ROUTES = 'src/routes.ts';
const THEME = 'src/ui/theme.css';
const HEADER = 'src/ui/Header.tsx';
const FILES = [CHECKOUT, COUPON, ROUTES, THEME, HEADER, 'src/utils.ts'];

type Member = 'A' | 'B' | 'C';
const ROLE: Record<Member, 'coder' | 'pm'> = { A: 'coder', B: 'coder', C: 'pm' };

let harness: ReturnType<typeof createTestHarness>;
let url: string;
let tokens: Record<string, string>;
let bundles: Record<HookName, string>;
const roots = {} as Record<Member, string>;
const agents: SyncAgent[] = [];

beforeAll(async () => {
  harness = createTestHarness({
    workers: [{ configPath: SERVER_CONFIG, vars: { GITHUB_COMMIT: 'false' }, secrets: { ADMIN_SECRET } }],
  });
  const [listening, hooks] = await Promise.all([harness.listen(), bundleHooks()]);
  url = listening.url.origin;
  bundles = hooks;

  const headers = { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET };
  const members = [
    { id: 'A', role: 'coder', name: 'Andi' },
    { id: 'B', role: 'coder', name: 'Budi' },
    { id: 'C', role: 'pm', name: 'Citra' },
  ];
  const init = await fetch(`${url}/admin/init`, { method: 'POST', headers, body: JSON.stringify({ workspace: 'toko-demo', members, force: true }) });
  if (init.status !== 201) throw new Error(`init failed: ${init.status} ${await init.text()}`);
  tokens = ((await init.json()) as { tokens: Record<string, string> }).tokens;
  // Fail here with a clear message instead of an opaque 401 later if the init shape drifts.
  for (const id of ['A', 'B', 'C', 'mc']) if (!tokens[id]) throw new Error(`init returned no token for ${id}`);
  const files = FILES.map((path) => ({ path, content: `// ${path}\n` }));
  const seeded = await fetch(`${url}/admin/files`, { method: 'POST', headers, body: JSON.stringify({ headCommit: null, files }) });
  if (seeded.status !== 200) throw new Error(`files failed: ${seeded.status} ${await seeded.text()}`);

  for (const m of ['A', 'B', 'C'] as const) {
    roots[m] = makeWorkspace({ server: url, workspace: 'toko-demo', member: m, token: tokens[m], role: ROLE[m], shareprompts: false });
  }
  // The coders run the real sync agent (fase 04): Bob writes to disk, the agent sends the file.update.
  for (const m of ['A', 'B'] as const) {
    const agent = new SyncAgent({ root: roots[m], server: url, token: tokens[m]!, member: m, log: () => {}, notify: () => {}, ...FAST });
    agents.push(agent);
    await agent.start();
  }
}, 90_000);

afterAll(async () => {
  // allSettled: a beforeAll that failed halfway still closes whatever it started (agents, then the Worker).
  await Promise.allSettled(agents.map((a) => a.stop()));
  await harness?.close();
});

const FAST = { heartbeatMs: 60_000, pingMs: 60_000, reconnect: { minMs: 50, maxMs: 200 } } as const;

const readWs = (m: Member, path: string) => (existsSync(join(roots[m], path)) ? readFileSync(join(roots[m], path), 'utf8') : null);

async function waitFor(fn: () => boolean, what: string, timeoutMs = 10_000): Promise<void> {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout: ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** A Bob write: the PreToolUse hook first; on exit 0 the file is written and the sync agent sends it. */
async function bobWrite(m: Member, path: string, content: string) {
  const r = await edit(m, path);
  if (r.code === 0) writeFileSync(join(roots[m], path), content);
  return r;
}

const cfg = (m: Member): LocalConfig => ({
  root: roots[m],
  server: url,
  workspace: 'toko-demo',
  member: m,
  token: tokens[m]!,
  role: ROLE[m],
  shareprompts: false,
});

async function tool(m: Member, name: string, args: Record<string, unknown> = {}) {
  const c = cfg(m);
  const server = createRadarServer(createRadarClient(c, 5_000), c.role);
  const client = new Client({ name: 'int', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const res = (await client.callTool({ name, arguments: args })) as { content: { text: string }[]; isError?: boolean };
  await client.close();
  return { text: res.content.map((x) => x.text).join('\n'), isError: res.isError === true };
}

async function rest(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${url}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} };
}

/** Mission Control approves a proposal (the PM human clicks Setujui). */
async function approve(proposalId: string) {
  const r = await rest(tokens.mc!, 'POST', `/v1/proposals/${proposalId}/decision`, { approve: true });
  expect(r.status, JSON.stringify(r.json)).toBe(200);
}

const proposalId = (text: string) => {
  const id = /\bP-\d+\b/.exec(text)?.[0];
  if (!id) throw new Error(`no proposal id in: ${text}`);
  return id;
};

const hook = (m: Member, name: HookName, args: string[], payload: unknown) => runHook(bundles[name], args, payload, {}, roots[m]);
const edit = (m: Member, path: string) => hook(m, 'lock_guard', [], prePayload(roots[m], path));
const briefPrompt = (m: Member) =>
  hook(m, 'brief', ['prompt'], { session_id: 's1', cwd: roots[m], hook_event_name: 'UserPromptSubmit', prompt: 'lanjut' });
const hookLog = (m: Member) => {
  const f = join(roots[m], '.radar', 'hook.log');
  return existsSync(f) ? readFileSync(f, 'utf8') : '';
};

describe('Bob kit against the real server (PRD §15 up to review)', () => {
  it('runs plan → block → decision → notify → submit → review', async () => {
    // 1. PM main agent proposes the plan; Mission Control approves → tasks + reserved locks.
    const plan = await tool('C', 'propose_plan', {
      goal: 'Tambah fitur kupon dan dark mode',
      reason: 'Dua fitur independen bisa jalan paralel.',
      tasks: [
        { title: 'Kupon', description: 'Kupon diskon di checkout', owner: 'A', files: [CHECKOUT, COUPON, ROUTES] },
        { title: 'Dark mode', description: 'Tema gelap', owner: 'B', files: [THEME, HEADER], queued_files: [ROUTES] },
      ],
    });
    expect(plan.isError, plan.text).toBe(false);
    await approve(proposalId(plan.text));

    const tasksB = await tool('B', 'my_tasks');
    expect(tasksB.isError, tasksB.text).toBe(false);
    expect(tasksB.text).toContain('Dark mode');

    const status = await tool('C', 'team_status');
    expect(status.isError, status.text).toBe(false);
    for (const s of ['Andi', 'Budi', 'Kupon', 'Dark mode']) expect(status.text).toContain(s);

    // 2. Live: A and B edit their own files (the first edit takes the lock); the other folder follows.
    const checkoutA = 'export const calculateTotal = (items: number[], shipping: number) => 0;\n';
    expect((await bobWrite('A', CHECKOUT, checkoutA)).code).toBe(0);
    expect((await bobWrite('B', THEME, ':root { --bg: #111; }\n')).code).toBe(0);
    await waitFor(() => readWs('B', CHECKOUT) === checkoutA, 'checkout.ts from A reaches B');
    await waitFor(() => readWs('A', THEME) === ':root { --bg: #111; }\n', 'theme.css from B reaches A');

    // 3. B tries A's file: exit 2 with the server message on stderr, file stays untouched (Bob IDE aborts the tool).
    const blocked = await bobWrite('B', CHECKOUT, 'overwrite');
    expect(blocked.code).toBe(2);
    expect(readWs('B', CHECKOUT)).toBe(checkoutA);
    expect(blocked.stderr).toContain(CHECKOUT);
    expect(blocked.stderr).toContain('Andi');

    const why = await tool('B', 'why_blocked');
    expect(why.isError, why.text).toBe(false);
    expect(why.text).toContain(CHECKOUT);
    expect(why.text).toContain('Andi');

    // 4. The block becomes a request the PM agent sees; "antre" is applied automatically (R4, fase 10 sim step 5).
    const requests = await tool('C', 'list_requests');
    expect(requests.isError, requests.text).toBe(false);
    expect(requests.text).toContain(CHECKOUT);
    const requestId = /\bR-\d+\b/.exec(requests.text)?.[0];
    expect(requestId, requests.text).toBeDefined();

    const decision = await tool('C', 'propose_decision', {
      request_id: requestId,
      option: 'antre',
      reason: `B antre ${CHECKOUT} setelah task Kupon selesai.`,
    });
    expect(decision.isError, decision.text).toBe(false);
    expect(decision.text).toContain('diterapkan otomatis');

    // 6. The PM agent notifies B; B's next prompt brief carries the decision and the notification.
    const note = await tool('C', 'notify', { member: 'B', message: 'calculateTotal() kini butuh parameter ongkir.' });
    expect(note.isError, note.text).toBe(false);
    const brief = await briefPrompt('B');
    expect(brief.code).toBe(0);
    expect(brief.stdout).toContain('calculateTotal');

    // 7. A submits T-1; the PM agent proposes the review with a notification for B.
    const tasksA = await tool('A', 'my_tasks');
    const taskA = /\bT-\d+\b/.exec(tasksA.text)?.[0];
    expect(taskA, tasksA.text).toBeDefined();
    const submitted = await tool('A', 'submit_task', { task_id: taskA, summary: 'Kupon diskon di checkout selesai.' });
    expect(submitted.isError, submitted.text).toBe(false);

    const review = await tool('C', 'propose_review', {
      task_id: taskA,
      verdict: 'setujui_beri_tahu',
      notes: 'Signature calculateTotal berubah, Header.tsx milik B ikut terdampak.',
      notify: [{ member: 'B', message: 'calculateTotal(items, shipping) berubah.' }],
    });
    expect(review.isError, review.text).toBe(false);
    const reviewId = proposalId(review.text);

    // 8. The PM token cannot decide proposals (MA-07: only Mission Control approves), then Mission Control does.
    const denied = await rest(tokens.C!, 'POST', `/v1/proposals/${reviewId}/decision`, { approve: true });
    expect(denied.status).toBe(403);
    await approve(reviewId);
    const afterReview = await briefPrompt('B');
    expect(afterReview.stdout).toContain('calculateTotal(items, shipping)');
  }, 60_000);

  it('activity hooks reach the server and show up in team_activity (JT-01)', async () => {
    const post = { ...prePayload(roots.B, THEME), hook_event_name: 'PostToolUse', tool_response: 'ok' };
    expect((await hook('B', 'mark_ai_edit', [], post)).code).toBe(0);
    expect((await hook('B', 'stop', [], { session_id: 's1', cwd: roots.B, hook_event_name: 'Stop' })).code).toBe(0);
    // POST /v1/ai-edits is P1 (fase 12, BC-05): until it lands only that call may be logged as not sent.
    const lines = hookLog('B').split('\n');
    // …and only because the route is missing (404), not for any other reason.
    for (const l of lines.filter((x) => x.includes('ai-edits not sent'))) expect(l).toContain('404');
    expect(lines.filter((l) => !l.includes('ai-edits not sent')).join('\n')).not.toMatch(/not sent|config invalid/);

    // bob.activity goes to app/mc sockets (JT-01), not to /v1/activity; team_activity still reads the team feed.
    const act = await tool('A', 'team_activity');
    expect(act.isError, act.text).toBe(false);
    expect(act.text).toContain('T-1: review → selesai');
  });

  it('brief start names the member and the active task (T-1 is done, B still has Dark mode)', async () => {
    const r = await hook('B', 'brief', ['start'], { session_id: 's2', cwd: roots.B, hook_event_name: 'SessionStart', source: 'startup' });
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('Kamu B');
    expect(r.stdout).toContain('Dark mode');
  });
});
