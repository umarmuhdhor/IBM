'use client';
// Replay stage: one lane per coder (their Bob IDE activity) around Mission Control, where the shared
// repo shows who holds which file. Everything is derived from the replayed RadarState.
import { bobTimeline, pendingDecisions, type BobActivityItem, type RadarState } from '@radar/common';
import { DecisionCard } from '@radar/ui';
import { memberColor } from './chrome';

const TASK_STATUS: Record<string, string> = {
  terbuka: 'open',
  dikerjakan: 'in progress',
  review: 'in review',
  selesai: 'done',
};

const LOCK_WORD: Record<string, string> = {
  dipesan: 'reserved',
  dipegang: 'held',
  review: 'review',
};

function base(path: string | undefined): string {
  return path ? (path.split('/').pop() ?? path) : '';
}

function dir(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i + 1);
}

function nameOf(state: RadarState, id: string | null | undefined): string {
  if (!id) return '';
  return state.members[id]?.name ?? id;
}

export function activityLabel(item: BobActivityItem): { primitive: 'hook' | 'mode'; text: string; outcome?: string } {
  const file = base(item.paths?.[0]);
  switch (item.kind) {
    case 'session.start':
      return { primitive: 'mode', text: `session start · ${item.mode}` };
    case 'prompt':
      return { primitive: 'mode', text: 'prompt from the human' };
    case 'tool.pre':
      return {
        primitive: 'hook',
        text: `${item.tool ?? 'tool'} ${file}`.trim(),
        outcome: item.decision === 'block' ? 'blocked' : 'allowed',
      };
    case 'tool.post':
      return {
        primitive: 'hook',
        text: `${item.tool ?? 'tool'} ${file}`.trim(),
        ...(typeof item.linesChanged === 'number' ? { outcome: `+${item.linesChanged} lines` } : {}),
      };
    case 'turn.end':
      return { primitive: 'mode', text: 'turn finished' };
    default:
      return { primitive: 'mode', text: String(item.kind) };
  }
}

// ── Coder lane ───────────────────────────────────────────────────────────────

