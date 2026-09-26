'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  BobTrace,
  FeedItem,
  DecisionCard,
  TaskCard,
  LockChip,
  MemberChip,
  AgentTag,
} from '@radar/ui';
import type { BobTracePrimitive } from '@radar/ui';
import { bobTimeline, pendingDecisions } from '@radar/common';
import type { RadarState, BobActivityItem } from '@radar/ui';
import { createPlayer } from '../../src/lib/replay-player';
import type { ReplayPlayer, Speed } from '../../src/lib/replay-player';
import type { ReplayMeta } from '../../src/replay/meta';
import type { RadarEvent } from '@radar/common';

// ── Theme vars ────────────────────────────────────────────────────────────────
// The page uses --lc-* tokens from @radar/ui/src/theme-vars.css, which is
// imported globally via app/globals.css.

interface BobQuotes {
  brief_seen: string[];
  bob_after_block: string[];
  hook_block_message: string;
  why_blocked_output: string[];
  bob_refuses_shortcut: string;
  pm: {
    refuses_to_edit: string;
    refuses_self_approve: string;
    decision_reason: string;
    review_impact: string;
    review_verdict: string;
  };
}

// ── Primitive mapping ─────────────────────────────────────────────────────────

/** Map BobActivityKind → BobTracePrimitive */
function toBobPrimitive(item: BobActivityItem): BobTracePrimitive {
  if (item.kind === 'tool.pre' || item.kind === 'tool.post') return 'hook';
  if (item.kind === 'session.start' || item.kind === 'turn.end') return 'mode';
  if (item.tool) return 'hook';
  return 'mode';
}

/** Build a short detail string for the BobTrace */
function toBobDetail(item: BobActivityItem): string {
  const toolOrKind = item.tool ?? item.kind;
  const paths = item.paths?.join(', ') ?? '';
  return paths ? `${toolOrKind} · ${paths}` : toolOrKind;
}

/** Pick the most relevant quote for a given activity item */
function pickQuote(item: BobActivityItem, quotes: BobQuotes): string | null {
  // member B + tool.pre + decision block → bob_after_block
  if (item.memberId === 'B' && item.kind === 'tool.pre' && item.decision === 'block') {
    return quotes.bob_after_block[0] ?? null;
  }
  // any block
  if (item.decision === 'block') {
    return quotes.hook_block_message ?? null;
  }
  // session start → brief_seen
  if (item.kind === 'session.start') {
    return quotes.brief_seen[0] ?? null;
  }
  // fallback
  return quotes.brief_seen[0] ?? null;
}

// ── Member info ───────────────────────────────────────────────────────────────

const MEMBER_INFO: Record<string, { name: string; initials: string; colorVar: string }> = {
  A: { name: 'Andi', initials: 'A', colorVar: 'var(--lc-member-a)' },
  B: { name: 'Budi', initials: 'B', colorVar: 'var(--lc-member-b)' },
  C: { name: 'Citra', initials: 'C', colorVar: 'var(--lc-member-c)' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricsRow({ metrics }: { metrics: ReplayMeta['metrics'] }) {
  const median =
    metrics.medianDecisionSeconds == null ? '–' : `${metrics.medianDecisionSeconds.toFixed(1)} s`;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0 24px',
        fontFamily: 'var(--lc-font-mono)',
        fontSize: '13px',
        color: 'var(--lc-text-muted)',
        padding: '8px 0',
        borderBottom: '1px solid var(--lc-border)',
      }}
    >
      <span>
        near-misses prevented{' '}
        <strong style={{ color: 'var(--lc-text)', fontWeight: 600 }}>{metrics.nearMisses}</strong>
      </span>
      <span>·</span>
      <span>
        merge conflicts{' '}
        <strong style={{ color: 'var(--lc-text)', fontWeight: 600 }}>
          {metrics.mergeConflicts}
        </strong>
      </span>
      <span>·</span>
      <span>
        decisions{' '}
        <strong style={{ color: 'var(--lc-text)', fontWeight: 600 }}>{metrics.decisions}</strong>
      </span>
      <span>·</span>
      <span>
        median decision{' '}
        <strong style={{ color: 'var(--lc-text)', fontWeight: 600 }}>{median}</strong>
      </span>
    </div>
  );
}

