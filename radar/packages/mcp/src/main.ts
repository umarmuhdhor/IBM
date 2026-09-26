// radar-mcp entry (stdio). Bob IDE starts stdio servers with cwd `/` (fase 01 spike 6), so the workspace comes
// from `--root <dir>` (`${workspaceFolder}` in .bob/mcp.json) or RADAR_ROOT, never from process.cwd() alone.
// stdout is the MCP channel: diagnostics go to stderr only.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRadarClient } from './client.js';
import { ConfigInvalidError, ConfigMissingError, loadLocalConfig, type LocalConfig } from '@radar/common/node';
import { createRadarServer } from './server.js';

export function rootFromArgs(argv: string[], env: NodeJS.ProcessEnv): string {
  const i = argv.indexOf('--root');
  const fromArg = i > -1 ? argv[i + 1] : undefined;
  // an unexpanded ${workspaceFolder} means the host did not substitute it; fall back
  if (fromArg && !fromArg.includes('${')) return fromArg;
  return env.RADAR_ROOT ?? process.cwd();
}

async function main(): Promise<void> {
  const root = rootFromArgs(process.argv.slice(2), process.env);
  let config: LocalConfig | null = null;
  try {
    config = loadLocalConfig(root);
  } catch (err) {
    // a missing or broken .radar/local.json must not kill the server: the tools then ask the user to run radar join
    if (!(err instanceof ConfigMissingError || err instanceof ConfigInvalidError)) throw err;
    process.stderr.write(`radar-mcp: ${err.message}; tools will ask the user to run radar join\n`);
  }
  const role = config?.role ?? (process.env.RADAR_ROLE === 'pm' ? 'pm' : 'coder');
  const server = createRadarServer(createRadarClient(config), role);
  await server.connect(new StdioServerTransport());
}

main().catch((err: unknown) => {
  process.stderr.write(`radar-mcp: fatal: ${String(err)}\n`);
  process.exit(1);
});
