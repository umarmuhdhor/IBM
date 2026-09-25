// TODO(sync:alief): stand-ins for @radar/common (constants, hook-payload, config, schemas) — replace after the fase 02 PR lands in main.
// Shapes follow plan/fase-02-common-mock.md §5–§11, R3 §2.2/§2.3/§2.24, R5 §4 and the real Bob IDE 2.2.0 payloads
// in radar/docs/spike-payloads/ (D-umar-01).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export const HOOK_SERVER_TIMEOUT_MS = 1_500;
export const ACTIVITY_TIMEOUT_MS = 800;
export const BRIEF_MAX_LINES = 6;
export const BRIEF_MAX_LINE_CHARS = 160;
export const EDIT_TOOLS_REGEX = /^(write_file|apply_diff|search_and_replace|insert_content|office_edit)$/;

export type HookEvent = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop' | 'unknown';

export interface NormalizedHook {
  event: HookEvent;
  tool: string | null;
  paths: string[]; // workspace-relative, unique, POSIX
  sessionId: string | null;
  cwd: string | null;
  prompt: string | null;
  input: Record<string, unknown>;
  raw: unknown;
}

const EVENTS: readonly HookEvent[] = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

function pick(o: Obj, ...keys: string[]): unknown {
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
}

function collectPaths(input: Obj): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = str(v);
    if (s) out.push(s);
  };
  for (const k of ['path', 'file_path', 'filePath', 'target_file']) push(input[k]);
  const args = input.args;
  if (isObj(args)) {
    push(args.path);
    if (Array.isArray(args.file)) for (const f of args.file) if (isObj(f)) push(f.path);
  }
  if (Array.isArray(input.files)) for (const f of input.files) if (isObj(f)) push(f.path);
  return out;
}

export function toWorkspaceRelative(root: string, p: string): string | null {
  const posix = p.replace(/\\/g, '/');
  const abs = isAbsolute(posix) ? posix : resolve(root, posix);
  const rel = relative(root, abs);
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) return null;
  return rel.split(sep).join('/');
}

export function normalizeHookPayload(raw: unknown, root: string): NormalizedHook {
  const o: Obj = isObj(raw) ? raw : {};
  const eventName = str(pick(o, 'hook_event_name', 'hookEventName', 'event'));
  const event: HookEvent = eventName && (EVENTS as string[]).includes(eventName) ? (eventName as HookEvent) : 'unknown';
  const inputRaw = pick(o, 'tool_input', 'toolInput', 'input');
  const input: Obj = isObj(inputRaw) ? inputRaw : {};
  const paths = [
    ...new Set(collectPaths(input).map((p) => toWorkspaceRelative(root, p)).filter((p): p is string => p !== null)),
  ];
  return {
    event,
    tool: str(pick(o, 'tool_name', 'toolName', 'tool')),
    paths,
    sessionId: str(pick(o, 'session_id', 'sessionId')),
    cwd: str(o.cwd),
    prompt: typeof o.prompt === 'string' ? o.prompt : null,
    input,
    raw,
  };
}

// --- R3 request/response shapes used by the hooks -------------------------------------------------------------

export interface LockHolder {
  memberId: string;
  memberName: string;
  taskId: string;
  taskTitle: string;
  state: string;
}

export interface LockCheckRes {
  decision: 'allow' | 'block';
  results: { path: string; decision: 'allow' | 'block'; reason: string; holder?: LockHolder | null }[];
  activeTaskId: string | null;
  message: string;
  serverMs?: number;
}

export interface BriefRes {
  lines: string[];
  cursor: number;
}

export type BobActivityKind = 'session.start' | 'prompt' | 'tool.pre' | 'tool.post' | 'turn.end';

export interface BobActivityReq {
  kind: BobActivityKind;
  sessionId: string | null;
  mode: string;
  tool?: string;
  paths?: string[];
  decision?: 'allow' | 'block';
  linesChanged?: number;
  text?: string;
  clientTs: number;
}

// --- config (.radar/local.json, R1 §6 + R5 §5) ---------------------------------------------------------------

export interface LocalConfig {
  root: string;
  server: string;
  workspace: string;
  member: string;
  token: string;
  role: 'coder' | 'pm';
  shareprompts: boolean;
}

export class ConfigMissingError extends Error {}

function findLocalJson(startDir: string): string | null {
  let dir = resolve(startDir);
  for (;;) {
    const f = join(dir, '.radar', 'local.json');
    if (existsSync(f)) return f;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function loadLocalConfig(startDir: string, env: NodeJS.ProcessEnv = process.env): LocalConfig {
  const base = env.RADAR_ROOT ? resolve(env.RADAR_ROOT) : startDir;
  const file = findLocalJson(base);
  let fromFile: Obj = {};
  if (file) {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (isObj(parsed)) fromFile = parsed;
  }
  const root = env.RADAR_ROOT ? resolve(env.RADAR_ROOT) : file ? dirname(dirname(file)) : resolve(startDir);
  const server = env.RADAR_SERVER ?? str(fromFile.server);
  const token = env.RADAR_TOKEN ?? str(fromFile.token);
  if (!server || !token) throw new ConfigMissingError(`no .radar/local.json (server, token) found from ${base}`);
  const role = (env.RADAR_ROLE ?? str(fromFile.role)) === 'pm' ? 'pm' : 'coder';
  return {
    root,
    server: server.replace(/\/+$/, ''),
    workspace: str(fromFile.workspace) ?? '',
    member: env.RADAR_MEMBER ?? str(fromFile.member) ?? '',
    token,
    role,
    shareprompts: env.RADAR_SHAREPROMPTS ? env.RADAR_SHAREPROMPTS === 'true' : fromFile.shareprompts === true,
  };
}

export interface HookState {
  briefCursor?: number;
  lastBlock?: { path: string; message: string; ts: number };
}

const stateFile = (root: string) => join(root, '.radar', 'state.json');

export function loadState(root: string): HookState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(stateFile(root), 'utf8'));
    return isObj(parsed) ? (parsed as HookState) : {};
  } catch {
    return {};
  }
}

export function saveState(root: string, patch: HookState): void {
  const next = { ...loadState(root), ...patch };
  const file = stateFile(root);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2));
  renameSync(tmp, file);
}
