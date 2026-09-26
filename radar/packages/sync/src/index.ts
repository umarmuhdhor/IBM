// @radar/sync: the sync agent behind the `radar` CLI (fase 04).
export const PACKAGE_NAME = '@radar/sync';
export { SyncAgent, SYNC_CLIENT_VERSION, WS_CLOSE_REPLACED, WS_CLOSE_RESET, type SyncAgentOptions, type SyncStats, type SyncStatus, type LockView } from './agent.js';
export { KnownStore, type KnownEntry } from './known.js';
export { atomicWrite, hashText, readLocal, removeLocal, safeRelative, UnsafePathError, type LocalFile } from './writer.js';
export { writeSidecar, type SidecarKind } from './sidecar.js';
export { formatRejection, terminalNotifier, type Notice, type Notifier } from './notify.js';
export { createWatcher, listFiles, type SyncMode, type Watcher } from './watcher.js';
export { findKitDir, installKit, type KitResult, type KitRole } from './kit.js';
export { createSyncLog, type SyncLog } from './log.js';
