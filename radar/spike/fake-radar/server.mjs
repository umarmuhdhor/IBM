#!/usr/bin/env node
// Scenario fake of the Radar server for testing the coder kit in Bob IDE before fase 02/03 land (fase 07 step 13).
// Implements only what the coder hooks and radar-mcp call (R3 §2.2–§2.9, §2.24). No dependencies.
// TODO(sync:alief): replace with `pnpm -C radar dev:mock` (fase 02) or the real Worker (fase 03) in fase 10.
//
// usage: node spike/fake-radar/server.mjs [--port 8787] [--log out/fake-radar.jsonl]
// Scenario: member B (token tok-b) works on T-2 "Dark mode"; src/checkout/checkout.ts and src/routes.ts are held by
// Alice (A) for T-1 "Kupon". Only checkout.ts is announced in the brief.
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
    const auth = req.headers.authorization === 'Bearer tok-b';
    const [status, json] = auth ? routes(req.method, req.url, body) : [401, { error: { code: 'unauthorized', message: 'token' } }];
    appendFileSync(logFile, `${JSON.stringify({ t: Date.now(), method: req.method, url: req.url, body, status })}\n`);
    console.log(`${new Date().toISOString().slice(11, 19)} ${req.method} ${req.url} → ${status}${body?.kind ? ` ${body.kind}` : ''}${body?.tool ? ` ${body.tool}` : ''}`);
    res.statusCode = status;
    if (json !== undefined) res.setHeader('content-type', 'application/json');
    res.end(json === undefined ? undefined : JSON.stringify(json));
  });
}).listen(port, '127.0.0.1', () => console.log(`fake-radar on http://127.0.0.1:${port} (log ${logFile})`));
