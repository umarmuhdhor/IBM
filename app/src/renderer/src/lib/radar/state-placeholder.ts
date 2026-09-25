import type { RadarEvent, RadarState, TaskStatus } from '@radar/ui'

// TODO(sync:alief): Replace this adapter with @radar/common reducer and schemas after fase 02 lands on main.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function keyed(value: unknown, key: string): Record<string, unknown> {
  if (isRecord(value)) {
    return value
  }
  if (!Array.isArray(value)) {
    return {}
  }
  return Object.fromEntries(
    value
      .filter(isRecord)
      .filter((item) => typeof item[key] === 'string')
      .map((item) => [item[key], item])
  )
}

export function normalizeRadarState(value: unknown): RadarState | null {
  if (!isRecord(value) || !isRecord(value.workspace) || typeof value.cursor !== 'number') {
    return null
  }
  const workspace = value.workspace
  if (typeof workspace.id !== 'string' || typeof workspace.name !== 'string') {
    return null
  }
  const normalized = {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      headCommit: typeof workspace.headCommit === 'string' ? workspace.headCommit : null,
      repoUrl: typeof workspace.repoUrl === 'string' ? workspace.repoUrl : null
    },
    members: keyed(value.members, 'id'),
    tasks: keyed(value.tasks, 'id'),
    locks: keyed(value.locks, 'path'),
    files: keyed(value.files, 'path'),
    requests: keyed(value.requests, 'id'),
    proposals: keyed(value.proposals, 'id'),
    feed: Array.isArray(value.feed) ? value.feed : [],
    bobActivity: isRecord(value.bobActivity) ? value.bobActivity : {},
    cursor: value.cursor
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: temporary server snapshot adapter; common schemas replace it after fase 02.
  return normalized as RadarState
}

function isRadarEvent(value: unknown): value is RadarEvent {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.ts === 'number' &&
    typeof value.actor === 'string' &&
    typeof value.type === 'string' &&
    isRecord(value.payload)
  )
}

function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === 'terbuka' ||
    value === 'draf' ||
    value === 'dikerjakan' ||
    value === 'review' ||
    value === 'selesai' ||
    value === 'batal'
  )
}

function isProposalStatus(
  value: unknown
): value is 'menunggu' | 'disetujui' | 'ditolak' | 'diterapkan_otomatis' {
  return (
    value === 'menunggu' ||
    value === 'disetujui' ||
    value === 'ditolak' ||
    value === 'diterapkan_otomatis'
  )
}

export function applyRadarEvent(state: RadarState, value: unknown): RadarState {
  if (!isRadarEvent(value) || value.id <= state.cursor) {
    return state
  }
  const next = { ...state, cursor: value.id }
  const payload = value.payload
  if (value.type === 'task.created' && typeof payload.taskId === 'string') {
    const taskId = payload.taskId
    const status = isTaskStatus(payload.status) ? payload.status : 'terbuka'
    next.tasks = {
      ...state.tasks,
      [taskId]: {
        id: taskId,
        title: typeof payload.title === 'string' ? payload.title : taskId,
        ownerId: typeof payload.ownerId === 'string' ? payload.ownerId : '',
        status,
        files: Array.isArray(payload.files)
          ? payload.files.filter((item) => typeof item === 'string')
          : [],
        queuedFiles: Array.isArray(payload.queuedFiles)
          ? payload.queuedFiles.filter((item) => typeof item === 'string')
          : [],
        editCount: 0,
        commitSha: null
      }
    }
  } else if (value.type === 'task.status' && typeof payload.taskId === 'string') {
    const task = state.tasks[payload.taskId]
    if (task && isTaskStatus(payload.to)) {
      next.tasks = { ...state.tasks, [task.id]: { ...task, status: payload.to } }
    }
  } else if (value.type === 'lock.acquired' && typeof payload.path === 'string') {
    next.locks = {
      ...state.locks,
      [payload.path]: {
        path: payload.path,
        taskId: typeof payload.taskId === 'string' ? payload.taskId : null,
        memberId: typeof payload.memberId === 'string' ? payload.memberId : null,
        state: 'dipegang',
        queue: []
      }
    }
  } else if (value.type === 'lock.released' && typeof payload.path === 'string') {
    const lock = state.locks[payload.path]
    if (lock) {
      next.locks = {
        ...state.locks,
        [payload.path]: { ...lock, taskId: null, memberId: null, state: 'bebas' }
      }
    }
  } else if (value.type === 'file.changed' && typeof payload.path === 'string') {
    next.files = {
      ...state.files,
      [payload.path]: {
        path: payload.path,
        version: typeof payload.version === 'number' ? payload.version : 0,
        updatedBy: typeof payload.by === 'string' ? payload.by : null,
        updatedAt: value.ts,
        writingUntil: value.ts + 3_000
      }
    }
  } else if (value.type === 'proposal.created' && typeof payload.proposalId === 'string') {
    const kind =
      payload.kind === 'plan' || payload.kind === 'decision' || payload.kind === 'review'
        ? payload.kind
        : 'decision'
    next.proposals = {
      ...state.proposals,
      [payload.proposalId]: {
        id: payload.proposalId,
        kind,
        status: isProposalStatus(payload.status) ? payload.status : 'menunggu',
        payload: isRecord(payload.payload) ? payload.payload : {},
        reason: typeof payload.reason === 'string' ? payload.reason : '',
        refId: typeof payload.refId === 'string' ? payload.refId : null,
        createdAt: value.ts
      }
    }
  } else if (value.type === 'proposal.decided' && typeof payload.proposalId === 'string') {
    const proposal = state.proposals[payload.proposalId]
    if (proposal && isProposalStatus(payload.status)) {
      next.proposals = {
        ...state.proposals,
        [proposal.id]: {
          ...proposal,
          status: payload.status,
          decidedBy: typeof payload.by === 'string' ? payload.by : null,
          note: typeof payload.note === 'string' ? payload.note : null
        }
      }
    }
  }
  return next
}
