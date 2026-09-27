// Phase 12k bug 6 (D-alief-21): the member who shared the folder takes back Mission Control without the CLI, when the
// device that took over as owner is gone. The owner code comes only to that seat's token and expires fast.
import { describe, expect, it } from 'vitest';
import { AdminJoinCodeRes, decodeInvite, JoinMemberRes, JoinOwnerRes, OWNER_RECLAIM_TTL_MS, OpenWorkspaceRes } from '@radar/common';
import { admin, call, freshWorkspace, hello } from './helpers';

const OWNER = { name: 'Alief', role: 'coder' as const };

async function setup() {
  const { stub } = freshWorkspace();
  const open = OpenWorkspaceRes.parse(
    (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'reclaim', owner: OWNER } })).json,
  );
  const ownerSeat = decodeInvite(open.invite).token;
  const b = JoinMemberRes.parse((await call(stub, 'POST', '/v1/join', { body: { code: open.code, name: 'Budi', role: 'coder' } })).json);
  return { stub, open, ownerSeat, bToken: decodeInvite(b.invite).token };
}

describe('the owner takes back Mission Control (bug 6)', () => {
  it('the owner seat gets a short-lived owner code; redeeming it gives a working mc token and ends the old one', async () => {
    const { stub, open, ownerSeat } = await setup();
    const before = Date.now();
    const r = await call(stub, 'POST', '/v1/owner/reclaim', { token: ownerSeat });
    expect(r.status).toBe(201);
    const res = AdminJoinCodeRes.parse(r.json);
    expect(res).toMatchObject({ member: null, owner: true });
    expect(res.expiresAt).toBeLessThanOrEqual(Date.now() + OWNER_RECLAIM_TTL_MS);
    expect(res.expiresAt).toBeGreaterThan(before);

    const joined = JoinOwnerRes.parse((await call(stub, 'POST', '/v1/join', { body: { code: res.code } })).json);
    expect((await call(stub, 'GET', '/v1/team', { token: joined.token })).status).toBe(200);
    const old = await call(stub, 'GET', '/v1/team', { token: open.mcToken });
    expect(old.status).toBe(401);
    expect(old.json.error.reason).toBe('signed-out');
  });

  it('refuses other seats, Mission Control and no token', async () => {
    const { stub, open, bToken } = await setup();
    const other = await call(stub, 'POST', '/v1/owner/reclaim', { token: bToken });
    expect(other.status).toBe(403);
    expect(other.json.error.message).toBe('Only Alief, who shared this workspace, can take back ownership.');
    expect((await call(stub, 'POST', '/v1/owner/reclaim', { token: open.mcToken })).status).toBe(403);
    expect((await call(stub, 'POST', '/v1/owner/reclaim')).status).toBe(401);
  });

  it('refuses while a Mission Control app is connected, so it cannot take over a live owner', async () => {
    const { stub, open, ownerSeat } = await setup();
    const mc = await hello(stub, open.mcToken, 'mc');
    const r = await call(stub, 'POST', '/v1/owner/reclaim', { token: ownerSeat });
    expect(r.status).toBe(409);
    expect(r.json.error.message).toBe('Mission Control is open on another device. Take back ownership there, or close it first.');
    mc.ws.close();
  });

  it('a workspace made with admin init has no owner seat, so nobody can reclaim it', async () => {
    const { stub } = freshWorkspace();
    const init = await admin(stub, 'POST', '/admin/init', { workspace: 'w', branch: 'main', members: [{ id: 'A', role: 'coder', name: 'Andi', email: 'a@x.com' }] });
    const r = await call(stub, 'POST', '/v1/owner/reclaim', { token: init.json.tokens.A });
    expect(r.status).toBe(403);
  });

  it('limits attempts per seat', async () => {
    const { stub, ownerSeat } = await setup();
    let last = 0;
    for (let i = 0; i < 6; i++) last = (await call(stub, 'POST', '/v1/owner/reclaim', { token: ownerSeat })).status;
    expect(last).toBe(429);
  });
});
