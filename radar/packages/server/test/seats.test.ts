// Phase 12k bug 5 (D-alief-20): member seats stop piling up. Rejoining with a new open code from the same app keeps
// the seat, and the owner can remove a seat.
import { describe, expect, it } from 'vitest';
import { decodeInvite, JoinMemberRes, OpenWorkspaceRes } from '@radar/common';
import { call, freshWorkspace, hello } from './helpers';

const OWNER = { name: 'Alief', role: 'coder' as const };

async function openWorkspace(stub: DurableObjectStub) {
  return OpenWorkspaceRes.parse(
    (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'seats', owner: OWNER } })).json,
  );
}

async function newCode(stub: DurableObjectStub, mcToken: string): Promise<string> {
  const r = await call(stub, 'POST', '/v1/join-codes', { token: mcToken, body: {} });
  expect(r.status).toBe(201);
  return r.json.code as string;
}

async function join(stub: DurableObjectStub, code: string, name: string, role: 'coder' | 'pm', token?: string) {
  const r = await call(stub, 'POST', '/v1/join', { body: { code, name, role }, ...(token ? { token } : {}) });
  expect(r.status).toBe(200);
  const res = JoinMemberRes.parse(r.json);
  return { ...res, token: decodeInvite(res.invite).token };
}

async function members(stub: DurableObjectStub, mcToken: string) {
  const r = await call(stub, 'GET', '/v1/team', { token: mcToken });
  expect(r.status).toBe(200);
  return (r.json.members as { id: string; name: string; role: string }[]).map(({ id, name, role }) => ({ id, name, role }));
}

describe('rejoining keeps the seat (bug 5)', () => {
  it('a new open code redeemed with the seat token reuses that seat with the new name and role', async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    const first = await join(stub, open.code, 'af', 'pm');
    expect(first.member).toBe('B');

    const again = await join(stub, await newCode(stub, open.mcToken), 'af', 'coder', first.token);
    expect(again).toMatchObject({ member: 'B', role: 'coder' });
    expect(await members(stub, open.mcToken)).toEqual([
      { id: 'A', name: 'Alief', role: 'coder' },
      { id: 'B', name: 'af', role: 'coder' },
    ]);
    // the old token was rotated
    expect((await call(stub, 'GET', '/v1/state', { token: first.token })).status).toBe(401);
    expect((await call(stub, 'GET', '/v1/state', { token: again.token })).status).toBe(200);
  });

  it('without a seat token, or with a token that is not a member seat, a new open code adds a new seat', async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    await join(stub, open.code, 'Budi', 'coder');
    const c = await join(stub, await newCode(stub, open.mcToken), 'Citra', 'pm', open.mcToken);
    expect(c.member).toBe('C');
    // Dewi joins as coder (Citra is already the PM).
    const d = await join(stub, await newCode(stub, open.mcToken), 'Dewi', 'coder', 'rdr_not_a_real_token');
    expect(d.member).toBe('D');
  });
});

describe('rejoining without a token reuses the offline seat (bug reconnect)', () => {
  it("'Dewi' joins as pm; a new open code redeemed by 'dewi' (no token) gets the same seat id, the team still has one member named Dewi, and the role is taken from the new join", async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    const dewi = await join(stub, open.code, 'Dewi', 'pm');
    expect(dewi.member).toBe('B');

    const again = await join(stub, await newCode(stub, open.mcToken), 'dewi', 'coder');
    expect(again.member).toBe('B');
    expect(again.role).toBe('coder');
    const team = await members(stub, open.mcToken);
    expect(team.filter((m) => m.name.toLowerCase() === 'dewi')).toHaveLength(1);
    expect(team).toEqual([
      { id: 'A', name: 'Alief', role: 'coder' },
      { id: 'B', name: 'dewi', role: 'coder' },
    ]);
  });
});

