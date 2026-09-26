// Fase 12 step 9 hardening: body caps (256 KB REST, 1.5 MB WS) and the 60/min rate limit on mc and proposal writes.
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_PER_MINUTE, RateLimiter } from '../src/services/rate-limit';
import { call, freshWorkspace, hello, seedTestWorkspace, sha256Hex } from './helpers';

describe('body size caps', () => {
  it('a REST body over 256 KB is 413 PAYLOAD_TOO_LARGE before it is parsed', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const r = await call(stub, 'POST', '/v1/ai-edits', { token: t.A, raw: JSON.stringify({ paths: ['a'], tool: 'x'.repeat(300 * 1024) }) });
    expect(r.status).toBe(413);
    expect(r.json.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('a WS frame over 1.5 MB gets a PAYLOAD_TOO_LARGE error and the socket stays usable', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    a.send({ t: 'file.update', id: 'big', d: { path: 'src/app.ts', baseVersion: 1, content: 'x'.repeat(1.6 * 1024 * 1024), hash: 'h', clientTs: 0 } });
    const err = await a.next((m) => m.t === 'error');
    expect(err.d.code).toBe('PAYLOAD_TOO_LARGE');
    const content = 'export const a = 2;\n';
    a.send({ t: 'file.update', id: 'small', d: { path: 'src/app.ts', baseVersion: 1, content, hash: await sha256Hex(content), clientTs: 0 } });
    expect((await a.next((m) => m.t === 'file.ack')).d.version).toBe(2);
  });
});

describe('rate limit (60 POST/min per principal)', () => {
  it('the 61st proposal write in a minute is 429 RATE_LIMITED with Retry-After; other tokens and reads are not limited', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i++) {
      const r = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: {} });
      expect(r.status).not.toBe(429);
    }
    const over = await call(stub, 'POST', '/v1/proposals', { token: t.C, body: {} });
    expect(over.status).toBe(429);
    expect(over.json.error.code).toBe('RATE_LIMITED');
    expect(Number(over.headers.get('retry-after'))).toBeGreaterThan(0);
    // Same token on another limited route shares the budget.
    expect((await call(stub, 'POST', '/v1/locks/revoke', { token: t.C, body: {} })).status).toBe(429);
    // A request without a valid token is not counted (the route answers 401).
    expect((await call(stub, 'POST', '/v1/proposals', { body: {} })).status).toBe(401);
    // A different token and a read are unaffected.
    expect((await call(stub, 'POST', '/v1/proposals', { token: t.A, body: {} })).status).not.toBe(429);
    expect((await call(stub, 'GET', '/v1/state', { token: t.C })).status).toBe(200);
  });

  it('the window resets after a minute', () => {
    const rl = new RateLimiter(2);
    expect(rl.hit('k', 0)).toBe(0);
    expect(rl.hit('k', 1000)).toBe(0);
    expect(rl.hit('k', 2000)).toBe(58);
    expect(rl.hit('k', 60_000)).toBe(0);
  });
});
