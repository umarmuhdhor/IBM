import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('@radar/server worker', () => {
  it('answers GET /health', async () => {
    const res = await exports.default.fetch('http://localhost/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: 'live-collab', codename: 'radar' });
  });

  it('returns 404 for unknown routes', async () => {
    const res = await exports.default.fetch('http://localhost/nope');
    expect(res.status).toBe(404);
  });
});
