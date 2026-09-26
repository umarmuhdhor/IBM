import { bobTimeline, EDIT_TOOLS_REGEX } from '@radar/common'
import type { BobActivityItem, BobTracePrimitive, RadarState } from '@radar/ui'

export type WatchRowKind =
  | 'session' | 'prompt' | 'read' | 'write' | 'tool' | 'blocked' | 'turn' | 'edit' | 'submit'

export type WatchRowTrace = { primitive: BobTracePrimitive; detail: string; outcome?: string }

export type WatchRow = {
  id: string
  ts: number
  // Event id: bob.activity and feed items share one server sequence, so it orders both.
  seq: number
  kind: WatchRowKind
  label: string
  detail: string | null
  lines: number | null
  trace: WatchRowTrace | null
}

const LABEL: Record<WatchRowKind, string> = {
  session: 'session', prompt: 'prompt', read: 'read', write: 'write', tool: 'tool',
  blocked: 'blocked', turn: 'turn end', edit: 'edit', submit: 'submit'
}

const FEED_KIND: Record<string, WatchRowKind> = {
  'file.changed': 'edit',
  'file.deleted': 'edit',
  'file.rejected': 'blocked',
  'lock.blocked': 'blocked',
  'task.submitted': 'submit'
}

const READ_TOOL = /read|list|search|grep|glob|view/

function toolKind(tool: string | undefined): WatchRowKind {
  if (!tool) {
    return 'tool'
  }
  if (EDIT_TOOLS_REGEX.test(tool)) {
    return 'write'
  }
  return READ_TOOL.test(tool) ? 'read' : 'tool'
}

function pathsDetail(paths: string[] | undefined): string | null {
  if (!paths || paths.length === 0) {
    return null
  }
  return paths.length === 1 ? paths[0] : `${paths[0]} +${paths.length - 1} more`
}

function row(item: BobActivityItem, kind: WatchRowKind, detail: string | null, trace: WatchRowTrace): WatchRow {
  return {
    id: `bob-${item.id}`, ts: item.ts, seq: item.id, kind, label: LABEL[kind], detail,
    lines: item.linesChanged ?? null, trace
  }
}

function activityRow(item: BobActivityItem): WatchRow | null {
  switch (item.kind) {
    case 'session.start':
      return row(item, 'session', null, { primitive: 'mode', detail: item.mode })
    case 'prompt':
      return row(item, 'prompt', item.text ? `“${item.text}”` : 'Prompt text not shared', { primitive: 'hook', detail: 'UserPromptSubmit' })
    case 'tool.pre':
      // Allowed checks are reported again by the tool.post row for the same call.
      return item.decision === 'block'
        ? row(item, 'blocked', pathsDetail(item.paths), { primitive: 'hook', detail: 'PreToolUse · lock_guard', outcome: 'blocked' })
        : null
    case 'tool.post':
      return row(item, toolKind(item.tool), pathsDetail(item.paths), { primitive: 'hook', detail: `PostToolUse · ${item.tool ?? 'tool'}` })
    case 'turn.end':
      return row(item, 'turn', null, { primitive: 'hook', detail: 'Stop' })
  }
}

/** Timeline for "Watching <name>'s Bob": bob.activity plus the member's edits, blocks and submits, oldest first. */
export function watchBobTimeline(state: RadarState, memberId: string): WatchRow[] {
  const rows = bobTimeline(state, memberId).flatMap((item) => activityRow(item) ?? [])
  for (const item of state.feed) {
    const kind = FEED_KIND[item.type]
    if (kind && item.actor === memberId) {
      rows.push({
        id: `feed-${item.id}`, ts: item.ts, seq: item.id, kind, label: LABEL[kind],
        detail: item.text.replace(/^\d{2}:\d{2}\s+/, ''), lines: null, trace: null
      })
    }
  }
  return rows.sort((a, b) => a.seq - b.seq)
}

/** Latest Bob mode the member's hooks reported, else the default mode for their role. */
export function watchBobMode(state: RadarState, memberId: string): string {
  const latest = state.bobActivity[memberId]?.[0]
  if (latest?.mode) {
    return latest.mode
  }
  return state.members[memberId]?.role === 'pm' ? 'pm-lead' : 'coder'
}
