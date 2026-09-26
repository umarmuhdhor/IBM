// Replay narrator: turns raw Radar events into one plain-English sentence each, so a juror who has
// never seen Radar can follow the story (Plan → Live → Review → Near-miss → Commit) without reading
// hook payloads. Pure: every string comes from the event log, nothing is invented. `major` beats are
// the headline in the narrator bar; minor beats only show in the story log.
import type { RadarEvent } from '@radar/common';

export type BeatTone = 'info' | 'ok' | 'block' | 'decision';

export interface Beat {
  id: number;
  ts: number;
  /** Member id the beat is about (drives colour + the mobile tab), or null for server/system beats. */
  actor: string | null;
  tone: BeatTone;
  major: boolean;
  text: string;
  /** Verbatim text from the log (prompt, plan goal, PM reason), shown in quotes under the sentence. */
  quote?: string;
  /** File the beat is about, highlighted in the shared repo panel. */
  file?: string;
}

type Names = Readonly<Record<string, string>>;
type Payload = Record<string, unknown>;

const TASK_STATUS: Record<string, string> = {
  terbuka: 'open',
  dikerjakan: 'in progress',
  review: 'in review',
  selesai: 'done',
};

const OPTION: Record<string, string> = {
  antre: 'wait in the queue',
  alihkan: 'take the file over',
  tolak: 'drop the request',
};

