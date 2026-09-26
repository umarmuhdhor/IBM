'use client';
// Replay chrome (fase 11D1 redesign): header, narrator bar, chapter stepper and the sticky transport.
// The narrator + stepper are what make the story followable; the transport keeps the e2e contract
// (`replay-play-toggle`, `replay-speed-8x`, `chapter-*`).
import type { Speed } from '../../lib/replay-player';
import type { Chapter } from '../chapters';
import type { ReplayMeta } from '../meta';
import type { Beat } from '../narrate';

export const MEMBER_COLOR: Record<string, string> = {
  A: 'var(--lc-member-a)',
  B: 'var(--lc-member-b)',
  C: 'var(--lc-member-c)',
  D: 'var(--lc-member-d)',
};

export function memberColor(id: string | null | undefined): string {
  return (id && MEMBER_COLOR[id]) || 'var(--lc-text-muted)';
}

export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Header ───────────────────────────────────────────────────────────────────

export function Header({ meta }: { meta: ReplayMeta }) {
  const { links, metrics } = meta;
  const median = metrics.medianDecisionSeconds == null ? '–' : `${metrics.medianDecisionSeconds.toFixed(1)} s`;
  const linkList: Array<[string, string | null]> = [
    ['Repo', links.repoUrl],
    ['bob_sessions', links.bobSessions],
    ['Video', links.video],
    ['Deck', links.deck],
  ];
  return (
    <header className="rp-header">
      <div className="rp-header-top">
        <a className="rp-back" href="/">
          <span aria-hidden="true">←</span> IBM Bob Live Collab
        </a>
        <nav className="rp-links" aria-label="Project links">
          {linkList
            .filter((l): l is [string, string] => Boolean(l[1]))
            .map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ))}
        </nav>
      </div>
      <div className="rp-title-row">
        <h1>Session replay</h1>
        <span className="rp-badge">no login · no API key</span>
      </div>
      <p className="rp-lede">
        Three people, three IBM Bobs, one codebase. Watch Radar keep them out of each other&apos;s files.
      </p>
      <dl className="rp-metrics">
        <div>
          <dt>near-misses prevented</dt>
          <dd>{metrics.nearMisses}</dd>
        </div>
        <div>
          <dt>merge conflicts</dt>
          <dd>{metrics.mergeConflicts}</dd>
        </div>
        <div>
          <dt>decisions</dt>
          <dd>{metrics.decisions}</dd>
        </div>
        <div>
          <dt>median decision</dt>
          <dd>{median}</dd>
        </div>
      </dl>
    </header>
  );
}

// ── Narrator ─────────────────────────────────────────────────────────────────

const TONE_LABEL: Record<Beat['tone'], string | null> = {
  block: 'Near-miss caught',
  decision: 'PM Bob proposes',
  ok: 'Resolved',
  info: null,
};

export function NarratorBar({
  beat,
  chapter,
  stepIndex,
  stepCount,
  t0,
  names,
}: {
  beat: Beat | null;
  chapter: Chapter | null;
  stepIndex: number;
  stepCount: number;
  t0: number;
  names: Record<string, string>;
}) {
  const tone = beat ? TONE_LABEL[beat.tone] : null;
  return (
    <section
      className="rp-narrator"
      data-tone={beat?.tone ?? 'info'}
      style={{ ['--actor' as string]: memberColor(beat?.actor) }}
      aria-label="What is happening now"
    >
      <div className="rp-narrator-meta">
        <span>
          {chapter ? `Step ${stepIndex + 1} of ${stepCount} · ${chapter.label}` : 'Setting up the workspace'}
        </span>
        {tone && <span className="rp-tone">{tone}</span>}
        {beat?.actor && names[beat.actor] && <span className="rp-actor">{names[beat.actor]}</span>}
        {beat && <time className="rp-narrator-time">{clock(beat.ts - t0)}</time>}
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p key={beat?.id ?? 0} className="rp-narrator-text">
          {beat?.text ?? 'Press play to watch the session.'}
        </p>
        {beat?.quote && (
          <blockquote key={`q${beat.id}`} className="rp-narrator-quote">
            “{beat.quote}”
          </blockquote>
        )}
      </div>
    </section>
  );
}

