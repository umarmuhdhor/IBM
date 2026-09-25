// In-memory Radar core for the dev mock (fase 02 step 13). NOT the product server: fase 03 must not reuse this.
// Every state change goes through `emit()`, so the mock state is exactly what the shared reducer builds from
// the event log, the same way Mission Control and the replay rebuild it.
import { randomBytes } from 'node:crypto';
import {
  applyEvent,
  clampBrief,
  createIgnoreMatcherFromText,
  feedText,
  initialState,
  MAX_FILE_BYTES,
  normalizeRelative,
  parseRadarEvent,
  PathOutsideWorkspaceError,
  sha256Hex,
  TASK_DIFF_MAX_PATCH_BYTES,
  type AllocationSource,
  type BlockLastRes,
  type BlockVia,
  type BobActivityReq,
  type DecisionPayload,
  type ErrorCode,
  type LockCheckRes,
  type LockCheckResult,
  type LockHolder,
  type LockView,
  type PlanPayload,
  type Principal,
  type ProposalCreateReq,
  type ProposalItem,
  type ProposalView,
  type RadarEvent,
  type RadarEventOf,
  type RadarEventType,
  type RadarState,
  type RequestItem,
  type ReviewPayload,
  type StateRes,
  type TaskItem,
  type TaskStatus,
  type TaskView,
} from '../../packages/common/src/index.js';

/** Fixed dev credentials, printed in the banner. Mock only: the real server issues `rdr_…` tokens (fase 03). */
export const DEV_TOKENS: Readonly<Record<string, Principal>> = {
  'tok-a': { kind: 'member', memberId: 'A', role: 'coder' },
  'tok-b': { kind: 'member', memberId: 'B', role: 'coder' },
  'tok-c': { kind: 'member', memberId: 'C', role: 'pm' },
  'mc-dev': { kind: 'mc' },
};

export const DEFAULT_MEMBERS = [
  { id: 'A', name: 'Andi', role: 'coder' as const },
  { id: 'B', name: 'Budi', role: 'coder' as const },
  { id: 'C', name: 'Citra', role: 'pm' as const },
];

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type MemberPrincipal = Extract<Principal, { kind: 'member' }>;

interface BlockRecord {
  memberId: string;
  taskId: string | null;
  path: string;
  ts: number;
  via: BlockVia;
  requestId: string | null;
  holder: LockHolder;
}

interface HistoryEntry {
  version: number;
  by: string;
  taskId: string | null;
  ai: boolean;
  ts: number;
  patch: string;
}

export interface FileRecord {
  content: string | null;
  hash: string | null;
}

const OPEN_TASK: ReadonlySet<TaskStatus> = new Set(['terbuka', 'dikerjakan', 'review']);
const ACTIVITY_PER_SECOND = 20;

const idNum = (id: string) => Number(id.replace(/^\D+-/, '')) || 0;

function nextId(prefix: string, ids: Iterable<string>, first: number): string {
  let max = first - 1;
  for (const id of ids) if (id.startsWith(`${prefix}-`)) max = Math.max(max, idNum(id));
  return `${prefix}-${max + 1}`;
}

/** Tiny unified-style patch for the mock (the real server uses `diff.createTwoFilesPatch`). */
function naivePatch(path: string, before: string | null, after: string | null): string {
  const minus = (before ?? '').split('\n').filter((l) => l !== '').map((l) => `-${l}`);
  const plus = (after ?? '').split('\n').filter((l) => l !== '').map((l) => `+${l}`);
  return [`--- a/${path}`, `+++ b/${path}`, `@@ -1,${minus.length} +1,${plus.length} @@`, ...minus, ...plus].join('\n');
}

export class MockHub {
  state: RadarState = initialState();
  readonly events: RadarEvent[] = [];
  readonly files = new Map<string, FileRecord>();
  readonly tokens = new Map<string, Principal>(Object.entries(DEV_TOKENS));
  readonly startedAt: number;
  autoApplyQueue = true;

  private readonly listeners = new Set<(ev: RadarEvent) => void>();
  private readonly history = new Map<string, HistoryEntry[]>();
  private readonly blocks: BlockRecord[] = [];
  private readonly requestReasons = new Map<string, string>();
  private readonly notifications: { id: number; memberId: string; message: string; ts: number }[] = [];
  /** taskId → path → version before the task first touched it. */
  private readonly touches = new Map<string, Map<string, number>>();
  private readonly allocSource = new Map<string, AllocationSource>();
  private readonly baseCommit = new Map<string, string | null>();
  private readonly heartbeats = new Map<string, number>();
  private readonly activityWindow = new Map<string, { second: number; count: number }>();
  private ignore = createIgnoreMatcherFromText('');

  constructor(private readonly now: () => number = Date.now) {
    this.startedAt = now();
  }

  // ---- event log ---------------------------------------------------------------------------------------------

