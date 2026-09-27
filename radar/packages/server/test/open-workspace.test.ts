import { describe, expect, it } from 'vitest';
import { decodeInvite, JoinMemberRes, OpenWorkspaceRes } from '@radar/common';
import { call, freshWorkspace, hello } from './helpers';

const OWNER = { name: 'Alief', role: 'coder' as const };

describe('open a folder as the workspace from the app (D-alief-12)', () => {
  it('an empty server lets the owner start it: member A, an mc token and an open code', async () => {
    const { stub } = freshWorkspace();
    const r = await call(stub, 'POST', '/v1/workspace/open', {
      body: { workspace: 'my-app', owner: OWNER },
    });
    expect(r.status).toBe(201);
    const res = OpenWorkspaceRes.parse(r.json);
    expect(res).toMatchObject({ workspace: 'my-app', member: 'A' });
    expect(decodeInvite(res.invite)).toMatchObject({ workspace: 'my-app', member: 'A' });

    const state = await call(stub, 'GET', '/v1/state', { token: res.mcToken });
    expect(state.status).toBe(200);
    expect(state.json.workspace.name).toBe('my-app');
    expect(state.json.members).toEqual([
      expect.objectContaining({ id: 'A', name: 'Alief', role: 'coder' }),
    ]);

    // the code it returned adds the next teammate
    const joined = await call(stub, 'POST', '/v1/join', {
      body: { code: res.code, name: 'Sari', role: 'pm' },
    });
    expect(JoinMemberRes.parse(joined.json)).toMatchObject({ member: 'B', role: 'pm' });
  });

  it('uploads files with the mc token only, without a head commit', async () => {
    const { stub } = freshWorkspace();
    const res = OpenWorkspaceRes.parse(
      (
        await call(stub, 'POST', '/v1/workspace/open', {
          body: { workspace: 'my-app', owner: OWNER },
        })
      ).json,
    );
    const files = [
      { path: 'src/a.ts', content: 'export const a = 1;\n' },
      { path: 'README.md', content: '# hi\n' },
    ];
    const up = await call(stub, 'POST', '/v1/workspace/files', {
      token: res.mcToken,
      body: { headCommit: null, files },
    });
    expect(up.status).toBe(200);
    expect(up.json).toEqual({ inserted: 2, headCommit: null });

    const member = decodeInvite(res.invite).token;
    expect(
      (
        await call(stub, 'POST', '/v1/workspace/files', {
          token: member,
          body: { headCommit: null, files },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(stub, 'POST', '/v1/workspace/files', { body: { headCommit: null, files } }))
        .status,
    ).toBe(401);
    expect(
      (
        await call(stub, 'POST', '/v1/workspace/files', {
          token: res.mcToken,
          body: { headCommit: 'abc', files },
        })
      ).status,
    ).toBe(422);
    const state = await call(stub, 'GET', '/v1/state', { token: res.mcToken });
    expect(state.json.files.map((f: { path: string }) => f.path).sort()).toEqual([
      'README.md',
      'src/a.ts',
    ]);
  });

  it('once started, only the current owner can open another folder, and that replaces everything', async () => {
    const { stub } = freshWorkspace();
    const first = OpenWorkspaceRes.parse(
      (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'one', owner: OWNER } }))
        .json,
    );
    const stranger = await call(stub, 'POST', '/v1/workspace/open', {
      body: { workspace: 'two', owner: OWNER },
      headers: { 'cf-connecting-ip': '198.51.100.7' },
    });
    expect(stranger.status).toBe(409);
    expect(stranger.json.error.message).toBe('Alief is sharing one. Ask them to stop sharing first, or ask them for a join code.');
    const asMember = await call(stub, 'POST', '/v1/workspace/open', {
      token: decodeInvite(first.invite).token,
      body: { workspace: 'two', owner: OWNER },
    });
    expect(asMember.status).toBe(409);

    const oldMc = await hello(stub, first.mcToken, 'mc');
    const second = await call(stub, 'POST', '/v1/workspace/open', {
      token: first.mcToken,
      body: { workspace: 'two', owner: { name: 'Alief', role: 'pm' } },
    });
    expect(second.status).toBe(201);
    const res = OpenWorkspaceRes.parse(second.json);
    expect(await oldMc.closed).toBeGreaterThan(0);
    expect((await call(stub, 'GET', '/v1/state', { token: first.mcToken })).status).toBe(401);
    const state = await call(stub, 'GET', '/v1/state', { token: res.mcToken });
    expect(state.json.workspace.name).toBe('two');
    expect(state.json.members).toEqual([expect.objectContaining({ id: 'A', role: 'pm' })]);
  });

  it('the owner stops sharing: the server empties and anyone can share the next folder', async () => {
    const { stub } = freshWorkspace();
    const first = OpenWorkspaceRes.parse(
      (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'one', owner: OWNER } }))
        .json,
    );
    const member = decodeInvite(first.invite).token;
    expect((await call(stub, 'POST', '/v1/workspace/close', { token: member })).status).toBe(403);
    expect((await call(stub, 'POST', '/v1/workspace/close')).status).toBe(401);

    const socket = await hello(stub, member, 'sync');
    const closed = await call(stub, 'POST', '/v1/workspace/close', { token: first.mcToken });
    expect(closed.status).toBe(200);
    expect(closed.json).toEqual({ ok: true });
    expect(await socket.closed).toBeGreaterThan(0);
    expect((await call(stub, 'GET', '/v1/state', { token: first.mcToken })).status).toBe(401);

    // a teammate shares their folder next, without any token
    const next = await call(stub, 'POST', '/v1/workspace/open', {
      body: { workspace: 'two', owner: { name: 'Sari', role: 'coder' } },
    });
    expect(next.status).toBe(201);
    const res = OpenWorkspaceRes.parse(next.json);
    const state = await call(stub, 'GET', '/v1/state', { token: res.mcToken });
    expect(state.json.members).toEqual([expect.objectContaining({ id: 'A', name: 'Sari' })]);
  });

  it('rejects a missing name or role', async () => {
    const { stub } = freshWorkspace();
    expect(
      (
        await call(stub, 'POST', '/v1/workspace/open', {
          body: { workspace: 'x', owner: { name: ' ', role: 'coder' } },
        })
      ).status,
    ).toBe(422);
    expect(
      (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'x' } })).status,
    ).toBe(422);
  });
});
