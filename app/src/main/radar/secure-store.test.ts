import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronMock = vi.hoisted(() => {
  let plaintext = ''
  return {
    app: { getPath: vi.fn() },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((value: string) => {
        plaintext = value
        return Buffer.from('sealed-value')
      }),
      decryptString: vi.fn(() => plaintext)
    }
  }
})

vi.mock('electron', () => electronMock)

const {
  clearRadarConnection,
  getRadarConnectionSummary,
  readRadarConnection,
  saveRadarConnection
} = await import('./secure-store')

describe('Radar connection storage', () => {
  let userDataPath: string

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'radar-connection-'))
    electronMock.app.getPath.mockReturnValue(userDataPath)
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(true)
    vi.clearAllMocks()
  })

  afterEach(() => rmSync(userDataPath, { recursive: true, force: true }))

  it('stores the complete connection as ciphertext and returns a redacted summary', () => {
    const connection = {
      server: 'http://127.0.0.1:8787',
      workspace: 'demo',
      member: 'A',
      role: 'coder' as const,
      token: 'synthetic-value'
    }
    saveRadarConnection(connection)

    const stored = readFileSync(join(userDataPath, 'radar', 'connection.bin'))
    expect(stored.toString()).not.toContain(connection.token)
    expect(readRadarConnection()).toEqual(connection)
    expect(getRadarConnectionSummary()).toEqual({
      server: connection.server,
      workspace: connection.workspace,
      member: connection.member,
      role: connection.role
    })
  })

  it('refuses to store a connection without OS encryption', () => {
    electronMock.safeStorage.isEncryptionAvailable.mockReturnValue(false)
    expect(() =>
      saveRadarConnection({
        server: 'http://127.0.0.1:8787',
        workspace: 'demo',
        member: 'A',
        role: 'coder',
        token: 'synthetic-value'
      })
    ).toThrow(/encryption/i)
    expect(getRadarConnectionSummary()).toBeNull()
  })

  it('rejects a server URL with credentials or an unsupported protocol', () => {
    const connection = {
      server: 'https://user:pass@live.example.test',
      workspace: 'demo',
      member: 'A',
      role: 'coder' as const,
      token: 'synthetic-value'
    }
    expect(() => saveRadarConnection(connection)).toThrow(/Invalid Live Collab connection/)
    expect(() => saveRadarConnection({ ...connection, server: 'file:///tmp/live' })).toThrow(
      /Invalid Live Collab connection/
    )
  })

  it('removes the saved connection', () => {
    saveRadarConnection({
      server: 'http://127.0.0.1:8787',
      workspace: 'demo',
      member: 'A',
      role: 'coder',
      token: 'synthetic-value'
    })
    clearRadarConnection()
    expect(readRadarConnection()).toBeNull()
  })
})
