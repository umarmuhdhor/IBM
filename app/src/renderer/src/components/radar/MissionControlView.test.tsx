// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'
import { MissionControlView } from './MissionControlView'

afterEach(cleanup)

const state = {
  workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
  members: {}, tasks: {}, locks: {}, files: {}, requests: {},
  proposals: { p1: { id: 'p1', kind: 'decision', status: 'menunggu', payload: { title: 'Blocked edit' }, reason: 'File held', refId: null, createdAt: 1 } },
  feed: [], bobActivity: {}, cursor: 0
} satisfies RadarState

describe('MissionControlView', () => {
  it('keeps coder decisions read-only', () => {
    render(<MissionControlView state={state} canDecide={false} />)
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(true)
  })

  it('waits for a server decision event after the PM approves', () => {
    const decide = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window, 'api', { configurable: true, value: { radar: { decide } } })
    render(<MissionControlView state={state} canDecide />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(decide).toHaveBeenCalledWith('p1', true, '')
    expect(screen.getByRole('button', { name: 'Approve' }).hasAttribute('disabled')).toBe(true)
  })
})
