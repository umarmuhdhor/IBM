// Minimal client for the Radar REST API (R3 §1). Built-in fetch only, so the bundled hook stays dependency-free.
import type { z } from 'zod';
import { ErrorRes } from './schemas.js';

export interface RadarClientConfig {
  server: string;
  token: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RadarFetchOptions<T> {
  timeoutMs: number;
  /** Validates the JSON body. Without it the body is returned as-is (typed as T). */
  schema?: z.ZodType<T>;
  /** Injected in tests; defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch;
}

/** Non-2xx response. `code` comes from the R3 error body, or is derived from the status. */
export class RadarHttpError extends Error {
  override readonly name = 'RadarHttpError';
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class RadarTimeoutError extends Error {
  override readonly name = 'RadarTimeoutError';
  constructor(readonly timeoutMs: number) {
    super(`radar request timed out after ${timeoutMs} ms`);
  }
}

/** Connection refused, DNS failure, invalid JSON body, or a body that fails the schema. */
export class RadarNetworkError extends Error {
  override readonly name = 'RadarNetworkError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

function codeForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 422:
      return 'VALIDATION';
    default:
      return 'INTERNAL';
  }
}

export async function radarFetch<T>(
  cfg: RadarClientConfig,
  method: HttpMethod,
  path: string,
  body: unknown,
  opts: RadarFetchOptions<T>,
): Promise<T> {
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const url = cfg.server.replace(/\/+$/, '') + (path.startsWith('/') ? path : `/${path}`);
  const headers: Record<string, string> = { authorization: `Bearer ${cfg.token}` };
  if (body !== undefined) headers['content-type'] = 'application/json';

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  let res: Response;
  let text: string;
  try {
    res = await doFetch(url, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      signal: ctrl.signal,
    });
    text = await res.text();
  } catch (err) {
    if (ctrl.signal.aborted) throw new RadarTimeoutError(opts.timeoutMs);
    throw new RadarNetworkError(`radar request failed: ${method} ${path}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    const err = ErrorRes.safeParse(parsed);
    if (err.success) throw new RadarHttpError(err.data.error.code, res.status, err.data.error.message);
    throw new RadarHttpError(codeForStatus(res.status), res.status, `HTTP ${res.status} ${method} ${path}`);
  }

  if (res.status === 204 || text === '') return undefined as T;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    throw new RadarNetworkError(`invalid JSON from ${method} ${path}`, { cause: err });
  }
  if (!opts.schema) return json as T;
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) {
    throw new RadarNetworkError(`unexpected response shape from ${method} ${path}`, { cause: parsed.error });
  }
  return parsed.data;
}
