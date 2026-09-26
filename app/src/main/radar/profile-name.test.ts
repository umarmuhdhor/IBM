import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, expect, it, vi } from 'vitest'

const dir = mkdtempSync(join(tmpdir(), 'radar-profile-'))
vi.mock('electron', () => ({ app: { getPath: () => dir } }))

const { readProfileName, saveProfileName } = await import('./profile-name')

afterAll(() => rmSync(dir, { recursive: true, force: true }))

it('keeps the name the user chose once, cleaned up', () => {
  expect(readProfileName()).toBeNull()
  expect(saveProfileName('  Alief   Fauzan ')).toBe('Alief Fauzan')
  expect(readProfileName()).toBe('Alief Fauzan')
  expect(saveProfileName('   ')).toBeNull()
  expect(readProfileName()).toBe('Alief Fauzan')
})
