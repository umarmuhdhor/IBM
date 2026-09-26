// SyncAgent (fase 04): keeps one workspace folder equal to the server over the `sync` WebSocket (R3 §3).
// Every message handler is synchronous, so a snapshot, change or rejection is fully applied on disk before
// the next frame or watcher callback runs.
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import {
  HEARTBEAT_INTERVAL_MS,
  SYNC_DEBOUNCE_MS,
  WS_CLOSE_UNAUTHORIZED,
  WS_PING_FRAME,
  WS_PING_MS,
  WS_PONG_FRAME,
  WsMessageSchema,
  type IgnoreMatcher,
  type Principal,
  type WsMessage,
  type WsMessageOf,
} from '@radar/common';
import { createIgnoreMatcher } from '@radar/common/node';
import { KnownStore } from './known.js';
import { createSyncLog, type SyncLog } from './log.js';
import { formatRejection, terminalNotifier, type Notifier } from './notify.js';
import { writeSidecar } from './sidecar.js';
import { createWatcher, isIgnored, listFiles, type SyncMode, type Watcher } from './watcher.js';
import { atomicWrite, readLocal, removeLocal, safeRelative, UnsafePathError } from './writer.js';

/** Close code for a sync socket replaced by a newer one of the same member (R3 §3). */
export const WS_CLOSE_REPLACED = 4000;
/** Close code when the workspace is reset on the server. */
export const WS_CLOSE_RESET = 1012;
/** Retries for an update the server could not verify (hash or path mismatch). */
const MAX_VERIFY_RETRIES = 3;

export const SYNC_CLIENT_VERSION = '0.3.0';

export interface SyncAgentOptions {
  root: string;
  server: string;
  token: string;
  /** Expected member id; only used in log lines (the server derives the member from the token). */
  member?: string;
  clientVersion?: string;
  mode?: SyncMode;
  debounceMs?: number;
  heartbeatMs?: number;
  pingMs?: number;
  reconnect?: { minMs: number; maxMs: number };
  /** Echo of every `.radar/sync.log` line (the CLI prints them with --verbose). */
  log?: (line: string) => void;
  notify?: Notifier;
}

export interface SyncStats {
  updatesSent: number;
  heartbeatsSent: number;
  applied: number;
  rejected: number;
  conflicts: number;
  reconnects: number;
}

export interface LockView {
  path: string;
  state: string;
  taskId: string | null;
  memberId: string | null;
}

export interface SyncStatus {
  connected: boolean;
  stopped: boolean;
  member: string | null;
  role: 'coder' | 'pm' | null;
  files: number;
  pending: number;
  myLocks: string[];
}

interface Pending {
  id: string;
  hash: string;
  sentAt: number;
}

export class SyncAgent extends EventEmitter {
  readonly known = new KnownStore();
  readonly stats: SyncStats = { updatesSent: 0, heartbeatsSent: 0, applied: 0, rejected: 0, conflicts: 0, reconnects: 0 };
  readonly locks = new Map<string, LockView>();
  principal: Principal | null = null;
  stopReason: string | null = null;

  private readonly root: string;
  private readonly o: Required<Pick<SyncAgentOptions, 'debounceMs' | 'heartbeatMs' | 'pingMs' | 'reconnect' | 'clientVersion' | 'mode'>> & SyncAgentOptions;
  private readonly log: SyncLog;
  private readonly notify: Notifier;
  private matcher: IgnoreMatcher;
  private watcher: Watcher | null = null;
  private ws: WebSocket | null = null;
  private synced = false;
  private everSynced = false;
  private watching = false;
  private isStopped = false;
  private resetSeen = false;
  private attempt = 0;
  private seq = 0;
  private lastPong = 0;
  private readonly pending = new Map<string, Pending>();
  private readonly dirty = new Set<string>();
  private readonly retries = new Map<string, number>();
  private readonly skipped = new Set<string>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private startWaiter: { resolve: () => void; reject: (err: Error) => void } | null = null;

