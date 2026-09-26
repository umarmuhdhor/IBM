// R3 §1 error shape `{ error: { code, message } }`. Messages are user-facing (Indonesian); stacks never leave the DO.
import type { ErrorCode } from '@radar/common';
import { ZodError, type z } from 'zod';

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 422 | 426 | 429 | 500;

export class RadarError extends Error {
  override readonly name = 'RadarError';
  constructor(
    readonly status: ErrorStatus,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function errorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

export function errorJson(status: ErrorStatus, code: ErrorCode, message: string): Response {
  return Response.json(errorBody(code, message), { status });
}

function zodMessage(err: ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
    .join('; ');
}

/** Maps any thrown value to an R3 error response. Unknown errors are logged and returned as a bare 500. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof RadarError) return errorJson(err.status, err.code, err.message);
  if (err instanceof ZodError) return errorJson(422, 'VALIDATION', zodMessage(err));
  console.error('radar: unhandled error', err instanceof Error ? (err.stack ?? `${err.name}: ${err.message}`) : String(err));
  return errorJson(500, 'INTERNAL', 'Terjadi kesalahan di server.');
}

/** JSON body text → value. Empty or broken JSON is 400 BAD_REQUEST. */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new RadarError(400, 'BAD_REQUEST', 'Body bukan JSON yang valid.');
  }
}

/** REST body cap (fase 12 step 9). Admin file batches pass a larger cap. */
export const REST_MAX_BODY_BYTES = 256 * 1024;

export async function readJson(req: Request, maxBytes = REST_MAX_BODY_BYTES): Promise<unknown> {
  const tooLarge = () => new RadarError(413, 'PAYLOAD_TOO_LARGE', `Body lebih dari ${Math.round(maxBytes / 1024)} KB.`);
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge();
  const text = await req.text();
  // Header can be absent or wrong (chunked): check the real size too. UTF-16 length ≤ UTF-8 bytes, so this is cheap first.
  if (text.length > maxBytes || new TextEncoder().encode(text).byteLength > maxBytes) throw tooLarge();
  return parseJsonText(text);
}

export function parseWith<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new RadarError(422, 'VALIDATION', zodMessage(r.error));
  return r.data;
}
