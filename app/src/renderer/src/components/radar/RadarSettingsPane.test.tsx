// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RadarSettingsPane } from './RadarSettingsPane'

const runChecks = vi.fn()
const getSharePrompts = vi.fn()
const setSharePrompts = vi.fn()

beforeEach(() => {
  getSharePrompts.mockResolvedValue(false)
  vi.stubGlobal('api', { radar: { runChecks, getSharePrompts, setSharePrompts } })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const summary = { server: 'http://127.0.0.1:8787', workspace: 'demo', member: 'A', role: 'coder' as const }

it('offers PM Lead separately from Mission Control', () => {
  render(<RadarSettingsPane connection={summary} connected={false} workspacePath={null} onConnectionChange={vi.fn()} />)
  const roleSelect = screen.getByLabelText('Role')
  fireEvent.change(roleSelect, { target: { value: 'pm' } })
  expect(roleSelect instanceof HTMLSelectElement && roleSelect.value).toBe('pm')
  expect(screen.getByRole('option', { name: 'Mission Control' })).toBeTruthy()
})

it('explains an access rejection without showing the old waiting message', () => {
  render(<RadarSettingsPane connection={summary} connected={false} connectionFailure="access-rejected" workspacePath={null} onConnectionChange={vi.fn()} />)
  expect(screen.getByText(/Access rejected/)).toBeTruthy()
  expect(screen.queryByText('Saved, waiting for server')).toBeNull()
})

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

  expect(await screen.findByText('Not found. Install Bob Shell')).toBeTruthy()
  expect(screen.getByText('Not connected. Check the server URL and access token')).toBeTruthy()
  expect(screen.getByText('Missing. Add the Bob kit to this folder')).toBeTruthy()
  expect(screen.getByLabelText('Access token')).toBeTruthy()
})

it('says when no workspace folder is open', async () => {
  runChecks.mockResolvedValue({ bobVersion: 'bob 2.0.5', bobSettings: null })
  render(<RadarSettingsPane connection={null} connected={false} workspacePath={null} onConnectionChange={vi.fn()} />)

  fireEvent.click(screen.getByRole('button', { name: 'Test' }))

  expect(await screen.findByText('Open a workspace folder first')).toBeTruthy()
  expect(runChecks).toHaveBeenCalledWith(null)
})

it('loads the share prompts flag for the open folder and saves a change', async () => {
  getSharePrompts.mockResolvedValue(false)
  setSharePrompts.mockResolvedValue(true)
  render(<RadarSettingsPane connection={summary} connected workspacePath="/work/toko-demo" onConnectionChange={vi.fn()} />)

  const toggle = screen.getByRole('switch', { name: 'Share my prompts' })
  await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false))
  expect(getSharePrompts).toHaveBeenCalledWith('/work/toko-demo')
  expect(toggle.getAttribute('aria-checked')).toBe('false')

  fireEvent.click(toggle)

  expect(setSharePrompts).toHaveBeenCalledWith('/work/toko-demo', true)
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
})

it('keeps the previous value and explains when saving fails', async () => {
  getSharePrompts.mockResolvedValue(true)
  setSharePrompts.mockRejectedValue(new Error('EACCES'))
  render(<RadarSettingsPane connection={summary} connected workspacePath="/work/toko-demo" onConnectionChange={vi.fn()} />)

  const toggle = screen.getByRole('switch', { name: 'Share my prompts' })
  await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('true'))
  fireEvent.click(toggle)

  expect(await screen.findByText('Could not save to .radar/local.json. Check that this folder is writable.')).toBeTruthy()
  expect(toggle.getAttribute('aria-checked')).toBe('true')
})

it('disables prompt sharing until a workspace folder is open', () => {
  render(<RadarSettingsPane connection={null} connected={false} workspacePath={null} onConnectionChange={vi.fn()} />)
  expect(screen.getByRole('switch', { name: 'Share my prompts' }).hasAttribute('disabled')).toBe(true)
  expect(getSharePrompts).not.toHaveBeenCalled()
})
