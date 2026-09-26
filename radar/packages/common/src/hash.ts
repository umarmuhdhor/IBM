// SHA-256 over the exact bytes (no CRLF normalisation), via Web Crypto so it runs in Node ≥ 20 and Workers.

const encoder = new TextEncoder();

export async function sha256Hex(content: string | Uint8Array): Promise<string> {
  // Copy into a fresh ArrayBuffer-backed view: digest() rejects views over a SharedArrayBuffer.
  const bytes = typeof content === 'string' ? encoder.encode(content) : new Uint8Array(content);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  let hex = '';
  for (const b of new Uint8Array(digest)) hex += b.toString(16).padStart(2, '0');
  return hex;
}
