// Builds the static replay bundle consumed by `/demo` (fase 11D1 langkah 14): events.json, meta.json,
// bob-quotes.json under public/demo/. Prefers a live server export (RADAR_EXPORT_URL) so this becomes
// the real recording pipeline once fase 03/05/06 (server) exist; falls back to the local fixture, which
// was captured from the contract-approved `radar/scripts/mock-scenarios/demo.json` scenario and
// re-timestamped from its own delayMs timeline (see gen-replay-fixture in this fase's log).
// TODO(sync:alief): swap the fixture branch for the real GET /v1/events/export (R3 §2.23) once it ships,
// and again after the fase 10 milestone recording (11D2, replay final).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ExportRes, type RadarEvent } from '@radar/common';
import { buildReplayMeta, type ReplayLinks } from '../src/replay/meta.js';
import { sanitizeEvents } from '../src/replay/sanitize.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FIXTURE_PATH = `${ROOT}fixtures/replay/export.json`;
const QUOTES_PATH = `${ROOT}../../bob-kit/prompts/bob-quotes.json`;
const OUT_DIR = `${ROOT}public/demo`;

const LINKS: ReplayLinks = {
  repoUrl: 'https://github.com/umarmuhdhor/IBM',
  bobSessions: 'https://github.com/umarmuhdhor/IBM/tree/main/bob_sessions',
  video: null, // TODO(sync:imelda): fase 11D2, once the milestone video is cut
  deck: null, // TODO(sync:imelda): fase 14, once the deck is published
};

interface ExportPayload {
  workspace: string;
  exportedAt: number;
  events: RadarEvent[];
}

async function loadExport(): Promise<ExportPayload> {
  const url = process.env.RADAR_EXPORT_URL;
  if (url) {
    const token = process.env.RADAR_EXPORT_TOKEN;
    if (!token) throw new Error('RADAR_EXPORT_URL is set but RADAR_EXPORT_TOKEN is missing');
    const res = await fetch(`${url}/v1/events/export`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`GET /v1/events/export failed: ${res.status} ${res.statusText}`);
    return ExportRes.parse(await res.json());
  }
  return ExportRes.parse(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')));
}

export async function run(): Promise<void> {
  const { workspace, exportedAt, events } = await loadExport();
  const sanitized = sanitizeEvents(events);
  const meta = buildReplayMeta(workspace, exportedAt, sanitized, LINKS);
  const quotes = JSON.parse(readFileSync(QUOTES_PATH, 'utf8'));

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/events.json`, JSON.stringify({ workspace, exportedAt, events: sanitized }, null, 2) + '\n');
  writeFileSync(`${OUT_DIR}/meta.json`, JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(`${OUT_DIR}/bob-quotes.json`, JSON.stringify(quotes, null, 2) + '\n');
  console.log(`export-replay: wrote ${sanitized.length} events and ${meta.chapters.length} chapters to ${OUT_DIR}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await run();
}
