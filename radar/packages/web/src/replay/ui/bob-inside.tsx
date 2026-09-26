'use client';
// "Bob inside" (DESIGN §5.8, the juror differentiator): which IBM Bob primitive did the work for the
// selected activity, in plain words, plus the compact payload and a line recorded in Bob IDE. Follows
// the newest activity until the viewer clicks a row, then stays pinned until "Follow live".
import type { BobActivityItem } from '@radar/common';
import type { Beat } from '../narrate';
import { clock, memberColor } from './chrome';
import { activityLabel } from './stage';

export interface BobQuotes {
  brief_seen: string[];
  bob_after_block: string[];
  hook_block_message: string;
}

function explain(item: BobActivityItem): { primitive: string; title: string; body: string } {
  switch (item.kind) {
    case 'tool.pre':
      return item.decision === 'block'
        ? {
            primitive: 'hook · PreToolUse',
            title: 'The hook stopped the write',
            body: 'Before every file write, a Bob IDE hook asks Radar who holds the file. Someone else did, so the edit was cancelled and Bob was told why.',
          }
        : {
            primitive: 'hook · PreToolUse',
            title: 'The hook allowed the write',
            body: 'Before every file write, a Bob IDE hook asks Radar who holds the file. This Bob holds it, so the edit goes through.',
          };
    case 'tool.post':
      return {
        primitive: 'hook · PostToolUse',
        title: 'The change is shared live',
        body: 'After the write, a hook reports what changed so every teammate and the PM see it right away.',
      };
    case 'session.start':
      return {
        primitive: `mode · ${item.mode}`,
        title: 'Bob starts in the Live Collab mode',
        body: 'The custom mode loads the team brief: your task, your files, and which files other Bobs hold.',
      };
    case 'prompt':
      return {
        primitive: `mode · ${item.mode}`,
        title: 'A human asks for a change',
        body: 'The request as typed into Bob IDE. Bob works on it inside the files assigned to this person.',
      };
    default:
      return {
        primitive: `mode · ${item.mode}`,
        title: 'Bob finishes its turn',
        body: 'The turn ends and Radar records it on the shared timeline.',
      };
  }
}

function quoteFor(item: BobActivityItem, quotes: BobQuotes | null): string | null {
  if (!quotes) return null;
  if (item.kind === 'tool.pre' && item.decision === 'block') return quotes.bob_after_block[0] ?? null;
  if (item.kind === 'session.start') return quotes.brief_seen.join('\n');
  return null;
}

export function BobInsidePanel({
  item,
  pinned,
  onFollow,
  quotes,
  names,
  bobSessionsUrl,
}: {
  item: BobActivityItem | null;
  pinned: boolean;
  onFollow: () => void;
  quotes: BobQuotes | null;
  names: Record<string, string>;
  bobSessionsUrl: string;
}) {
  return (
    <section className="rp-card rp-inside" data-testid="bob-inside-panel" aria-label="Bob inside">
      <header className="rp-card-head">
        <h2>Bob inside</h2>
        {pinned ? (
          <button type="button" className="rp-link-btn" onClick={onFollow}>
            Follow live
          </button>
        ) : (
          <span className="rp-live">following live</span>
        )}
      </header>
      {!item ? (
        <p className="rp-empty">When a Bob acts, this panel shows which IBM Bob primitive did the work.</p>
      ) : (
        <InsideBody item={item} quotes={quotes} names={names} bobSessionsUrl={bobSessionsUrl} />
      )}
    </section>
  );
}

function InsideBody({
  item,
  quotes,
  names,
  bobSessionsUrl,
}: {
  item: BobActivityItem;
  quotes: BobQuotes | null;
  names: Record<string, string>;
  bobSessionsUrl: string;
}) {
  const e = explain(item);
  const outcome = activityLabel(item).outcome;
  const quote = quoteFor(item, quotes);
  const payload = {
    kind: item.kind,
    ...(item.tool ? { tool: item.tool } : {}),
    ...(item.paths ? { paths: item.paths } : {}),
    ...(item.decision ? { decision: item.decision } : {}),
    mode: item.mode,
  };
  return (
    <div className="rp-inside-body" style={{ ['--member' as string]: memberColor(item.memberId) }}>
      <p className="rp-inside-who">
        <span className="rp-dot" aria-hidden="true" />
        {names[item.memberId] ?? item.memberId}&apos;s Bob
        <span className="rp-prim">{e.primitive}</span>
        {outcome && (
          <span className="rp-outcome" data-outcome={outcome === 'blocked' ? 'blocked' : undefined}>
            {outcome}
          </span>
        )}
      </p>
      <h3>{e.title}</h3>
      <p className="rp-inside-text">{e.body}</p>
      <pre className="rp-payload">{JSON.stringify(payload, null, 2)}</pre>
      {quote && (
        <figure className="rp-inside-quote">
          <figcaption>Recorded in Bob IDE</figcaption>
          <blockquote>{quote}</blockquote>
        </figure>
      )}
      <a className="rp-link" href={bobSessionsUrl} target="_blank" rel="noopener noreferrer">
        See the Bob sessions on GitHub <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

// ── Story log ────────────────────────────────────────────────────────────────

export function StoryLog({
  beats,
  t0,
  offsetMs,
  currentId,
  onSeek,
}: {
  beats: Beat[];
  t0: number;
  offsetMs: number;
  currentId: number | null;
  onSeek: (ms: number) => void;
}) {
  const shown = beats.filter((b) => b.ts - t0 <= offsetMs).reverse();
  return (
    <section className="rp-card rp-log" aria-label="Story so far">
      <header className="rp-card-head">
        <h2>Story so far</h2>
        <span className="rp-count">{shown.length} events</span>
      </header>
      {shown.length === 0 ? (
        <p className="rp-empty">Nothing yet. Press play.</p>
      ) : (
        <ol>
          {shown.map((b) => (
            <li
              key={b.id}
              data-tone={b.tone}
              data-major={b.major ? 'true' : undefined}
              data-current={b.id === currentId ? 'true' : undefined}
            >
              <button type="button" onClick={() => onSeek(b.ts - t0)} style={{ ['--member' as string]: memberColor(b.actor) }}>
                <time>{clock(b.ts - t0)}</time>
                <span className="rp-dot" aria-hidden="true" />
                <span>{b.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
