#!/usr/bin/env node
// Scenario fake of the Radar server for testing the coder kit in Bob IDE before fase 02/03 land (fase 07 step 13).
// Implements only what the coder hooks and radar-mcp call (R3 §2.2–§2.9, §2.24). No dependencies.
// Superseded in fase 10: Bob IDE runs now use the real Worker (plan/log/fase-10-bob.md) and packages/mcp/test/server.int.test.ts.
// Kept only to reproduce the fase 07/08 evidence (bob_sessions task 05–08).
//
// usage: node spike/fake-radar/server.mjs [--port 8787] [--log out/fake-radar.jsonl]
// Scenario: member B (token tok-b) works on T-2 "Dark mode"; src/checkout/checkout.ts and src/routes.ts are held by
// Alice (A) for T-1 "Kupon". Only checkout.ts is announced in the brief.
// PM C (token tok-c) sees the PM endpoints (R3 §2.10–§2.17): one open request R-3, task T-0 "Setup ongkir" in review
// that changes calculateTotal() used by src/ui/Header.tsx (held by B). Proposals are only stored, never applied.
import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] ?? d : d);
const port = Number(opt('--port', '8787'));
const logFile = resolve(opt('--log', new URL('../out/fake-radar.jsonl', import.meta.url).pathname));
mkdirSync(dirname(logFile), { recursive: true });

const HELD = { path: 'src/checkout/checkout.ts', holder: { memberId: 'A', memberName: 'Alice', taskId: 'T-1', taskTitle: 'Kupon', state: 'dipegang' } };
// Held by Alice too, but not mentioned in the brief or my_tasks: Bob only learns about it from the hook (BC-04 path).
const HIDDEN = 'src/routes.ts';
const isHeld = (path) => path === HELD.path || path === HIDDEN;
const MINE = ['src/ui/theme.css', 'src/ui/Header.tsx'];
const proposals = [];
const notifications = [];
const state = { eventId: 10, lastBlock: null, blockEventId: 0, submitted: false, touched: new Set() };

const blockMessage = (path) =>
  `RADAR: ${path} sedang dipegang Bob milik Alice (T-1 Kupon). Edit dibatalkan. Jangan coba ulang dan jangan ubah lewat shell. ` +
  'Panggil radar why_blocked, beri tahu user, lalu kerjakan bagian lain dari task T-2.';

function routes(method, url, body) {
  const u = new URL(url, 'http://x');
  const p = u.pathname;
  if (method === 'POST' && p === '/v1/locks/check') {
    const paths = body?.paths ?? [];
    const results = paths.map((path) =>
      isHeld(path)
        ? { path, decision: 'block', reason: 'held_by_other', holder: HELD.holder, requestId: 'R-3', queuePos: 1 }
        : { path, decision: 'allow', reason: MINE.includes(path) ? 'own' : 'grabbed', holder: null },
    );
    const blocked = results.find((r) => r.decision === 'block');
    for (const r of results) if (r.decision === 'allow') state.touched.add(r.path);
    if (blocked) {
      state.lastBlock = { path: blocked.path, ts: Date.now() };
      state.blockEventId = ++state.eventId;
    }
    return [200, { decision: blocked ? 'block' : 'allow', results, activeTaskId: 'T-2', message: blocked ? blockMessage(blocked.path) : '', serverMs: 1 }];
  }
  if (method === 'GET' && p === '/v1/brief') {
    const kind = u.searchParams.get('kind');
    if (kind === 'start') {
      return [200, { cursor: state.eventId, lines: [
        '[Radar] Kamu B (coder). Task aktif: T-2 Dark mode (dikerjakan).',
        '[Radar] File kamu: src/ui/theme.css, src/ui/Header.tsx',
        '[Radar] Dipegang orang lain: src/checkout/checkout.ts→A(T-1)',
        '[Radar] Jangan edit file milik orang lain. Kalau ditolak: radar why_blocked.',
      ] }];
    }
    const since = Number(u.searchParams.get('since') ?? 0);
    const lines = [];
    // MA-05: notifications from the PM (POST /v1/notify, token tok-c) reach B in the next prompt brief
    for (const n of notifications.splice(0)) if (n?.memberId === 'B') lines.push(`[Radar] Catatan PM: ${n.message}`);
    if (state.lastBlock && state.blockEventId > since) {
      lines.push(`[Radar] Edit ${state.lastBlock.path} DITOLAK: dipegang Alice (T-1). Jangan coba ulang, jangan lewat shell. Lanjutkan src/ui/Header.tsx.`);
      lines.push('[Radar] Task aktif: T-2 Dark mode (dikerjakan).');
    }
    return [200, { cursor: state.eventId, lines }];
  }
  if (method === 'GET' && p === '/v1/tasks') {
    return [200, { activeTaskId: 'T-2', tasks: [{
      id: 'T-2', title: 'Dark mode', description: 'Tambah tema gelap di src/ui/theme.css dan tombol toggle di src/ui/Header.tsx.',
      ownerId: 'B', status: 'dikerjakan', adhoc: false, baseCommit: '3f9a2c1', editCount: state.touched.size,
      files: [
        { path: 'src/ui/theme.css', lock: 'dipegang', queuePos: 0 },
        { path: 'src/ui/Header.tsx', lock: 'dipesan', queuePos: 0 },
        { path: 'src/checkout/checkout.ts', lock: null, queuePos: 1, waitingFor: 'T-1' },
      ],
    }] }];
  }
  if (method === 'GET' && p === '/v1/blocks/last') {
    if (!state.lastBlock) return [200, { block: null }];
    return [200, { block: {
      path: state.lastBlock.path, ts: state.lastBlock.ts, via: 'hook',
      holder: { ...HELD.holder, sinceMs: 7 * 60_000 }, requestId: 'R-3', requestStatus: 'terbuka',
      queue: [{ taskId: 'T-1', memberId: 'A' }, { taskId: 'T-2', memberId: 'B' }],
      suggestion: 'File ini milik T-1. Permintaanmu R-3 sudah masuk antrean PM. Lanjutkan file lain di task T-2: src/ui/Header.tsx.',
    } }];
  }
  if (method === 'POST' && p === '/v1/requests') {
    if (!isHeld(body?.path)) return [200, { requestId: null, status: 'bebas', message: 'File bebas, langsung edit saja.' }];
    return [201, { requestId: 'R-3', status: 'terbuka', duplicate: true }];
  }
  if (method === 'GET' && p === '/v1/activity') {
    return [200, { items: [{ ts: Date.now() - 60_000, actor: 'A', type: 'file.changed', path: HELD.path, summary: 'A mengubah checkout.ts (v9, T-1)' }] }];
  }
  const submit = p.match(/^\/v1\/tasks\/([^/]+)\/submit$/);
  if (method === 'POST' && submit) {
    if (decodeURIComponent(submit[1]) !== 'T-2') return [403, { error: { code: 'forbidden', message: 'Task ini bukan milikmu.' } }];
    state.submitted = true;
    return [200, { taskId: 'T-2', status: 'review', files: MINE }];
  }
  if (method === 'POST' && (p === '/v1/bob/activity' || p === '/v1/ai-edits')) return [204, undefined];
  return [404, { error: { code: 'not_found', message: `${method} ${p}` } }];
}

