// Node-only: `.radar/local.json` + `.radar/state.json` (R1 §6, R5 §5). Exported via `@radar/common/node`,
// never from the main entry, because the Worker imports `@radar/common` too.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { RoleSchema } from './schemas.js';

export const LocalConfigFile = z.object({
  server: z.string().min(1).optional(),
  workspace: z.string().optional(),
  member: z.string().optional(),
  token: z.string().min(1).optional(),
  role: RoleSchema.optional(),
  shareprompts: z.boolean().optional(),
});

export interface LocalConfig {
  /** Workspace root: the folder that contains `.radar/`. */
  root: string;
  /** Server base URL without a trailing slash. */
  server: string;
  workspace: string;
  member: string;
  token: string;
  role: 'coder' | 'pm';
  /** Send prompt text with bob.activity (R3 §2.24). Off by default. */
  shareprompts: boolean;
}

/** No server or token found in `.radar/local.json` or the RADAR_* environment. */
export class ConfigMissingError extends Error {
  override readonly name = 'ConfigMissingError';
}

/** `.radar/local.json` exists but is not valid JSON or has fields of the wrong type. */
export class ConfigInvalidError extends Error {
  override readonly name = 'ConfigInvalidError';
}

export function findLocalConfigFile(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    const file = join(dir, '.radar', 'local.json');
    if (existsSync(file)) return file;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const envStr = (v: string | undefined): string | undefined => (v === undefined || v === '' ? undefined : v);

/**
 * Walk up from `startDir` to the nearest `.radar/local.json`; `RADAR_SERVER`, `RADAR_TOKEN`, `RADAR_MEMBER`,
 * `RADAR_ROLE`, `RADAR_ROOT` and `RADAR_SHAREPROMPTS` override the file (R5 §5).
 */
export function loadLocalConfig(startDir: string, env: Record<string, string | undefined> = process.env): LocalConfig {
  const envRoot = envStr(env.RADAR_ROOT);
  const base = envRoot ? resolve(envRoot) : resolve(startDir);
  const file = findLocalConfigFile(base);

  let fromFile: z.infer<typeof LocalConfigFile> = {};
  if (file) {
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new ConfigInvalidError(`${file} is not valid JSON`, { cause: err });
    }
    const parsed = LocalConfigFile.safeParse(json);
    if (!parsed.success) {
      throw new ConfigInvalidError(`${file}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    }
    fromFile = parsed.data;
  }

  const server = envStr(env.RADAR_SERVER) ?? fromFile.server;
  const token = envStr(env.RADAR_TOKEN) ?? fromFile.token;
  if (!server || !token) throw new ConfigMissingError(`no Radar server/token found from ${base} (.radar/local.json or RADAR_*)`);

  const envRole = envStr(env.RADAR_ROLE);
  const role = envRole === undefined ? (fromFile.role ?? 'coder') : RoleSchema.safeParse(envRole).data;
  if (!role) throw new ConfigInvalidError(`RADAR_ROLE must be coder or pm, got ${envRole}`);

  const envShare = envStr(env.RADAR_SHAREPROMPTS);
  return {
    root: envRoot ? resolve(envRoot) : file ? dirname(dirname(file)) : base,
    server: server.replace(/\/+$/, ''),
    workspace: fromFile.workspace ?? '',
    member: envStr(env.RADAR_MEMBER) ?? fromFile.member ?? '',
    token,
    role,
    shareprompts: envShare === undefined ? (fromFile.shareprompts ?? false) : envShare === 'true',
  };
}

const HookStateFile = z.object({
  briefCursor: z.number().int().nonnegative().optional(),
  lastBlock: z.object({ path: z.string(), message: z.string(), ts: z.number() }).optional(),
});

export type HookState = z.infer<typeof HookStateFile>;

const stateFile = (root: string) => join(root, '.radar', 'state.json');

/**
 * Read `.radar/state.json`. A missing or unreadable file returns `{}`: the state is a cache
 * (brief cursor, last block), and a reset only repeats one brief.
 */
export function loadState(root: string): HookState {
  let text: string;
  try {
    text = readFileSync(stateFile(root), 'utf8');
  } catch {
    return {};
  }
  try {
    const parsed = HookStateFile.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Merge `patch` into `.radar/state.json` with an atomic write (tmp file + rename). */
export function saveState(root: string, patch: HookState): HookState {
  const next = { ...loadState(root), ...patch };
  const file = stateFile(root);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, file);
  return next;
}
