import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { encodeInvite } from '@radar/common'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireOsEncryption: vi.fn(),
  saveRadarConnection: vi.fn(),
  readRadarConnection: vi.fn(),
  getRadarConnectionSummary: vi.fn(),
  startClient: vi.fn(),
  disconnectRadar: vi.fn(),
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
vi.mock('./connection-ipc', () => ({
  startClient: mocks.startClient,
  disconnectRadar: mocks.disconnectRadar
}))
vi.mock('./node-shim', () => ({ ensureNodeForBob: vi.fn(async () => undefined) }))
vi.mock('./sync-agent', () => ({
  getSyncStatus: vi.fn(),
  startSyncAgent: mocks.startSyncAgent,
  stopSyncAgent: vi.fn(),
  workspaceFolder: (workspace: string) => `/home/test/live-collab/${workspace}`
}))

const {
  batchFolderFiles,
  collectFolderFiles,
  registerRadarOpenFolderIpc,
  shareFolder,
  stopSharing,
  workspaceNameFor
} = await import('./open-folder')

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
    write('.env', 'KEY=value\n')
    write('.env.example', 'KEY=\n')
    write('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))
    write('big.txt', 'a'.repeat(1_048_577))
    const { files, skipped } = collectFolderFiles(root)
    expect(files.map((file) => file.path)).toEqual([
      '.env.example',
      '.gitignore',
      'README.md',
      'src/a.ts'
    ])
    expect(skipped).toBe(2)
  })

  it('honours a .gitignore in a subfolder (D-alief-16)', () => {
    write('pkg/.gitignore', 'local.txt\n')
    write('pkg/local.txt', 'private')
    write('pkg/deep/local.txt', 'private')
    write('pkg/keep.ts', 'x')
    write('local.txt', 'shared')
    expect(collectFolderFiles(root).files.map((file) => file.path)).toEqual([
      'local.txt',
      'pkg/.gitignore',
      'pkg/keep.ts'
    ])
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

  it('uses a default owner name when none is typed', async () => {
    respondInOrder([201, opened])
    await shareFolder(root, '  ', 'coder', SERVER)
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))
    expect(body.owner.name.length).toBeGreaterThan(0)
  })

  it('keeps the first name so the owner does not drift between git and the Mac account', async () => {
    respondInOrder([201, opened], [201, opened])
    await shareFolder(root, ' Alief ', 'coder', SERVER)
    await shareFolder(root, '', 'coder', SERVER)
    const opens = vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => String(url).endsWith('/v1/workspace/open'))
    expect(JSON.parse(String(opens[1]?.[1]?.body)).owner.name).toBe('Alief')
  })

  it('never shares the whole disk, the home folder or the folder teammates sync into', async () => {
    respondInOrder([201, opened])
    for (const folder of ['/', homedir(), dirname(homedir()), '/home/test/live-collab']) {
      await expect(shareFolder(folder, 'Alief', 'coder', SERVER), folder).rejects.toThrow(
        /Pick one project folder/
      )
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('says which file it cannot read instead of a raw EACCES', async () => {
    respondInOrder([201, opened])
    write('locked/a.txt', 'x')
    chmodSync(join(root, 'locked'), 0o000)
    try {
      await expect(shareFolder(root, 'Alief', 'coder', SERVER)).rejects.toThrow(
        /cannot read .*locked/
      )
    } finally {
      chmodSync(join(root, 'locked'), 0o755)
    }
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuses a folder that does not exist before it calls the server', async () => {
    respondInOrder([201, opened])
    await expect(shareFolder(join(root, 'gone'), 'Alief', 'coder', SERVER)).rejects.toThrow(
      /no longer exists/
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('stopSharing (D-alief-12)', () => {
  it('needs the owner connection', async () => {
    respondInOrder([200, { ok: true }])
    await expect(stopSharing()).rejects.toThrow(/owner/)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('closes the workspace on the server, then forgets the connection on this Mac', async () => {
    mocks.readRadarConnection.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'my-app',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_mc_value'
    })
    respondInOrder([200, { ok: true }])
    await stopSharing()
    expect(fetch).toHaveBeenCalledWith(
      `${SERVER}/v1/workspace/close`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer rdr_test_mc_value' })
      })
    )
    expect(mocks.disconnectRadar).toHaveBeenCalled()
  })

  it("says the server can't be reached instead of a raw TimeoutError (offline)", async () => {
    mocks.readRadarConnection.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'my-app',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_mc_value'
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      })
    )
    await expect(stopSharing()).rejects.toThrow("Can't reach the Live Collab server. Try again.")
    expect(mocks.disconnectRadar).not.toHaveBeenCalled()
  })

  it('keeps the connection when the server refuses', async () => {
    mocks.readRadarConnection.mockReturnValue({
      server: `${SERVER}/`,
      workspace: 'my-app',
      member: 'mc',
      role: 'mc',
      token: 'rdr_test_mc_value'
    })
    respondInOrder([401, { error: { code: 'UNAUTHORIZED', message: 'Token revoked.' } }])
    await expect(stopSharing()).rejects.toThrow('Token revoked.')
    expect(mocks.disconnectRadar).not.toHaveBeenCalled()
  })
})

describe('a share cut off mid-upload (fase 12k bug 9)', () => {
  const mcConnection = {
    server: `${SERVER}/`,
    workspace: 'my-app',
    member: 'mc',
    role: 'mc',
    token: 'rdr_test_mc_value'
  }
  const ownerFile = () => join(mocks.userData, 'radar', 'owner-folder.json')

  it('keeps this Mac as owner once the server opened the workspace, so Share again replaces it', async () => {
    write('src/a.ts', 'export const a = 1\n')
    respondInOrder([201, opened], [503, { error: { code: 'UNAVAILABLE', message: 'try later' } }])
    await expect(shareFolder(root, 'Alief', 'coder', SERVER)).rejects.toThrow()
    expect(mocks.saveRadarConnection).toHaveBeenCalledWith(mcConnection)
    expect(JSON.parse(readFileSync(ownerFile(), 'utf8'))).toEqual({
      workspace: 'my-app',
      folder: root,
      pending: true,
      role: 'coder'
    })
    expect(mocks.startSyncAgent).not.toHaveBeenCalled()

    mocks.readRadarConnection.mockReturnValue(mcConnection)
    respondInOrder([201, opened], [200, { inserted: 1, headCommit: null }])
    await shareFolder(root, 'Alief', 'coder', SERVER)
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer rdr_test_mc_value'
    })
    expect(JSON.parse(readFileSync(ownerFile(), 'utf8'))).toEqual({ workspace: 'my-app', folder: root })
  })

  it('the next start finishes the share by itself', async () => {
    write('src/a.ts', 'export const a = 1\n')
    mkdirSync(dirname(ownerFile()), { recursive: true })
    writeFileSync(ownerFile(), JSON.stringify({ workspace: 'my-app', folder: root, pending: true, role: 'pm' }))
    mocks.readRadarConnection.mockReturnValue(mcConnection)
    respondInOrder([201, opened], [200, { inserted: 1, headCommit: null }])
    registerRadarOpenFolderIpc()
    await vi.waitFor(() => expect(mocks.startSyncAgent).toHaveBeenCalledWith('my-app', invite, root))
    expect(vi.mocked(fetch).mock.calls[1]?.[0]).toBe(`${SERVER}/v1/workspace/files`)
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      owner: { role: 'pm' }
    })
    expect(JSON.parse(readFileSync(ownerFile(), 'utf8'))).toEqual({ workspace: 'my-app', folder: root })
  })
})
