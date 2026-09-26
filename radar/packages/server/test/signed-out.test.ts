// D-alief-15: a token that stopped working says why, so the app can show a friendly state instead of a raw 4401.
import { describe, expect, it } from 'vitest';
import { AdminJoinCodeRes, decodeInvite, JoinOwnerRes, OpenWorkspaceRes } from '@radar/common';
import { admin, call, connect, freshWorkspace, hello } from './helpers';

const OWNER = { name: 'Alief', role: 'coder' as const };

async function rejectedHello(stub: DurableObjectStub, token: string, client: 'sync' | 'mc') {
  const c = await connect(stub);
  c.send({ t: 'hello', d: { token, client, clientVersion: 'test' } });
  return { code: await c.closed, reason: await c.reason() };
}

describe('why a token stopped working (D-alief-15)', () => {
  it('after Stop sharing, old tokens get "workspace closed" and an English 401', async () => {
    const { stub } = freshWorkspace();
    const open = OpenWorkspaceRes.parse(
      (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'one', owner: OWNER } })).json,
    );
    const member = decodeInvite(open.invite).token;
    expect((await call(stub, 'POST', '/v1/workspace/close', { token: open.mcToken })).status).toBe(200);

    expect(await rejectedHello(stub, member, 'sync')).toEqual({ code: 4401, reason: 'workspace closed' });
    const state = await call(stub, 'GET', '/v1/state', { token: member });
    expect(state.status).toBe(401);
    expect(state.json.error).toEqual({
      code: 'UNAUTHORIZED',
      message: 'This workspace is no longer shared. Join with a new code.',
      reason: 'workspace-closed',
    });
  });

  it('when another device takes over as owner, the old owner gets "token rotated" and a signed-out 401', async () => {
    const { stub } = freshWorkspace();
    await admin(stub, 'POST', '/admin/init', { workspace: 'one', members: [] });
    const first = JoinOwnerRes.parse(
      (await call(stub, 'POST', '/v1/join', { body: { code: AdminJoinCodeRes.parse((await admin(stub, 'POST', '/admin/join-code', { owner: true })).json).code } })).json,
    );
    const mc = await hello(stub, first.token, 'mc');
    const { code } = AdminJoinCodeRes.parse((await admin(stub, 'POST', '/admin/join-code', { owner: true })).json);
    expect((await call(stub, 'POST', '/v1/join', { body: { code } })).status).toBe(200);

    expect(await mc.closed).toBe(4401);
    expect(await mc.reason()).toBe('token rotated');
    expect(await rejectedHello(stub, first.token, 'mc')).toEqual({ code: 4401, reason: 'token rotated' });
    const stop = await call(stub, 'POST', '/v1/workspace/close', { token: first.token });
    expect(stop.status).toBe(401);
    expect(stop.json.error.reason).toBe('signed-out');
  });

  it('a live token of the wrong client kind is plain "unauthorized"', async () => {
    const { stub } = freshWorkspace();
    const open = OpenWorkspaceRes.parse(
      (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'one', owner: OWNER } })).json,
    );
    expect(await rejectedHello(stub, open.mcToken, 'sync')).toEqual({ code: 4401, reason: 'unauthorized' });
  });
});
