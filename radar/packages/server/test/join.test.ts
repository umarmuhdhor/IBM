import { exports } from 'cloudflare:workers';
import { runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { AdminJoinCodeRes, decodeInvite, JoinRes, normalizeJoinCode } from '@radar/common';
import { admin, call, freshWorkspace, hello, seedTestWorkspace, sleep } from './helpers';

const stillOpen = (closed: Promise<number>) =>
  Promise.race([closed, sleep(300).then(() => 'open' as const)]);

describe('short join code (IN-03, D-alief-09)', () => {
  it('normalizes typed codes and rejects malformed ones', () => {
    expect(normalizeJoinCode(' k7qm 3xpa ')).toBe('K7QM-3XPA');
    expect(normalizeJoinCode('k7qm-3xpo')).toBe('K7QM-3XP0');
    expect(normalizeJoinCode('K7QM-3XP')).toBeNull();
    expect(normalizeJoinCode('K7QM-3XPU')).toBeNull();
  });

  it('admin creates a code (hash only stored); /v1/join returns an invite with a fresh token and kicks the old device', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const created = await admin(stub, 'POST', '/admin/join-code', { member: 'B' });
    expect(created.status).toBe(201);
    const { code } = AdminJoinCodeRes.parse(created.json);
    expect(code).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    const stored = await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec<{ hash: string }>('SELECT hash FROM join_code').toArray(),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]!.hash).not.toContain(code);

    const old = await hello(stub, t.B!, 'sync');
    const a = await hello(stub, t.A!, 'sync');
    const r = await call(stub, 'POST', '/v1/join', {
      body: { code: code.toLowerCase().replace('-', ' ') },
    });
    expect(r.status).toBe(200);
    const res = JoinRes.parse(r.json);
    expect(res).toMatchObject({ workspace: 'toko-demo', member: 'B', role: 'coder' });
    const inv = decodeInvite(res.invite);
    expect(inv).toMatchObject({ server: 'http://radar.test', workspace: 'toko-demo', member: 'B' });
    expect(await old.closed).toBe(4401);
    expect(await stillOpen(a.closed)).toBe('open');
    expect((await call(stub, 'GET', '/v1/state', { token: inv.token })).status).toBe(200);
    expect((await call(stub, 'GET', '/v1/state', { token: t.B! })).status).toBe(401);

    // reusable until it expires: a second redeem rotates again
    const again = JoinRes.parse((await call(stub, 'POST', '/v1/join', { body: { code } })).json);
    expect((await call(stub, 'GET', '/v1/state', { token: inv.token })).status).toBe(401);
    expect(
      (await call(stub, 'GET', '/v1/state', { token: decodeInvite(again.invite).token })).status,
    ).toBe(200);
  });

  it('wrong, malformed and expired codes are 404; unknown member is 404 at creation', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    expect((await call(stub, 'POST', '/v1/join', { body: { code: 'AAAA-BBBB' } })).status).toBe(
      404,
    );
    expect((await call(stub, 'POST', '/v1/join', { body: { code: 'nope' } })).status).toBe(404);
    expect((await admin(stub, 'POST', '/admin/join-code', { member: 'Z' })).status).toBe(404);
    const { code } = AdminJoinCodeRes.parse(
      (await admin(stub, 'POST', '/admin/join-code', { member: 'C', ttlHours: 1 })).json,
    );
    await runInDurableObject(stub, (_i, st) =>
      st.storage.sql.exec('UPDATE join_code SET expires_at = 0'),
    );
    expect((await call(stub, 'POST', '/v1/join', { body: { code } })).status).toBe(404);
  });

  it('Mission Control makes join codes with its mc token; members cannot', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const r = await call(stub, 'POST', '/v1/join-codes', { token: t.mc!, body: { member: 'C' } });
    expect(r.status).toBe(201);
    const { code } = AdminJoinCodeRes.parse(r.json);
    expect(
      JoinRes.parse((await call(stub, 'POST', '/v1/join', { body: { code } })).json),
    ).toMatchObject({ member: 'C', role: 'pm' });
    expect(
      (await call(stub, 'POST', '/v1/join-codes', { token: t.A!, body: { member: 'B' } })).status,
    ).toBe(403);
    expect((await call(stub, 'POST', '/v1/join-codes', { body: { member: 'B' } })).status).toBe(
      401,
    );
  });

  it('admin/join-code needs the admin secret; /v1/join is rate limited per client IP', async () => {
    const { stub } = freshWorkspace();
    await seedTestWorkspace(stub);
    expect((await admin(stub, 'POST', '/admin/join-code', { member: 'B' }, 'wrong')).status).toBe(
      401,
    );
    const headers = { 'cf-connecting-ip': '203.0.113.9' };
    let last = 0;
    for (let i = 0; i < 61; i++)
      last = (await call(stub, 'POST', '/v1/join', { body: { code: 'AAAA-BBBB' }, headers }))
        .status;
    expect(last).toBe(429);
    expect(
      (
        await call(stub, 'POST', '/v1/join', {
          body: { code: 'AAAA-BBBB' },
          headers: { 'cf-connecting-ip': '203.0.113.10' },
        })
      ).status,
    ).toBe(404);
  });

  it('the Worker serves the join script with the server and code filled in', async () => {
    const res = await exports.default.fetch('http://localhost/j/k7qm-3xpa');
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("SERVER='http://localhost'");
    expect(body).toContain("code='K7QM-3XPA'");
    expect(body.trimEnd().endsWith('main "$@"')).toBe(true);
    const bad = await (await exports.default.fetch('http://localhost/j/zzz')).text();
    expect(bad).toContain('exit 1');
    expect(await (await exports.default.fetch('http://localhost/join.sh')).text()).toContain(
      "code=''",
    );
  });
});
