// Phase 15: one PM per workspace + PM task steps.
// (A) second PM join → 409; coder join still works; PM rejoining their own seat works.
// (B) plan with steps → tasks with steps in GET /v1/state and GET /v1/tasks.
// (C) step toggle: owner coder → 200 + event; another coder → 403; PM → 403; bad index → 404.
import { describe, expect, it } from 'vitest';
import { decodeInvite, JoinMemberRes, OpenWorkspaceRes, StateRes } from '@radar/common';
import { call, freshWorkspace, hello, seedTestWorkspace } from './helpers';

// ---- helpers -----------------------------------------------------------------------

async function openWorkspace(stub: DurableObjectStub) {
  return OpenWorkspaceRes.parse(
    (await call(stub, 'POST', '/v1/workspace/open', { body: { workspace: 'pm-test', owner: { name: 'Owner', role: 'coder' } } })).json,
  );
}

async function newCode(stub: DurableObjectStub, mcToken: string): Promise<string> {
  const r = await call(stub, 'POST', '/v1/join-codes', { token: mcToken, body: {} });
  expect(r.status).toBe(201);
  return r.json.code as string;
}

async function join(stub: DurableObjectStub, code: string, name: string, role: 'coder' | 'pm', token?: string) {
  const r = await call(stub, 'POST', '/v1/join', { body: { code, name, role }, ...(token ? { token } : {}) });
  return r;
}

async function joinOk(stub: DurableObjectStub, code: string, name: string, role: 'coder' | 'pm', token?: string) {
  const r = await join(stub, code, name, role, token);
  expect(r.status).toBe(200);
  const res = JoinMemberRes.parse(r.json);
  return { ...res, token: decodeInvite(res.invite).token };
}

/** Create and approve a plan proposal, returning the proposalId. */
async function approvePlan(stub: DurableObjectStub, pmToken: string, mcToken: string, tasks: unknown[]) {
  const p = await call(stub, 'POST', '/v1/proposals', { token: pmToken, body: { kind: 'plan', reason: 'test plan', payload: { goal: 'test', tasks } } });
  expect(p.status).toBe(201);
  const d = await call(stub, 'POST', `/v1/proposals/${p.json.proposalId}/decision`, { token: mcToken, body: { approve: true } });
  expect(d.status).toBe(200);
  return p.json.proposalId as string;
}

// ---- A. One PM per workspace -------------------------------------------------------

describe('one PM per workspace (A)', () => {
  it('second PM join gets 409 with the existing PM name', { timeout: 15_000 }, async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    // First teammate joins as PM.
    await joinOk(stub, open.code, 'Citra', 'pm');
    // Second code for a new joiner who also wants PM.
    const code2 = await newCode(stub, open.mcToken);
    const r = await join(stub, code2, 'Dewi', 'pm');
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('CONFLICT');
    expect(r.json.error.message).toContain('Citra');
    expect(r.json.error.message).toContain('coder');
  });

  it('second person joining as coder still works after a PM is seated', { timeout: 15_000 }, async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    await joinOk(stub, open.code, 'Citra', 'pm');
    const code2 = await newCode(stub, open.mcToken);
    const r = await join(stub, code2, 'Budi', 'coder');
    expect(r.status).toBe(200);
    expect(r.json.role).toBe('coder');
  });

  it('the PM can rejoin their own seat as pm (reuse path) without conflict', { timeout: 15_000 }, async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    const pm = await joinOk(stub, open.code, 'Citra', 'pm');
    // Get a new code and reuse the same seat.
    const code2 = await newCode(stub, open.mcToken);
    const r = await join(stub, code2, 'Citra', 'pm', pm.token);
    expect(r.status).toBe(200);
    expect(r.json.role).toBe('pm');
  });

  it('the PM can switch to coder via seat reuse, then a new PM can join', { timeout: 15_000 }, async () => {
    const { stub } = freshWorkspace();
    const open = await openWorkspace(stub);
    const pm = await joinOk(stub, open.code, 'Citra', 'pm');
    const code2 = await newCode(stub, open.mcToken);
    // PM switches to coder.
    const switched = await joinOk(stub, code2, 'Citra', 'coder', pm.token);
    expect(switched.role).toBe('coder');
    // Now another person can join as PM.
    const code3 = await newCode(stub, open.mcToken);
    const newPm = await join(stub, code3, 'Dewi', 'pm');
    expect(newPm.status).toBe(200);
  });
});

// ---- B. Steps stored with tasks and returned by /v1/state + /v1/tasks --------------

describe('plan with steps (B)', () => {
  it('tasks created from a plan carry steps in GET /v1/state and GET /v1/tasks', { timeout: 20_000 }, async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    // C is the PM in DEFAULT_MEMBERS.
    await approvePlan(stub, t.C!, t.mc!, [
      {
        ref: 'task1',
        title: 'Login flow',
        ownerId: 'A',
        files: ['src/app.ts'],
        steps: ['Write tests', 'Implement login', 'Refactor'],
      },
    ]);

    // Check GET /v1/state (TaskViewSchema has steps).
    const stateRes = await call(stub, 'GET', '/v1/state', { token: t.mc });
    expect(stateRes.status).toBe(200);
    const state = StateRes.parse(stateRes.json);
    const taskInState = state.tasks.find((x) => x.id === 'T-1');
    expect(taskInState).toBeDefined();
    expect(taskInState!.steps).toEqual([
      { text: 'Write tests', done: false },
      { text: 'Implement login', done: false },
      { text: 'Refactor', done: false },
    ]);

    // Check GET /v1/tasks (TaskItem has steps).
    const tasksRes = await call(stub, 'GET', '/v1/tasks', { token: t.A });
    expect(tasksRes.status).toBe(200);
    const taskInList = tasksRes.json.tasks.find((x: { id: string }) => x.id === 'T-1');
    expect(taskInList).toBeDefined();
    expect(taskInList.steps).toEqual([
      { text: 'Write tests', done: false },
      { text: 'Implement login', done: false },
      { text: 'Refactor', done: false },
    ]);
  });

  it('tasks with no steps have steps: [] in the response', { timeout: 15_000 }, async () => {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub);
    await approvePlan(stub, t.C!, t.mc!, [
      { ref: 't1', title: 'No steps', ownerId: 'A', files: ['src/app.ts'] },
    ]);
    const stateRes = await call(stub, 'GET', '/v1/state', { token: t.mc });
    const state = StateRes.parse(stateRes.json);
    expect(state.tasks.find((x) => x.id === 'T-1')!.steps).toEqual([]);
  });
});

