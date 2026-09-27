// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'

const { TaskBoardView } = await import('./TaskBoardView')

const TASK_A = {
  id: 'T-1',
  title: 'Build login',
  description: 'OAuth login flow',
  ownerId: 'B',
  status: 'terbuka' as const,
  files: ['src/auth.ts'],
  queuedFiles: [],
  adhoc: false,
  parentTaskId: null,
  editCount: 0,
  commitSha: null,
  summary: null,
  steps: [
    { text: 'step one', done: false },
    { text: 'step two', done: false },
    { text: 'step three', done: true }
  ]
}

const TASK_B = {
  id: 'T-2',
  title: 'Write tests',
  description: '',
  ownerId: 'C',
  status: 'dikerjakan' as const,
  files: [],
  queuedFiles: [],
  adhoc: false,
  parentTaskId: null,
  editCount: 0,
  commitSha: null,
  summary: null,
  steps: []
}

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: {
    B: { id: 'B', name: 'Budi', role: 'coder', color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 },
    C: { id: 'C', name: 'Citra', role: 'coder', color: null, online: true, stale: false, activeTaskId: null, blocked: false, writingUntil: 0 }
  },
  tasks: { 'T-1': TASK_A, 'T-2': TASK_B },
  locks: {},
  files: {},
  requests: {},
  proposals: {},
  feed: [],
  bobActivity: {},
  cursor: 0
} satisfies RadarState

let setTaskStep: ReturnType<typeof vi.fn>
let submitTask: ReturnType<typeof vi.fn>
let activateTask: ReturnType<typeof vi.fn>
let copyText: ReturnType<typeof vi.fn>
let openInBob: ReturnType<typeof vi.fn>
let decide: ReturnType<typeof vi.fn>

beforeEach(() => {
  setTaskStep = vi.fn(async () => undefined)
  submitTask = vi.fn(async () => undefined)
  activateTask = vi.fn(async () => undefined)
  copyText = vi.fn(async () => undefined)
  openInBob = vi.fn(async () => null)
  decide = vi.fn(async () => undefined)
  vi.stubGlobal('api', { radar: { setTaskStep, submitTask, activateTask, copyText, openInBob, decide } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('TaskBoardView — coder role', () => {
  it('shows only the tasks owned by memberId', () => {
    render(<TaskBoardView state={state} role="coder" seatId="B" />)
    expect(screen.getByRole('article', { name: 'Build login' })).toBeTruthy()
    expect(screen.queryByRole('article', { name: 'Write tests' })).toBeNull()
  })

  it('ticking a checkbox calls setTaskStep with the right args', async () => {
    render(<TaskBoardView state={state} role="coder" seatId="B" />)
    const checkbox = screen.getByRole('checkbox', { name: /step two/ })
    fireEvent.click(checkbox)
    await waitFor(() => expect(setTaskStep).toHaveBeenCalledWith('T-1', 1, true))
  })

  it('"Mark task done" button calls submitTask', async () => {
    render(<TaskBoardView state={state} role="coder" seatId="B" />)
    const btn = screen.getByRole('button', { name: 'Mark task done' })
    fireEvent.click(btn)
    await waitFor(() =>
      expect(submitTask).toHaveBeenCalledWith('T-1', expect.stringContaining('1/3'))
    )
  })

  it('a refused "Mark task done" shows the server sentence without the IPC prefix, plus what to do next', async () => {
    submitTask.mockRejectedValueOnce(
      new Error("Error invoking remote method 'radar:submit-task': Error: Task T-1 has not changed any file yet.")
    )
    render(<TaskBoardView state={state} role="coder" seatId="B" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark task done' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Task T-1 has not changed any file yet. Edit its files in Bob first, then mark it done.')
  })

  it('shows the coder empty state when there are no tasks', () => {
    const empty: RadarState = { ...state, tasks: {} }
    render(<TaskBoardView state={empty} role="coder" seatId="B" />)
    expect(screen.getByText(/No tasks for you yet/)).toBeTruthy()
  })
})

describe('TaskBoardView — pm role', () => {
  it('groups tasks by owner and shows x/y step count', () => {
    render(<TaskBoardView state={state} role="pm" seatId={null} />)
    // Budi's group: 1 done / 3 total
    expect(screen.getByText(/1\/3/)).toBeTruthy()
    // Both coder articles visible
    expect(screen.getByRole('article', { name: 'Build login' })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'Write tests' })).toBeTruthy()
  })

  it('renders steps as read-only text symbols, not checkboxes', () => {
    render(<TaskBoardView state={state} role="pm" seatId={null} />)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByText('✓')).toBeTruthy()
  })

  it('shows the pm empty state when there are no tasks, pointing at the brief', () => {
    const empty: RadarState = { ...state, tasks: {} }
    render(<TaskBoardView state={empty} role="pm" seatId={null} />)
    expect(screen.getByText(/propose_plan/)).toBeTruthy()
  })
})

const PLAN = {
  id: 'P-1',
  kind: 'plan' as const,
  status: 'menunggu' as const,
  refId: null,
  reason: 'Split by layer',
  payload: { goal: 'Coupons', tasks: [{ ref: 't1', title: 'Coupon logic', ownerId: 'B', files: ['src/coupon.ts'], steps: ['a', 'b'] }] },
  createdAt: 0
}

describe('TaskBoardView — plans and starting work (fase 15c)', () => {
  it('Start in Bob activates the task, copies the prompt and opens Bob', async () => {
    render(<TaskBoardView state={state} role="coder" seatId="B" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start in Bob' }))
    await waitFor(() => expect(openInBob).toHaveBeenCalled())
    expect(activateTask).toHaveBeenCalledWith('T-1')
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('Work on task T-1: Build login'))
    expect((await screen.findByRole('status')).textContent).toMatch(/Live Collab Coder mode/)
  })

  it('when Bob cannot open, the card says so as an error and how to go on', async () => {
    openInBob.mockResolvedValueOnce('Join a workspace first.')
    render(<TaskBoardView state={state} role="coder" seatId="B" />)
    fireEvent.click(screen.getByRole('button', { name: 'Start in Bob' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Join a workspace first\. The prompt is copied/)
  })

  it('the PM approves a waiting plan from the Tasks tab', async () => {
    const withPlan = { ...state, proposals: { 'P-1': PLAN } } as unknown as RadarState
    render(<TaskBoardView state={withPlan} role="pm" seatId={null} />)
    expect(screen.getByText(/Budi · Coupon logic/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Approve and assign' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith('P-1', true, ''))
  })

  it('the owner waits for the PM when the room has one', () => {
    const withPm = {
      ...state,
      members: { ...state.members, C: { ...state.members.C, role: 'pm' } },
      proposals: { 'P-1': PLAN }
    } as unknown as RadarState
    render(<TaskBoardView state={withPm} role="mc" seatId="B" />)
    expect(screen.queryByRole('button', { name: 'Approve and assign' })).toBeNull()
    expect(screen.getByText('Waiting for Citra (PM) to approve.')).toBeTruthy()
    // the owner is also a coder: their own tasks are workable
    expect(screen.getByRole('region', { name: 'My tasks' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start in Bob' })).toBeTruthy()
  })
})
