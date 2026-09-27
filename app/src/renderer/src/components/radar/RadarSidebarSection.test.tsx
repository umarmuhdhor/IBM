// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { keepPanelOpenForLiveCollabNav, RadarSidebarSection } from './RadarSidebarSection'

afterEach(cleanup)

it('a click on another Live Collab item switches the open panel instead of closing it', () => {
  render(<RadarSidebarSection needsYou={0} onOpen={vi.fn()} />)
  const inside = { target: screen.getByRole('button', { name: 'Team' }), preventDefault: vi.fn() }
  keepPanelOpenForLiveCollabNav(inside)
  expect(inside.preventDefault).toHaveBeenCalled()

  const outside = { target: document.body, preventDefault: vi.fn() }
  keepPanelOpenForLiveCollabNav(outside)
  expect(outside.preventDefault).not.toHaveBeenCalled()
})
