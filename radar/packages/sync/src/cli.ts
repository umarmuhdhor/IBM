#!/usr/bin/env node
// `radar` CLI (R1 §5, fase 04 step 1): join, start, status, kit install; `task use` and `agent` are P1 stubs.
import type { EventEmitter } from 'node:events';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, Option } from 'commander';
import pc from 'picocolors';
import { decodeInvite, HealthRes, InviteInvalidError, MEMBER_COLORS, TasksRes, type LockHolder } from '@radar/common';
import { ConfigInvalidError, ConfigMissingError, loadLocalConfig, type LocalConfig } from '@radar/common/node';
import { SyncAgent, SYNC_CLIENT_VERSION, type StopKind } from './agent.js';
import { findKitDir, installKit, type KitResult, type KitRole } from './kit.js';
import { formatRejection, terminalNotifier, type RejectReason } from './notify.js';
import type { SyncMode } from './watcher.js';

export interface JoinFiles {
  root: string;
  server: string;
  workspace: string;
  member: string;
  token: string;
  role: KitRole;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Local-only paths kept out of git: the token, the Bob kit and the copies sync keeps next to a file. */
export const LOCAL_ONLY_RULES = ['.radar/', '.bob/', '*.radar-conflict', '*.radar-rejected'] as const;

const hasRule = (text: string, rule: string) => {
  const bare = rule.replace(/\/$/, '');
  return text.split(/\r?\n/).some((l) => [bare, `${bare}/`, `/${bare}`, `/${bare}/`].includes(l.trim()));
};

/**
 * Writes `.radar/local.json` (mode 0600) and keeps local-only paths out of git. The synced `.gitignore` is never
 * edited (that would send a change to every PC); the rules go to `.git/info/exclude` instead (D-alief-04).
 */
export function writeJoinFiles(o: JoinFiles): { configFile: string; excluded: string | null } {
  const dir = join(o.root, '.radar');
  mkdirSync(dir, { recursive: true });
  const configFile = join(dir, 'local.json');
  const body = { server: o.server.replace(/\/+$/, ''), workspace: o.workspace, member: o.member, token: o.token, role: o.role, shareprompts: false };
  writeFileSync(configFile, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
  // writeFileSync keeps the mode of an existing file.
  chmodSync(configFile, 0o600);

  let gitignore: string;
  try {
    gitignore = readFileSync(join(o.root, '.gitignore'), 'utf8');
  } catch {
    gitignore = '';
  }
  const needed = LOCAL_ONLY_RULES.filter((r) => !hasRule(gitignore, r));
  if (needed.length === 0 || !isDir(join(o.root, '.git'))) return { configFile, excluded: null };
  const exclude = join(o.root, '.git', 'info', 'exclude');
  let current = '';
  try {
    current = readFileSync(exclude, 'utf8');
  } catch {
    mkdirSync(join(o.root, '.git', 'info'), { recursive: true });
  }
  const missing = needed.filter((r) => !hasRule(current, r));
  if (missing.length > 0) appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}# Live Collab: local only (token, Bob kit, sync copies)\n${missing.join('\n')}\n`);
  return { configFile, excluded: '.git/info/exclude' };
}

function memberDot(member: string): string {
  const hex = (MEMBER_COLORS as Record<string, string>)[member];
  if (!hex || !pc.isColorSupported) return '●';
  const n = Number.parseInt(hex.slice(1), 16);
  return `\x1b[38;2;${(n >> 16) & 255};${(n >> 8) & 255};${n & 255}m●\x1b[39m`;
}

interface RunFlags {
  mode?: SyncMode;
  verbose?: boolean;
  jsonStatus?: boolean;
  /** Called once after the first snapshot (join uses it to install the kit for the real role). */
  afterStart?: (agent: SyncAgent) => void;
}

/**
 * `--json-status` lines for the desktop app: `status` on every change, `conflict` when a local copy that
 * differed from the server was kept as `<file>.radar-conflict` (D-alief-14), and `stopped` with the reason
 * when sync ends for good (D-alief-15), so the app can show a friendly state instead of an error.
 */
export function wireJsonStatus(agent: Pick<EventEmitter, 'on'>, out: (line: string) => void): void {
  agent.on('status', (s: object) => out(JSON.stringify({ type: 'status', ts: Date.now(), ...s })));
  agent.on('conflict', (c: { path: string; sidecar: string }) => out(JSON.stringify({ type: 'conflict', ts: Date.now(), path: c.path, sidecar: c.sidecar })));
  // The app shows why a change was not sent (PM read-only, file held by a task, too large, binary).
  agent.on('rejected', (r: { path: string; reason: RejectReason; holder?: LockHolder | null; sidecar: string | null }) =>
    out(JSON.stringify({ type: 'rejected', ts: Date.now(), path: r.path, reason: r.reason, sidecar: r.sidecar, message: formatRejection({ ...r, holder: r.holder ?? null }) })),
  );
  agent.on('stopped', (message: string, reason: StopKind) => out(JSON.stringify({ type: 'stopped', ts: Date.now(), reason, message })));
}

/** Runs the agent in the foreground until Ctrl-C or a fatal close (4401/4000). Returns the exit code. */
export async function runAgent(cfg: LocalConfig, flags: RunFlags = {}): Promise<number> {
  const out = (s: string) => process.stdout.write(`${s}\n`);
  const agent = new SyncAgent({
    root: cfg.root,
    server: cfg.server,
    token: cfg.token,
    member: cfg.member,
    mode: flags.mode ?? (process.env.SYNC === 'poll-1s' ? 'poll-1s' : 'watch'),
    notify: terminalNotifier(undefined, { plain: flags.jsonStatus ?? false }),
    ...(flags.verbose ? { log: (l: string) => out(pc.dim(l)) } : {}),
  });
  if (flags.jsonStatus) wireJsonStatus(agent, out);
  let resolveDone: (code: number) => void = () => undefined;
  const done = new Promise<number>((r) => {
    resolveDone = r;
  });
  agent.on('stopped', () => resolveDone(1));
  const onSignal = () => {
    void agent.stop().then(() => resolveDone(0));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    await agent.start();
  } catch (err) {
    process.stderr.write(`${pc.red(`✖ ${(err as Error).message}`)}\n`);
    return 1;
  }
  const s = agent.status();
  if (!flags.jsonStatus) {
    out(`${memberDot(s.member ?? cfg.member)} connected as ${s.member ?? cfg.member} (${s.role ?? cfg.role}) · ${s.files} files · ${cfg.server}`);
    agent.on('snapshot', (x: { files: number; conflicts: number }) => out(pc.dim(`snapshot: ${x.files} files, ${x.conflicts} conflicts`)));
  }
  flags.afterStart?.(agent);
  return done;
}

async function getJson(url: string, token?: string): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(5000) });
  const text = await res.text();
  try {
    return { status: res.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { status: res.status, json: null };
  }
}

