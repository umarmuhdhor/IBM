import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { HealthRes } from '@radar/common';

describe('Worker entry (R3 §2.1, fase 03 step 2)', () => {
  it('answers GET /healthz itself', async () => {
    const res = await exports.default.fetch('http://localhost/healthz');
    expect(res.status).toBe(200);
    const body = HealthRes.parse(await res.json());
    expect(body).toMatchObject({ ok: true, workspace: 'toko-demo' });
  });

  it('answers the CORS preflight', async () => {
    const res = await exports.default.fetch('http://localhost/v1/state', {
      method: 'OPTIONS',
      headers: { origin: 'http://app.test', 'access-control-request-method': 'GET', 'access-control-request-headers': 'authorization' },
    });
    expect(res.status).toBeLessThan(300);
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('forwards /v1/* to the workspace Durable Object (401 without token, R3 §1 error shape)', async () => {
    const res = await exports.default.fetch('http://localhost/v1/state', { headers: { origin: 'http://app.test' } });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
    expect(res.headers.get('access-control-allow-origin')).toBeTruthy();
  });

  it('forwards the WebSocket upgrade untouched', async () => {
    const res = await exports.default.fetch('http://localhost/ws', { headers: { Upgrade: 'websocket' } });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
    res.webSocket!.accept();
    res.webSocket!.close(1000, 'done');
  });

  it('unknown routes are 404 NOT_FOUND', async () => {
    const res = await exports.default.fetch('http://localhost/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
