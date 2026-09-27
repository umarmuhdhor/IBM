// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LiveCollabMark } from './LiveCollabMark'

afterEach(cleanup)

it('draws the hub mark with five bars and one live dot', () => {
  render(<LiveCollabMark title="Live Collab" />)
  const mark = screen.getByRole('img', { name: 'Live Collab' })
  expect(mark.querySelectorAll('rect')).toHaveLength(5)
  expect(mark.querySelectorAll('circle')).toHaveLength(1)
})

it('is hidden from assistive tech when decorative', () => {
  const { container } = render(<LiveCollabMark />)
  expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
})
