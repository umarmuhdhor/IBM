// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { RadarState } from '@radar/ui'
import { NotificationsPanel } from './NotificationsPanel'

afterEach(cleanup)

it('shows blocked activity in the notification list', () => {
  const state = {
    workspace: { id: 'w', name: 'Demo', headCommit: null, repoUrl: null },
    members: {}, tasks: {}, locks: {}, files: {}, requests: {}, proposals: {},
    feed: [{ id: 1, ts: 1, actor: 'A', type: 'lock.blocked', text: 'Budi was blocked' }], bobActivity: {}, cursor: 1
  } satisfies RadarState
  render(<NotificationsPanel state={state} />)
  expect(screen.getByText('Budi was blocked')).toBeTruthy()
})
