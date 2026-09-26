// Worker entry (R1 §2.1, fase 03 step 2): answers /healthz and CORS itself and forwards everything else to the
// workspace Durable Object. No state and no heavy work here (10 ms CPU per request on the Free plan).
import { normalizeJoinCode, type HealthRes } from '@radar/common';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { joinScript } from './join-script';
import { SERVER_VERSION } from './version';

export { WorkspaceDO } from './workspace-do';

// Date.now() is frozen at 0 during global scope in Workers, so the start time is taken on the first request.
let startedAt: number | null = null;

const app = new Hono<{ Bindings: Env }>();

const forward = (req: Request, env: Env) => env.WORKSPACE.getByName(env.WORKSPACE_ID).fetch(req);

// Registered before the CORS middleware so the 101 response (and its webSocket) is returned untouched.
app.get('/ws', (c) => forward(c.req.raw, c.env));

app.use('*', async (c, next) => {
  const origins = c.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean);
  const origin = origins.length === 0 || origins.includes('*') ? '*' : origins;
  return cors({ origin, allowHeaders: ['authorization', 'content-type'], allowMethods: ['GET', 'POST', 'OPTIONS'], maxAge: 600 })(c, next);
});

app.get('/healthz', (c) => {
  startedAt ??= Date.now();
  const body: HealthRes = { ok: true, workspace: c.env.WORKSPACE_ID, version: SERVER_VERSION, uptimeMs: Date.now() - startedAt };
  return c.json(body);
});

// IN-03 one-command join (D-alief-09): `curl -fsSL <server>/j/<code> | sh`, or `…/join.sh | sh -s <code>`.
// The CLI tarball it installs is a static asset (public/radar-cli.tgz, built by `pnpm deploy`).
const script = (body: string) => new Response(body, { headers: { 'content-type': 'text/x-shellscript; charset=utf-8', 'cache-control': 'no-store' } });
app.get('/join.sh', (c) => script(joinScript(new URL(c.req.url).origin, '')));
app.get('/j/:code', (c) => {
  const code = normalizeJoinCode(c.req.param('code'));
  if (code === null) return script(`#!/bin/sh\necho 'Kode gabung tidak valid. Contoh: K7QM-3XPA' >&2\nexit 1\n`);
  return script(joinScript(new URL(c.req.url).origin, code));
});

app.all('*', async (c) => {
  const res = await forward(c.req.raw, c.env);
  // Copy so the CORS middleware can add headers (responses from a stub are immutable).
  return new Response(res.body, res);
});

export default app;