export async function printStatus(cfg: LocalConfig, out: (s: string) => void): Promise<number> {
  out(`server   ${cfg.server}`);
  out(`member   ${cfg.member || '?'} (${cfg.role}) · workspace ${cfg.workspace || '?'}`);
  out(`folder   ${cfg.root}`);
  try {
    const h = await getJson(`${cfg.server}/healthz`);
    const health = HealthRes.safeParse(h.json);
    out(health.success ? `server   ${pc.green('ok')} · v${health.data.version} · ${health.data.workspace}` : `server   ${pc.red(`HTTP ${h.status}`)}`);
    if (!health.success) return 1;
  } catch (err) {
    out(`server   ${pc.red(`unreachable: ${(err as Error).message}`)}`);
    return 1;
  }
  try {
    const t = await getJson(`${cfg.server}/v1/tasks?owner=${encodeURIComponent(cfg.member)}`, cfg.token);
    const tasks = TasksRes.safeParse(t.json);
    if (tasks.success) {
      const mine = tasks.data.tasks.filter((x) => x.ownerId === cfg.member);
      out(`task     active ${tasks.data.activeTaskId ?? '-'} · ${mine.length} mine`);
      const locks = mine.flatMap((x) => x.files.filter((f) => f.lock !== null).map((f) => `${f.path} (${f.lock})`));
      out(`locks    ${locks.length ? locks.join(', ') : '-'}`);
    } else {
      out(`task     ${pc.dim(`not available (HTTP ${t.status})`)}`);
    }
  } catch (err) {
    out(`task     ${pc.yellow(`failed: ${(err as Error).message}`)}`);
  }
  return 0;
}

/** `--json-status` line for the app after the join installs the Bob kit (fase 12k bug 4). */
export function kitStatusLine(r: KitResult, role: KitRole): string {
  const base = { type: 'kit', ts: Date.now(), status: r.status, role };
  if (r.status === 'installed') return JSON.stringify({ ...base, message: `Bob ${role} kit installed in .bob/.` });
  if (r.status === 'refused') {
    const shown = r.foreign.slice(0, 3).join(', ') + (r.foreign.length > 3 ? ` and ${r.foreign.length - 3} more` : '');
    return JSON.stringify({
      ...base,
      foreign: r.foreign,
      message: `Bob kit not installed: this folder's .bob/ already has other files (${shown}). Installing it moves your current .bob/ to a backup folder .bob.bak-<time> first, so nothing is lost.`,
    });
  }
  return JSON.stringify({ ...base, message: 'Bob kit not found in the app, so Bob IDE hooks and radar-mcp are not set up in this folder.' });
}

