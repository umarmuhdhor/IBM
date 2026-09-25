// Thin REST client for radar-mcp tools (R3 §2). Errors carry a short Indonesian message written for the model.
import type { LocalConfig } from './placeholder/config.js';

export const MCP_FETCH_TIMEOUT_MS = 5_000;
export const MSG_UNAVAILABLE = 'Server Radar tidak menjawab; lanjutkan pekerjaan lokal dan coba lagi nanti.';
export const MSG_NOT_JOINED = 'Folder ini belum terhubung ke Radar. Minta user menjalankan `radar join` dulu.';

export class RadarToolError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface RadarClient {
  readonly config: LocalConfig | null;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

export function createRadarClient(config: LocalConfig | null, timeoutMs = MCP_FETCH_TIMEOUT_MS): RadarClient {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!config) throw new RadarToolError(MSG_NOT_JOINED);
    let res: Response;
    try {
      res = await fetch(`${config.server}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${config.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new RadarToolError(MSG_UNAVAILABLE);
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON (e.g. a proxy error page): fall through with no body
    }
    if (!res.ok) {
      // R3 §1 error body: { error: { code, message } }
      const err = (json as { error?: { code?: string; message?: string } } | undefined)?.error;
      throw new RadarToolError(err?.message ?? `Server Radar menolak permintaan (HTTP ${res.status}).`, res.status, err?.code);
    }
    return json as T;
  }
  return {
    config,
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body: unknown) => call<T>('POST', path, body),
  };
}
