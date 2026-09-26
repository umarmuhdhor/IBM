// What routes and WebSocket handlers need from the Durable Object. Kept as an interface so handlers never reach
// into the DO class directly.
import type { Db } from './db/sql';
import type { ActivityLimiter } from './services/activity';
import type { AuthorizeWrite } from './services/files';
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
  readonly authorizeWrite: AuthorizeWrite;
  now(): number;
  /** meta.workspace_id, else the DO name, else env.WORKSPACE_ID. */
  workspaceId(): string;
  /** Runs `fn` in one SQLite transaction, then broadcasts what it queued. */
  transact<T>(fn: (uow: UnitOfWork) => T): T;
  /** Deletes every row and the alarm, closes all sockets, and re-creates the empty schema. */
  wipe(): Promise<void>;
}
