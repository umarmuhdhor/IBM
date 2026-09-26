#!/usr/bin/env node
// `radar` CLI (R1 §5, fase 04 step 1): join, start, status, kit install; `task use` and `agent` are P1 stubs.
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, Option } from 'commander';
import pc from 'picocolors';
import { decodeInvite, HealthRes, InviteInvalidError, MEMBER_COLORS, TasksRes } from '@radar/common';
import { ConfigInvalidError, ConfigMissingError, loadLocalConfig, type LocalConfig } from '@radar/common/node';
import { SyncAgent, SYNC_CLIENT_VERSION } from './agent.js';
import { findKitDir, installKit, type KitRole } from './kit.js';
import { terminalNotifier } from './notify.js';
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

const hasRadarLine = (text: string) => text.split(/\r?\n/).some((l) => /^\/?\.radar\/?$/.test(l.trim()));

/**
 * Writes `.radar/local.json` (mode 0600) and keeps `.radar/` out of git. The synced `.gitignore` is never
 * edited (that would send a change to every PC); the rule goes to `.git/info/exclude` instead (D-alief-04).
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
  if (hasRadarLine(gitignore) || !isDir(join(o.root, '.git'))) return { configFile, excluded: null };
  const exclude = join(o.root, '.git', 'info', 'exclude');
  let current = '';
  try {
    current = readFileSync(exclude, 'utf8');
  } catch {
    mkdirSync(join(o.root, '.git', 'info'), { recursive: true });
  }
  if (!hasRadarLine(current)) appendFileSync(exclude, `${current && !current.endsWith('\n') ? '\n' : ''}# Radar sync agent (token inside)\n.radar/\n`);
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

/** Runs the agent in the foreground until Ctrl-C or a fatal close (4401/4000). Returns the exit code. */
export async function runAgent(cfg: LocalConfig, flags: RunFlags = {}): Promise<number> {
  const out = (s: string) => process.stdout.write(`${s}\n`);
  const agent = new SyncAgent({
    root: cfg.root,
    server: cfg.server,
    token: cfg.token,
    member: cfg.member,
    mode: flags.mode ?? (process.env.SYNC === 'poll-1s' ? 'poll-1s' : 'watch'),
    notify: terminalNotifier(),
    ...(flags.verbose ? { log: (l: string) => out(pc.dim(l)) } : {}),
  });
  if (flags.jsonStatus) agent.on('status', (s) => out(JSON.stringify({ type: 'status', ts: Date.now(), ...s })));
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
    out(`${memberDot(s.member ?? cfg.member)} terhubung sebagai ${s.member ?? cfg.member} (${s.role ?? cfg.role}) · ${s.files} file · ${cfg.server}`);
    agent.on('snapshot', (x: { files: number; conflicts: number }) => out(pc.dim(`snapshot: ${x.files} file, ${x.conflicts} konflik`)));
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
    out(health.success ? `koneksi  ${pc.green('ok')} · server v${health.data.version} · ${health.data.workspace}` : `koneksi  ${pc.red(`HTTP ${h.status}`)}`);
    if (!health.success) return 1;
  } catch (err) {
    out(`koneksi  ${pc.red(`gagal: ${(err as Error).message}`)}`);
    return 1;
  }
  try {
    const t = await getJson(`${cfg.server}/v1/tasks?owner=${encodeURIComponent(cfg.member)}`, cfg.token);
    const tasks = TasksRes.safeParse(t.json);
    if (tasks.success) {
      const mine = tasks.data.tasks.filter((x) => x.ownerId === cfg.member);
      out(`task     aktif ${tasks.data.activeTaskId ?? '-'} · ${mine.length} task milikku`);
      const locks = mine.flatMap((x) => x.files.filter((f) => f.lock !== null).map((f) => `${f.path} (${f.lock})`));
      out(`kunci    ${locks.length ? locks.join(', ') : '-'}`);
    } else {
      out(`task     ${pc.dim(`belum tersedia (HTTP ${t.status}, fase 05)`)}`);
    }
  } catch (err) {
    out(`task     ${pc.yellow(`gagal: ${(err as Error).message}`)}`);
  }
  return 0;
}

function reportKit(r: ReturnType<typeof installKit>, role: KitRole, out: (s: string) => void): void {
  if (r.status === 'installed') out(pc.green(`✓ kit ${role} terpasang di .bob/ (${r.files} file${r.backup ? `, cadangan ${r.backup}` : ''})`));
  else if (r.status === 'refused') out(pc.yellow(`⚠ .bob/ berisi file lain (${r.foreign.slice(0, 3).join(', ')}…). Jalankan \`radar kit install ${role} --force\` (cadangan .bob.bak-<ts>).`));
  else out(pc.yellow(`⚠ bob-kit tidak ditemukan${r.kitDir ? ` di ${r.kitDir}` : ''}; lewati pemasangan kit (set RADAR_KIT_DIR atau --kit-dir).`));
}

function loadConfigOrExit(dir: string): LocalConfig {
  try {
    return loadLocalConfig(resolve(dir));
  } catch (err) {
    if (err instanceof ConfigMissingError || err instanceof ConfigInvalidError) {
      process.stderr.write(`${pc.red(`✖ ${err.message}`)}\nJalankan \`radar join <server> --workspace … --as … --token …\` dulu.\n`);
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
    if (server || o.workspace || o.as || o.token) return { error: '--invite sudah berisi server, workspace, member, dan token; jangan digabung dengan argumen itu.' };
    try {
      const i = decodeInvite(invite);
      return { server: i.server, workspace: i.workspace, member: i.member, token: i.token };
    } catch (e) {
      return { error: e instanceof InviteInvalidError ? e.message : 'Kode undangan tidak bisa dibaca.' };
    }
  }
  const token = o.token ?? env.RADAR_TOKEN;
  if (!server || !o.workspace || !o.as || !token) return { error: 'Butuh --invite <kode>, atau <server> --workspace --as dengan --token / env RADAR_TOKEN.' };
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
      if (!o.jsonStatus) out(pc.dim(`.radar/local.json ditulis (0600)${files.excluded ? `; .radar/ ditambahkan ke ${files.excluded}` : ''}`));
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
          if (!o.jsonStatus) reportKit(r, kitRole ?? role, out);
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
        process.stderr.write(pc.red('✖ role harus coder atau pm\n'));
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
      out(pc.yellow('radar task use: tersedia di fase 12'));
    });
  program
    .command('agent')
    .description('automatic main-agent trigger on the PM PC (P1)')
    .allowUnknownOption()
    .action(() => {
      out(pc.yellow('radar agent: tersedia di fase 12'));
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