  onEvent(listener: (ev: RadarEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit<T extends RadarEventType>(actor: string, type: T, payload: RadarEventOf<T>['payload']): RadarEventOf<T> {
    return this.append(actor, type, payload) as RadarEventOf<T>;
  }

  /** Scenario steps are already-shaped events; they get fresh ids and timestamps and are validated like any other. */
  emitRaw(actor: string, type: string, payload: unknown): RadarEvent {
    return this.append(actor, type, payload);
  }

  /** Validate against the R2 event schema, log, reduce and broadcast. Throws on an invalid event. */
  private append(actor: string, type: string, payload: unknown): RadarEvent {
    const ev = parseRadarEvent({ id: this.state.cursor + 1, ts: this.now(), actor, type, payload });
    if (!ev) throw new Error(`mock emitted an invalid ${type} event: ${JSON.stringify(payload)}`);
    this.events.push(ev);
    this.state = applyEvent(this.state, ev);
    if (ev.type === 'file.changed' && ev.payload.taskId) this.touch(ev.payload.taskId, ev.payload.path, ev.payload.version - 1);
    for (const l of this.listeners) l(ev);
    return ev;
  }

  seed(workspace = 'toko-demo', members = DEFAULT_MEMBERS, headCommit: string | null = null): void {
    this.emit('server', 'workspace.created', { workspaceId: workspace, headCommit, fileCount: this.files.size });
    for (const m of members) this.emit('server', 'member.created', { memberId: m.id, name: m.name, role: m.role });
  }

  reset(): void {
    this.state = initialState();
    this.events.length = 0;
    this.files.clear();
    this.history.clear();
    this.blocks.length = 0;
    this.requestReasons.clear();
    this.notifications.length = 0;
    this.touches.clear();
    this.allocSource.clear();
    this.baseCommit.clear();
    this.heartbeats.clear();
  }

  setGitignore(text: string): void {
    this.ignore = createIgnoreMatcherFromText(text);
  }

  // ---- helpers -----------------------------------------------------------------------------------------------

  principal(authorization: string | undefined | null): Principal | null {
    const m = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
    return m?.[1] ? (this.tokens.get(m[1]) ?? null) : null;
  }

  private memberName(id: string): string {
    return this.state.members[id]?.name ?? id;
  }

  private task(id: string): TaskView {
    const t = this.state.tasks[id];
    if (!t) throw new HttpError(404, 'NOT_FOUND', `task ${id} tidak ada`);
    return t;
  }

  private touch(taskId: string, path: string, before: number): void {
    const m = this.touches.get(taskId) ?? new Map<string, number>();
    if (!m.has(path)) m.set(path, Math.max(before, 0));
    this.touches.set(taskId, m);
  }

  private holderOf(lock: LockView): LockHolder {
    return {
      memberId: lock.memberId,
      memberName: this.memberName(lock.memberId),
      taskId: lock.taskId,
      taskTitle: this.state.tasks[lock.taskId]?.title ?? lock.taskId,
      state: lock.state,
    };
  }

  private setActive(memberId: string, taskId: string | null): void {
    const m = this.state.members[memberId];
    if (!m || m.activeTaskId === taskId) return;
    this.state = { ...this.state, members: { ...this.state.members, [memberId]: { ...m, activeTaskId: taskId } } };
  }

  private locksOf(taskId: string): LockView[] {
    return Object.values(this.state.locks).filter((l) => l.taskId === taskId);
  }

  isIgnored(path: string): boolean {
    return this.ignore.ignores(path);
  }

  /** R4 §4. With `create=false` it never makes an adhoc task (used by the brief). */
  resolveActiveTask(memberId: string, create = true): string | null {
    const mine = Object.values(this.state.tasks).filter((t) => t.ownerId === memberId);
    const active = this.state.members[memberId]?.activeTaskId;
    const current = active ? this.state.tasks[active] : undefined;
    let pick: TaskView | undefined =
      current && current.ownerId === memberId && OPEN_TASK.has(current.status) ? current : undefined;
    pick ??= mine.filter((t) => t.status === 'dikerjakan').sort((a, b) => idNum(b.id) - idNum(a.id))[0];
    pick ??= mine.filter((t) => t.status === 'terbuka').sort((a, b) => idNum(a.id) - idNum(b.id))[0];
    if (!pick && !create) return null;
    const id = pick?.id ?? this.createTask({ title: `Adhoc ${memberId}`, ownerId: memberId, status: 'dikerjakan', adhoc: true });
    this.setActive(memberId, id);
    return id;
  }

  private createTask(t: {
    title: string;
    description?: string;
    ownerId: string;
    status: TaskStatus;
    adhoc: boolean;
    files?: string[];
    queuedFiles?: string[];
    parentTaskId?: string | null;
  }): string {
    const taskId = nextId('T', Object.keys(this.state.tasks), 0);
    this.baseCommit.set(taskId, this.state.workspace.headCommit);
    this.emit('server', 'task.created', {
      taskId,
      title: t.title,
      description: t.description ?? '',
      ownerId: t.ownerId,
      status: t.status,
      files: t.files ?? [],
      queuedFiles: t.queuedFiles ?? [],
      adhoc: t.adhoc,
      parentTaskId: t.parentTaskId ?? null,
    });
    return taskId;
  }

  private setTaskStatus(taskId: string, to: TaskStatus, by: string): void {
    const from = this.task(taskId).status;
    if (from !== to) this.emit(by, 'task.status', { taskId, from, to, by });
  }

  private markTaskWorking(taskId: string, by: string): void {
    if (this.state.tasks[taskId]?.status === 'terbuka') this.setTaskStatus(taskId, 'dikerjakan', by);
  }

  // ---- R4 §3 checkWrite ----------------------------------------------------------------------------------------

  /** Workspace-relative POSIX path, or null for absolute / `..`-climbing input. */
  private relative(rawPath: string): string | null {
    try {
      return normalizeRelative(rawPath);
    } catch (err) {
      if (err instanceof PathOutsideWorkspaceError) return null;
      throw err;
    }
  }

  checkWrite(p: MemberPrincipal, rawPath: string, via: BlockVia): LockCheckResult {
    let path: string;
    try {
      path = normalizeRelative(rawPath);
    } catch (err) {
      if (err instanceof PathOutsideWorkspaceError) return { path: rawPath, decision: 'allow', reason: 'ignored_path' };
      throw err;
    }
    if (path === '' || this.isIgnored(path)) return { path, decision: 'allow', reason: 'ignored_path' };
    if (p.role === 'pm') return { path, decision: 'block', reason: 'pm_readonly' };

    const lock = this.state.locks[path];
    if (!lock) {
      const taskId = this.resolveActiveTask(p.memberId)!;
      this.allocSource.set(`${taskId}\0${path}`, 'auto');
      this.emit(p.memberId, 'lock.acquired', { path, taskId, memberId: p.memberId, auto: true });
      this.markTaskWorking(taskId, p.memberId);
      return { path, decision: 'allow', reason: 'grabbed' };
    }

    if (lock.memberId === p.memberId) {
      if (lock.state === 'dipesan') {
        this.emit(p.memberId, 'lock.acquired', { path, taskId: lock.taskId, memberId: p.memberId, auto: false });
      } else if (lock.state === 'review') {
        this.setTaskStatus(lock.taskId, 'dikerjakan', p.memberId);
        for (const l of this.locksOf(lock.taskId).filter((x) => x.state === 'review')) {
          this.emit(p.memberId, 'lock.acquired', { path: l.path, taskId: l.taskId, memberId: p.memberId, auto: false });
        }
        for (const prop of Object.values(this.state.proposals)) {
          if (prop.kind === 'review' && prop.status === 'menunggu' && prop.refId === lock.taskId) {
            this.emit('server', 'proposal.decided', { proposalId: prop.id, kind: 'review', status: 'kedaluwarsa', by: 'server' });
          }
        }
      }
      this.markTaskWorking(lock.taskId, p.memberId);
      this.setActive(p.memberId, lock.taskId);
      return { path, decision: 'allow', reason: 'own' };
    }

    return this.blockFor(p.memberId, path, via, lock);
  }

  private blockFor(memberId: string, path: string, via: BlockVia, lock: LockView): LockCheckResult {
    const reqTask = this.resolveActiveTask(memberId);
    const requestId = this.openRequest(memberId, reqTask, path, via, lock).id;
    const holder = this.holderOf(lock);
    this.blocks.push({ memberId, taskId: reqTask, path, ts: this.now(), via, requestId, holder });
    this.emit(memberId, 'lock.blocked', {
      path,
      memberId,
      taskId: reqTask,
      holderMemberId: lock.memberId,
      holderTaskId: lock.taskId,
      via,
      requestId,
    });
    const reason = lock.state === 'dipesan' ? 'reserved_by_other' : lock.state === 'review' ? 'in_review_by_other' : 'held_by_other';
    const at = reqTask ? lock.queue.indexOf(reqTask) : -1;
    return { path, decision: 'block', reason, holder, requestId, queuePos: at >= 0 ? at + 1 : null };
  }

  /** One active request per (task, path): SV-05 / I10. */
  private openRequest(
    memberId: string,
    taskId: string | null,
    path: string,
    source: 'hook' | 'sync' | 'mcp',
    lock: LockView | undefined,
    reason = '',
  ): { id: string; duplicate: boolean } {
    const existing = Object.values(this.state.requests).find(
      (r) => r.requesterTaskId === taskId && r.path === path && (r.status === 'terbuka' || r.status === 'diusulkan'),
    );
    if (existing) return { id: existing.id, duplicate: true };
    const requestId = nextId('R', Object.keys(this.state.requests), 1);
    this.requestReasons.set(requestId, reason);
    this.emit(memberId, 'request.created', {
      requestId,
      path,
      requesterMemberId: memberId,
      requesterTaskId: taskId,
      holderMemberId: lock?.memberId ?? null,
      holderTaskId: lock?.taskId ?? null,
      source,
    });
    return { id: requestId, duplicate: false };
  }

  private suggestion(memberId: string, taskId: string | null): string {
    if (!taskId) return 'Tunggu keputusan PM atau panggil radar my_tasks.';
    const task = this.state.tasks[taskId];
    const writable = [...new Set([...(task?.files ?? []), ...this.locksOf(taskId).map((l) => l.path)])].filter((path) => {
      const l = this.state.locks[path];
      return !l || (l.memberId === memberId && l.taskId === taskId);
    });
    return writable.length > 0
      ? `Lanjutkan file lain di task ${taskId}: ${writable.slice(0, 3).join(', ')}.`
      : `Tunggu keputusan PM untuk task ${taskId}.`;
  }

  // ---- REST handlers (R3 §2) -----------------------------------------------------------------------------------

  health() {
    return { ok: true, workspace: this.state.workspace.id, version: '0.2.0-mock', uptimeMs: this.now() - this.startedAt };
  }

  locksCheck(p: MemberPrincipal, paths: readonly string[]): LockCheckRes {
    const started = this.now();
    const results = paths.map((path) => this.checkWrite(p, path, 'hook'));
    const blocked = results.find((r) => r.decision === 'block');
    const activeTaskId = p.role === 'pm' ? null : (this.state.members[p.memberId]?.activeTaskId ?? null);
    let message = '';
    if (blocked?.reason === 'pm_readonly') {
      message = 'RADAR: PM hanya membaca. Edit file dikerjakan coder; usulkan lewat main agent.';
    } else if (blocked?.holder) {
      const h = blocked.holder;
      message =
        `RADAR: ${blocked.path} sedang dipegang Bob milik ${h.memberName} (${h.taskId} ${h.taskTitle}). ` +
        `Edit dibatalkan. Jangan coba ulang dan jangan ubah lewat shell. Panggil radar why_blocked, beri tahu user, ` +
        `lalu kerjakan bagian lain dari task ${activeTaskId ?? 'kamu'}.`;
    }
    return { decision: blocked ? 'block' : 'allow', results, activeTaskId, message, serverMs: this.now() - started };
  }

  brief(p: MemberPrincipal, kind: 'start' | 'prompt', since: number | undefined) {
    const lines = kind === 'start' ? this.briefStart(p) : this.briefPrompt(p, since ?? 0);
    return { lines: clampBrief(lines), cursor: this.state.cursor };
  }

  private taskLine(taskId: string | null): string | null {
    const t = taskId ? this.state.tasks[taskId] : undefined;
    return t ? `Task aktif: ${t.id} ${t.title} (${t.status}).` : null;
  }

  private briefStart(p: MemberPrincipal): string[] {
    const me = p.memberId;
    const taskId = this.resolveActiveTask(me, false);
    const lines: string[] = [];
    const taskLine = this.taskLine(taskId);
    lines.push(`Kamu ${me} (${p.role}). ${taskLine ?? 'Belum ada task. Tunggu rencana PM atau panggil radar my_tasks.'}`);

    const myTasks = new Set(Object.values(this.state.tasks).filter((t) => t.ownerId === me).map((t) => t.id));
    const locks = Object.values(this.state.locks);
    const mine = locks.filter((l) => l.memberId === me).map((l) => l.path);
    const queued = locks.flatMap((l) => {
      const i = l.queue.findIndex((t) => myTasks.has(t));
      return i >= 0 ? [`${l.path} (antre #${i + 1})`] : [];
    });
    if (mine.length + queued.length > 0) lines.push(`File kamu: ${[...mine, ...queued].join(', ')}`);

    const others = locks
      .filter((l) => l.memberId !== me)
      .sort((a, b) => Number(b.queue.some((t) => myTasks.has(t))) - Number(a.queue.some((t) => myTasks.has(t))))
      .slice(0, 4)
      .map((l) => `${l.path}→${l.memberId}(${l.taskId})`);
    if (others.length > 0) lines.push(`Dipegang orang lain: ${others.join(', ')}`);

    const waiting = Object.values(this.state.requests)
      .filter((r) => r.requesterMemberId === me && (r.status === 'terbuka' || r.status === 'diusulkan'))
      .map((r) => `${r.path} (${r.id})`);
    if (waiting.length > 0) lines.push(`Menunggu PM: ${waiting.join(', ')}.`);

    const note = this.notifications.filter((n) => n.memberId === me).at(-1);
    if (note) lines.push(`Catatan PM: ${note.message}`);
    lines.push('Jangan edit file milik orang lain. Kalau ditolak: radar why_blocked.');
    return lines;
  }

  private briefPrompt(p: MemberPrincipal, since: number): string[] {
    const me = p.memberId;
    const fresh = this.events.filter((e) => e.id > since);
    const myRequests = new Set(Object.values(this.state.requests).filter((r) => r.requesterMemberId === me).map((r) => r.id));
    const lines: string[] = [];

    const lastBlock = fresh.filter((e): e is RadarEventOf<'lock.blocked'> => e.type === 'lock.blocked' && e.payload.memberId === me).at(-1);
    if (lastBlock) {
      const b = lastBlock.payload;
      lines.push(
        `Edit ${b.path} DITOLAK: dipegang ${b.holderMemberId} (${b.holderTaskId}). Jangan coba ulang, jangan lewat shell. ${this.suggestion(me, b.taskId)}`,
      );
    }
    for (const e of fresh) {
      if (e.type === 'request.decided' && myRequests.has(e.payload.requestId)) {
        const r = this.state.requests[e.payload.requestId];
        const outcome = e.payload.outcome;
        lines.push(
          outcome === 'antre'
            ? `Keputusan PM: kamu antre ${r?.path} setelah ${r?.holderTaskId ?? 'pemegang'}.`
            : outcome === 'ditolak'
              ? `Keputusan PM: permintaan ${r?.path} ditolak.`
              : `Keputusan PM (${outcome}): ${r?.path} (${e.payload.requestId}).`,
        );
      } else if (e.type === 'notify.sent' && e.payload.memberId === me) {
        lines.push(`Catatan PM: ${e.payload.message}`);
      } else if (e.type === 'lock.transferred' && e.payload.toMemberId === me) {
        lines.push(`Giliranmu: ${e.payload.path} kini dipesan untuk ${e.payload.toTaskId}.`);
      } else if (e.type === 'lock.reserved' && e.payload.memberId === me && e.payload.source !== 'plan') {
        lines.push(`Giliranmu: ${e.payload.path} kini dipesan untuk ${e.payload.taskId}.`);
      }
    }
    const changed = new Map<string, string>();
    for (const e of fresh) {
      if (e.type === 'file.changed' && e.payload.by !== me) changed.set(e.payload.path, `${e.payload.path} (${e.payload.by},v${e.payload.version})`);
    }
    if (changed.size > 0) lines.push(`Berubah: ${[...changed.values()].slice(-5).join(', ')}`);
    if (lines.length === 0) return [];
    const taskLine = this.taskLine(this.resolveActiveTask(me, false));
    return taskLine ? [...lines, taskLine] : lines;
  }

  private taskItem(t: TaskView): TaskItem {
    const paths = new Set([...t.files, ...t.queuedFiles]);
    for (const l of Object.values(this.state.locks)) if (l.taskId === t.id || l.queue.includes(t.id)) paths.add(l.path);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      ownerId: t.ownerId,
      status: t.status,
      adhoc: t.adhoc,
      baseCommit: this.baseCommit.get(t.id) ?? null,
      editCount: t.editCount,
      files: [...paths].map((path) => {
        const l = this.state.locks[path];
        if (l?.taskId === t.id) return { path, lock: l.state, queuePos: 0 };
        const i = l ? l.queue.indexOf(t.id) : -1;
        if (l && i >= 0) return { path, lock: null, queuePos: i + 1, waitingFor: l.taskId };
        return { path, lock: null, queuePos: null };
      }),
    };
  }

  tasks(p: MemberPrincipal, owner: string | undefined, status: 'open' | 'all' | undefined) {
    const ownerId = !owner || owner === 'me' ? p.memberId : owner;
    const tasks = Object.values(this.state.tasks)
      .filter((t) => t.ownerId === ownerId && (status === 'all' || OPEN_TASK.has(t.status)))
      .sort((a, b) => idNum(a.id) - idNum(b.id))
      .map((t) => this.taskItem(t));
    return { tasks, activeTaskId: this.state.members[p.memberId]?.activeTaskId ?? null };
  }

  activate(p: MemberPrincipal, taskId: string) {
    const t = this.task(taskId);
    if (t.ownerId !== p.memberId) throw new HttpError(403, 'FORBIDDEN', `${taskId} bukan task kamu`);
    if (t.status !== 'terbuka' && t.status !== 'dikerjakan') throw new HttpError(409, 'CONFLICT', `${taskId} berstatus ${t.status}`);
    this.setActive(p.memberId, taskId);
    return { activeTaskId: taskId };
  }

  blocksLast(p: MemberPrincipal): BlockLastRes {
    const b = this.blocks.filter((x) => x.memberId === p.memberId).at(-1);
    if (!b) return { block: null };
    const lock = this.state.locks[b.path];
    const req = b.requestId ? this.state.requests[b.requestId] : undefined;
    const queue = lock
      ? [lock.taskId, ...lock.queue].map((taskId) => ({ taskId, memberId: this.state.tasks[taskId]?.ownerId ?? '?' }))
      : [];
    return {
      block: {
        path: b.path,
        ts: b.ts,
        via: b.via,
        holder: lock ? { ...this.holderOf(lock), sinceMs: this.now() - b.ts } : b.holder,
        requestId: b.requestId,
        requestStatus: req?.status ?? null,
        queue,
        suggestion: `File ini milik ${b.holder.taskId}.${b.requestId ? ` Permintaanmu ${b.requestId} sudah masuk antrean PM.` : ''} ${this.suggestion(p.memberId, b.taskId)}`,
      },
    };
  }

  requestFile(p: MemberPrincipal, rawPath: string, reason: string) {
    const path = this.relative(rawPath);
    if (path === null) throw new HttpError(422, 'VALIDATION', `path ${rawPath} di luar workspace`);
    const lock = this.state.locks[path];
    if (!lock || lock.memberId === p.memberId) {
      return { status: 200, body: { requestId: null, status: 'bebas' as const, message: 'File bebas, langsung edit saja.' } };
    }
    const taskId = this.resolveActiveTask(p.memberId);
    const r = this.openRequest(p.memberId, taskId, path, 'mcp', lock, reason);
    const status = this.state.requests[r.id]?.status ?? 'terbuka';
    return { status: r.duplicate ? 200 : 201, body: { requestId: r.id, status, duplicate: r.duplicate } };
  }

  activity(path: string | undefined, limit = 20) {
    const withPath = (e: RadarEvent): string | undefined =>
      'path' in e.payload && typeof e.payload.path === 'string' ? e.payload.path : undefined;
    const items = [...this.events]
      .reverse()
      .filter((e) => withPath(e) !== undefined && (!path || withPath(e) === path))
      .flatMap((e) => {
        const text = feedText(e);
        return text ? [{ ts: e.ts, actor: e.actor, type: e.type, path: withPath(e), summary: text.slice(6) }] : [];
      })
      .slice(0, limit);
    return { items };
  }

  submit(p: MemberPrincipal, taskId: string, summary: string) {
    const t = this.task(taskId);
    if (t.ownerId !== p.memberId) throw new HttpError(403, 'FORBIDDEN', `${taskId} bukan task kamu`);
    const touched = [...(this.touches.get(taskId)?.keys() ?? [])];
    if (t.status !== 'dikerjakan' && !(t.status === 'terbuka' && touched.length > 0)) {
      throw new HttpError(409, 'CONFLICT', `${taskId} berstatus ${t.status}`);
    }
    if (touched.length === 0) throw new HttpError(409, 'CONFLICT', `${taskId} belum mengubah file apa pun`);
    this.emit(p.memberId, 'task.submitted', { taskId, summary, files: touched });
    this.setTaskStatus(taskId, 'review', p.memberId);
    for (const l of this.locksOf(taskId)) this.emit(p.memberId, 'lock.review', { path: l.path, taskId });
    return { taskId, status: 'review' as const, files: touched };
  }

  team() {
    const now = this.now();
    return {
      members: Object.values(this.state.members).map((m) => {
        const hb = this.heartbeats.get(m.id);
        return {
          id: m.id,
          name: m.name,
          role: m.role,
          online: m.online,
          lastHeartbeatMs: hb === undefined ? null : now - hb,
          activeTaskId: m.activeTaskId,
        };
      }),
      tasks: Object.values(this.state.tasks).map((t) => ({
        id: t.id,
        title: t.title,
        ownerId: t.ownerId,
        status: t.status,
        files: this.taskItem(t).files.map((f) => f.path),
        editCount: t.editCount,
      })),
      locks: Object.values(this.state.locks),
      openRequests: Object.values(this.state.requests).filter((r) => r.status === 'terbuka').length,
      pendingProposals: Object.values(this.state.proposals).filter((x) => x.status === 'menunggu').length,
      headCommit: this.state.workspace.headCommit,
    };
  }

  requests(status: 'terbuka' | 'diusulkan' | 'all' = 'terbuka') {
    const out: RequestItem[] = Object.values(this.state.requests)
      .filter((r) => status === 'all' || r.status === status)
      .map((r) => {
        const rt = r.requesterTaskId ? this.state.tasks[r.requesterTaskId] : undefined;
        const lock = this.state.locks[r.path];
        const ht = lock ? this.state.tasks[lock.taskId] : undefined;
        return {
          id: r.id,
          path: r.path,
          status: r.status,
          source: r.source,
          reason: this.requestReasons.get(r.id) ?? '',
          requester: {
            memberId: r.requesterMemberId,
            taskId: r.requesterTaskId,
            taskTitle: rt?.title ?? '',
            taskDescription: rt?.description ?? '',
          },
          holder: lock
            ? {
                memberId: lock.memberId,
                taskId: lock.taskId,
                taskTitle: ht?.title ?? '',
                taskDescription: ht?.description ?? '',
                state: lock.state,
                editCount: ht?.editCount ?? 0,
              }
            : null,
          fileVersion: this.state.files[r.path]?.version ?? 0,
          createdAt: r.createdAt,
        };
      });
    return { requests: out };
  }

  // ---- proposals (R3 §2.12–2.14, R4 §6) --------------------------------------------------------------------------

  proposalItem(p: ProposalView): ProposalItem {
    return { id: p.id, kind: p.kind, status: p.status, payload: p.payload, reason: p.reason, refId: p.refId, createdAt: p.createdAt };
  }

  proposals(status: string | undefined) {
    const list = Object.values(this.state.proposals)
      .filter((p) => !status || status === 'all' || p.status === status)
      .sort((a, b) => a.createdAt - b.createdAt || idNum(a.id) - idNum(b.id));
    return { proposals: list.map((p) => this.proposalItem(p)) };
  }

  createProposal(actor: string, req: ProposalCreateReq) {
    let refId: string | null = null;
    if (req.kind === 'plan') {
      for (const t of req.payload.tasks) {
        if (this.state.members[t.ownerId]?.role !== 'coder') throw new HttpError(422, 'VALIDATION', `${t.ownerId} bukan coder`);
      }
    } else if (req.kind === 'decision') {
      const r = this.state.requests[req.payload.requestId];
      if (!r) throw new HttpError(404, 'NOT_FOUND', `request ${req.payload.requestId} tidak ada`);
      if (r.status !== 'terbuka' && r.status !== 'diusulkan') throw new HttpError(409, 'CONFLICT', `${r.id} berstatus ${r.status}`);
      refId = r.id;
    } else {
      const t = this.task(req.payload.taskId);
      if (t.status !== 'review') throw new HttpError(409, 'CONFLICT', `${t.id} belum review`);
      refId = t.id;
    }
    const proposalId = nextId('P', Object.keys(this.state.proposals), 1);
    this.emit(actor, 'proposal.created', { proposalId, kind: req.kind, refId, reason: req.reason, payload: req.payload });
    if (req.kind === 'decision' && req.payload.option === 'antre' && this.autoApplyQueue) {
      this.applyDecision(proposalId, req.payload, true);
      this.emit('server', 'proposal.decided', { proposalId, kind: 'decision', status: 'diterapkan_otomatis', by: 'server' });
      return { proposalId, status: 'diterapkan_otomatis' as const };
    }
    return { proposalId, status: 'menunggu' as const };
  }

  decide(proposalId: string, approve: boolean, note: string | undefined) {
    const prop = this.state.proposals[proposalId];
    if (!prop) throw new HttpError(404, 'NOT_FOUND', `proposal ${proposalId} tidak ada`);
    if (prop.status !== 'menunggu') throw new HttpError(409, 'CONFLICT', `${proposalId} berstatus ${prop.status}`);
    let applied: Record<string, unknown> = {};
    if (!approve) {
      if (prop.kind === 'decision' && prop.refId) {
        this.emit('mc', 'request.decided', { requestId: prop.refId, outcome: 'ditolak', proposalId, auto: false });
      }
    } else if (prop.kind === 'plan') {
      applied = { tasks: this.applyPlan(prop.payload as PlanPayload) };
    } else if (prop.kind === 'decision') {
      applied = this.applyDecision(proposalId, prop.payload as DecisionPayload, false);
    } else {
      applied = this.applyReview(proposalId, prop.payload as ReviewPayload);
    }
    const status = approve ? 'disetujui' : 'ditolak';
    this.emit('mc', 'proposal.decided', { proposalId, kind: prop.kind, status, by: 'mc', note: note ?? null });
    return { proposalId, status, applied };
  }

  private enqueue(path: string, taskId: string, source: AllocationSource): number {
    const owner = this.task(taskId).ownerId;
    this.allocSource.set(`${taskId}\0${path}`, source);
    const lock = this.state.locks[path];
    if (!lock) {
      this.emit('server', 'lock.reserved', { path, taskId, memberId: owner, source });
      return 0;
    }
    if (lock.taskId === taskId) return 0;
    const at = lock.queue.indexOf(taskId);
    if (at >= 0) return at + 1;
    const pos = lock.queue.length + 1;
    this.emit('server', 'lock.queued', { path, taskId, memberId: owner, pos });
    return pos;
  }

  private applyPlan(plan: PlanPayload): Record<string, string> {
    const ids: Record<string, string> = {};
    for (const t of plan.tasks) {
      ids[t.ref] = this.createTask({
        title: t.title,
        description: t.description,
        ownerId: t.ownerId,
        status: 'terbuka',
        adhoc: false,
        files: t.files,
        queuedFiles: t.queuedFiles,
      });
    }
    for (const t of plan.tasks) for (const path of t.files) this.enqueue(path, ids[t.ref]!, 'plan');
    for (const t of plan.tasks) for (const path of t.queuedFiles) this.enqueue(path, ids[t.ref]!, 'plan');
    return ids;
  }

  private applyDecision(proposalId: string, d: DecisionPayload, auto: boolean): Record<string, unknown> {
    const r = this.state.requests[d.requestId];
    if (!r) throw new HttpError(404, 'NOT_FOUND', `request ${d.requestId} tidak ada`);
    const reqTask = r.requesterTaskId ?? this.resolveActiveTask(r.requesterMemberId)!;
    let applied: Record<string, unknown>;
    if (d.option === 'antre') {
      applied = { path: r.path, taskId: reqTask, pos: this.enqueue(r.path, reqTask, 'decision') };
    } else if (d.option === 'pindahkan') {
      const lock = this.state.locks[r.path];
      this.allocSource.set(`${reqTask}\0${r.path}`, 'decision');
      this.emit('server', 'lock.transferred', {
        path: r.path,
        fromTaskId: lock?.taskId ?? null,
        toTaskId: reqTask,
        toMemberId: r.requesterMemberId,
        cause: 'decision',
      });
      applied = { path: r.path, toTaskId: reqTask, fromTaskId: lock?.taskId ?? null };
    } else {
      const nt = d.newTask!;
      const taskId = this.createTask({
        title: nt.title,
        description: nt.description,
        ownerId: nt.ownerId ?? r.requesterMemberId,
        status: 'terbuka',
        adhoc: false,
        queuedFiles: [r.path],
        parentTaskId: reqTask,
      });
      applied = { path: r.path, newTaskId: taskId, pos: this.enqueue(r.path, taskId, 'decision') };
    }
    this.emit(auto ? 'server' : 'mc', 'request.decided', { requestId: r.id, outcome: d.option, proposalId, auto });
    return applied;
  }

  private applyReview(proposalId: string, rv: ReviewPayload): Record<string, unknown> {
    const t = this.task(rv.taskId);
    if (t.status !== 'review') throw new HttpError(409, 'CONFLICT', `${t.id} berstatus ${t.status}`);
    this.emit('mc', 'review.created', { reviewId: proposalId, taskId: t.id, verdict: rv.verdict });
    if (rv.flags.length > 0) this.emit('mc', 'review.flagged', { reviewId: proposalId, taskId: t.id, flags: rv.flags });
    if (rv.verdict === 'kembalikan') {
      this.setTaskStatus(t.id, 'dikerjakan', 'mc');
      for (const l of this.locksOf(t.id)) this.emit('mc', 'lock.acquired', { path: l.path, taskId: t.id, memberId: l.memberId, auto: false });
      if (rv.notes) this.notify('mc', t.ownerId, rv.notes.slice(0, 200));
      return { taskId: t.id, status: 'dikerjakan' };
    }
    const sha = randomBytes(20).toString('hex');
    const files = [...(this.touches.get(t.id)?.keys() ?? [])];
    this.emit('server', 'commit.created', { taskId: t.id, sha, author: t.ownerId, files, pushed: false });
    this.setTaskStatus(t.id, 'selesai', 'mc');
    this.releaseTaskLocks(t.id);
    if (rv.verdict === 'setujui_beri_tahu') for (const n of rv.notify) this.notify('mc', n.memberId, n.message);
    return { taskId: t.id, commitSha: sha, pushed: false };
  }

  private advanceQueue(path: string, fromTaskId: string): { taskId: string; memberId: string } | null {
    const lock = this.state.locks[path];
    const head = lock?.queue[0];
    if (!head) return null;
    const memberId = this.task(head).ownerId;
    this.emit('server', 'lock.transferred', { path, fromTaskId, toTaskId: head, toMemberId: memberId, cause: 'queue' });
    return { taskId: head, memberId };
  }

  private releaseTaskLocks(taskId: string): void {
    for (const l of this.locksOf(taskId)) {
      this.emit('server', 'lock.released', { path: l.path, taskId });
      this.advanceQueue(l.path, taskId);
    }
  }

  // ---- other endpoints -----------------------------------------------------------------------------------------

  taskDiff(taskId: string) {
    const t = this.task(taskId);
    let budget = TASK_DIFF_MAX_PATCH_BYTES;
    let truncated = false;
    const files = [...(this.touches.get(taskId)?.entries() ?? [])].map(([path, fromVersion]) => {
      const f = this.state.files[path];
      const hist = this.history.get(path) ?? [];
      let patch = hist.filter((h) => h.version > fromVersion).map((h) => h.patch).join('\n');
      if (patch.length > budget) {
        patch = patch.slice(0, Math.max(budget, 0));
        truncated = true;
      }
      budget -= patch.length;
      return {
        path,
        change: f?.deleted ? ('deleted' as const) : fromVersion === 0 ? ('added' as const) : ('modified' as const),
        fromVersion,
        toVersion: f?.version ?? fromVersion,
        patch,
        exportsChanged: [],
      };
    });
    return {
      taskId: t.id,
      title: t.title,
      ownerId: t.ownerId,
      status: t.status,
      baseCommit: this.baseCommit.get(t.id) ?? null,
      summary: t.summary,
      files,
      importers: [],
      truncated,
    };
  }

  notify(actor: string, memberId: string, message: string) {
    if (!this.state.members[memberId]) throw new HttpError(404, 'NOT_FOUND', `member ${memberId} tidak ada`);
    const id = this.notifications.length + 1;
    this.notifications.push({ id, memberId, message, ts: this.now() });
    this.emit(actor, 'notify.sent', { notificationId: id, memberId, message, by: actor });
    return { notificationId: id };
  }

  sessionReport() {
    const count = (type: RadarEventType) => this.events.filter((e) => e.type === type).length;
    const stats = {
      tasks: Object.keys(this.state.tasks).length,
      commits: count('commit.created'),
      blocks: count('lock.blocked'),
      decisions: count('request.decided'),
      medianBlockToDecisionMs: null,
      syncP95Ms: null,
      lockCheckP95Ms: null,
    };
    const markdown = [
      '## Laporan sesi (mock)',
      '',
      `- Task: ${stats.tasks}`,
      `- Commit: ${stats.commits}`,
      `- Blokir: ${stats.blocks}`,
      `- Keputusan: ${stats.decisions}`,
    ].join('\n');
    return { markdown, stats };
  }

  revoke(path: string, reason: string) {
    const lock = this.state.locks[path];
    if (!lock) throw new HttpError(404, 'NOT_FOUND', `${path} tidak dikunci`);
    this.emit('mc', 'lock.revoked', { path, taskId: lock.taskId, memberId: lock.memberId, reason });
    return { path, nextHolder: this.advanceQueue(path, lock.taskId) };
  }

  cancel(taskId: string) {
    const t = this.task(taskId);
    if (!['terbuka', 'draf', 'dikerjakan'].includes(t.status)) throw new HttpError(409, 'CONFLICT', `${taskId} berstatus ${t.status}`);
    this.setTaskStatus(taskId, 'batal', 'mc');
    this.releaseTaskLocks(taskId);
    return { taskId, status: 'batal' as const };
  }

  aiEdits(p: MemberPrincipal, paths: string[], tool: string): void {
    for (const path of paths) {
      const last = this.history.get(path)?.at(-1);
      if (last) last.ai = true;
    }
    this.emit(p.memberId, 'ai.edit', { memberId: p.memberId, paths, tool });
  }

  snapshot(): StateRes {
    const s = this.state;
    const allocations = Object.values(s.locks).flatMap((l) =>
      [l.taskId, ...l.queue].map((taskId, queuePos) => ({
        taskId,
        path: l.path,
        queuePos,
        source: this.allocSource.get(`${taskId}\0${l.path}`) ?? 'plan',
      })),
    );
    return {
      workspace: s.workspace,
      members: Object.values(s.members),
      tasks: Object.values(s.tasks),
      locks: Object.values(s.locks),
      allocations,
      files: Object.values(s.files),
      requests: Object.values(s.requests),
      proposals: Object.values(s.proposals),
      recentEvents: this.events.slice(-100),
      cursor: s.cursor,
    };
  }

  fileHistory(path: string, limit = 5) {
    const versions = this.history.get(path);
    if (!versions) throw new HttpError(404, 'NOT_FOUND', `${path} tidak ada riwayat`);
    return { path, versions: [...versions].reverse().slice(0, limit) };
  }

  exportEvents(from = 0, to = Number.MAX_SAFE_INTEGER) {
    return { workspace: this.state.workspace.id, exportedAt: this.now(), events: this.events.filter((e) => e.id >= from && e.id <= to) };
  }

  /** R3 §2.24. Returns false when the 20/s budget for this member is spent (the caller still answers 204). */
  bobActivity(p: MemberPrincipal, req: BobActivityReq): boolean {
    const second = Math.floor(this.now() / 1000);
    const w = this.activityWindow.get(p.memberId);
    const count = w && w.second === second ? w.count + 1 : 1;
    this.activityWindow.set(p.memberId, { second, count });
    if (count > ACTIVITY_PER_SECOND) return false;
    const payload = { memberId: p.memberId, ...req };
    delete payload.clientTs;
    this.emit(p.memberId, 'bob.activity', payload);
    return true;
  }

  heartbeat(memberId: string): void {
    this.heartbeats.set(memberId, this.now());
  }

  // ---- files (WS file.update, R4 "Penerimaan file.update") ------------------------------------------------------

  async applyUpdate(
    p: MemberPrincipal,
    u: { path: string; baseVersion: number; content: string; hash: string },
  ): Promise<
    | { ok: true; version: number; hash: string; changed: boolean; taskId: string | null }
    | { ok: false; reason: 'held_by_other' | 'committing' | 'pm_readonly' | 'conflict' | 'too_large' | 'binary'; holder?: LockHolder }
  > {
    if (new TextEncoder().encode(u.content).byteLength > MAX_FILE_BYTES) return { ok: false, reason: 'too_large' };
    if (u.content.includes('\0')) return { ok: false, reason: 'binary' };
    if ((await sha256Hex(u.content)) !== u.hash) return { ok: false, reason: 'conflict' };
    const path = this.relative(u.path);
    if (path === null) return { ok: false, reason: 'conflict' };
    const r = this.checkWrite(p, path, 'sync');
    if (r.decision === 'block') {
      const reason = r.reason === 'pm_readonly' || r.reason === 'committing' ? r.reason : 'held_by_other';
      this.emit(p.memberId, 'file.rejected', {
        path,
        by: p.memberId,
        reason,
        holderMemberId: r.holder?.memberId ?? null,
        holderTaskId: r.holder?.taskId ?? null,
      });
      return r.holder ? { ok: false, reason, holder: r.holder } : { ok: false, reason };
    }
    const f = this.state.files[path];
    if (f && u.baseVersion < f.version && f.updatedBy !== p.memberId) return { ok: false, reason: 'conflict' };
    const prev = this.files.get(path);
    const taskId = this.state.locks[path]?.taskId ?? null;
    if (f && !f.deleted && prev?.hash === u.hash) return { ok: true, version: f.version, hash: u.hash, changed: false, taskId };
    const version = (f?.version ?? 0) + 1;
    const patch = naivePatch(path, prev?.content ?? null, u.content);
    this.files.set(path, { content: u.content, hash: u.hash });
    const hist = this.history.get(path) ?? [];
    hist.push({ version, by: p.memberId, taskId, ai: false, ts: this.now(), patch });
    this.history.set(path, hist);
    this.emit(p.memberId, 'file.changed', {
      path,
      version,
      hash: u.hash,
      by: p.memberId,
      taskId,
      size: new TextEncoder().encode(u.content).byteLength,
      patch,
    });
    return { ok: true, version, hash: u.hash, changed: true, taskId };
  }

  /** `POST /admin/files`: import at version 1 without events (the snapshot carries them). */
  async importFiles(headCommit: string | null, files: readonly { path: string; content: string }[]): Promise<number> {
    let inserted = 0;
    const views = { ...this.state.files };
    for (const file of files) {
      const path = this.relative(file.path);
      if (path === null || this.isIgnored(path)) continue;
      const hash = await sha256Hex(file.content);
      this.files.set(path, { content: file.content, hash });
      this.history.set(path, [{ version: 1, by: 'server', taskId: null, ai: false, ts: this.now(), patch: naivePatch(path, null, file.content) }]);
      views[path] = { path, version: 1, updatedBy: null, updatedAt: this.now(), writingUntil: 0, deleted: false };
      inserted++;
    }
    this.state = { ...this.state, files: views, workspace: { ...this.state.workspace, headCommit: headCommit ?? this.state.workspace.headCommit } };
    return inserted;
  }
}
