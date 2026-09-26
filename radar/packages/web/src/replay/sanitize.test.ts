import { describe, expect, it } from 'vitest';
import type { RadarEvent } from '@radar/common';
import { SecretFoundError, sanitizeEvents } from './sanitize.js';

function ev(id: number, payload: unknown): RadarEvent {
  return { id, ts: 1_000 + id, actor: 'server', type: 'workspace.created', payload } as unknown as RadarEvent;
}

describe('sanitizeEvents', () => {
  it('passes events with no secret-shaped tokens through unchanged', () => {
    const events = [ev(1, { workspaceId: 'toko-demo', headCommit: 'a1b2c3d', fileCount: 3 })];
    expect(sanitizeEvents(events)).toEqual(events);
  });

  it('rejects a radar token (rdr_) anywhere in the payload', () => {
    const events = [ev(1, { note: 'token rdr_abc123' })];
    expect(() => sanitizeEvents(events)).toThrow(SecretFoundError);
  });

  it('rejects a GitHub PAT shape (ghp_) nested inside payload', () => {
    const events = [ev(2, { nested: { deep: 'ghp_1234567890abcdef1234567890abcdef1234' } })];
    expect(() => sanitizeEvents(events)).toThrow(SecretFoundError);
  });

  it('rejects an API-key shape (sk-) and names the offending event id', () => {
    const events = [ev(7, { key: 'sk-abcdefghijklmnop' })];
    expect(() => sanitizeEvents(events)).toThrow(/id=7/);
  });

  it('does not false-positive on an ordinary identifier that merely contains "sk-"', () => {
    const events = [ev(1, { taskId: 'desk-1', path: 'src/risk-model.ts', note: 'task-2 continues' })];
    expect(sanitizeEvents(events)).toEqual(events);
  });

  it('scans every event, not just the first', () => {
    const events = [ev(1, { ok: true }), ev(2, { ok: true }), ev(3, { leak: 'sk-abcdefghijklmnop' })];
    expect(() => sanitizeEvents(events)).toThrow(/id=3/);
  });
});