// ── Chapter stepper ──────────────────────────────────────────────────────────

const CHAPTER_HINT: Record<string, string> = {
  plan: 'PM Bob splits the work',
  live: 'Each Bob edits only its own files',
  review: 'PM Bob checks before merge',
  'near-miss': 'Two Bobs reach for one file',
  commit: 'The work lands in git',
};

export function ChapterStepper({
  chapters,
  activeIndex,
  t0,
  onSeek,
}: {
  chapters: Chapter[];
  activeIndex: number;
  t0: number;
  onSeek: (ms: number) => void;
}) {
  return (
    <ol className="rp-stepper" aria-label="Chapters">
      {chapters.map((ch, i) => {
        const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'next';
        return (
          <li key={ch.id} data-state={state} data-chapter={ch.id}>
            <button
              type="button"
              data-testid={`chapter-${ch.id}`}
              aria-current={state === 'active' ? 'step' : undefined}
              onClick={() => onSeek(ch.ts - t0)}
            >
              <span className="rp-step-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="rp-step-label">{ch.label}</span>
              <span className="rp-step-hint">{CHAPTER_HINT[ch.id] ?? ''}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ── Transport ────────────────────────────────────────────────────────────────

const SPEEDS: Speed[] = [1, 2, 4, 8];

export function Transport({
  isPlaying,
  onPlayPause,
  speed,
  onSpeed,
  offsetMs,
  durationMs,
  onSeek,
  chapters,
  t0,
}: {
  isPlaying: boolean;
  onPlayPause: () => void;
  speed: Speed;
  onSpeed: (s: Speed) => void;
  offsetMs: number;
  durationMs: number;
  onSeek: (ms: number) => void;
  chapters: Chapter[];
  t0: number;
}) {
  const pct = durationMs > 0 ? (offsetMs / durationMs) * 100 : 0;
  const ended = durationMs > 0 && offsetMs >= durationMs;
  return (
    <div className="rp-transport" role="group" aria-label="Replay controls">
      <button
        type="button"
        className="rp-play"
        data-testid="replay-play-toggle"
        data-playing={isPlaying ? 'true' : 'false'}
        onClick={onPlayPause}
      >
        {isPlaying ? (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <rect x="3" y="2.5" width="3.5" height="11" rx="1" />
            <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 2.8v10.4a.8.8 0 0 0 1.2.7l8.6-5.2a.8.8 0 0 0 0-1.4L5.2 2.1a.8.8 0 0 0-1.2.7Z" />
          </svg>
        )}
        <span>{isPlaying ? 'Pause' : ended ? 'Replay' : 'Play'}</span>
      </button>

      <div className="rp-scrub" style={{ ['--pct' as string]: `${pct}%` }}>
        <input
          type="range"
          min={0}
          max={durationMs}
          step={100}
          value={offsetMs}
          onChange={(e) => onSeek(Number(e.currentTarget.value))}
          aria-label="Seek"
          aria-valuetext={`${clock(offsetMs)} of ${clock(durationMs)}`}
        />
        {chapters.map((ch) => (
          <i
            key={ch.id}
            aria-hidden="true"
            data-passed={ch.ts - t0 <= offsetMs ? 'true' : 'false'}
            style={{ left: `${durationMs > 0 ? ((ch.ts - t0) / durationMs) * 100 : 0}%` }}
          />
        ))}
      </div>

      <span className="rp-time">
        {clock(offsetMs)} <span aria-hidden="true">/</span> {clock(durationMs)}
      </span>

      <div className="rp-speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={speed === s}
            data-testid={s === 8 ? 'replay-speed-8x' : undefined}
            onClick={() => onSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
