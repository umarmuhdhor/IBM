import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodeInvite } from '@radar/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOsEncryption: vi.fn(),
  saveRadarConnection: vi.fn(),
  readRadarConnection: vi.fn(),
  getRadarConnectionSummary: vi.fn(),
  startClient: vi.fn(),
  startSyncAgent: vi.fn(),
  userData: ''
}))

vi.mock('electron', () => ({
  app: {
    on: vi.fn(),
    whenReady: vi.fn(async () => undefined),
    getPath: () => mocks.userData
  },
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
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
vi.mock('./node-shim', () => ({ ensureNodeForBob: vi.fn(async () => undefined) }))
vi.mock('./sync-agent', () => ({
  getSyncStatus: vi.fn(),
  startSyncAgent: mocks.startSyncAgent,
  stopSyncAgent: vi.fn(),
  workspaceFolder: (workspace: string) => `/home/test/live-collab/${workspace}`
}))

const { batchFolderFiles, collectFolderFiles, shareFolder, workspaceNameFor } =
  await import('./open-folder')

const SERVER = 'https://collab.example.dev'
const invite = encodeInvite({
  server: SERVER,
  workspace: 'my-app',
  member: 'A',
  token: 'rdr_test_member_value'
})
const opened = {
  workspace: 'my-app',
  member: 'A',
  invite,
  mcToken: 'rdr_test_mc_value',
  code: 'K7QM-3XPA',
  expiresAt: 1
}

let root: string

function write(rel: string, content: string | Buffer): void {
  mkdirSync(join(root, rel, '..'), { recursive: true })
  writeFileSync(join(root, rel), content)
}

function respondInOrder(...bodies: [number, unknown][]): void {
  const queue = [...bodies]
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const [status, body] = queue.shift() ?? [500, {}]
      return new Response(JSON.stringify(body), { status })
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  root = mkdtempSync(join(tmpdir(), 'radar-share-'))
  mocks.userData = mkdtempSync(join(tmpdir(), 'radar-userdata-'))
  mocks.readRadarConnection.mockReturnValue(null)
  mocks.getRadarConnectionSummary.mockReturnValue({
    server: `${SERVER}/`,
    workspace: 'my-app',
    member: 'mc',
    role: 'mc'
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(root, { recursive: true, force: true })
  rmSync(mocks.userData, { recursive: true, force: true })
})

describe('collectFolderFiles', () => {
  it('keeps text files and skips ignored, binary and large ones', () => {
    write('.gitignore', 'secret-notes.txt\n')
    write('src/a.ts', 'export const a = 1\n')
    write('README.md', '# hi\n')
    write('secret-notes.txt', 'x')
    write('node_modules/x/index.js', 'x')
    write('.radar/local.json', '{}')
    write('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))
    write('big.txt', 'a'.repeat(1_048_577))
    const { files, skipped } = collectFolderFiles(root)
    expect(files.map((file) => file.path)).toEqual(['.gitignore', 'README.md', 'src/a.ts'])
    expect(skipped).toBe(2)
  })

  it('splits uploads into batches of at most 100 files', () => {
    const files = Array.from({ length: 205 }, (_, i) => ({ path: `f${i}.txt`, content: 'x' }))
    expect(batchFolderFiles(files).map((batch) => batch.length)).toEqual([100, 100, 5])
  })

  it('turns the folder name into a workspace name', () => {
    expect(workspaceNameFor('/Users/me/My Shop App')).toBe('my-shop-app')
    expect(workspaceNameFor('/Users/me/.hidden')).toBe('hidden')
    expect(workspaceNameFor('/Users/me/???')).toBe('workspace')
  })
})

describe('shareFolder (D-alief-12)', () => {
  it('opens the workspace, uploads the folder, saves Mission Control and syncs the same folder', async () => {
    write('src/a.ts', 'export const a = 1\n')
    respondInOrder([201, opened], [200, { inserted: 1, headCommit: null }])
    const result = await shareFolder(root, ' Alief ', 'coder', SERVER)

    const calls = vi.mocked(fetch).mock.calls
    expect(calls[0]?.[0]).toBe(`${SERVER}/v1/workspace/open`)
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toMatchObject({
      owner: { name: 'Alief', role: 'coder' }
    })
    expect(calls[1]?.[0]).toBe(`${SERVER}/v1/workspace/files`)
    expect(calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer rdr_test_mc_value' })
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({
      headCommit: null,
      files: [{ path: 'src/a.ts', content: 'export const a = 1\n' }]
    })
    const saved = {
      server: `${SERVER}/`,
      workspace: 'my-app',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_mc_value'
    }
    expect(mocks.saveRadarConnection).toHaveBeenCalledWith(saved)
    expect(mocks.startClient).toHaveBeenCalledWith(saved)
    expect(mocks.startSyncAgent).toHaveBeenCalledWith('my-app', invite, root)
    expect(result).toMatchObject({
      folder: root,
      files: 1,
      skipped: 0,
      code: { member: null, code: 'K7QM-3XPA', expiresAt: 1 }
    })
  })

  it('sends the current Mission Control token so the owner can replace the workspace', async () => {
    mocks.readRadarConnection.mockReturnValue({
      server: 'https://other.example.dev/',
      workspace: 'old',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_old_mc'
    })
    respondInOrder([201, opened])
    await shareFolder(root, 'Alief', 'pm', SERVER)
    expect(fetch).toHaveBeenCalledWith(
      'https://other.example.dev/v1/workspace/open',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer rdr_test_old_mc' })
      })
    )
  })

  it("shows the server's message when someone else already owns the server", async () => {
    respondInOrder([
      409,
      {
        error: {
          code: 'CONFLICT',
          message:
            'This server already has the workspace toko-demo. Ask its owner for a join code, or use your own server to share a folder.'
        }
      }
    ])
    await expect(shareFolder(root, 'Alief', 'coder', SERVER)).rejects.toThrow(/toko-demo/)
    expect(mocks.saveRadarConnection).not.toHaveBeenCalled()
    expect(mocks.startSyncAgent).not.toHaveBeenCalled()
  })

  it('needs a name before it calls the server', async () => {
    respondInOrder([201, opened])
    await expect(shareFolder(root, '  ', 'coder', SERVER)).rejects.toThrow(/name/)
    expect(fetch).not.toHaveBeenCalled()
  })
})
