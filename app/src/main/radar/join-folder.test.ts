import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { moveAsideOldFolder } from './join-folder'

const NOW = Date.UTC(2026, 8, 27, 3, 4, 5)
let base = ''

afterEach(() => {
  if (base) {
    rmSync(base, { recursive: true, force: true })
  }
})

describe('moveAsideOldFolder', () => {
  it('moves a leftover folder with files aside so the join starts empty', () => {
    base = mkdtempSync(join(tmpdir(), 'lc-join-'))
    const folder = join(base, 'proj-alpha')
    mkdirSync(folder)
    writeFileSync(join(folder, 'stale-only.md'), 'old\n')
    const moved = moveAsideOldFolder(folder, NOW)
    expect(moved).toBe(`${folder}.old-20260927T030405Z`)
    expect(existsSync(folder)).toBe(false)
    expect(readFileSync(join(moved!, 'stale-only.md'), 'utf8')).toBe('old\n')
  })

  it('keeps a missing or empty folder and never overwrites an earlier backup', () => {
    base = mkdtempSync(join(tmpdir(), 'lc-join-'))
    const folder = join(base, 'ws')
    expect(moveAsideOldFolder(folder, NOW)).toBeNull()
    mkdirSync(folder)
    expect(moveAsideOldFolder(folder, NOW)).toBeNull()
    writeFileSync(join(folder, 'a.md'), 'a')
    mkdirSync(`${folder}.old-20260927T030405Z`)
    expect(moveAsideOldFolder(folder, NOW)).toBe(`${folder}.old-20260927T030405Z-2`)
  })
})