interface ActivityRowProps {
  item: BobActivityItem;
  onClick: (item: BobActivityItem) => void;
  selected: boolean;
}

function ActivityRow({ item, onClick, selected }: ActivityRowProps) {
  const primitive = toBobPrimitive(item);
  const detail = toBobDetail(item);
  const outcome = item.decision ?? undefined;

  return (
    <div
      data-testid="bob-activity-row"
      role="button"
      tabIndex={0}
      onClick={() => onClick(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(item);
      }}
      style={{
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '6px',
        background: selected ? 'var(--lc-surface-3)' : 'transparent',
        border: selected ? '1px solid var(--lc-border-strong)' : '1px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <BobTrace primitive={primitive} detail={detail} outcome={outcome} />
    </div>
  );
}

interface MissionControlColumnProps {
  state: RadarState;
}

function MissionControlColumn({ state }: MissionControlColumnProps) {
  const proposals = pendingDecisions(state);
  const recentFeed = state.feed.slice(0, 5);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '11px',
          color: 'var(--lc-text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '4px',
        }}
      >
        Mission Control
      </div>

      {/* Pending proposals → TaskCard / DecisionCard */}
      {proposals.length === 0 && (
        <div
          style={{
            fontFamily: 'var(--lc-font-sans)',
            fontSize: '12px',
            color: 'var(--lc-text-faint)',
          }}
        >
          No pending decisions
        </div>
      )}
      {proposals.map((p) => {
        if (p.kind === 'review') {
          return (
            <DecisionCard
              key={p.id}
              title={`Review: ${p.refId ?? p.id}`}
              reason={p.reason}
              status="pending"
              readOnly
              onApprove={() => {}}
              onDeny={() => {}}
            />
          );
        }
        return (
          <DecisionCard
            key={p.id}
            title={`${p.kind === 'plan' ? 'Plan' : 'Decision'}: ${p.id}`}
            reason={p.reason}
            status="pending"
            readOnly
            onApprove={() => {}}
            onDeny={() => {}}
          />
        );
      })}

      {/* Active tasks */}
      <div
        style={{
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '11px',
          color: 'var(--lc-text-faint)',
          marginTop: '8px',
        }}
      >
        Tasks
      </div>
      {Object.values(state.tasks)
        .filter((t) => t.status === 'dikerjakan' || t.status === 'terbuka')
        .slice(0, 4)
        .map((t) => {
          const owner = state.members[t.ownerId];
          const memberInfo = MEMBER_INFO[t.ownerId];
          return (
            <TaskCard
              key={t.id}
              id={t.id}
              title={t.title}
              ownerId={t.ownerId}
              ownerInitials={memberInfo?.initials ?? t.ownerId}
              ownerStatus={owner?.online ? 'online' : 'offline'}
              status={t.status}
              fileCount={t.files.length}
              editCount={t.editCount}
              commitSha={t.commitSha}
            />
          );
        })}

      {/* Active locks */}
      {Object.keys(state.locks).length > 0 && (
        <>
          <div
            style={{
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '11px',
              color: 'var(--lc-text-faint)',
              marginTop: '8px',
            }}
          >
            Locks
          </div>
          {Object.values(state.locks)
            .slice(0, 4)
            .map((lock) => (
              <div
                key={lock.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'var(--lc-font-mono)',
                  fontSize: '12px',
                  color: 'var(--lc-text-muted)',
                }}
              >
                <LockChip state={lock.state} holder={lock.memberId} />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lock.path}
                </span>
              </div>
            ))}
        </>
      )}

      {/* Feed */}
      {recentFeed.length > 0 && (
        <>
          <div
            style={{
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '11px',
              color: 'var(--lc-text-faint)',
              marginTop: '8px',
            }}
          >
            Feed
          </div>
          {recentFeed.map((fi) => (
            <FeedItem
              key={fi.id}
              ts={fi.ts}
              actor={fi.actor}
              kind="info"
              text={fi.text}
            />
          ))}
        </>
      )}
    </div>
  );
}

