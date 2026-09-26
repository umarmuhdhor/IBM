// Normalise Bob hook payloads (BC-04). Bob IDE 2.2.0 sends the snake_case shape
// `{ session_id, cwd, hook_event_name, tool_name, tool_input, tool_use_id }` (fixtures in radar/docs/spike-payloads/,
// D-umar-01 P1). The docs shape `{ event, tool, input }` and camelCase keys are accepted too.
import { tryWorkspaceRelative } from './paths.js';

export type HookEvent = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'Stop' | 'unknown';

export interface NormalizedHook {
  event: HookEvent;
  tool: string | null;
  /** Workspace-relative, unique, POSIX. Paths outside the workspace are dropped (listed in `droppedPaths`). */
  paths: string[];
  droppedPaths: string[];
  sessionId: string | null;
  cwd: string | null;
  /** UserPromptSubmit only. */
  prompt: string | null;
  /** `tool_input` as sent by Bob (e.g. `diff`, `content`, `line_count`). Never forward it to the server. */
  input: Record<string, unknown>;
  /** Full payload, including `tool_response` (may hold file content). Never forward it to the server. */
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

/** Path fields in priority order (fase 02 §6). Bob IDE 2.2.0 edit tools use `path` (D-umar-01 P2). */
const DIRECT_PATH_KEYS = ['path', 'file_path', 'filePath', 'target_file'] as const;

function collectPaths(input: Obj): string[] {
  const out: string[] = [];
  const push = (v: unknown) => {
    const s = str(v);
    if (s) out.push(s);
  };
  const pushEntries = (list: unknown) => {
    if (Array.isArray(list)) for (const f of list) if (isObj(f)) push(pick(f, 'path', 'file_path', 'filePath'));
  };
  for (const k of DIRECT_PATH_KEYS) push(input[k]);
  pushEntries(input.files);
  const args = input.args;
  if (isObj(args)) {
    for (const k of DIRECT_PATH_KEYS) push(args[k]);
    // apply_diff multi-file: args.file is an array of { path, diff }, or a single object.
    if (Array.isArray(args.file)) pushEntries(args.file);
    else if (isObj(args.file)) push(args.file.path);
    pushEntries(args.files);
  }
  return out;
}

export function normalizeHookPayload(raw: unknown, root: string): NormalizedHook {
  const o: Obj = isObj(raw) ? raw : {};
  const eventName = str(pick(o, 'hook_event_name', 'hookEventName', 'event'));
  const event: HookEvent =
    eventName !== null && (EVENTS as readonly string[]).includes(eventName) ? (eventName as HookEvent) : 'unknown';
  const inputRaw = pick(o, 'tool_input', 'toolInput', 'input');
  const input: Obj = isObj(inputRaw) ? inputRaw : {};

  const paths: string[] = [];
  const droppedPaths: string[] = [];
  for (const p of collectPaths(input)) {
    const rel = tryWorkspaceRelative(root, p);
    if (rel === null) droppedPaths.push(p);
    else if (!paths.includes(rel)) paths.push(rel);
  }

  const prompt = pick(o, 'prompt');
  return {
    event,
    tool: str(pick(o, 'tool_name', 'toolName', 'tool')),
    paths,
    droppedPaths,
    sessionId: str(pick(o, 'session_id', 'sessionId')),
    cwd: str(o.cwd),
    prompt: typeof prompt === 'string' ? prompt : null,
    input,
    raw,
  };
}