export function CoderLane({
  state,
  memberId,
  nowTs,
  selectedId,
  onSelect,
}: {
  state: RadarState;
  memberId: string;
  nowTs: number;
  selectedId: number | null;
  onSelect: (item: BobActivityItem) => void;
}) {
  const member = state.members[memberId];
  const name = member?.name ?? memberId;
  const timeline = bobTimeline(state, memberId);
  const recent = [...timeline].reverse().slice(0, 6);
  const lastPrompt = [...timeline].reverse().find((i) => i.kind === 'prompt');
  const tasks = Object.values(state.tasks).filter((t) => t.ownerId === memberId);
  const writing = Object.values(state.files).some((f) => f.updatedBy === memberId && nowTs < f.writingUntil);

  const openRequest = Object.values(state.requests).find(
    (r) => r.requesterMemberId === memberId && (r.status === 'terbuka' || r.status === 'diusulkan'),
  );
  const myTaskIds = new Set(tasks.map((t) => t.id));
  const queuedFor = Object.values(state.locks).find((l) => l.queue.some((q) => myTaskIds.has(q)));
  const waitingOnMe = Object.values(state.locks).find((l) => l.memberId === memberId && l.queue.length > 0);

  const status = member?.blocked || openRequest ? 'blocked' : writing ? 'writing' : member?.online ? 'online' : 'offline';

  return (
    <section className="rp-lane" style={{ ['--member' as string]: memberColor(memberId) }} aria-label={`${name}'s Bob IDE`}>
      <header className="rp-lane-head">
        <span className="rp-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
        <div>
          <h2>{name}</h2>
          <p>coder · IBM Bob IDE</p>
        </div>
        <span className="rp-status" data-status={status}>
          {status}
        </span>
      </header>

      {openRequest && (
        <p className="rp-alert" data-tone="block">
          Blocked on <code>{base(openRequest.path)}</code>. {nameOf(state, openRequest.holderMemberId)} holds it; the
          request went to the PM.
        </p>
      )}
      {!openRequest && queuedFor && (
        <p className="rp-alert" data-tone="ok">
          #{queuedFor.queue.findIndex((q) => myTaskIds.has(q)) + 1} in the queue for <code>{base(queuedFor.path)}</code>.
          Working on other files meanwhile.
        </p>
      )}
      {waitingOnMe && (
        <p className="rp-alert" data-tone="info">
          {nameOf(state, state.tasks[waitingOnMe.queue[0] ?? '']?.ownerId)} is waiting for{' '}
          <code>{base(waitingOnMe.path)}</code> after this task.
        </p>
      )}

      {tasks.length > 0 && (
        <ul className="rp-tasks" aria-label={`${name}'s tasks`}>
          {tasks.map((t) => (
            <li key={t.id} data-status={t.status}>
              <span className="rp-mono">{t.id}</span> {t.title}
              <span className="rp-task-status">{TASK_STATUS[t.status] ?? t.status}</span>
            </li>
          ))}
        </ul>
      )}

      {lastPrompt?.text && (
        <figure className="rp-prompt">
          <figcaption>{name} asked Bob</figcaption>
          <blockquote>“{lastPrompt.text}”</blockquote>
        </figure>
      )}

      <h3 className="rp-sub">Bob activity</h3>
      {recent.length === 0 ? (
        <p className="rp-empty">Bob hasn&apos;t started yet.</p>
      ) : (
        <ol className="rp-activity">
          {recent.map((item) => {
            const l = activityLabel(item);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  data-testid="bob-activity-row"
                  aria-pressed={selectedId === item.id}
                  data-outcome={l.outcome === 'blocked' ? 'blocked' : undefined}
                  onClick={() => onSelect(item)}
                >
                  <span className="rp-prim">{l.primitive}</span>
                  <span className="rp-activity-text">{l.text}</span>
                  {l.outcome && <span className="rp-outcome">{l.outcome}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ── Mission Control ──────────────────────────────────────────────────────────

export function MissionControl({
  state,
  pmId,
  nowTs,
  focusFile,
  focusTone,
}: {
  state: RadarState;
  pmId: string | null;
  nowTs: number;
  focusFile: string | null;
  focusTone: string | null;
}) {
  const proposals = pendingDecisions(state);
  const pmName = nameOf(state, pmId) || 'PM';
  const paths = [
    ...new Set([
      ...Object.keys(state.locks),
      ...Object.values(state.files)
        .filter((f) => !f.deleted)
        .map((f) => f.path),
    ]),
  ].sort();
  const commits = Object.values(state.tasks).filter((t) => t.commitSha);

  return (
    <section className="rp-mc" style={{ ['--member' as string]: memberColor(pmId) }} aria-label="Mission Control">
      <header className="rp-lane-head">
        <span className="rp-avatar" aria-hidden="true">
          {pmName.slice(0, 1)}
        </span>
        <div>
          <h2>Mission Control</h2>
          <p>{pmName} · PM · approves every decision</p>
        </div>
      </header>

      <h3 className="rp-sub">Needs you</h3>
      {proposals.length === 0 ? (
        <p className="rp-empty">Nothing waiting for the PM.</p>
      ) : (
        <div className="rp-decisions">
          {proposals.map((p) => {
            const title =
              p.kind === 'plan'
                ? `Plan · ${String((p.payload as { goal?: string } | null)?.goal ?? p.id)}`
                : p.kind === 'review'
                  ? `Review · ${p.refId ?? p.id}`
                  : `Decision · ${p.refId ?? p.id}`;
            return (
              <DecisionCard
                key={p.id}
                title={title}
                reason={p.reason}
                status="pending"
                readOnly
                onApprove={() => {}}
                onDeny={() => {}}
              />
            );
          })}
        </div>
      )}

      <h3 className="rp-sub">Shared repo</h3>
      {paths.length === 0 ? (
        <p className="rp-empty">No files claimed yet. The plan decides who gets what.</p>
      ) : (
        <ul className="rp-files">
          {paths.map((path) => {
            const lock = state.locks[path];
            const file = state.files[path];
            const writing = file ? nowTs < file.writingUntil : false;
            const queued = lock?.queue.map((q) => nameOf(state, state.tasks[q]?.ownerId)).filter(Boolean) ?? [];
            const focused = path === focusFile;
            return (
              <li
                key={path}
                data-focus={focused ? (focusTone === 'block' ? 'block' : 'on') : undefined}
                style={{ ['--member' as string]: memberColor(lock?.memberId) }}
              >
                <span className="rp-file">
                  <span className="rp-file-dir">{dir(path)}</span>
                  {base(path)}
                </span>
                {writing && <span className="rp-writing">writing</span>}
                {queued.length > 0 && <span className="rp-queue">{queued.join(', ')} queued</span>}
                {lock ? (
                  <span className="rp-holder" data-state={lock.state}>
                    <span className="rp-dot" aria-hidden="true" />
                    {nameOf(state, lock.memberId)} · {LOCK_WORD[lock.state] ?? lock.state}
                  </span>
                ) : (
                  <span className="rp-holder" data-state="free">
                    free
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {commits.length > 0 && (
        <>
          <h3 className="rp-sub">Commits</h3>
          <ul className="rp-commits">
            {commits.map((t) => (
              <li key={t.id}>
                <span className="rp-mono">{t.commitSha?.slice(0, 7)}</span> {t.id} {t.title} ·{' '}
                {nameOf(state, t.ownerId)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
