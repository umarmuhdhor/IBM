import type { BobActivityItem, RadarState, TaskStatus } from '@radar/ui'

// View helpers for the demo-style lanes (Team cards, Shared repo list). Pure: every string comes from
// the Radar state, nothing is invented, so the app tells the same story as the /demo replay.

export const TASK_STATUS_TEXT: Record<TaskStatus, string> = {
  draf: 'draft',
  terbuka: 'open',
  dikerjakan: 'in progress',
  review: 'in review',
  selesai: 'done',
  batal: 'cancelled'
}

export type RepoLockLabel = 'held' | 'reserved' | 'review'

const LOCK_LABEL: Record<string, RepoLockLabel> = { dipegang: 'held', dipesan: 'reserved', review: 'review' }

export type RepoRow = {
  path: string
  holderId: string | null
  holderName: string | null
  lock: RepoLockLabel | null
  writing: boolean
  /** Teammates waiting for this file, in queue order (pos starts at 1). */
  queue: { memberId: string; name: string; pos: number }[]
}

function memberName(state: RadarState, id: string): string {
  return state.members[id]?.name ?? id
}

/** One row per locked or synced file: who holds it, whether they are writing, who waits for it. */
export function repoRows(state: RadarState, now: number): RepoRow[] {
  const paths = new Set<string>(Object.keys(state.locks))
  for (const file of Object.values(state.files)) {
    if (!file.deleted) {
      paths.add(file.path)
    }
  }
  return [...paths].sort().map((path) => {
    const lock = state.locks[path]
    const file = state.files[path]
    const queue = (lock?.queue ?? []).flatMap((taskId, index) => {
      const ownerId = state.tasks[taskId]?.ownerId
      return ownerId ? [{ memberId: ownerId, name: memberName(state, ownerId), pos: index + 1 }] : []
    })
    return {
      path,
      holderId: lock?.memberId ?? null,
      holderName: lock ? memberName(state, lock.memberId) : null,
      lock: lock ? (LOCK_LABEL[lock.state] ?? null) : null,
      writing: Boolean(file && file.writingUntil > now),
      queue
    }
  })
}

/** Files this member is queued for, e.g. "#1 in the queue for checkout.ts". */
export function queueSpots(state: RadarState, memberId: string): { path: string; pos: number; holderName: string }[] {
  const spots: { path: string; pos: number; holderName: string }[] = []
  for (const lock of Object.values(state.locks)) {
    const index = lock.queue.findIndex((taskId) => state.tasks[taskId]?.ownerId === memberId)
    if (index !== -1) {
      spots.push({ path: lock.path, pos: index + 1, holderName: memberName(state, lock.memberId) })
    }
  }
  return spots.sort((a, b) => a.path.localeCompare(b.path))
}

/** Latest prompt the member typed to their Bob, when they share prompt text. */
export function lastPrompt(state: RadarState, memberId: string): string | null {
  const item = (state.bobActivity[memberId] ?? []).find((entry) => entry.kind === 'prompt' && entry.text)
  return item?.text ?? null
}

export type ActivityRow = {
  id: number
  primitive: 'hook' | 'mode'
  detail: string
  outcome: { text: string; tone: 'ok' | 'block' | 'muted' } | null
}

function fileName(paths: string[] | undefined): string {
  const first = paths?.[0]
  if (!first) {
    return ''
  }
  const base = first.split('/').pop() ?? first
  return paths.length > 1 ? `${base} +${paths.length - 1}` : base
}

function activityRow(item: BobActivityItem): ActivityRow {
  const call = [item.tool, fileName(item.paths)].filter(Boolean).join(' ')
  switch (item.kind) {
    case 'session.start':
      return { id: item.id, primitive: 'mode', detail: `session start · ${item.mode || 'coder'}`, outcome: null }
    case 'prompt':
      return { id: item.id, primitive: 'hook', detail: 'prompt from the human', outcome: null }
    case 'tool.pre':
      return {
        id: item.id,
        primitive: 'hook',
        detail: call || 'tool call',
        outcome: item.decision === 'block' ? { text: 'blocked', tone: 'block' } : { text: 'allowed', tone: 'ok' }
      }
    case 'tool.post':
      return {
        id: item.id,
        primitive: 'hook',
        detail: call || 'tool call',
        outcome: typeof item.linesChanged === 'number' ? { text: `+${item.linesChanged} lines`, tone: 'ok' } : null
      }
    case 'turn.end':
      return { id: item.id, primitive: 'hook', detail: 'turn finished', outcome: null }
  }
}

/** Newest-first Bob activity for a Team card, as hook / mode rows like the /demo replay. */
export function recentActivity(state: RadarState, memberId: string, limit = 6): ActivityRow[] {
  return (state.bobActivity[memberId] ?? []).slice(0, limit).map(activityRow)
}
