import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from './events.js';
import {
  BobActivityReq,
  BriefQuery,
  DecisionPayload,
  ErrorRes,
  LockCheckReq,
  LockCheckRes,
  parseRadarEvent,
  PlanPayload,
  ProposalCreateReq,
  RadarEventSchema,
  RequestFileReq,
  RequestFileRes,
  ReviewPayload,
  StateRes,
} from './schemas.js';
import { CoreWsMessageSchema, WsMessageSchema } from './ws.js';

const task = (ref: string, files: string[], queuedFiles: string[] = []) => ({
  ref,
  title: `Task ${ref}`,
  ownerId: 'A',
  files,
  queuedFiles,
});

describe('R3 §2 request/response schemas', () => {
  it('LockCheckReq accepts the R3 §2.2 example and rejects empty or oversized path lists', () => {
    const ok = { paths: ['src/checkout/checkout.ts'], tool: 'apply_diff', sessionId: 'abc', clientTs: 1790000000000 };
    expect(LockCheckReq.parse(ok)).toEqual(ok);
    expect(LockCheckReq.safeParse({ ...ok, paths: [] }).success).toBe(false);
    expect(LockCheckReq.safeParse({ ...ok, paths: Array.from({ length: 101 }, (_, i) => `f${i}.ts`) }).success).toBe(false);
    expect(LockCheckReq.safeParse({ ...ok, sessionId: null }).success).toBe(true);
  });

  it('LockCheckRes accepts a block with holder and optional sinceMs', () => {
    const res = LockCheckRes.parse({
      decision: 'block',
      results: [
        {
          path: 'src/checkout/checkout.ts',
          decision: 'block',
          reason: 'held_by_other',
          holder: { memberId: 'A', memberName: 'Andi', taskId: 'T-1', taskTitle: 'Kupon', state: 'dipegang' },
          requestId: 'R-1',
          queuePos: null,
        },
      ],
      activeTaskId: 'T-2',
      message: 'checkout.ts dipegang A (T-1).',
    });
    expect(res.results[0]?.holder?.sinceMs).toBeUndefined();
  });

  it('ErrorRes only accepts known codes', () => {
    expect(ErrorRes.safeParse({ error: { code: 'UNAUTHORIZED', message: 'x' } }).success).toBe(true);
    expect(ErrorRes.safeParse({ error: { code: 'TEAPOT', message: 'x' } }).success).toBe(false);
  });

  it('BriefQuery coerces the since cursor from a query string', () => {
    expect(BriefQuery.parse({ kind: 'prompt', since: '42' })).toEqual({ kind: 'prompt', since: 42 });
    expect(BriefQuery.safeParse({ kind: 'other' }).success).toBe(false);
  });

  it('RequestFileReq defaults reason; RequestFileRes accepts the bebas branch', () => {
    expect(RequestFileReq.parse({ path: 'a.ts' })).toEqual({ path: 'a.ts', reason: '' });
    expect(RequestFileRes.safeParse({ requestId: null, status: 'bebas', message: 'a.ts bebas' }).success).toBe(true);
    expect(RequestFileRes.safeParse({ requestId: 'R-1', status: 'terbuka', duplicate: true }).success).toBe(true);
  });

  it('BobActivityReq accepts the R3 §2.24 body without clientTs and fills default paths', () => {
    const pre = BobActivityReq.parse({ kind: 'tool.pre', sessionId: 's', mode: 'coder', tool: 'apply_diff', decision: 'allow' });
    expect(pre).toMatchObject({ kind: 'tool.pre', paths: [] });
    expect(BobActivityReq.safeParse({ kind: 'turn.end', sessionId: null, mode: 'coder', clientTs: 1 }).success).toBe(true);
    expect(BobActivityReq.safeParse({ kind: 'tool.pre', sessionId: null, mode: 'coder', tool: 'x' }).success).toBe(false);
    expect(BobActivityReq.safeParse({ kind: 'prompt', sessionId: null, mode: 'coder', text: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('proposal payloads (R3 §4)', () => {
  it('accepts a plan whose later task queues a file owned by an earlier task', () => {
    const plan = PlanPayload.parse({ goal: 'g', tasks: [task('t1', ['a.ts']), task('t2', ['b.ts'], ['a.ts'])] });
    expect(plan.tasks[0]?.description).toBe('');
  });

  it('rejects the same file in files of two tasks', () => {
    const r = PlanPayload.safeParse({ goal: 'g', tasks: [task('t1', ['a.ts']), task('t2', ['a.ts'])] });
    expect(r.success).toBe(false);
  });

  it('rejects queuedFiles that nobody owns or that the task itself owns, and duplicate refs', () => {
    expect(PlanPayload.safeParse({ goal: 'g', tasks: [task('t1', ['a.ts'], ['z.ts'])] }).success).toBe(false);
    expect(PlanPayload.safeParse({ goal: 'g', tasks: [task('t1', ['a.ts'], ['a.ts'])] }).success).toBe(false);
    expect(PlanPayload.safeParse({ goal: 'g', tasks: [task('t1', ['a.ts']), task('t1', ['b.ts'])] }).success).toBe(false);
  });

  it('enforces plan limits (8 tasks, 20 files per task)', () => {
    const nine = Array.from({ length: 9 }, (_, i) => task(`t${i}`, [`f${i}.ts`]));
    expect(PlanPayload.safeParse({ goal: 'g', tasks: nine }).success).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => `f${i}.ts`);
    expect(PlanPayload.safeParse({ goal: 'g', tasks: [task('t1', many)] }).success).toBe(false);
  });

  it('pecah needs newTask', () => {
    expect(DecisionPayload.safeParse({ requestId: 'R-1', option: 'pecah' }).success).toBe(false);
    expect(DecisionPayload.safeParse({ requestId: 'R-1', option: 'pecah', newTask: { title: 'Bagian B' } }).success).toBe(true);
    expect(DecisionPayload.safeParse({ requestId: 'R-1', option: 'antre' }).success).toBe(true);
  });

  it('ReviewPayload defaults notify and flags', () => {
    expect(ReviewPayload.parse({ taskId: 'T-0', verdict: 'setujui' })).toMatchObject({ notify: [], flags: [], notes: '' });
  });

  it('ProposalCreateReq dispatches on kind', () => {
    const r = ProposalCreateReq.safeParse({ kind: 'decision', reason: 'r', payload: { requestId: 'R-1', option: 'antre' } });
    expect(r.success).toBe(true);
    expect(ProposalCreateReq.safeParse({ kind: 'decision', reason: 'r', payload: { goal: 'g', tasks: [] } }).success).toBe(false);
  });
});

describe('events (R3 §5)', () => {
  it('EVENT_TYPES lists exactly the schema event types', () => {
    const schemaTypes = RadarEventSchema.options.map((o) => o.shape.type.value).sort();
    expect([...EVENT_TYPES].sort()).toEqual(schemaTypes);
    expect(EVENT_TYPES).toHaveLength(35);
  });

  it('parseRadarEvent returns null for unknown or malformed events', () => {
    expect(parseRadarEvent({ id: 1, ts: 1, actor: 'x', type: 'future.thing', payload: {} })).toBeNull();
    expect(parseRadarEvent({ id: 1, ts: 1, actor: 'x', type: 'lock.review', payload: {} })).toBeNull();
    expect(parseRadarEvent({ id: 1, ts: 1, actor: 'A', type: 'bob.turn', payload: { memberId: 'A' } })?.type).toBe('bob.turn');
  });

  it('task.created defaults queuedFiles', () => {
    const ev = parseRadarEvent({
      id: 1,
      ts: 1,
      actor: 'C',
      type: 'task.created',
      payload: { taskId: 'T-0', title: 't', ownerId: 'A', status: 'terbuka', files: ['a.ts'], adhoc: false },
    });
    expect(ev?.type === 'task.created' && ev.payload.queuedFiles).toEqual([]);
  });
});

describe('WebSocket messages (R3 §3)', () => {
  it('accepts hello from the desktop app with knownVersions', () => {
    const r = CoreWsMessageSchema.safeParse({
      t: 'hello',
      d: { token: 'x', client: 'app', clientVersion: '0.0.0', knownVersions: { 'a.ts': 3 } },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown message types', () => {
    expect(WsMessageSchema.safeParse({ t: 'nope', d: {} }).success).toBe(false);
  });

  it('accepts a state message carrying a StateRes snapshot', () => {
    const snapshot = StateRes.parse({
      workspace: { id: 'w', name: 'w', headCommit: null, repoUrl: null },
      members: [],
      tasks: [],
      locks: [],
      files: [],
      requests: [],
      proposals: [],
      cursor: 0,
    });
    expect(snapshot.recentEvents).toEqual([]);
    expect(CoreWsMessageSchema.safeParse({ t: 'state', d: snapshot }).success).toBe(true);
  });
});
