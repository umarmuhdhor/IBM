import { encodeInvite } from '@radar/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOsEncryption: vi.fn(),
  saveRadarConnection: vi.fn(),
  readRadarConnection: vi.fn(),
  getRadarConnectionSummary: vi.fn(),
  startClient: vi.fn(),
  startSyncAgent: vi.fn(),
  stopSyncAgent: vi.fn(),
  ensureNodeForBob: vi.fn(async () => undefined),
  moveAsideOldFolder: vi.fn((_folder: string): string | null => null)
}))

vi.mock('electron', () => ({
  app: { on: vi.fn(), whenReady: vi.fn(async () => undefined) },
  ipcMain: { handle: vi.fn() },
  shell: { openPath: vi.fn() }
}))
vi.mock('./secure-store', () => ({
  requireOsEncryption: mocks.requireOsEncryption,
  saveRadarConnection: mocks.saveRadarConnection,
  readRadarConnection: mocks.readRadarConnection,
  getRadarConnectionSummary: mocks.getRadarConnectionSummary
}))
vi.mock('./connection-ipc', () => ({ startClient: mocks.startClient }))
vi.mock('./node-shim', () => ({ ensureNodeForBob: mocks.ensureNodeForBob }))
vi.mock('./join-folder', () => ({ moveAsideOldFolder: mocks.moveAsideOldFolder }))
vi.mock('./sync-agent', () => ({
  getSyncStatus: vi.fn(),
  startSyncAgent: mocks.startSyncAgent,
  stopSyncAgent: mocks.stopSyncAgent,
  workspaceFolder: (workspace: string) => `/home/test/live-collab/${workspace}`
}))

const { createJoinCode, joinWithCode, serverOrigin } = await import('./join')

const SERVER = 'https://collab.example.dev'
const invite = encodeInvite({
  server: SERVER,
  workspace: 'toko-demo',
  member: 'D',
  token: 'rdr_test_member_value'
})

function respond(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status }))
  )
}

