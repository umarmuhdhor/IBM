import { describe, expect, it } from 'vitest';
import { decodeInvite, encodeInvite, INVITE_PREFIX, InviteInvalidError } from './invite.js';

const sample = { server: 'https://live-collab.example.workers.dev/', workspace: 'toko-demo', member: 'B', token: 'rdr_test_Ab-_9' };

describe('invite code (IN-02)', () => {
  it('round-trips and drops the trailing slash of the server', () => {
    const code = encodeInvite(sample);
    expect(code).toMatch(/^rdr_inv_[A-Za-z0-9_-]+$/);
    expect(decodeInvite(`  ${code}\n`)).toEqual({ v: 1, ...sample, server: 'https://live-collab.example.workers.dev' });
  });

  it('keeps non-ASCII workspace names', () => {
    expect(decodeInvite(encodeInvite({ ...sample, workspace: 'toko-démo' })).workspace).toBe('toko-démo');
  });

  it('rejects a wrong prefix, a truncated code and a missing field without echoing the code', () => {
    const code = encodeInvite(sample);
    expect(() => decodeInvite('rdr_xyz')).toThrow(InviteInvalidError);
    expect(() => decodeInvite(code.slice(0, 20))).toThrow(InviteInvalidError);
    const noToken = INVITE_PREFIX + btoa(JSON.stringify({ v: 1, server: sample.server, workspace: 'w', member: 'B' })).replace(/=+$/, '');
    expect(() => decodeInvite(noToken)).toThrow(/tidak lengkap/);
    expect(() => decodeInvite(code.slice(0, 30))).toThrow(expect.objectContaining({ message: expect.not.stringContaining(code.slice(8, 30)) }));
  });

  it('refuses to encode an invalid server URL', () => {
    expect(() => encodeInvite({ ...sample, server: 'not a url' })).toThrow();
  });
});
