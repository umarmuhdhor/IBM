import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readSharePrompts, writeSharePrompts } from './share-prompts'

let workspace: string
const localJson = () => join(workspace, '.radar', 'local.json')

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'lc-share-prompts-'))
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

describe('share prompts setting', () => {
  it('creates .radar/local.json with the flag the hooks read', async () => {
    await expect(writeSharePrompts(workspace, true)).resolves.toBe(true)
    expect(JSON.parse(readFileSync(localJson(), 'utf8'))).toEqual({ shareprompts: true })
    expect(statSync(localJson()).mode & 0o777).toBe(0o600)
  })

  it('keeps every other field when it toggles the flag', async () => {
    mkdirSync(join(workspace, '.radar'))
    const existing = { server: 'http://127.0.0.1:8787', workspace: 'toko-demo', member: 'B', role: 'coder', shareprompts: true }
    writeFileSync(localJson(), JSON.stringify(existing))

    await writeSharePrompts(workspace, false)

    expect(JSON.parse(readFileSync(localJson(), 'utf8'))).toEqual({ ...existing, shareprompts: false })
  })

  it('reads the flag and treats a missing file or field as off', async () => {
    await expect(readSharePrompts(workspace)).resolves.toBe(false)
    mkdirSync(join(workspace, '.radar'))
    writeFileSync(localJson(), JSON.stringify({ member: 'B' }))
    await expect(readSharePrompts(workspace)).resolves.toBe(false)
    writeFileSync(localJson(), JSON.stringify({ member: 'B', shareprompts: true }))
    await expect(readSharePrompts(workspace)).resolves.toBe(true)
  })

  it('refuses to overwrite a local.json it cannot parse', async () => {
    mkdirSync(join(workspace, '.radar'))
    writeFileSync(localJson(), '{ not json')
    await expect(writeSharePrompts(workspace, true)).rejects.toThrow(/local\.json/)
    expect(readFileSync(localJson(), 'utf8')).toBe('{ not json')
  })

  it('rejects relative or missing workspace folders', async () => {
    await expect(writeSharePrompts('relative/folder', true)).rejects.toThrow(/absolute/)
    await expect(readSharePrompts('relative/folder')).rejects.toThrow(/absolute/)
    await expect(writeSharePrompts(join(workspace, 'missing'), true)).rejects.toThrow(/folder/)
  })
})
