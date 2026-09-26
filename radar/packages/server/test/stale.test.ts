// SV-09 heartbeat expiry (R4 §7, fase 12 step 2): one `member.stale` per episode for a coder holding a lock,
// a heartbeat ends the episode, members without locks are never reported, and no alarm stays without holders.
import { runInDurableObject } from 'cloudflare:test';
import { HEARTBEAT_EXPIRE_MS } from '@radar/common';
import { describe, expect, it } from 'vitest';
import { insertLock } from '../src/db/repo/lock';
import { insertTask } from '../src/db/repo/task';
import { heartbeatExpireMs } from '../src/services/stale';
import type { WorkspaceDO } from '../src/workspace-do';
import { freshWorkspace, hello, seedTestWorkspace, sleep } from './helpers';

type Stub = DurableObjectStub;

/** Gives A a task holding `src/app.ts`, then schedules the alarm like a request would. */
async function giveALock(stub: Stub): Promise<void> {
  await runInDurableObject(stub, async (instance: WorkspaceDO) => {
    instance.db.tx(() => {
      const t = insertTask(instance.db, { title: 'Header', ownerId: 'A', status: 'dikerjakan', now: instance.now() });
      insertLock(instance.db, { path: 'src/app.ts', taskId: t.id, memberId: 'A', state: 'dipegang', now: instance.now() });
    });
    await instance.scheduler.reschedule();
  });
}

/** Moves every live sync socket's last heartbeat `ago` ms into the past. */
async function ageHeartbeats(stub: Stub, ago: number): Promise<void> {
  await runInDurableObject(stub, (_i, state) => {
    for (const ws of state.getWebSockets()) {
      const att = ws.deserializeAttachment() as { state: string; lastHeartbeat?: number };
      if (att.state === 'ready') ws.serializeAttachment({ ...att, lastHeartbeat: Date.now() - ago });
    }
  });
}

const runAlarm = (stub: Stub) => runInDurableObject(stub, (instance: WorkspaceDO) => instance.alarm());

const presence = (stub: Stub, memberId: string) =>
  runInDurableObject(stub, (instance: WorkspaceDO) =>
    instance.db
      .all<{ type: string }>(
        `SELECT type FROM event WHERE type IN ('member.stale','member.online','member.reconnected') AND json_extract(payload,'$.memberId') = ? ORDER BY id`,
        memberId,
      )
      .map((r) => r.type),
  );

describe('heartbeat expiry (SV-09, R4 §7)', () => {
  it('a lock holder silent past the expiry gets member.stale once, even when the alarm runs again', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await hello(stub, t.A!, 'sync');
    await giveALock(stub);
    await ageHeartbeats(stub, HEARTBEAT_EXPIRE_MS + 1000);
    await runAlarm(stub);
    await runAlarm(stub);
    expect(await presence(stub, 'A')).toEqual(['member.online', 'member.stale']);
    const payload = await runInDurableObject(stub, (instance: WorkspaceDO) =>
      instance.db.one<{ payload: string }>(`SELECT payload FROM event WHERE type = 'member.stale'`),
    );
    expect(JSON.parse(payload!.payload)).toMatchObject({ memberId: 'A', lastHeartbeat: expect.any(Number) });
  });

  it('a heartbeat ends the episode (member.online), so a new silence is reported again', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    await giveALock(stub);
    await ageHeartbeats(stub, HEARTBEAT_EXPIRE_MS + 1000);
    await runAlarm(stub);
    a.send({ t: 'heartbeat', d: { ts: 0 } });
    await sleep(50);
    expect(await presence(stub, 'A')).toEqual(['member.online', 'member.stale', 'member.online']);
    // A fresh heartbeat: nothing new until the expiry passes again.
    await runAlarm(stub);
    expect((await presence(stub, 'A')).filter((x) => x === 'member.stale')).toHaveLength(1);
    await ageHeartbeats(stub, HEARTBEAT_EXPIRE_MS + 1000);
    await runAlarm(stub);
    expect((await presence(stub, 'A')).filter((x) => x === 'member.stale')).toHaveLength(2);
  });

  it('uses the heartbeat saved on close when the socket is gone', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    const a = await hello(stub, t.A!, 'sync');
    await giveALock(stub);
    a.ws.close(1000, 'bye');
    await sleep(50);
    await runInDurableObject(stub, (instance: WorkspaceDO) => {
      instance.db.run('UPDATE member SET last_heartbeat = ? WHERE id = ?', Date.now() - HEARTBEAT_EXPIRE_MS - 1000, 'A');
    });
    await runAlarm(stub);
    expect(await presence(stub, 'A')).toContain('member.stale');
  });

  it('a member without locks is never stale and leaves no alarm behind', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await hello(stub, t.B!, 'sync');
    await ageHeartbeats(stub, HEARTBEAT_EXPIRE_MS + 1000);
    await runAlarm(stub);
    expect(await presence(stub, 'B')).toEqual(['member.online']);
    expect(await runInDurableObject(stub, (_i, state) => state.storage.getAlarm())).toBeNull();
  });

  it('a lock holder makes their expiry the next alarm deadline', async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await hello(stub, t.A!, 'sync');
    const before = Date.now();
    await giveALock(stub);
    // The stored alarm may still be the earlier hello deadline (kept on purpose); the next deadline is A's expiry.
    const alarm = await runInDurableObject(stub, (instance: WorkspaceDO) => instance.scheduler.nextDeadline());
    expect(alarm).not.toBeNull();
    expect(alarm!).toBeGreaterThanOrEqual(before - 1000 + HEARTBEAT_EXPIRE_MS);
  });

  it('HEARTBEAT_EXPIRE_MS overrides the default; junk and values under 1 s are ignored', () => {
    expect(heartbeatExpireMs({})).toBe(HEARTBEAT_EXPIRE_MS);
    expect(heartbeatExpireMs({ HEARTBEAT_EXPIRE_MS: '60000' })).toBe(60_000);
    expect(heartbeatExpireMs({ HEARTBEAT_EXPIRE_MS: 'soon' })).toBe(HEARTBEAT_EXPIRE_MS);
    expect(heartbeatExpireMs({ HEARTBEAT_EXPIRE_MS: '10' })).toBe(HEARTBEAT_EXPIRE_MS);
  });
});