describe('joinWithCode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRadarConnectionSummary.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'toko-demo',
      member: 'D',
      role: 'coder'
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rejects a malformed code without calling the server', async () => {
    respond(200, {})
    await expect(joinWithCode('nope', SERVER)).rejects.toThrow(/K7QM-3XPA/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('checks OS encryption before redeeming, because redeeming rotates the token', async () => {
    respond(200, {})
    mocks.requireOsEncryption.mockImplementationOnce(() => {
      throw new Error('OS encryption is unavailable for Live Collab connection')
    })
    await expect(joinWithCode('K7QM-3XPA', SERVER)).rejects.toThrow(/encryption/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('normalizes the code, saves the member connection and starts sync with the invite', async () => {
    respond(200, { workspace: 'toko-demo', member: 'D', role: 'coder', invite })
    const result = await joinWithCode(' k7qm 3xpa ', SERVER)
    expect(fetch).toHaveBeenCalledWith(
      `${SERVER}/v1/join`,
      expect.objectContaining({ body: JSON.stringify({ code: 'K7QM-3XPA' }) })
    )
    const saved = {
      server: `${SERVER}/`,
      workspace: 'toko-demo',
      member: 'D',
      role: 'coder',
      token: 'rdr_test_member_value'
    }
    expect(mocks.saveRadarConnection).toHaveBeenCalledWith(saved)
    expect(mocks.startClient).toHaveBeenCalledWith(saved)
    expect(mocks.startSyncAgent).toHaveBeenCalledWith('toko-demo', invite)
    expect(result).toEqual({
      connection: expect.objectContaining({ workspace: 'toko-demo', member: 'D' }),
      role: 'coder',
      folder: '/home/test/live-collab/toko-demo',
      previousFolder: null
    })
  })

  it('stops the old sync and moves a leftover folder aside before syncing, so stale files never upload', async () => {
    respond(200, { workspace: 'toko-demo', member: 'D', role: 'coder', invite })
    mocks.moveAsideOldFolder.mockReturnValueOnce('/home/test/live-collab/toko-demo.old-1')
    const result = await joinWithCode('K7QM-3XPA', SERVER)
    expect(mocks.moveAsideOldFolder).toHaveBeenCalledWith('/home/test/live-collab/toko-demo')
    const stopped = mocks.stopSyncAgent.mock.invocationCallOrder[0]!
    const moved = mocks.moveAsideOldFolder.mock.invocationCallOrder[0]!
    expect(stopped).toBeLessThan(moved)
    expect(moved).toBeLessThan(mocks.startSyncAgent.mock.invocationCallOrder[0]!)
    expect(result.previousFolder).toBe('/home/test/live-collab/toko-demo.old-1')
  })

  it('keeps the old folder when the server refuses the code', async () => {
    respond(409, { error: { code: 'CONFLICT', message: 'This code was already used by Budi. Ask the owner for a new code.' } })
    await expect(joinWithCode('K7QM-3XPA', SERVER, 'Eve', 'pm')).rejects.toThrow(/already used by Budi/)
    expect(mocks.moveAsideOldFolder).not.toHaveBeenCalled()
  })

  it('sends the name and role that an open code needs', async () => {
    respond(200, { workspace: 'toko-demo', member: 'E', role: 'pm', invite })
    await joinWithCode('K7QM-3XPA', SERVER, '  Sari  ', 'pm')
    expect(fetch).toHaveBeenCalledWith(
      `${SERVER}/v1/join`,
      expect.objectContaining({
        body: JSON.stringify({ code: 'K7QM-3XPA', name: 'Sari', role: 'pm' })
      })
    )
  })

  it('an owner code saves a Mission Control connection and does not sync files (D-alief-11)', async () => {
    respond(200, { workspace: 'toko-demo', member: null, role: 'mc', token: 'rdr_test_mc_value' })
    mocks.getRadarConnectionSummary.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'toko-demo',
      member: 'mc',
      role: 'mc'
    })
    const result = await joinWithCode('K7QM-3XPA', SERVER)
    const saved = {
      server: `${SERVER}/`,
      workspace: 'toko-demo',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_mc_value'
    }
    expect(mocks.saveRadarConnection).toHaveBeenCalledWith(saved)
    expect(mocks.startClient).toHaveBeenCalledWith(saved)
    expect(mocks.stopSyncAgent).toHaveBeenCalled()
    expect(mocks.startSyncAgent).not.toHaveBeenCalled()
    expect(result).toEqual({
      connection: expect.objectContaining({ role: 'mc' }),
      role: 'mc',
      folder: null,
      previousFolder: null
    })
  })

  it("shows the server's message for a wrong or expired code", async () => {
    respond(404, {
      error: { code: 'NOT_FOUND', message: 'This join code is wrong or has expired.' }
    })
    await expect(joinWithCode('K7QM-3XPA', SERVER)).rejects.toThrow(
      'This join code is wrong or has expired.'
    )
    expect(mocks.saveRadarConnection).not.toHaveBeenCalled()
  })
})

describe('createJoinCode', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('needs a Mission Control connection', async () => {
    respond(201, {})
    mocks.readRadarConnection.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'toko-demo',
      member: 'D',
      role: 'coder',
      token: 'rdr_test_member_value'
    })
    await expect(createJoinCode()).rejects.toThrow(/Mission Control/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('asks the server for an open code with the Mission Control token', async () => {
    respond(201, { member: null, code: 'K7QM-3XPA', expiresAt: 1 })
    mocks.readRadarConnection.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'toko-demo',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_mc_value'
    })
    await expect(createJoinCode()).resolves.toEqual({
      member: null,
      code: 'K7QM-3XPA',
      expiresAt: 1
    })
    expect(fetch).toHaveBeenCalledWith(
      `${SERVER}/v1/join-codes`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer rdr_test_mc_value' }),
        body: JSON.stringify({})
      })
    )
  })
})

describe('serverOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses LIVE_COLLAB_SERVER instead of the deployed server, but keeps a typed server', () => {
    vi.stubEnv('LIVE_COLLAB_SERVER', 'http://localhost:8787')
    expect(serverOrigin('https://live-collab.afindo-mi01.workers.dev')).toBe('http://localhost:8787')
    expect(serverOrigin(undefined)).toBe('http://localhost:8787')
    expect(serverOrigin(SERVER)).toBe(SERVER)
  })

  it('falls back to the deployed server without LIVE_COLLAB_SERVER', () => {
    vi.stubEnv('LIVE_COLLAB_SERVER', '')
    expect(serverOrigin('')).toBe('https://live-collab.afindo-mi01.workers.dev')
  })
})
