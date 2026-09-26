// Helpers shared by every Bob IDE hook. Rule (R5 §1): any error or timeout fails open (exit 0) and is logged;
// only a real `block` decision exits 2. Nothing here ever writes the token to a log.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeHookPayload, type NormalizedHook } from '@radar/common';
import { ConfigMissingError, loadLocalConfig, type LocalConfig } from '@radar/common/node';

export const STDIN_TIMEOUT_MS = 500;

export function readStdin(timeoutMs = STDIN_TIMEOUT_MS): Promise<string> {
  return new Promise((resolve) => {
    let raw = '';
    const done = () => {
      clearTimeout(timer);
      resolve(raw);
    };
    const timer = setTimeout(done, timeoutMs);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => (raw += chunk));
    process.stdin.on('end', done);
    process.stdin.on('error', done);
  });
}

export function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Log one line to `<root>/.radar/hook.log`. Never throws. */
export function logLine(root: string | null, hook: string, message: string): void {
  if (!root) return;
  try {
    const dir = join(root, '.radar');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, 'hook.log'), `${new Date().toISOString()} ${hook} ${message}\n`);
  } catch {
    // the log is best effort; a hook must not fail because of it
  }
}

export interface HookContext {
  cfg: LocalConfig;
  hook: NormalizedHook;
  started: number;
}

/**
 * Read stdin, find `.radar/local.json` (from RADAR_ROOT, the payload cwd, then process.cwd()) and normalize the
 * payload. Returns null when this folder is not a Radar workspace: the caller then exits 0 silently.
 */
export async function loadContext(hookName: string): Promise<HookContext | null> {
  const started = Date.now();
  const raw = parseJson(await readStdin());
  const payloadCwd =
    raw && typeof raw === 'object' && typeof (raw as { cwd?: unknown }).cwd === 'string'
      ? (raw as { cwd: string }).cwd
      : process.cwd();
  let cfg: LocalConfig;
  try {
    cfg = loadLocalConfig(payloadCwd);
  } catch (err) {
    if (!(err instanceof ConfigMissingError)) logLine(payloadCwd, hookName, `config error: ${String(err)}`);
    return null;
  }
  return { cfg, hook: normalizeHookPayload(raw, cfg.root), started };
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** fetch against the Radar server with a hard deadline. Throws on timeout, network error or non-2xx. */
export async function radarFetch<T>(
  cfg: LocalConfig,
  method: 'GET' | 'POST',
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const res = await fetch(`${cfg.server}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new HttpError(res.status, `${method} ${path} → ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const modeOf = (cfg: LocalConfig): string => (cfg.role === 'pm' ? 'pm-lead' : 'coder');

/** Wait for `p`, but never longer than `ms`. Resolves either way; never rejects. */
export function settleWithin(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, ms));
    p.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}
