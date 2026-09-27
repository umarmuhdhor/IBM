// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import { ReclaimOwnerButton } from './ReclaimOwnerButton'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const summary: RadarConnectionSummary = {
  server: 'https://radar.example/',
  workspace: 'seats',
  member: 'mc',
  role: 'mc'
}

it('takes back ownership on this Mac and hands the new connection up (D-alief-21)', async () => {
  const reclaimOwner = vi.fn(async () => summary)
  vi.stubGlobal('api', { radar: { reclaimOwner } })
  const onReclaimed = vi.fn()
  render(<ReclaimOwnerButton onReclaimed={onReclaimed} />)

  fireEvent.click(screen.getByRole('button', { name: 'Take back ownership' }))
  expect(screen.getByRole('button', { name: 'Taking back…' }).hasAttribute('disabled')).toBe(true)
  await vi.waitFor(() => expect(onReclaimed).toHaveBeenCalledWith(summary))
  expect(reclaimOwner).toHaveBeenCalledTimes(1)
})

it("shows the server's reason when ownership cannot be taken back", async () => {
  const reclaimOwner = vi.fn(async () => {
    throw new Error(
      "Error invoking remote method 'radar:reclaim-owner': Error: Mission Control is open on another device. Take back ownership there, or close it first."
    )
  })
  vi.stubGlobal('api', { radar: { reclaimOwner } })
  const onReclaimed = vi.fn()
  render(<ReclaimOwnerButton onReclaimed={onReclaimed} />)

  fireEvent.click(screen.getByRole('button', { name: 'Take back ownership' }))
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Mission Control is open on another device. Take back ownership there, or close it first.'
  )
  expect(onReclaimed).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Take back ownership' }).hasAttribute('disabled')).toBe(false)
})
