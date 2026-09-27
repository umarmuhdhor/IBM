// Phase 12k bug 5 (D-alief-20): member seats stop piling up. Rejoining with a new open code from the same app keeps
// the seat, and the owner can remove a seat.
import { describe, expect, it } from 'vitest';
import { decodeInvite, JoinMemberRes, OpenWorkspaceRes } from '@radar/common';
import { call, freshWorkspace } from './helpers';

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
    const d = await join(stub, await newCode(stub, open.mcToken), 'Dewi', 'pm', 'rdr_not_a_real_token');
    expect(d.member).toBe('D');
  });
});