function reportKit(r: ReturnType<typeof installKit>, role: KitRole, out: (s: string) => void): void {
  if (r.status === 'installed') out(pc.green(`✓ ${role} kit installed in .bob/ (${r.files} files${r.backup ? `, backup ${r.backup}` : ''})`));
  else if (r.status === 'refused') out(pc.yellow(`⚠ .bob/ holds other files (${r.foreign.slice(0, 3).join(', ')}…). Run \`radar kit install ${role} --force\` (backup .bob.bak-<ts>).`));
  else out(pc.yellow(`⚠ bob-kit not found${r.kitDir ? ` in ${r.kitDir}` : ''}; skipping the kit (set RADAR_KIT_DIR or --kit-dir).`));
}

function loadConfigOrExit(dir: string): LocalConfig {
  try {
    return loadLocalConfig(resolve(dir));
  } catch (err) {
    if (err instanceof ConfigMissingError || err instanceof ConfigInvalidError) {
      process.stderr.write(`${pc.red(`✖ ${err.message}`)}\nRun \`radar join --invite <code>\` first.\n`);
      process.exit(2);
    }
    throw err;
  }
}

export interface JoinTarget {
  server: string;
  workspace: string;
  member: string;
  token: string;
}

/**
 * IN-02: `radar join --invite <code>` (or RADAR_INVITE) fills server, workspace, member and token from one code;
 * otherwise all four come from the arguments (token from --token or RADAR_TOKEN). Returns an error text instead
 * of throwing, and never echoes the code or the token.
 */
export function resolveJoin(
  server: string | undefined,
  o: { workspace?: string; as?: string; token?: string; invite?: string },
  env: NodeJS.ProcessEnv = process.env,
): JoinTarget | { error: string } {
  // RADAR_INVITE applies only when no server is given, so a stale env value never overrides explicit arguments.
  const invite = o.invite ?? (server ? undefined : env.RADAR_INVITE);
  if (invite) {
    if (server || o.workspace || o.as || o.token) return { error: '--invite already holds the server, workspace, member and token; do not combine it with those arguments.' };
    try {
      const i = decodeInvite(invite);
      return { server: i.server, workspace: i.workspace, member: i.member, token: i.token };
    } catch (e) {
      return { error: e instanceof InviteInvalidError ? e.message : 'The invite code cannot be read.' };
    }
  }
  const token = o.token ?? env.RADAR_TOKEN;
  if (!server || !o.workspace || !o.as || !token) return { error: 'Needs --invite <code>, or <server> --workspace --as with --token / env RADAR_TOKEN.' };
  return { server, workspace: o.workspace, member: o.as, token };
}

const modeOption = () => new Option('--mode <mode>', 'watch (default) or poll-1s (GATE 1 fallback)').choices(['watch', 'poll-1s']);