// ---- C. POST /v1/tasks/:id/steps ---------------------------------------------------

describe('POST /v1/tasks/:id/steps (C)', { timeout: 20_000 }, () => {
  /** Seed workspace, create a plan with steps, return tokens + taskId. */
  async function setup() {
    const { stub } = freshWorkspace();
    const t = await seedTestWorkspace(stub, [
      { path: 'src/app.ts', content: 'export const a = 1;\n' },
      { path: 'src/b.ts', content: 'export const b = 1;\n' },
    ]);
    // A and B are coders; C is the PM.
    await approvePlan(stub, t.C!, t.mc!, [
      {
        ref: 't1',
        title: 'Auth',
        ownerId: 'A',
        files: ['src/app.ts'],
        steps: ['Step zero', 'Step one', 'Step two'],
      },
      {
        ref: 't2',
        title: 'Other',
        ownerId: 'B',
        files: ['src/b.ts'],
      },
    ]);
    return { stub, t, taskId: 'T-1' as string };
  }

  it('the task owner (coder A) can mark a step done → 200, updated steps, task.step event', async () => {
    const { stub, t, taskId } = await setup();

    const mc = await hello(stub, t.mc!, 'mc');

    const r = await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, {
      token: t.A,
      body: { index: 1, done: true },
    });
    expect(r.status).toBe(200);
    expect(r.json.taskId).toBe(taskId);
    expect(r.json.steps).toEqual([
      { text: 'Step zero', done: false },
      { text: 'Step one', done: true },
      { text: 'Step two', done: false },
    ]);

    // Event appears in the event stream.
    const ev = await mc.next((m) => m.t === 'event' && m.d?.type === 'task.step');
    expect(ev.d.payload).toMatchObject({ taskId, index: 1, done: true, by: 'A' });

    // GET /v1/state reflects the change.
    const state = StateRes.parse((await call(stub, 'GET', '/v1/state', { token: t.mc })).json);
    expect(state.tasks.find((x) => x.id === taskId)!.steps[1]).toEqual({ text: 'Step one', done: true });
  });

  it('can also un-mark a step (done: false)', async () => {
    const { stub, t, taskId } = await setup();
    // First mark it done.
    await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, { token: t.A, body: { index: 0, done: true } });
    // Then un-mark.
    const r = await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, { token: t.A, body: { index: 0, done: false } });
    expect(r.status).toBe(200);
    expect(r.json.steps[0]).toEqual({ text: 'Step zero', done: false });
  });

  it('another coder (B) gets 403 on a task owned by A', async () => {
    const { stub, t, taskId } = await setup();
    const r = await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, {
      token: t.B,
      body: { index: 0, done: true },
    });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('FORBIDDEN');
  });

  it('the PM (C) gets 403 because steps require role coder', async () => {
    const { stub, t, taskId } = await setup();
    const r = await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, {
      token: t.C,
      body: { index: 0, done: true },
    });
    expect(r.status).toBe(403);
  });

  it('an unknown step index gets 404', async () => {
    const { stub, t, taskId } = await setup();
    const r = await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, {
      token: t.A,
      body: { index: 99, done: true },
    });
    expect(r.status).toBe(404);
    expect(r.json.error.code).toBe('NOT_FOUND');
  });

  it('a task with no steps: setting any index is 404', async () => {
    const { stub, t } = await setup();
    // T-2 belongs to B and has no steps.
    const r = await call(stub, 'POST', '/v1/tasks/T-2/steps', {
      token: t.B,
      body: { index: 0, done: true },
    });
    expect(r.status).toBe(404);
  });

  it('409 when the task is in review (not terbuka/dikerjakan)', async () => {
    const { stub, t, taskId } = await setup();
    // Get A connected to submit the task.
    const a = await hello(stub, t.A!, 'sync');
    // Force a file edit to satisfy the "must have changed a file" rule.
    const content = 'export const a = 2;\n';
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content)))]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    a.send({ t: 'file.update', id: 'u1', d: { path: 'src/app.ts', baseVersion: 1, content, hash, clientTs: 0 } });
    await a.byType('file.ack');
    // Trigger lock acquisition so we can submit.
    await call(stub, 'POST', '/v1/locks/check', { token: t.A, body: { paths: ['src/app.ts'], tool: 'write_to_file', clientTs: 0 } });
    await call(stub, 'POST', `/v1/tasks/${taskId}/submit`, { token: t.A, body: { summary: 'done' } });
    // Now the task is in review — steps should fail with 409.
    const r = await call(stub, 'POST', `/v1/tasks/${taskId}/steps`, { token: t.A, body: { index: 0, done: true } });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('CONFLICT');
  });
});
