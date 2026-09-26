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
import { UnitOfWork } from './services/uow';
import { Hub } from './ws/hub';
import { expireHellos, handleClose, handleMessage, helloDeadline, WS_CLOSE_RESET } from './ws/protocol';
import { AlarmScheduler } from './ws/scheduler';

export class WorkspaceDO extends DurableObject<Env> implements WorkspaceDeps {
  readonly db: Db;
  readonly hub: Hub;
  readonly scheduler: AlarmScheduler;
  readonly limiter = new ActivityLimiter();
  readonly authorizeWrite: AuthorizeWrite = authorizeWriteLocks;
  // Set in the constructor from env (fase 06 owns the default; tests swap in fakes).
  committer!: GitHubCommitter;
  private readonly app: Hono;
  // Re-declared public so the DO itself can serve as WorkspaceDeps.
  declare readonly ctx: DurableObjectState<Record<string, never>>;
  declare readonly env: Env;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.committer = createCommitter(env);
    this.db = createDb(ctx.storage);
    this.hub = new Hub(ctx);
    this.scheduler = new AlarmScheduler(ctx.storage, [() => helloDeadline(this)]);
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
    this.hub.flush(uow);
    return result;
  }

  async wipe(): Promise<void> {
    this.hub.closeAll(WS_CLOSE_RESET, 'workspace reset');
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    migrate(this.db);
    this.limiter.clear();
  }

  override fetch(request: Request): Response | Promise<Response> {
    return this.app.fetch(request);
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    handleMessage(this, ws, message);
  }

  override webSocketClose(ws: WebSocket): void {
    handleClose(this, ws);
  }

  override webSocketError(ws: WebSocket): void {
    handleClose(this, ws);
  }

  override async alarm(): Promise<void> {
    expireHellos(this);
    await this.scheduler.reschedule();
  }
}