  constructor(opts: SyncAgentOptions) {
    super();
    this.root = opts.root;
    this.o = {
      ...opts,
      clientVersion: opts.clientVersion ?? SYNC_CLIENT_VERSION,
      mode: opts.mode ?? 'watch',
      debounceMs: opts.debounceMs ?? SYNC_DEBOUNCE_MS,
      heartbeatMs: opts.heartbeatMs ?? HEARTBEAT_INTERVAL_MS,
      pingMs: opts.pingMs ?? WS_PING_MS,
      reconnect: opts.reconnect ?? { minMs: 500, maxMs: 8000 },
    };
    this.log = createSyncLog(this.root, opts.log ? { echo: opts.log } : {});
    this.notify = opts.notify ?? terminalNotifier();
    this.matcher = createIgnoreMatcher(this.root);
  }

  get connected(): boolean {
    return this.synced;
  }

  get stopped(): boolean {
    return this.isStopped;
  }

  status(): SyncStatus {
    const me = this.principal?.kind === 'member' ? this.principal : null;
    return {
      connected: this.synced,
      stopped: this.isStopped,
      member: me?.memberId ?? null,
      role: me?.role ?? null,
      files: this.known.size,
      pending: this.pending.size,
      myLocks: me ? [...this.locks.values()].filter((l) => l.memberId === me.memberId).map((l) => l.path) : [],
    };
  }

  /**
   * Connects, writes the first snapshot, then starts the watcher and scans for local edits. Resolves when all
   * of that is done; rejects on 4401/4000. The watcher starts after the snapshot so that folders the snapshot
   * creates are watched too; the scan covers edits made before the watcher was ready.
   */
  async start(): Promise<void> {
    if (this.startWaiter || this.watcher || this.isStopped) throw new Error('SyncAgent already started');
    this.log('start', `${this.o.server} member ${this.o.member ?? '?'} mode ${this.o.mode}`);
    const synced = new Promise<void>((resolve, reject) => {
      this.startWaiter = { resolve, reject };
    });
    this.connect();
    await synced;
    const watcher = createWatcher({
      root: this.root,
      mode: this.o.mode,
      debounceMs: this.o.debounceMs,
      ignores: (rel) => this.matcher.ignores(rel),
      onChange: (rel) => this.processPath(rel),
      // file.delete is P1 (fase 12): deletes are only logged.
      onUnlink: (rel) => this.log('local.unlink', `${rel} (not synced before fase 12)`),
      onError: (err) => this.log('watch.error', err.message),
    });
    this.watcher = watcher;
    await watcher.ready;
    if (this.isStopped) {
      await watcher.close();
      throw new Error(this.stopReason ?? 'stopped');
    }
    this.watching = true;
    if (this.synced) this.scanLocal();
    this.emit('status', this.status());
  }

  async stop(): Promise<void> {
    if (!this.isStopped) {
      this.isStopped = true;
      this.stopReason = 'stopped';
    }
    this.teardown();
    this.startWaiter?.reject(new Error('stopped'));
    this.startWaiter = null;
    const w = this.watcher;
    this.watcher = null;
    await w?.close();
  }

  /** Test hook: drop the socket as a network failure would. */
  dropConnection(): void {
    this.ws?.terminate();
  }

  // ---- connection ------------------------------------------------------------------------------------------

