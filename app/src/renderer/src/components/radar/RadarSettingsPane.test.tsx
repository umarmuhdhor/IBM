// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RadarSettingsPane } from './RadarSettingsPane'

const runChecks = vi.fn()

beforeEach(() => {
  vi.stubGlobal('api', { radar: { runChecks } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const summary = { server: 'http://127.0.0.1:8787', workspace: 'demo', member: 'A', role: 'coder' as const }

it('runs the connection checklist for the active workspace', async () => {
  runChecks.mockResolvedValue({ bobVersion: 'bob 2.0.5', bobSettings: true })
  render(<RadarSettingsPane connection={summary} connected workspacePath="/work/toko-demo" onConnectionChange={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: 'Test' }))

  expect(await screen.findByText('bob 2.0.5')).toBeTruthy()
  expect(runChecks).toHaveBeenCalledWith('/work/toko-demo')
  expect(screen.getByText('Connected')).toBeTruthy()
  expect(screen.getByText('Found')).toBeTruthy()
})

it('explains failed checks without hiding the form', async () => {
  runChecks.mockResolvedValue({ bobVersion: null, bobSettings: false })
  render(<RadarSettingsPane connection={summary} connected={false} workspacePath="/work/toko-demo" onConnectionChange={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: 'Test' }))

  expect(await screen.findByText('Not found on PATH')).toBeTruthy()
  expect(screen.getByText('Not connected')).toBeTruthy()
  expect(screen.getByText('Missing in this folder')).toBeTruthy()
  expect(screen.getByLabelText('Access token')).toBeTruthy()
})

it('says when no workspace folder is open', async () => {
  runChecks.mockResolvedValue({ bobVersion: 'bob 2.0.5', bobSettings: null })
  render(<RadarSettingsPane connection={null} connected={false} workspacePath={null} onConnectionChange={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: 'Test' }))

  expect(await screen.findByText('Open a workspace folder first')).toBeTruthy()
  expect(runChecks).toHaveBeenCalledWith(null)
})
