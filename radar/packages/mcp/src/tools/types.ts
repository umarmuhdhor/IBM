import type { z } from 'zod';
import type { RadarClient } from '../client.js';

/**
 * One MCP tool (R3 §7). `run` returns the text shown to the model: Indonesian, ≤ ~12 lines, first line a one-line
 * summary. Throw `RadarToolError` for a friendly failure; server.ts turns it into an `isError` result.
 */
export interface ToolDef<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  description: string;
  inputSchema: Shape;
  run(args: z.infer<z.ZodObject<Shape>>, client: RadarClient): Promise<string>;
}

export const defineTool = <Shape extends z.ZodRawShape>(def: ToolDef<Shape>): ToolDef<Shape> => def;
