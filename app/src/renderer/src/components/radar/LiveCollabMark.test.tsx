// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { LiveCollabMark } from './LiveCollabMark'

afterEach(cleanup)

it('shows three collaborating Bob agents', () => {
  render(<LiveCollabMark />)
  const mark = screen.getByRole('img', { name: 'Three Bob agents working together' })
  expect(mark.tagName).toBe('IMG')
  expect(mark.getAttribute('src')).toContain('bob-live-collab.png')
})
