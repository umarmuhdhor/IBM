import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connection = vi.hoisted(() => ({ readRadarConnection: vi.fn() }))
vi.mock('./secure-store', () => connection)

const { decideProposal, revokeLock, cancelTask } = await import('./api')

describe('Mission Control requests', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 'disetujui' }) })
    connection.readRadarConnection.mockReturnValue({
      server: 'https://live.example.test',
      workspace: 'demo',
      member: 'mc',
      role: 'mc',
      token: 'synthetic-value'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('sends a decision from main with the MC credential', async () => {
    await decideProposal('P-5', true, 'ok')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://live.example.test/v1/proposals/P-5/decision',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer synthetic-value',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approve: true, note: 'ok' })
      })
    )
  })

  it('rejects coder requests before any network call', async () => {
    connection.readRadarConnection.mockReturnValue({
      server: 'https://live.example.test',
      workspace: 'demo',
      member: 'A',
      role: 'coder',
      token: 'synthetic-value'
    })
    await expect(decideProposal('P-5', true, '')).rejects.toThrow(/Mission Control/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('uses the documented revoke and cancel endpoints', async () => {
    await revokeLock('src/routes.ts', 'stale host')
    await cancelTask('T-3')
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://live.example.test/v1/locks/revoke')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://live.example.test/v1/tasks/T-3/cancel')
  })
})