  private connect(): void {
    if (this.isStopped) return;
    const url = `${this.o.server.replace(/\/+$/, '').replace(/^http/, 'ws')}/ws`;
    const ws = new WebSocket(url);
    this.ws = ws;
    this.lastPong = Date.now();
    ws.on('open', () => {
      if (ws !== this.ws) return;
      this.sendMsg({ t: 'hello', d: { token: this.o.token, client: 'sync', clientVersion: this.o.clientVersion, knownVersions: this.known.versions() } });
    });
    ws.on('message', (data: WebSocket.RawData) => {
      if (ws !== this.ws) return;
      this.onFrame(Buffer.isBuffer(data) ? data.toString('utf8') : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)]).toString('utf8'));
    });
    ws.on('close', (code: number, reason: Buffer) => this.onClose(ws, code, reason.toString('utf8')));
    // 'close' always follows 'error' in ws; the reconnect is decided there.
    ws.on('error', (err: Error) => this.log('ws.error', err.message));
  }

  private teardown(): void {
    for (const t of [this.heartbeatTimer, this.pingTimer, this.reconnectTimer]) if (t) clearTimeout(t);
    this.heartbeatTimer = this.pingTimer = this.reconnectTimer = null;
    const ws = this.ws;
    this.ws = null;
    this.synced = false;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      if (ws.readyState === WebSocket.OPEN) ws.close(1000, 'client stop');
      else ws.terminate();
    }
  }

  private halt(reason: string): void {
    this.isStopped = true;
    this.stopReason = reason;
    this.teardown();
    this.log('halt', reason);
    this.notify({ level: 'error', text: `✖ Sync berhenti: ${reason}` });
    this.startWaiter?.reject(new Error(reason));
    this.startWaiter = null;
    const w = this.watcher;
    this.watcher = null;
    void w?.close().catch((err: unknown) => this.log('watch.error', String(err)));
    this.emit('stopped', reason);
    this.emit('status', this.status());
  }

  private onClose(ws: WebSocket, code: number, reason: string): void {
    if (ws !== this.ws) return;
    this.ws = null;
    this.synced = false;
    for (const t of [this.heartbeatTimer, this.pingTimer]) if (t) clearInterval(t);
    this.heartbeatTimer = this.pingTimer = null;
    // Unanswered updates are re-sent by the post-snapshot scan (local hash ≠ known hash).
    this.pending.clear();
    this.log('close', `${code}${reason ? ` ${reason}` : ''}`);
    this.emit('status', this.status());
    if (this.isStopped) return;
    if (code === WS_CLOSE_UNAUTHORIZED) return this.halt(`token ditolak server (${code})`);
    if (code === WS_CLOSE_REPLACED) return this.halt(`diganti agent lain untuk member yang sama (${code})`);
    if (code === WS_CLOSE_RESET) {
      // Fresh workspace: forget agreed versions and do not re-upload local-only files into it.
      this.known.clear();
      this.resetSeen = true;
      this.notify({ level: 'warn', text: 'Workspace di-reset server. File lokal yang tidak ada di server tidak diunggah otomatis.' });
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.attempt++;
    const { minMs, maxMs } = this.o.reconnect;
    const base = Math.min(maxMs, minMs * 2 ** Math.min(this.attempt - 1, 16));
    const delay = Math.round(base * (0.8 + Math.random() * 0.4));
    this.log('reconnect', `attempt ${this.attempt} in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendMsg(msg: WsMessage): boolean {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(msg));
    return true;
  }

  private onFrame(text: string): void {
    // The pong is a DO auto-response string, not part of the message schema.
    if (text === WS_PONG_FRAME) {
      this.lastPong = Date.now();
      return;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      this.log('ws.invalid', `not JSON: ${text.slice(0, 80)}`);
      return;
    }
    const parsed = WsMessageSchema.safeParse(json);
    if (!parsed.success) {
      this.log('ws.invalid', parsed.error.issues[0]?.message ?? 'schema mismatch');
      return;
    }
    const msg = parsed.data;
    try {
      this.dispatch(msg);
    } catch (err) {
      // A failed disk write must not kill the connection; the next snapshot or save repairs the path.
      this.log('handler.error', `${msg.t}: ${(err as Error).message}`);
      this.notify({ level: 'error', text: `✖ Gagal memproses ${msg.t}: ${(err as Error).message}` });
    }
  }

  private dispatch(msg: WsMessage): void {
    switch (msg.t) {
      case 'welcome':
        return this.onWelcome(msg);
      case 'snapshot':
        return this.onSnapshot(msg);
      case 'file.ack':
        return this.onAck(msg);
      case 'file.changed':
        return this.onChanged(msg);
      case 'file.rejected':
        return this.onRejected(msg);
      case 'lock.changed': {
        const d = msg.d;
        if (d.state === 'bebas' || d.memberId === null) this.locks.delete(d.path);
        else this.locks.set(d.path, { path: d.path, state: d.state, taskId: d.taskId, memberId: d.memberId });
        this.emit('status', this.status());
        return;
      }
      case 'notice':
        this.notify({ level: msg.d.level, text: msg.d.message });
        return;
      case 'error':
        this.log('server.error', `${msg.d.code} ${msg.d.message}`);
        return;
      default:
        return;
    }
  }

  private onWelcome(msg: WsMessageOf<'welcome'>): void {
    this.principal = msg.d.principal;
    if (this.everSynced) this.stats.reconnects++;
    this.attempt = 0;
    const who = msg.d.principal.kind === 'member' ? `${msg.d.principal.memberId} (${msg.d.principal.role})` : 'mc';
    this.log('welcome', `${who} workspace ${msg.d.workspace}`);
    this.heartbeatTimer = setInterval(() => {
      if (this.sendMsg({ t: 'heartbeat', d: { ts: Date.now() } })) this.stats.heartbeatsSent++;
    }, this.o.heartbeatMs);
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastPong > 2 * this.o.pingMs) {
        this.log('ping.timeout', `no pong for ${Date.now() - this.lastPong}ms`);
        this.ws?.terminate();
        return;
      }
      this.ws?.send(WS_PING_FRAME);
    }, this.o.pingMs);
  }

  // ---- server → disk --------------------------------------------------------------------------------------

  /** Validates a path from the server; ignored or unsafe paths are logged and skipped. */
  private serverPath(raw: string): string | null {
    try {
      const path = safeRelative(raw);
      if (isIgnored((r) => this.matcher.ignores(r), path, false)) {
        this.log('recv.ignored', path);
        return null;
      }
      return path;
    } catch (err) {
      if (err instanceof UnsafePathError) {
        this.log('recv.unsafe', JSON.stringify(raw));
        return null;
      }
      throw err;
    }
  }

  /** Keeps an unsent local edit before a server write replaces it. Returns the sidecar path. */
  private saveConflict(path: string, previousHash: string | undefined, incomingHash: string): string | null {
    const local = readLocal(this.root, path);
    if (local.kind === 'missing') return null;
    if (local.kind === 'text' && (local.hash === incomingHash || local.hash === previousHash)) return null;
    const sidecar = writeSidecar(this.root, path, 'conflict', local.kind === 'text' ? local.content : local.bytes);
    this.stats.conflicts++;
    this.log('conflict', `${path} local copy → ${sidecar}`);
    this.notify({ level: 'warn', text: `⚠ ${path} berbeda dengan server, isi server dipakai. Salinanmu: ${sidecar}` });
    this.emit('conflict', { path, sidecar });
    return sidecar;
  }

  private onSnapshot(msg: WsMessageOf<'snapshot'>): void {
    let written = 0;
    const conflictsBefore = this.stats.conflicts;
    for (const f of msg.d.files) {
      const path = this.serverPath(f.path);
      if (!path) continue;
      if (f.deleted || f.content === null || f.hash === null) {
        // Absent from a filtered snapshot means "unchanged", not deleted. Real deletes are P1 (fase 12).
        if (this.everSynced) this.log('snapshot.deleted', `${path} (kept locally until fase 12)`);
        continue;
      }
      const prev = this.known.get(path);
      if (prev && f.version < prev.version) continue;
      const local = readLocal(this.root, path);
      if (local.kind === 'text' && local.hash === f.hash) {
        // Already equal (for example our ack was lost): agree without writing.
        this.known.set(path, { version: f.version, hash: f.hash });
        continue;
      }
      this.saveConflict(path, prev?.hash, f.hash);
      // Anti-echo: record the agreed hash before the write reaches the watcher.
      this.known.set(path, { version: f.version, hash: f.hash });
      atomicWrite(this.root, path, f.content);
      written++;
      if (path === '.gitignore') this.rebuildMatcher();
    }
    this.locks.clear();
    for (const l of msg.d.locks) this.locks.set(l.path, { path: l.path, state: l.state, taskId: l.taskId, memberId: l.memberId });
    this.synced = true;
    this.everSynced = true;
    this.log('snapshot', `${msg.d.files.length} files, ${written} written, ${this.stats.conflicts - conflictsBefore} conflicts, known ${this.known.size}`);
    // On the first connect start() scans once the watcher is ready.
    if (this.watching) this.scanLocal();
    this.emit('snapshot', { files: msg.d.files.length, written, conflicts: this.stats.conflicts - conflictsBefore });
    this.emit('status', this.status());
    this.startWaiter?.resolve();
    this.startWaiter = null;
  }

  /** After a snapshot: send local edits the server does not have yet, then drain paths buffered while offline. */
  private scanLocal(): void {
    const isPm = this.principal?.kind === 'member' && this.principal.role === 'pm';
    for (const rel of listFiles(this.root, (r) => this.matcher.ignores(r))) {
      this.dirty.delete(rel);
      if (!this.known.get(rel) && (isPm || this.resetSeen)) {
        // A PM cannot write, and a reset workspace must not be refilled with stale local files.
        this.log('scan.skip', `${rel} local-only (${isPm ? 'pm' : 'after reset'})`);
        continue;
      }
      this.processPath(rel);
    }
    for (const rel of [...this.dirty]) {
      this.dirty.delete(rel);
      this.processPath(rel);
    }
    this.resetSeen = false;
  }

  private onAck(msg: WsMessageOf<'file.ack'>): void {
    const d = msg.d;
    const id = msg.id ?? d.id;
    const p = this.pending.get(d.path);
    if (p && p.id === id) this.pending.delete(d.path);
    this.retries.delete(d.path);
    const fresh = this.known.set(d.path, { version: d.version, hash: d.hash });
    this.log('ack', `${d.path} v${d.version}${p ? ` ${Date.now() - p.sentAt}ms` : ''}${fresh ? '' : ' (stale)'}`);
    this.emit('ack', d);
    // Settle check: the watcher can coalesce the last events of a burst, so re-read once nothing is in flight.
    if (!this.pending.has(d.path)) this.processPath(d.path);
  }

  private onChanged(msg: WsMessageOf<'file.changed'>): void {
    const d = msg.d;
    const path = this.serverPath(d.path);
    if (!path) return;
    if (d.deleted || d.content === null || d.hash === null) {
      this.log('recv.deleted', `${path} by ${d.by} (kept locally until fase 12)`);
      return;
    }
    const prev = this.known.get(path);
    if (prev && d.version <= prev.version) {
      this.log('recv.stale', `${path} v${d.version} ≤ known v${prev.version}`);
      return;
    }
    this.saveConflict(path, prev?.hash, d.hash);
    this.known.set(path, { version: d.version, hash: d.hash });
    atomicWrite(this.root, path, d.content);
    if (path === '.gitignore') this.rebuildMatcher();
    const appliedTs = Date.now();
    this.sendMsg({ t: 'file.applied', d: { path, version: d.version, serverTs: d.serverTs, appliedTs } });
    this.stats.applied++;
    this.log('recv', `${path} v${d.version} by ${d.by} ${appliedTs - d.serverTs}ms`);
    this.emit('applied', { path, version: d.version, serverTs: d.serverTs, appliedTs, by: d.by });
  }

  private onRejected(msg: WsMessageOf<'file.rejected'>): void {
    const d = msg.d;
    const id = msg.id ?? d.id;
    const p = this.pending.get(d.path);
    if (p && id !== undefined && p.id !== id) {
      // A newer update for this path is in flight; its own answer decides.
      this.log('reject.stale', `${d.path} ${d.reason} for ${id}`);
      return;
    }
    this.pending.delete(d.path);
    const path = this.serverPath(d.path);
    if (!path) return;
    const s = d.server;
    // `conflict` with no server file = the server could not verify our hash/path (a half-written read).
    // Keep the local file and re-send after the next quiet period.
    if (d.reason === 'conflict' && s.version === 0 && s.content === null && !s.deleted) {
      const n = (this.retries.get(path) ?? 0) + 1;
      this.retries.set(path, n);
      if (n > MAX_VERIFY_RETRIES) {
        this.log('reject.giveup', `${path} not verified after ${MAX_VERIFY_RETRIES} retries`);
        return;
      }
      this.log('reject.retry', `${path} attempt ${n}`);
      setTimeout(() => this.processPath(path), this.o.debounceMs).unref();
      return;
    }
    const serverHas = s.version > 0 && !s.deleted && s.content !== null && s.hash !== null;
    const local = readLocal(this.root, path);
    if (serverHas && local.kind === 'text' && local.hash === s.hash) {
      this.known.set(path, { version: s.version, hash: s.hash as string });
      this.log('reject.equal', `${path} ${d.reason} (local already equals server v${s.version})`);
      return;
    }
    let sidecar: string | null = null;
    if (local.kind !== 'missing') sidecar = writeSidecar(this.root, path, d.reason === 'conflict' ? 'conflict' : 'rejected', local.kind === 'text' ? local.content : local.bytes);
    if (serverHas) {
      this.known.set(path, { version: s.version, hash: s.hash as string });
      atomicWrite(this.root, path, s.content as string);
    } else {
      this.known.delete(path);
      removeLocal(this.root, path);
    }
    this.stats.rejected++;
    this.log('reject', `${path} ${d.reason}${d.holder ? ` holder ${d.holder.memberId}/${d.holder.taskId}` : ''} → ${sidecar ?? '(no local copy)'}`);
    this.notify({ level: 'error', text: formatRejection({ path, reason: d.reason, holder: d.holder ?? null, sidecar }) });
    this.emit('rejected', { ...d, path, sidecar });
  }

  // ---- disk → server --------------------------------------------------------------------------------------

  private rebuildMatcher(): void {
    this.matcher = createIgnoreMatcher(this.root);
    this.log('ignore.reload', '.gitignore changed');
  }

  /** Debounced watcher callback and scan step: send the file if its content is new to the server. */
  private processPath(rel: string): void {
    if (this.isStopped) return;
    let path: string;
    try {
      path = safeRelative(rel);
    } catch {
      return;
    }
    if (isIgnored((r) => this.matcher.ignores(r), path, false)) return;
    if (!this.synced) {
      this.dirty.add(path);
      return;
    }
    const local = readLocal(this.root, path);
    if (local.kind === 'missing') return;
    if (local.kind !== 'text') {
      if (!this.skipped.has(path)) {
        this.skipped.add(path);
        this.log('skip', `${path} ${local.kind}`);
      }
      return;
    }
    this.skipped.delete(path);
    if (path === '.gitignore') this.rebuildMatcher();
    const known = this.known.get(path);
    if (known?.hash === local.hash) return;
    const p = this.pending.get(path);
    if (p?.hash === local.hash) return;
    const id = `u${++this.seq}`;
    const baseVersion = known?.version ?? 0;
    if (!this.sendMsg({ t: 'file.update', id, d: { path, baseVersion, content: local.content, hash: local.hash, clientTs: Date.now() } })) {
      this.dirty.add(path);
      return;
    }
    this.pending.set(path, { id, hash: local.hash, sentAt: Date.now() });
    this.stats.updatesSent++;
    this.log('send', `${path} base v${baseVersion} ${local.hash.slice(0, 8)}`);
    this.emit('sent', { path, id, hash: local.hash });
  }
}
