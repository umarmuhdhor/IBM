import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RadarJoinRole } from '../../shared/radar-join'

// The folder this Mac shares as owner, so it resumes syncing (or finishes an upload) after a restart.

/** `pending`: the server opened the workspace but the upload did not finish (the app quit or lost the network). */
export type OwnerFolder = { workspace: string; folder: string; pending?: true; role?: RadarJoinRole }

export function ownerFolderPath(): string {
  return join(app.getPath('userData'), 'radar', 'owner-folder.json')
}

export function readOwnerFolder(): OwnerFolder | null {
  try {
    const value: unknown = JSON.parse(readFileSync(ownerFolderPath(), 'utf8'))
    if (
      typeof value === 'object' &&
      value !== null &&
      'workspace' in value &&
      typeof value.workspace === 'string' &&
      'folder' in value &&
      typeof value.folder === 'string'
    ) {
      const pending = 'pending' in value && value.pending === true
      const role = 'role' in value && value.role === 'pm' ? 'pm' : 'coder'
      return pending
        ? { workspace: value.workspace, folder: value.folder, pending, role }
        : { workspace: value.workspace, folder: value.folder }
    }
  } catch {
    // Missing or unreadable: nothing to resume.
  }
  return null
}

export function saveOwnerFolder(value: OwnerFolder): void {
  mkdirSync(join(app.getPath('userData'), 'radar'), { recursive: true })
  writeFileSync(ownerFolderPath(), JSON.stringify(value))
}