const TASK_T0_PATCH = [
  '--- a/src/checkout/checkout.ts',
  '+++ b/src/checkout/checkout.ts',
  '@@ -1,4 +1,4 @@',
  ' // Checkout total for the demo shop (synthetic data).',
  '-export function calculateTotal(items: { price: number; qty: number }[]): number {',
  '-  return items.reduce((sum, i) => sum + i.price * i.qty, 0);',
  '+export function calculateTotal(items: { price: number; qty: number }[], shipping: number): number {',
  '+  return items.reduce((sum, i) => sum + i.price * i.qty, 0) + shipping;',
  ' }',
].join('\n');

function pmRoutes(method, url, body) {
  const u = new URL(url, 'http://x');
  const p = u.pathname;
  if (method === 'GET' && p === '/v1/brief') {
    return [200, { cursor: state.eventId, lines: u.searchParams.get('kind') === 'start'
      ? ['[Radar] Kamu C (pm). 1 permintaan terbuka (R-3), 1 task menunggu review (T-0).', '[Radar] Semua usulanmu menunggu persetujuan di Mission Control.']
      : [] }];
  }
  if (method === 'GET' && p === '/v1/team') {
    return [200, {
      members: [
        { id: 'A', name: 'Alice', role: 'coder', online: true, lastHeartbeatMs: 3200, activeTaskId: 'T-1' },
        { id: 'B', name: 'Budi', role: 'coder', online: true, lastHeartbeatMs: 5100, activeTaskId: 'T-2' },
      ],
      tasks: [
        { id: 'T-0', title: 'Setup ongkir', ownerId: 'A', status: 'review', files: ['src/checkout/checkout.ts'], editCount: 4 },
        { id: 'T-1', title: 'Kupon', ownerId: 'A', status: 'dikerjakan', files: ['src/checkout/checkout.ts', 'src/routes.ts'], editCount: 14 },
        { id: 'T-2', title: 'Dark mode', ownerId: 'B', status: 'dikerjakan', files: ['src/ui/theme.css', 'src/ui/Header.tsx'], editCount: 3 },
      ],
      locks: [
        { path: 'src/checkout/checkout.ts', taskId: 'T-1', memberId: 'A', state: 'dipegang', queue: ['T-2'] },
        { path: 'src/ui/Header.tsx', taskId: 'T-2', memberId: 'B', state: 'dipegang', queue: [] },
      ],
      openRequests: 1, pendingProposals: proposals.filter((x) => x.status === 'menunggu').length, headCommit: '3f9a2c1',
    }];
  }
  if (method === 'GET' && p === '/v1/requests') {
    return [200, { requests: [{
      id: 'R-3', path: 'src/checkout/checkout.ts', status: 'terbuka', source: 'hook', reason: '',
      requester: { memberId: 'B', taskId: 'T-2', taskTitle: 'Dark mode', taskDescription: 'Tambah tema gelap di theme.css dan tampilkan total keranjang di Header.tsx; butuh sedikit format angka di checkout.ts.' },
      holder: { memberId: 'A', taskId: 'T-1', taskTitle: 'Kupon', taskDescription: 'Tambah kode kupon persen di checkout.ts dan rute /coupon.', state: 'dipegang', editCount: 14 },
      fileVersion: 9, createdAt: Date.now() - 120_000,
    }] }];
  }
  if (method === 'POST' && p === '/v1/proposals') {
    if (body?.kind === 'plan') {
      const seenFiles = new Map();
      for (const t of body.payload?.tasks ?? []) {
        for (const f of t.files ?? []) {
          if (seenFiles.has(f)) return [422, { error: { code: 'plan_conflict', message: `${f} ada di files ${seenFiles.get(f)} dan ${t.ref}. Taruh di queuedFiles salah satu task.` } }];
          seenFiles.set(f, t.ref);
        }
      }
    }
    const id = `P-${proposals.length + 5}`;
    const status = body?.kind === 'decision' && body?.payload?.option === 'antre' ? 'diterapkan_otomatis' : 'menunggu';
    proposals.push({ id, kind: body?.kind, status, payload: body?.payload, reason: body?.reason, createdAt: Date.now() });
    return [201, { proposalId: id, status }];
  }
  if (method === 'GET' && p === '/v1/proposals') return [200, { proposals }];
  if (method === 'POST' && /^\/v1\/proposals\/[^/]+\/decision$/.test(p)) return [403, { error: { code: 'forbidden', message: 'Hanya Mission Control (token mc) yang bisa memutuskan usulan.' } }];
  if (method === 'GET' && p === '/v1/tasks/T-0/diff') {
    return [200, {
      taskId: 'T-0', title: 'Setup ongkir', ownerId: 'A', status: 'review', baseCommit: '3f9a2c1', summary: 'Tambah parameter ongkir ke calculateTotal',
      files: [{ path: 'src/checkout/checkout.ts', change: 'modified', fromVersion: 3, toVersion: 12, patch: TASK_T0_PATCH,
        exportsChanged: [{ name: 'calculateTotal', kind: 'function', before: 'calculateTotal(items)', after: 'calculateTotal(items, shipping: number)' }] }],
      importers: [{ path: 'src/ui/Header.tsx', imports: 'src/checkout/checkout.ts', symbols: ['calculateTotal'], lines: [2, 5], holder: { memberId: 'B', taskId: 'T-2', state: 'dipegang' } }],
      truncated: false,
    }];
  }
  if (method === 'POST' && p === '/v1/notify') {
    notifications.push(body);
    return [201, { notificationId: 16 + notifications.length }];
  }
  if (method === 'GET' && p === '/v1/report/session') return [404, { error: { code: 'not_found', message: 'fase 12' } }];
  if (method === 'POST' && p === '/v1/bob/activity') return [204, undefined];
  if (method === 'POST' && p === '/v1/locks/check') {
    const paths = body?.paths ?? [];
    return [200, { decision: 'block', results: paths.map((path) => ({ path, decision: 'block', reason: 'pm_readonly' })), activeTaskId: null, message: 'RADAR: PM tidak menulis file.', serverMs: 1 }];
  }
  return [404, { error: { code: 'not_found', message: `${method} ${p}` } }];
}

createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    let body;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      body = undefined;
    }
    const auth = req.headers.authorization;
    const [status, json] =
      auth === 'Bearer tok-b' ? routes(req.method, req.url, body)
      : auth === 'Bearer tok-c' ? pmRoutes(req.method, req.url, body)
      : [401, { error: { code: 'unauthorized', message: 'token' } }];
    appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), method: req.method, url: req.url, body, status })}\n`);
    console.log(`${new Date().toISOString().slice(11, 19)} ${auth === 'Bearer tok-c' ? 'C' : 'B'} ${req.method} ${req.url} → ${status}${body?.kind ? ` ${body.kind}` : ''}${body?.tool ? ` ${body.tool}` : ''}`);
    res.statusCode = status;
    if (json !== undefined) res.setHeader('content-type', 'application/json');
    res.end(json === undefined ? undefined : JSON.stringify(json));
  });
}).listen(port, '127.0.0.1', () => console.log(`fake-radar on http://127.0.0.1:${port} (log ${logFile})`));
