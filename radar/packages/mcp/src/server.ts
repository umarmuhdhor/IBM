// Builds the radar-mcp server for one role. Only the tools of that role are registered (R3 §7, MA-07).
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import type { RadarClient } from './client.js';
import { RadarToolError } from './client.js';
import { CODER_TOOLS } from './tools/coder/index.js';
import type { ToolDef } from './tools/types.js';

export const SERVER_NAME = 'radar';
export const SERVER_VERSION = '0.3.0';

export function toolsForRole(role: 'coder' | 'pm'): readonly ToolDef[] {
  // TODO(fase 08): PM tools (team_status, propose_plan, …) register here for role 'pm'.
  return role === 'coder' ? (CODER_TOOLS as readonly ToolDef[]) : [];
}

export function createRadarServer(client: RadarClient, role: 'coder' | 'pm'): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  for (const tool of toolsForRole(role)) {
    server.registerTool(
      tool.name,
      { title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      async (args: z.infer<z.ZodObject<z.ZodRawShape>>) => {
        try {
          const text = await tool.run(args, client);
          return { content: [{ type: 'text' as const, text }] };
        } catch (err) {
          const text = err instanceof RadarToolError ? err.message : `Tool ${tool.name} gagal: ${String(err)}`;
          return { content: [{ type: 'text' as const, text }], isError: true };
        }
      },
    );
  }
  return server;
}
