import { describe, expect, it, vi } from 'vitest';
import { clampBrief } from './brief.js';
import { BRIEF_MAX_LINE_CHARS, EDIT_TOOLS_REGEX, MEMBER_COLORS, WS_PING_FRAME, WS_PONG_FRAME } from './constants.js';
import { sha256Hex } from './hash.js';
import { RadarHttpError, RadarNetworkError, RadarTimeoutError, radarFetch } from './http.js';
import { createIgnoreMatcherFromText, exceedsMaxSize, isProbablyBinary } from './ignore.js';
import { HealthRes } from './schemas.js';

describe('constants', () => {
  it('matches the R5 §4 wire values', () => {
    expect(WS_PING_FRAME).toBe('{"t":"ping"}');
    expect(WS_PONG_FRAME).toBe('{"t":"pong"}');
    expect(MEMBER_COLORS.A).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('EDIT_TOOLS_REGEX matches edit tools only', () => {
    for (const t of ['write_file', 'apply_diff', 'search_and_replace', 'insert_content']) expect(EDIT_TOOLS_REGEX.test(t), t).toBe(true);
    for (const t of ['read_file', 'execute_command', 'mcp__radar__why_blocked', 'write_file_x']) expect(EDIT_TOOLS_REGEX.test(t), t).toBe(false);
  });
});

describe('sha256Hex', () => {
  it('matches the FIPS 180-2 test vectors', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('hashes strings as UTF-8 and bytes as-is', async () => {
    const bytes = new TextEncoder().encode('héllo');
    expect(await sha256Hex('héllo')).toBe(await sha256Hex(bytes));
    const view = new Uint8Array(new Uint8Array([0, 97, 98, 99, 0]).buffer, 1, 3);
    expect(await sha256Hex(view)).toBe(await sha256Hex('abc'));
  });
});

describe('clampBrief', () => {
  it('adds the prefix exactly once and drops empty lines', () => {
    expect(clampBrief(['[Radar] [Radar] halo', '', '  ', 'dua\nbaris'])).toEqual(['[Radar] halo', '[Radar] dua baris']);
  });

  it('keeps at most 6 lines of at most 160 chars', () => {
    const out = clampBrief(Array.from({ length: 9 }, () => 'x'.repeat(300)));
    expect(out).toHaveLength(6);
    for (const l of out) {
      expect(l.length).toBe(BRIEF_MAX_LINE_CHARS);
      expect(l.endsWith('…')).toBe(true);
    }
  });
});

describe('ignore rules (R5 §6)', () => {
  const m = createIgnoreMatcherFromText('secret-notes/\n*.log\n');

  it('applies the defaults', () => {
    for (const p of ['node_modules/x/index.js', '.git/HEAD', '.radar/local.json', 'dist/a.js', 'src/.DS_Store', 'a.ts.radar-rejected', 'a.ts~', 'src/.#a.ts', 'src/.utils.ts.radar-tmp-1a2b', '.README.md.radar-tmp-x']) {
      expect(m.ignores(p), p).toBe(true);
    }
    expect(m.ignores('src/checkout/checkout.ts')).toBe(false);
    expect(m.ignores('src/radar-tmp-notes.ts')).toBe(false);
  });

  it('applies the root .gitignore text', () => {
    expect(m.ignores('app.log')).toBe(true);
    expect(m.ignores('secret-notes/a.md')).toBe(true);
  });

  it('treats paths outside the workspace as ignored and the root as not ignored', () => {
    expect(m.ignores('../x.ts')).toBe(true);
    expect(m.ignores('/etc/hosts')).toBe(true);
    expect(m.ignores('.')).toBe(false);
  });

  it('binary and size checks', () => {
    expect(isProbablyBinary(new Uint8Array([65, 0, 66]))).toBe(true);
    expect(isProbablyBinary(new TextEncoder().encode('plain text'))).toBe(false);
    const late = new Uint8Array(9000).fill(65);
    late[8500] = 0;
    expect(isProbablyBinary(late)).toBe(false);
    expect(exceedsMaxSize(1_048_576)).toBe(false);
    expect(exceedsMaxSize(1_048_577)).toBe(true);
  });
});

describe('radarFetch', () => {
  const cfg = { server: 'http://radar.test/', token: 'tok-a' };
  const json = (status: number, body: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('sends the bearer header and JSON body, and validates with the schema', async () => {
    const fetchImpl = vi.fn(async () => json(200, { ok: true, workspace: 'w', version: '0.0.0', uptimeMs: 5 }));
    const res = await radarFetch(cfg, 'POST', '/healthz', { a: 1 }, { timeoutMs: 1000, schema: HealthRes, fetchImpl });
    expect(res.workspace).toBe('w');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://radar.test/healthz');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok-a');
    expect(init.body).toBe('{"a":1}');
  });

  it('returns undefined for 204', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await radarFetch(cfg, 'POST', 'v1/bob/activity', {}, { timeoutMs: 1000, fetchImpl })).toBeUndefined();
  });

  it('throws RadarHttpError with the R3 error code, or one derived from the status', async () => {
    const withBody = vi.fn(async () => json(409, { error: { code: 'CONFLICT', message: 'dipegang A' } }));
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 1000, fetchImpl: withBody })).rejects.toMatchObject({
      name: 'RadarHttpError',
      code: 'CONFLICT',
      status: 409,
      message: 'dipegang A',
    });
    const bare = vi.fn(async () => new Response('nope', { status: 401 }));
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 1000, fetchImpl: bare })).rejects.toBeInstanceOf(RadarHttpError);
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 1000, fetchImpl: bare })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('throws RadarNetworkError for connection errors, invalid JSON and schema mismatches', async () => {
    const refused = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 1000, fetchImpl: refused })).rejects.toBeInstanceOf(RadarNetworkError);
    const garbage = vi.fn(async () => new Response('{', { status: 200 }));
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 1000, fetchImpl: garbage })).rejects.toBeInstanceOf(RadarNetworkError);
    const wrong = vi.fn(async () => json(200, { ok: 'yes' }));
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 1000, schema: HealthRes, fetchImpl: wrong })).rejects.toBeInstanceOf(
      RadarNetworkError,
    );
  });

  it('throws RadarTimeoutError when the server is too slow', async () => {
    const slow = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(radarFetch(cfg, 'GET', '/x', undefined, { timeoutMs: 20, fetchImpl: slow })).rejects.toBeInstanceOf(RadarTimeoutError);
  });
});
