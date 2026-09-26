import { afterEach, describe, expect, it, vi } from 'vitest'

const processes = vi.hoisted(() => ({ runProcess: vi.fn() }))
const fs = vi.hoisted(() => ({ access: vi.fn() }))
vi.mock('../../shared/child-process/run-process', () => processes)
vi.mock('node:fs/promises', () => fs)

const { runRadarChecks } = await import('./checks')

function processResult(code: number | null, stdout = '', timedOut = false): void {
  processes.runProcess.mockResolvedValue({ code, signal: null, stdout, stderr: '', timedOut })
}

describe('Live Collab settings checks', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('reports the Bob Shell version through the Node 24 launcher', async () => {
    processResult(0, 'bob 2.0.5\n')
    fs.access.mockResolvedValue(undefined)

    const result = await runRadarChecks('/work/toko-demo')

    expect(result.bobVersion).toBe('bob 2.0.5')
    expect(processes.runProcess).toHaveBeenCalledWith(
      expect.objectContaining({
        program: 'sh',
        args: ['-c', expect.stringContaining('nvm exec 24 bob'), 'bob', '--version'],
        timeoutMs: expect.any(Number)
      })
    )
  })

  it('returns null when Bob Shell is missing, fails, or hangs', async () => {
    fs.access.mockResolvedValue(undefined)
    processResult(127)
    expect((await runRadarChecks('/work/toko-demo')).bobVersion).toBeNull()
    processResult(null, 'bob 2.0.5', true)
    expect((await runRadarChecks('/work/toko-demo')).bobVersion).toBeNull()
    processes.runProcess.mockRejectedValue(new Error('spawn failed'))
    expect((await runRadarChecks('/work/toko-demo')).bobVersion).toBeNull()
  })

  it('checks for .bob/settings.json inside the workspace folder', async () => {
    processResult(0, 'bob 2.0.5')
    fs.access.mockResolvedValue(undefined)

    expect((await runRadarChecks('/work/toko-demo')).bobSettings).toBe(true)
    expect(fs.access).toHaveBeenCalledWith('/work/toko-demo/.bob/settings.json')
  })

  it('reports missing Bob settings', async () => {
    processResult(0, 'bob 2.0.5')
    fs.access.mockRejectedValue(new Error('ENOENT'))

    expect((await runRadarChecks('/work/toko-demo')).bobSettings).toBe(false)
  })

  it('skips the settings check without an absolute workspace path', async () => {
    processResult(0, 'bob 2.0.5')

    expect((await runRadarChecks(null)).bobSettings).toBeNull()
    expect((await runRadarChecks('relative/path')).bobSettings).toBeNull()
    expect(fs.access).not.toHaveBeenCalled()
  })
})
