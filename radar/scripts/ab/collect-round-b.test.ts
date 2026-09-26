import { afterEach, describe, expect, it } from 'vitest';
import { startMockServer, type MockServer } from '../mock-server.js';
import { collectRoundB, fetchAllEvents } from './collect-round-b.js';

const servers: MockServer[] = [];
afterEach(async () => {
  for (const s of servers.splice(0)) await s.close();
});

async function mock(): Promise<string> {
  const s = await startMockServer({ port: 0, scenario: 'demo', instant: true, log: () => {} });
  servers.push(s);
  return `http://127.0.0.1:${s.port}`;
}

describe('fetchAllEvents', () => {
  it('pages through /v1/events/export until a short page', async () => {
    const calls: string[] = [];
    const online = (id: number) => ({
      id,
      ts: id,
      actor: 'A',
      type: 'member.online',
      payload: { memberId: 'A' },
    });
    const pages = [[online(1), online(2), online(3)], [online(4)]];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      return new Response(
        JSON.stringify({ workspace: 'w', exportedAt: 0, events: pages.shift() ?? [] }),
      );
    }) as unknown as typeof fetch;
    const events = await fetchAllEvents('http://x', 'tok', { pageSize: 3, fetchImpl: fakeFetch });
    expect(events.map((e) => e.id)).toEqual([1, 2, 3, 4]);
    expect(calls).toEqual([
      'http://x/v1/events/export?from=0&limit=3',
      'http://x/v1/events/export?from=4&limit=3',
    ]);
  });

  it('rejects an answer that does not match the export contract', async () => {
    const fakeFetch = (async () =>
      new Response(
        JSON.stringify({ workspace: 'w', exportedAt: 0, events: [{ id: 1 }] }),
      )) as unknown as typeof fetch;
    await expect(fetchAllEvents('http://x', 'tok', { fetchImpl: fakeFetch })).rejects.toThrow(
      /ExportRes/,
    );
  });

  it('turns a non-2xx answer into an error naming the status', async () => {
    const url = await mock();
    await expect(fetchAllEvents(url, 'wrong-token')).rejects.toThrow(/401/);
  });
});

describe('collectRoundB against the mock server', () => {
  it('computes the metrics and keeps the session report', async () => {
    const url = await mock();
    const r = await collectRoundB({ server: url, token: 'mc-dev' });
    expect(r.events.length).toBeGreaterThan(10);
    expect(r.metrics.writers.violations).toEqual([]);
    expect(r.metrics.blocks.total).toBeGreaterThan(0);
    expect(r.report).not.toBeNull();
    expect(r.replay).toBeNull();
  });
});
