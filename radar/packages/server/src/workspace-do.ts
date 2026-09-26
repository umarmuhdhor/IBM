// One Durable Object per workspace (R2 §1, fase 03). Owns the SQLite data, the WebSocket hub and the single
// alarm. The constructor runs again after every hibernation wake, so it only rebuilds cheap, stateless helpers.
import { WS_PING_FRAME, WS_PONG_FRAME } from '@radar/common';
import { DurableObject } from 'cloudflare:workers';
import type { Hono } from 'hono';
import type { GitHubCommitter } from './committer';
import type { WorkspaceDeps } from './deps';
import { migrate } from './db/migrate';
import { getMeta } from './db/repo/meta';
import { createDb, type Db } from './db/sql';
import { createApp } from './http/routes';
import { ActivityLimiter } from './services/activity';
import { authorizeWriteLocks, type AuthorizeWrite } from './services/files';
import { createCommitter } from './services/github';
import { expireCommitClaims } from './services/proposals';
import { RateLimiter } from './services/rate-limit';
import { expireHeartbeats, staleDeadline } from './services/stale';
import { UnitOfWork } from './services/uow';
import { Hub } from './ws/hub';
import { expireHellos, handleClose, handleMessage, helloDeadline, WS_CLOSE_RESET } from './ws/protocol';
import { AlarmScheduler } from './ws/scheduler';

export class WorkspaceDO extends DurableObject<Env> implements WorkspaceDeps {
  readonly db: Db;
  readonly hub: Hub;
  readonly scheduler: AlarmScheduler;
  readonly limiter = new ActivityLimiter();
  readonly rateLimiter = new RateLimiter();
  readonly authorizeWrite: AuthorizeWrite = authorizeWriteLocks;
  // Set in the constructor from env (fase 06 owns the default; tests swap in fakes).
  committer!: GitHubCommitter;
  private readonly app: Hono;
  /** Set by every write transaction: a WebSocket frame that changed state reschedules the alarm afterwards. */
  private wroteSinceSchedule = false;
  // Re-declared public so the DO itself can serve as WorkspaceDeps.
  declare readonly ctx: DurableObjectState<Record<string, never>>;
  declare readonly env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.committer = createCommitter(env);
    this.db = createDb(ctx.storage);
    this.hub = new Hub(ctx);
    this.scheduler = new AlarmScheduler(ctx.storage, [() => helloDeadline(this), () => staleDeadline(this)]);
    // Keepalive answered by the runtime without waking the DO (R3 §3).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(WS_PING_FRAME, WS_PONG_FRAME));
    // A throw here makes the runtime reset the object and fail the waiting requests; log it so it is visible.
    void ctx.blockConcurrencyWhile(async () => {
      try {
        migrate(this.db);
        // A commit in flight dies with the old instance; its claim must not block a new approval (R4 §6.3).
        this.transact((uow) => expireCommitClaims({ db: this.db, uow, now: this.now() }));
      } catch (err) {
        console.error('radar: schema migration or claim cleanup failed', err instanceof Error ? (err.stack ?? err.message) : String(err));
        throw err;
      }
    });
    this.app = createApp(this);
  }

  now(): number {
    return Date.now();
  }

  workspaceId(): string {
    return getMeta(this.db, 'workspace_id') ?? this.ctx.id.name ?? this.env.WORKSPACE_ID;
  }

  transact<T>(fn: (uow: UnitOfWork) => T): T {
    const uow = new UnitOfWork();
    const result = this.db.tx(() => fn(uow));
    this.wroteSinceSchedule = true;
    this.hub.flush(uow);
    return result;
  }

  async wipe(): Promise<void> {
    this.hub.closeAll(WS_CLOSE_RESET, 'workspace reset');
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    migrate(this.db);
    this.limiter.clear();
    this.rateLimiter.clear();
  }

  override async fetch(request: Request): Promise<Response> {
    const res = await this.app.fetch(request);
    // A write may create the first lock (plan decision): keep the alarm in step. Reads change no deadline, and
    // the WebSocket upgrade (a GET) reschedules for its hello timeout itself.
    if (request.method !== 'GET') await this.scheduler.reschedule();
    return res;
  }

  // A sync frame can grab the first lock (auto-grab in checkWrite) or end a stale episode; a close drops a hello
  // deadline. Reschedule after any of them wrote, so SV-09 does not depend on a later HTTP request.
  private async rescheduleIfWrote(): Promise<void> {
    if (!this.wroteSinceSchedule) return;
    this.wroteSinceSchedule = false;
    await this.scheduler.reschedule();
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    handleMessage(this, ws, message);
    await this.rescheduleIfWrote();
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    handleClose(this, ws);
    await this.rescheduleIfWrote();
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    handleClose(this, ws);
    await this.rescheduleIfWrote();
  }

  override async alarm(): Promise<void> {
    expireHellos(this);
    expireHeartbeats(this);
    await this.scheduler.reschedule();
  }
}
