// TODO(sync:alief): stand-in for loadLocalConfig from @radar/common/node (fase 02 §10) — replace after the fase 02 PR lands in main.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface LocalConfig {
  root: string;
  server: string;
  workspace: string;
  member: string;
  token: string;
  role: 'coder' | 'pm';
}

export class ConfigMissingError extends Error {}

type Obj = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

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
  const parsed: unknown = file ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const fromFile: Obj = typeof parsed === 'object' && parsed !== null ? (parsed as Obj) : {};
  const server = env.RADAR_SERVER ?? str(fromFile.server);
  const token = env.RADAR_TOKEN ?? str(fromFile.token);
  if (!server || !token) throw new ConfigMissingError(`no .radar/local.json (server, token) found from ${base}`);
  return {
    root: env.RADAR_ROOT ? resolve(env.RADAR_ROOT) : file ? dirname(dirname(file)) : resolve(startDir),
    server: server.replace(/\/+$/, ''),
    workspace: str(fromFile.workspace) ?? '',
    member: env.RADAR_MEMBER ?? str(fromFile.member) ?? '',
    token,
    role: (env.RADAR_ROLE ?? str(fromFile.role)) === 'pm' ? 'pm' : 'coder',
  };
}