interface BobInsidePanelProps {
  item: BobActivityItem | null;
  quotes: BobQuotes | null;
  bobSessionsUrl: string;
}

function BobInsidePanel({ item, quotes, bobSessionsUrl }: BobInsidePanelProps) {
  if (!item) {
    return (
      <div
        data-testid="bob-inside-panel"
        style={{
          background: 'var(--lc-surface-1)',
          border: '1px solid var(--lc-border)',
          borderRadius: '10px',
          padding: '16px',
          fontFamily: 'var(--lc-font-sans)',
          fontSize: '13px',
          color: 'var(--lc-text-faint)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}
        >
          Bob inside
        </div>
        Click a timeline row to inspect the Bob primitive.
      </div>
    );
  }

  const primitive = toBobPrimitive(item);
  const detail = toBobDetail(item);
  const quote = quotes ? pickQuote(item, quotes) : null;
  const memberInfo = MEMBER_INFO[item.memberId];

  // Compact payload (omit large fields)
  const payloadPreview = {
    kind: item.kind,
    ...(item.tool ? { tool: item.tool } : {}),
    ...(item.decision ? { decision: item.decision } : {}),
    ...(item.paths ? { paths: item.paths } : {}),
    ...(item.mode ? { mode: item.mode } : {}),
  };

  return (
    <div
      data-testid="bob-inside-panel"
      style={{
        background: 'var(--lc-surface-1)',
        border: '1px solid var(--lc-border)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'var(--lc-font-sans)',
        fontSize: '13px',
        color: 'var(--lc-text)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '11px',
          color: 'var(--lc-text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        Bob inside
      </div>

      {/* Member + primitive */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MemberChip
          member={item.memberId}
          initials={memberInfo?.initials ?? item.memberId}
          status="offline"
        />
        <AgentTag label={`Bob · ${item.memberId}`} member={item.memberId} />
      </div>

      {/* BobTrace */}
      <BobTrace primitive={primitive} detail={detail} outcome={item.decision ?? undefined} />

      {/* Compact payload */}
      <div>
        <div
          style={{
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-faint)',
            marginBottom: '4px',
          }}
        >
          payload
        </div>
        <pre
          style={{
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-muted)',
            background: 'var(--lc-surface-2)',
            borderRadius: '6px',
            padding: '8px',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {JSON.stringify(payloadPreview, null, 2)}
        </pre>
      </div>

      {/* Quote */}
      {quote && (
        <div>
          <div
            style={{
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '11px',
              color: 'var(--lc-text-faint)',
              marginBottom: '4px',
            }}
          >
            Bob said
          </div>
          <blockquote
            style={{
              margin: 0,
              padding: '8px 12px',
              borderLeft: `3px solid ${memberInfo?.colorVar ?? 'var(--lc-accent)'}`,
              fontFamily: 'var(--lc-font-sans)',
              fontSize: '12px',
              color: 'var(--lc-text-muted)',
              fontStyle: 'italic',
              lineHeight: '18px',
            }}
          >
            {quote}
          </blockquote>
        </div>
      )}
      {!quote && (
        <div style={{ fontSize: '12px', color: 'var(--lc-text-faint)' }}>belum ada kutipan</div>
      )}

      {/* Bob sessions link */}
      <a
        href={bobSessionsUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '11px',
          color: 'var(--lc-accent-soft)',
          textDecoration: 'none',
          borderBottom: '1px solid var(--lc-border)',
          paddingBottom: '2px',
          alignSelf: 'flex-start',
        }}
      >
        → bob_sessions
      </a>
    </div>
  );
}

// ── Chapter Timeline ──────────────────────────────────────────────────────────

interface TimelineBarProps {
  chapters: ReplayMeta['chapters'];
  t0: number;
  durationMs: number;
  offsetMs: number;
  onSeek: (ms: number) => void;
  speed: Speed;
  onSpeedChange: (s: Speed) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

const SPEEDS: Speed[] = [1, 2, 4, 8];

function TimelineBar({
  chapters,
  t0,
  durationMs,
  offsetMs,
  onSeek,
  speed,
  onSpeedChange,
  isPlaying,
  onPlayPause,
}: TimelineBarProps) {
  const pct = durationMs > 0 ? (offsetMs / durationMs) * 100 : 0;

  const barRef = useRef<HTMLDivElement>(null);

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || durationMs === 0) return;
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(Math.round(fraction * durationMs));
    },
    [durationMs, onSeek],
  );

  return (
    <div
      style={{
        background: 'var(--lc-surface-1)',
        borderTop: '1px solid var(--lc-border)',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Chapter markers + progress bar */}
      <div style={{ position: 'relative' }}>
        {/* Chapter labels above bar */}
        <div
          style={{
            position: 'relative',
            height: '18px',
            marginBottom: '4px',
          }}
        >
          {chapters.map((ch) => {
            const chOffset = ch.ts - t0;
            const chPct = durationMs > 0 ? (chOffset / durationMs) * 100 : 0;
            return (
              <div
                key={ch.id}
                data-testid={`chapter-${ch.id}`}
                style={{
                  position: 'absolute',
                  left: `${chPct}%`,
                  transform: 'translateX(-50%)',
                  fontFamily: 'var(--lc-font-mono)',
                  fontSize: '10px',
                  color: 'var(--lc-text-faint)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
                onClick={() => onSeek(chOffset)}
              >
                {ch.label}
              </div>
            );
          })}
        </div>

        {/* Scrubber bar */}
        <div
          ref={barRef}
          onClick={handleBarClick}
          style={{
            position: 'relative',
            height: '4px',
            background: 'var(--lc-surface-3)',
            borderRadius: '2px',
            cursor: 'pointer',
          }}
        >
          {/* Progress fill */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pct}%`,
              background: 'var(--lc-accent)',
              borderRadius: '2px',
              transition: 'width 0.1s linear',
            }}
          />

          {/* Chapter tick marks */}
          {chapters.map((ch) => {
            const chOffset = ch.ts - t0;
            const chPct = durationMs > 0 ? (chOffset / durationMs) * 100 : 0;
            return (
              <div
                key={ch.id}
                style={{
                  position: 'absolute',
                  left: `${chPct}%`,
                  top: '-2px',
                  width: '2px',
                  height: '8px',
                  background: 'var(--lc-border-strong)',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                }}
              />
            );
          })}

          {/* Playhead */}
          <div
            style={{
              position: 'absolute',
              left: `${pct}%`,
              top: '-4px',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: 'var(--lc-accent)',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 0 2px var(--lc-bg)',
            }}
          />
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Play/pause */}
        <button
          type="button"
          data-testid="replay-play-toggle"
          data-playing={isPlaying ? 'true' : 'false'}
          onClick={onPlayPause}
          style={{
            padding: '4px 12px',
            borderRadius: '6px',
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            background: 'var(--lc-accent)',
            color: 'var(--lc-text)',
            border: 'none',
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>

        {/* Speed buttons */}
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            data-testid={s === 8 ? 'replay-speed-8x' : undefined}
            onClick={() => onSpeedChange(s)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '12px',
              cursor: 'pointer',
              background: speed === s ? 'var(--lc-surface-3)' : 'transparent',
              color: speed === s ? 'var(--lc-text)' : 'var(--lc-text-faint)',
              border: speed === s ? '1px solid var(--lc-border-strong)' : '1px solid transparent',
            }}
          >
            {s}×
          </button>
        ))}

        {/* Elapsed / Duration */}
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-faint)',
          }}
        >
          {(offsetMs / 1000).toFixed(1)}s / {(durationMs / 1000).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [events, setEvents] = useState<RadarEvent[] | null>(null);
  const [quotes, setQuotes] = useState<BobQuotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<ReplayPlayer | null>(null);

  // Player state (derived from subscription)
  const [offsetMs, setOffsetMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeedState] = useState<Speed>(2);
  const [radarState, setRadarState] = useState<RadarState | null>(null);

  // Selected activity item for Bob Inside panel
  const [selectedItem, setSelectedItem] = useState<BobActivityItem | null>(null);

  // Fetch all three data files on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [eventsRes, metaRes, quotesRes] = await Promise.all([
          fetch('/demo/events.json'),
          fetch('/demo/meta.json'),
          fetch('/demo/bob-quotes.json'),
        ]);
        if (!eventsRes.ok || !metaRes.ok || !quotesRes.ok) {
          throw new Error('Failed to load demo data');
        }
        const eventsData = (await eventsRes.json()) as { events: RadarEvent[] };
        const metaData = (await metaRes.json()) as ReplayMeta;
        const quotesData = (await quotesRes.json()) as BobQuotes;

        if (cancelled) return;

        setMeta(metaData);
        setQuotes(quotesData);
        setEvents(eventsData.events);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Create player once events are loaded
  useEffect(() => {
    if (!events) return;

    // Destroy previous player if any
    playerRef.current?.destroy();

    const player = createPlayer(events);
    playerRef.current = player;

    // Set initial state
    setRadarState(player.getState());

    // Subscribe to offset changes
    const unsub = player.subscribe((ms) => {
      setOffsetMs(ms);
      setIsPlaying(player.isPlaying());
      setRadarState(player.getState());
    });

    // Autoplay at 2× (DESIGN §5.8)
    player.setSpeed(2);
    setSpeedState(2);
    player.play();
    setIsPlaying(true);

    return () => {
      unsub();
      player.destroy();
      playerRef.current = null;
    };
  }, [events]);

  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, []);

  const handleSeek = useCallback((ms: number) => {
    playerRef.current?.seek(ms);
  }, []);

  const handleSpeedChange = useCallback((s: Speed) => {
    playerRef.current?.setSpeed(s);
    setSpeedState(s);
  }, []);

  // Determine members for coder columns (left: A, right: B)
  const memberLeft = 'A';
  const memberRight = 'B';

  const timelineLeft = radarState ? bobTimeline(radarState, memberLeft) : [];
  const timelineRight = radarState ? bobTimeline(radarState, memberRight) : [];

  const durationMs = playerRef.current?.getDurationMs() ?? 0;
  const t0 = events?.[0]?.ts ?? 0;

  if (error) {
    return (
      <main
        style={{
          background: 'var(--lc-bg)',
          minHeight: '100vh',
          color: 'var(--lc-danger)',
          fontFamily: 'var(--lc-font-mono)',
          padding: '32px',
        }}
      >
        Error: {error}
      </main>
    );
  }

  if (!meta || !radarState) {
    return (
      <main
        style={{
          background: 'var(--lc-bg)',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--lc-text-faint)',
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '13px',
        }}
      >
        Loading replay…
      </main>
    );
  }

  const { links } = meta;

  return (
    <div
      style={{
        background: 'var(--lc-bg)',
        minHeight: '100vh',
        color: 'var(--lc-text)',
        fontFamily: 'var(--lc-font-sans)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: '1px solid var(--lc-border)',
          padding: '12px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          background: 'var(--lc-surface-1)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--lc-font-sans)',
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--lc-text)',
            margin: 0,
          }}
        >
          IBM Bob Live Collab — session replay
        </h1>

        <span
          style={{
            fontFamily: 'var(--lc-font-mono)',
            fontSize: '11px',
            color: 'var(--lc-text-faint)',
            padding: '2px 8px',
            borderRadius: '100px',
            border: '1px solid var(--lc-border)',
            background: 'var(--lc-surface-2)',
          }}
        >
          no login · no API key
        </span>

        <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <a
            href={links.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '11px',
              color: 'var(--lc-accent-soft)',
              textDecoration: 'none',
            }}
          >
            Repo ↗
          </a>
          <a
            href={links.bobSessions}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: 'var(--lc-font-mono)',
              fontSize: '11px',
              color: 'var(--lc-accent-soft)',
              textDecoration: 'none',
            }}
          >
            bob_sessions ↗
          </a>
          {links.video && (
            <a
              href={links.video}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--lc-font-mono)',
                fontSize: '11px',
                color: 'var(--lc-accent-soft)',
                textDecoration: 'none',
              }}
            >
              Video ↗
            </a>
          )}
          {links.deck && (
            <a
              href={links.deck}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--lc-font-mono)',
                fontSize: '11px',
                color: 'var(--lc-accent-soft)',
                textDecoration: 'none',
              }}
            >
              Deck ↗
            </a>
          )}
        </div>
      </header>

      {/* ── Metrics row ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 24px' }}>
        <MetricsRow metrics={meta.metrics} />
      </div>

      {/* ── Three-column main area ───────────────────────────────────────────── */}
      <div
        className="lc-demo-columns"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Left: Andi's Bob timeline */}
        <div
          style={{
            borderRight: '1px solid var(--lc-border)',
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <MemberChip
              member={memberLeft}
              initials={MEMBER_INFO[memberLeft]!.initials}
              status={radarState.members[memberLeft]?.online ? 'online' : 'offline'}
            />
            <span
              style={{
                fontFamily: 'var(--lc-font-mono)',
                fontSize: '12px',
                color: 'var(--lc-text-muted)',
              }}
            >
              {MEMBER_INFO[memberLeft]!.name} · Bob IDE
            </span>
            <AgentTag label="coder" member={memberLeft} />
          </div>

          {timelineLeft.length === 0 && (
            <div
              style={{
                fontFamily: 'var(--lc-font-mono)',
                fontSize: '12px',
                color: 'var(--lc-text-faint)',
              }}
            >
              no activity yet
            </div>
          )}
          {timelineLeft.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              selected={selectedItem?.id === item.id}
              onClick={setSelectedItem}
            />
          ))}
        </div>

        {/* Center: Mission Control */}
        <div
          style={{
            borderRight: '1px solid var(--lc-border)',
            padding: '16px',
            overflowY: 'auto',
          }}
        >
          <MissionControlColumn state={radarState} />
        </div>

        {/* Right: Budi's Bob timeline + Bob Inside panel */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px',
            }}
          >
            <MemberChip
              member={memberRight}
              initials={MEMBER_INFO[memberRight]!.initials}
              status={radarState.members[memberRight]?.online ? 'online' : 'offline'}
            />
            <span
              style={{
                fontFamily: 'var(--lc-font-mono)',
                fontSize: '12px',
                color: 'var(--lc-text-muted)',
              }}
            >
              {MEMBER_INFO[memberRight]!.name} · Bob IDE
            </span>
            <AgentTag label="coder" member={memberRight} />
          </div>

          {timelineRight.length === 0 && (
            <div
              style={{
                fontFamily: 'var(--lc-font-mono)',
                fontSize: '12px',
                color: 'var(--lc-text-faint)',
              }}
            >
              no activity yet
            </div>
          )}
          {timelineRight.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              selected={selectedItem?.id === item.id}
              onClick={setSelectedItem}
            />
          ))}

          {/* Bob Inside panel */}
          <div style={{ marginTop: '16px' }}>
            <BobInsidePanel
              item={selectedItem}
              quotes={quotes}
              bobSessionsUrl={links.bobSessions}
            />
          </div>
        </div>
      </div>

      {/* ── Timeline bar ────────────────────────────────────────────────────── */}
      <TimelineBar
        chapters={meta.chapters}
        t0={t0}
        durationMs={durationMs}
        offsetMs={offsetMs}
        onSeek={handleSeek}
        speed={speed}
        onSpeedChange={handleSpeedChange}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
      />
    </div>
  );
}
