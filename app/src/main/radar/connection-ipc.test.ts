import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers = vi.hoisted(() => new Map<string, (_event: unknown, value?: unknown) => unknown>())
const store = vi.hoisted(() => ({
  clearRadarConnection: vi.fn(),
  getRadarConnectionSummary: vi.fn(),
  readRadarConnection: vi.fn<() => unknown>(() => null),
  saveRadarConnection: vi.fn()
}))
const validation = vi.hoisted(() => ({ isRadarConnection: vi.fn() }))
const client = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn() }))
const windows = vi.hoisted(() => ({ getAllWindows: vi.fn(() => []) }))

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((name, handler) => handlers.set(name, handler)) },
  BrowserWindow: windows
}))
vi.mock('./secure-store', () => store)
vi.mock('../../shared/radar-connection', () => validation)
vi.mock('./ws-client', () => ({
  RadarWsClient: class {
    connect = client.connect
    disconnect = client.disconnect
  }
}))

const { registerRadarConnectionIpc } = await import('./connection-ipc')

describe('Radar connection IPC', () => {
  beforeEach(() => {
    handlers.clear()
    vi.clearAllMocks()
    registerRadarConnectionIpc()
  })

  it('returns only the redacted connection summary', () => {
    const summary = {
      server: 'http://127.0.0.1:8787',
      workspace: 'demo',
      member: 'A',
      role: 'coder'
    }
    store.getRadarConnectionSummary.mockReturnValue(summary)
    expect(handlers.get('radar:get-connection')?.(null)).toEqual(summary)
    expect(handlers.get('radar:get-connection')?.(null)).not.toHaveProperty('token')
  })

  it('rejects invalid set arguments before persistence', () => {
    validation.isRadarConnection.mockReturnValue(false)
    expect(() =>
      handlers.get('radar:set-connection')?.(null, { token: 'synthetic-value' })
    ).toThrow(/Invalid Live Collab connection/)
    expect(store.saveRadarConnection).not.toHaveBeenCalled()
  })

  it('persists a valid connection and returns only its summary', () => {
    const connection = {
      server: 'http://127.0.0.1:8787',
      workspace: 'demo',
      member: 'A',
      role: 'coder',
      token: 'synthetic-value'
    }
    const summary = { server: connection.server, workspace: 'demo', member: 'A', role: 'coder' }
    validation.isRadarConnection.mockReturnValue(true)
    store.getRadarConnectionSummary.mockReturnValue(summary)
    expect(handlers.get('radar:set-connection')?.(null, connection)).toEqual(summary)
    expect(store.saveRadarConnection).toHaveBeenCalledWith(connection)
    expect(client.connect).toHaveBeenCalledOnce()
    handlers.get('radar:clear-connection')?.(null)
    expect(client.disconnect).toHaveBeenCalledOnce()
  })

  it('clears the saved connection', () => {
    handlers.get('radar:clear-connection')?.(null)
    expect(store.clearRadarConnection).toHaveBeenCalledOnce()
  })

  it('restarts a saved connection so a newly mounted renderer receives state', () => {
    store.readRadarConnection.mockReturnValueOnce({ server: 'http://127.0.0.1:8787', workspace: 'demo', member: 'A', role: 'coder', token: 'synthetic-value' })
    handlers.get('radar:refresh')?.(null)
    expect(client.connect).toHaveBeenCalledOnce()
  })
})
