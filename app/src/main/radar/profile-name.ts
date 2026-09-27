import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Why: the owner's name came from git user.name on one share and the macOS account on the next,
// so teammates saw two names for one person. The first name used is kept and reused.

function profilePath(): string {
  return join(app.getPath('userData'), 'radar', 'profile.json')
}

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 100) : ''
}

export function readProfileName(): string | null {
  try {
    const value: unknown = JSON.parse(readFileSync(profilePath(), 'utf8'))
    const name =
      typeof value === 'object' && value !== null && 'name' in value ? cleanName(value.name) : ''
    return name || null
  } catch {
    return null
  }
}

export function saveProfileName(value: unknown): string | null {
  const name = cleanName(value)
  if (!name) {
    return null
  }
  mkdirSync(join(app.getPath('userData'), 'radar'), { recursive: true })
  writeFileSync(profilePath(), JSON.stringify({ name }))
  return name
}
