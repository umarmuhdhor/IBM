// What routes and WebSocket handlers need from the Durable Object. Kept as an interface so handlers never reach
// into the DO class directly.
import type { GitHubCommitter } from './committer';
import type { Db } from './db/sql';
import type { ActivityLimiter } from './services/activity';
import type { AuthorizeWrite } from './services/files';
import type { LockCtx } from './services/locks';
import type { RateLimiter } from './services/rate-limit';
import type { UnitOfWork } from './services/uow';
import type { Hub } from './ws/hub';
import type { AlarmScheduler } from './ws/scheduler';

export interface WorkspaceDeps {
  readonly db: Db;
  readonly hub: Hub;
  readonly env: Env;
  readonly ctx: DurableObjectState;
  readonly scheduler: AlarmScheduler;
  readonly limiter: ActivityLimiter;
  /** 60/min per token on mc and proposal writes (fase 12). */
  readonly rateLimiter: RateLimiter;
  readonly authorizeWrite: AuthorizeWrite;
  /** Commits an approved task (R4 §6.3). Fase 05: stub; fase 06: GitHub Git Data API. */
  readonly committer: GitHubCommitter;
  now(): number;
  /** meta.workspace_id, else the DO name, else env.WORKSPACE_ID. */
  workspaceId(): string;
  /** Runs `fn` in one SQLite transaction, then broadcasts what it queued. */
  transact<T>(fn: (uow: UnitOfWork) => T): T;
  /** Deletes every row and the alarm, closes all sockets, and re-creates the empty schema. */
  wipe(): Promise<void>;
}

/** Lock context for one transaction of `deps.transact`, with a single clock reading. */
export function ctxOf(deps: WorkspaceDeps, uow: UnitOfWork): LockCtx {
  return { db: deps.db, uow, now: deps.now() };
}
