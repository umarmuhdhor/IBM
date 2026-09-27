// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RadarState } from '@radar/ui'
import type { TopLevelView } from '../../../../shared/ui-chrome-types'

const { appStore } = await vi.hoisted(async () => {
  const { create } = await import('zustand')
  const appStore = create<{ activeView: TopLevelView; setActiveView: (view: TopLevelView) => void }>()(
    (set) => ({ activeView: 'terminal', setActiveView: (activeView) => set({ activeView }) })
  )
  return { appStore }
})
vi.mock('@/store', () => ({ useAppStore: appStore }))

const { useRadarStore } = await import('@/store/radar-store')
const { LiveCollabSidebarButton } = await import('./LiveCollabSidebarButton')
const { closeLiveCollabPage, useLiveCollabPageStore } = await import('./live-collab-page-store')

beforeEach(() => {
  appStore.setState({ activeView: 'terminal' })
  useLiveCollabPageStore.setState({ tab: 'multiplayer', previousView: 'terminal' })
  useRadarStore.setState({ state: null })
})
afterEach(cleanup)

it('opens the Live Collab page and a second click returns to the previous view', () => {
  appStore.setState({ activeView: 'tasks' })
  render(<LiveCollabSidebarButton />)
  const button = screen.getByRole('button', { name: /Live Collab/ })

  fireEvent.click(button)
  expect(appStore.getState().activeView).toBe('live-collab')
  expect(button.getAttribute('aria-current')).toBe('page')

  fireEvent.click(button)
  expect(appStore.getState().activeView).toBe('tasks')
  expect(button.getAttribute('aria-current')).toBeNull()
})

it('keeps the last tab for the session when the page closes and reopens', () => {
  render(<LiveCollabSidebarButton />)
  fireEvent.click(screen.getByRole('button', { name: /Live Collab/ }))
  act(() => useLiveCollabPageStore.getState().setTab('team'))
  act(() => closeLiveCollabPage())
  fireEvent.click(screen.getByRole('button', { name: /Live Collab/ }))
  expect(useLiveCollabPageStore.getState().tab).toBe('team')
})

it('shows the needs-you count from pending proposals', () => {
  const pending = { id: 'p', status: 'menunggu' }
  act(() => {
    useRadarStore.setState({
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: getRadarViewModel reads only tasks, members and proposals.
      state: { tasks: {}, members: {}, proposals: { p: pending } } as unknown as RadarState
    })
  })
  render(<LiveCollabSidebarButton />)
  expect(screen.getByLabelText('1 needs you').textContent).toBe('1')
})