describe('the owner removes a seat (bug 5)', () => {
  it('removes the member: gone from the team, token and socket end with "member removed", used code refused', async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    const b = await join(stub, open.code, 'Budi', 'coder');
    const sock = await hello(stub, b.token, 'sync');
    const mc = await hello(stub, open.mcToken, 'mc');

    const r = await call(stub, 'DELETE', '/v1/members/B', { token: open.mcToken });
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ok: true });
    expect(await members(stub, open.mcToken)).toEqual([{ id: 'A', name: 'Alief', role: 'coder' }]);
    expect(await sock.closed).toBe(4401);
    expect(await sock.reason()).toBe('member removed');
    const ev = await mc.next((m) => m.t === 'event' && m.d?.type === 'member.removed');
    expect(ev.d.payload).toEqual({ memberId: 'B' });

    const state = await call(stub, 'GET', '/v1/state', { token: b.token });
    expect(state.status).toBe(401);
    expect(state.json.error.reason).toBe('removed');
    const again = await call(stub, 'POST', '/v1/join', { body: { code: open.code, name: 'Budi', role: 'coder' } });
    expect(again.status).toBe(404);
    const stateMc = await call(stub, 'GET', '/v1/state', { token: open.mcToken });
    expect(stateMc.json.members.map((m: { id: string }) => m.id)).toEqual(['A']);
  });

  it('cancels the removed coder\'s open tasks, so their locks go to the next in line', async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    await call(stub, 'POST', '/v1/workspace/files', { token: open.mcToken, body: { headCommit: null, files: [{ path: 'a.ts', content: 'x\n' }] } });
    const b = await join(stub, open.code, 'Budi', 'coder');
    const bSock = await hello(stub, b.token, 'sync');
    const check = await call(stub, 'POST', '/v1/locks/check', { token: b.token, body: { paths: ['a.ts'], tool: 'write_to_file', clientTs: Date.now() } });
    expect(check.json.decision).toBe('allow');
    await bSock.ws.close();

    expect((await call(stub, 'DELETE', '/v1/members/B', { token: open.mcToken })).status).toBe(200);
    const team = await call(stub, 'GET', '/v1/team', { token: open.mcToken });
    expect(team.json.locks).toEqual([]);
    expect(team.json.tasks.filter((t: { status: string }) => t.status !== 'batal' && t.status !== 'selesai')).toEqual([]);
  });

  it('only Mission Control removes, never the owner seat, and a removed id may seat a newcomer when all are taken', async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    const b = await join(stub, open.code, 'Budi', 'coder');
    expect((await call(stub, 'DELETE', '/v1/members/B', { token: b.token })).status).toBe(403);
    expect((await call(stub, 'DELETE', '/v1/members/B')).status).toBe(401);
    const owner = await call(stub, 'DELETE', '/v1/members/A', { token: open.mcToken });
    expect(owner.status).toBe(409);
    expect(owner.json.error.message).toBe('Alief shares this workspace, so their seat cannot be removed.');
    expect((await call(stub, 'DELETE', '/v1/members/Z', { token: open.mcToken })).status).toBe(404);
    expect((await call(stub, 'DELETE', '/v1/members/B', { token: open.mcToken })).status).toBe(200);
    expect((await call(stub, 'DELETE', '/v1/members/B', { token: open.mcToken })).status).toBe(404);

    // C fills in as PM; D–H fill the rest as coders; the next newcomer gets the removed B
    await join(stub, await newCode(stub, open.mcToken), 'nC', 'pm');
    for (const name of ['D', 'E', 'F', 'G', 'H']) await join(stub, await newCode(stub, open.mcToken), `n${name}`, 'coder');
    const late = await join(stub, await newCode(stub, open.mcToken), 'Late', 'coder');
    expect(late.member).toBe('B');
    expect((await members(stub, open.mcToken)).find((m) => m.id === 'B')).toEqual({ id: 'B', name: 'Late', role: 'coder' });
    const full = await call(stub, 'POST', '/v1/join', { body: { code: await newCode(stub, open.mcToken), name: 'Nine', role: 'coder' } });
    expect(full.status).toBe(409);
  });
});