export function buildProgram(): Command {
  const program = new Command('radar').description('Radar sync agent: keeps this folder equal to the Live Collab server').version(SYNC_CLIENT_VERSION);
  const out = (s: string) => process.stdout.write(`${s}\n`);

  program
    .command('join [server]')
    .description('write .radar/local.json, sync the workspace, install the .bob kit, keep syncing')
    .option('--invite <code>', 'rdr_inv_ code from `admin invite` (or set RADAR_INVITE so it stays out of shell history)')
    .option('--workspace <name>', 'workspace name, e.g. toko-demo (without --invite)')
    .option('--as <member>', 'your member id (A, B, C, …) (without --invite)')
    .option('--token <token>', 'member token (or set RADAR_TOKEN so it stays out of shell history)')
    .option('--dir <dir>', 'workspace folder', '.')
    .addOption(new Option('--kit <role>', 'kit to install; defaults to the role the server reports').choices(['coder', 'pm']))
    .option('--no-kit', 'do not install the .bob kit')
    .option('--kit-dir <dir>', 'bob-kit location')
    .option('--force-kit', 'replace a .bob folder that holds other files (backup .bob.bak-<ts>)')
    .addOption(modeOption())
    .option('--verbose', 'print every sync.log line')
    .option('--json-status', 'print status as JSON lines (for the desktop app)')
    .action(async (serverArg: string | undefined, o: { invite?: string; workspace?: string; as?: string; token?: string; dir: string; kit: string | boolean; kitDir?: string; forceKit?: boolean; mode?: SyncMode; verbose?: boolean; jsonStatus?: boolean }) => {
      const target = resolveJoin(serverArg, o);
      if ('error' in target) {
        process.stderr.write(pc.red(`✖ ${target.error}\n`));
        process.exit(2);
      }
      const { server, workspace, member, token } = target;
      const root = resolve(o.dir);
      mkdirSync(root, { recursive: true });
      const kitRole = typeof o.kit === 'string' ? (o.kit as KitRole) : undefined;
      const files = writeJoinFiles({ root, server, workspace, member, token, role: kitRole ?? 'coder' });
      if (!o.jsonStatus) out(pc.dim(`.radar/local.json written (0600)${files.excluded ? `; local-only paths added to ${files.excluded}` : ''}`));
      const cfg = loadConfigOrExit(root);
      const code = await runAgent(cfg, {
        ...(o.mode ? { mode: o.mode } : {}),
        ...(o.verbose ? { verbose: true } : {}),
        ...(o.jsonStatus ? { jsonStatus: true } : {}),
        afterStart: (agent) => {
          const p = agent.principal;
          const role: KitRole = p?.kind === 'member' ? p.role : (kitRole ?? 'coder');
          if (role !== cfg.role) writeJoinFiles({ root, server, workspace, member, token, role });
          if (o.kit === false) return;
          const r = installKit({ root, role: kitRole ?? role, kitDir: findKitDir(o.kitDir), force: o.forceKit ?? false });
          if (o.jsonStatus) out(kitStatusLine(r, kitRole ?? role));
          else reportKit(r, kitRole ?? role, out);
        },
      });
      process.exit(code);
    });

  program
    .command('start')
    .description('sync using the existing .radar/local.json (foreground)')
    .option('--dir <dir>', 'workspace folder', '.')
    .addOption(modeOption())
    .option('--verbose', 'print every sync.log line')
    .option('--json-status', 'print status as JSON lines (for the desktop app)')
    .action(async (o: { dir: string; mode?: SyncMode; verbose?: boolean; jsonStatus?: boolean }) => {
      const cfg = loadConfigOrExit(o.dir);
      process.exit(await runAgent(cfg, { ...(o.mode ? { mode: o.mode } : {}), ...(o.verbose ? { verbose: true } : {}), ...(o.jsonStatus ? { jsonStatus: true } : {}) }));
    });

  program
    .command('status')
    .description('server, member, connection, active task, my locks')
    .option('--dir <dir>', 'workspace folder', '.')
    .action(async (o: { dir: string }) => {
      process.exit(await printStatus(loadConfigOrExit(o.dir), out));
    });

  const kit = program.command('kit').description('Bob IDE kit (.bob/)');
  kit
    .command('install [role]')
    .description('(re)install bob-kit/<role>/.bob into this workspace')
    .option('--dir <dir>', 'workspace folder', '.')
    .option('--kit-dir <dir>', 'bob-kit location')
    .option('--force', 'replace a .bob folder that holds other files (backup .bob.bak-<ts>)')
    .action((roleArg: string | undefined, o: { dir: string; kitDir?: string; force?: boolean }) => {
      const root = resolve(o.dir);
      let role = roleArg as KitRole | undefined;
      if (role && role !== 'coder' && role !== 'pm') {
        process.stderr.write(pc.red('✖ role must be coder or pm\n'));
        process.exit(2);
      }
      if (!role) role = existsSync(join(root, '.radar', 'local.json')) ? loadConfigOrExit(root).role : 'coder';
      const r = installKit({ root, role, kitDir: findKitDir(o.kitDir), force: o.force ?? false });
      reportKit(r, role, out);
      process.exit(r.status === 'refused' ? 1 : 0);
    });

  program
    .command('task')
    .description('task commands (P1)')
    .command('use <taskId>')
    .action(() => {
      out(pc.yellow('radar task use: not available yet'));
    });
  program
    .command('agent')
    .description('automatic main-agent trigger on the PM PC (P1)')
    .allowUnknownOption()
    .action(() => {
      out(pc.yellow('radar agent: not available yet'));
    });

  return program;
}

// The bin is a symlink (node_modules/.bin/radar), so compare real paths.
const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : null;
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  buildProgram()
    .parseAsync(process.argv)
    .catch((err: unknown) => {
      process.stderr.write(`${pc.red(`✖ ${err instanceof Error ? err.message : String(err)}`)}\n`);
      process.exit(1);
    });
}