function str(p: Payload, key: string): string | undefined {
  const v = p[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function base(path: string | undefined): string {
  if (!path) return 'a file';
  return path.split('/').pop() ?? path;
}

function opt<K extends keyof Beat>(key: K, value: Beat[K] | undefined): Partial<Beat> {
  return value === undefined ? {} : ({ [key]: value } as Partial<Beat>);
}

export function narrate(ev: RadarEvent, names: Names): Beat | null {
  const p = (ev.payload ?? {}) as Payload;
  const who = (id: string | undefined) => (id ? (names[id] ?? id) : 'Someone');
  const member = str(p, 'memberId');
  const path = str(p, 'path');
  const beat = (tone: BeatTone, major: boolean, text: string, extra: Partial<Beat> = {}): Beat => ({
    id: ev.id,
    ts: ev.ts,
    actor: member ?? (ev.actor in names ? ev.actor : null),
    tone,
    major,
    text,
    ...extra,
  });

  switch (ev.type) {
    case 'workspace.created': {
      const files = typeof p.fileCount === 'number' ? ` with ${p.fileCount} files` : '';
      return beat('info', true, `Shared workspace ${str(p, 'workspaceId') ?? ''}${files} opens.`);
    }
    case 'member.online':
      return beat('info', false, `${who(member)} comes online.`);

    case 'proposal.created': {
      const kind = str(p, 'kind');
      const pm = `${who(ev.actor)}'s Bob (PM)`;
      const inner = (p.payload ?? {}) as Payload;
      const reason = str(p, 'reason');
      if (kind === 'plan') {
        const n = Array.isArray(inner.tasks) ? inner.tasks.length : 0;
        return beat('decision', true, `${pm} proposes a plan: ${n} tasks, split so no two people touch the same file.`, {
          actor: ev.actor,
          ...opt('quote', str(inner, 'goal')),
        });
      }
      if (kind === 'review') {
        return beat('decision', true, `${pm} reviews ${str(p, 'refId') ?? 'the task'} before it can merge.`, {
          actor: ev.actor,
          ...opt('quote', reason),
        });
      }
      const option = OPTION[str(inner, 'option') ?? ''];
      const text = option ? `${pm} suggests the blocked teammate ${option}.` : `${pm} proposes a decision.`;
      return beat('decision', true, text, { actor: ev.actor, ...opt('quote', reason) });
    }
    case 'proposal.decided': {
      const status = str(p, 'status');
      const kind = str(p, 'kind') ?? 'proposal';
      if (status === 'diterapkan_otomatis') {
        return beat('ok', true, `Radar applies the PM's ${kind} automatically. Nobody waits on a meeting.`, { actor: null });
      }
      const verb = status === 'disetujui' ? 'approves' : status === 'ditolak' ? 'rejects' : 'closes';
      const by = str(p, 'by');
      const human = by === 'mc' || by === undefined ? 'The PM' : who(by);
      return beat(status === 'ditolak' ? 'block' : 'ok', true, `${human} ${verb} the ${kind} in Mission Control.`, {
        actor: null,
      });
    }
    case 'task.created': {
      const files = Array.isArray(p.files) ? p.files.length : 0;
      return beat('info', false, `${str(p, 'taskId')} “${str(p, 'title') ?? ''}” goes to ${who(str(p, 'ownerId'))} (${files} files).`, {
        actor: str(p, 'ownerId') ?? null,
      });
    }
    case 'lock.reserved':
      return beat('info', false, `${base(path)} is reserved for ${who(member)}.`, opt('file', path));
    case 'lock.acquired':
      return beat('info', false, `${who(member)} now holds ${base(path)}.`, opt('file', path));
    case 'lock.review':
      return beat('info', false, `${base(path)} is held for review.`, opt('file', path));
    case 'lock.queued': {
      const pos = typeof p.pos === 'number' ? p.pos : 1;
      return beat('ok', true, `${who(member)} is #${pos} in the queue for ${base(path)} and keeps working on other files.`, opt('file', path));
    }
    case 'lock.blocked':
      return beat(
        'block',
        true,
        `${who(member)}'s Bob tried to edit ${base(path)}, which ${who(str(p, 'holderMemberId'))} is holding. Blocked before a single byte changed.`,
        opt('file', path),
      );
    case 'task.status': {
      const to = str(p, 'to') ?? '';
      return beat('info', false, `${str(p, 'taskId')} is now ${TASK_STATUS[to] ?? to}.`, { actor: str(p, 'by') ?? null });
    }
    case 'task.submitted':
      return beat('info', true, `${who(ev.actor)} submits ${str(p, 'taskId')} for review.`, {
        actor: ev.actor,
        ...opt('quote', str(p, 'summary')),
      });
    case 'file.changed':
      return beat('info', false, `${base(path)} v${String(p.version ?? '?')} syncs from ${who(str(p, 'by'))}.`, {
        actor: str(p, 'by') ?? null,
        ...opt('file', path),
      });
    case 'request.created':
      return beat('info', false, `${who(str(p, 'requesterMemberId'))} asks for ${base(path)}. The request goes to the PM.`, {
        actor: str(p, 'requesterMemberId') ?? null,
        ...opt('file', path),
      });
    case 'commit.created': {
      const sha = str(p, 'sha')?.slice(0, 7) ?? '';
      const files = Array.isArray(p.files) ? p.files.length : 0;
      return beat('ok', true, `${who(str(p, 'author'))}'s ${str(p, 'taskId')} lands as commit ${sha} (${files} files).`, {
        actor: str(p, 'author') ?? null,
      });
    }
    case 'bob.activity':
      return narrateBob(ev, p, who(member), member ?? null);
    default:
      return null;
  }
}

function narrateBob(ev: RadarEvent, p: Payload, name: string, actor: string | null): Beat | null {
  const paths = Array.isArray(p.paths) ? (p.paths as string[]) : [];
  const file = paths[0];
  const b = (tone: BeatTone, major: boolean, text: string, extra: Partial<Beat> = {}): Beat => ({
    id: ev.id,
    ts: ev.ts,
    actor,
    tone,
    major,
    text,
    ...opt('file', file),
    ...extra,
  });
  switch (str(p, 'kind')) {
    case 'session.start':
      return b('info', false, `${name}'s Bob starts in ${str(p, 'mode') ?? 'coder'} mode and reads the team brief.`);
    case 'prompt':
      return b('info', true, `${name} asks their Bob for a change.`, opt('quote', str(p, 'text')));
    case 'tool.pre':
      // A blocked tool.pre is followed by lock.blocked, which tells the story with both names.
      if (p.decision === 'block') return null;
      return b('info', false, `Hook checks ${name}'s Bob: ${base(file)} is theirs, so the edit is allowed.`);
    case 'tool.post': {
      const lines = typeof p.linesChanged === 'number' ? `${p.linesChanged} lines` : 'lines';
      return b('info', false, `${name}'s Bob changes ${lines} in ${base(file)}.`);
    }
    case 'turn.end':
      return b('info', false, `${name}'s Bob finishes its turn.`);
    default:
      return null;
  }
}

/** Member names from `member.created`, then one beat per narratable event, in log order. */
export function buildBeats(events: readonly RadarEvent[]): Beat[] {
  const names: Record<string, string> = {};
  for (const ev of events) {
    if (ev.type !== 'member.created') continue;
    const p = ev.payload as Payload;
    const id = str(p, 'memberId');
    const name = str(p, 'name');
    if (id && name) names[id] = name;
  }
  const beats: Beat[] = [];
  for (const ev of events) {
    const beat = narrate(ev, names);
    if (beat) beats.push(beat);
  }
  return beats;
}

/** Headline for the narrator bar: the latest major beat at or before `offsetMs`. */
export function currentBeat(beats: readonly Beat[], t0: number, offsetMs: number): Beat | null {
  let found: Beat | null = null;
  for (const b of beats) {
    if (b.ts - t0 > offsetMs) break;
    if (b.major) found = b;
  }
  return found;
}
