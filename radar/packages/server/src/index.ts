import { Hono } from 'hono';

// Worker entry (R1 §2.1). Auth, REST routes, the WorkspaceDO and WebSocket hub land in fase 03.
// `Env` is generated from wrangler.jsonc by `pnpm types` (worker-configuration.d.ts).
const app = new Hono<{ Bindings: Env }>();

app.get('/health', (c) => c.json({ ok: true, service: 'live-collab', codename: 'radar' }));

export default app;
