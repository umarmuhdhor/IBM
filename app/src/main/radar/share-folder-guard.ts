import { realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, parse, resolve, sep } from 'node:path'
import { workspaceFolder } from './sync-agent'

function realPath(path: string): string {
  try {
    return realpathSync.native(path)
  } catch {
    return resolve(path)
  }
}

/** The whole disk, the home folder and ~/live-collab hold many projects and private files (SSH keys, shell history). */
export function refuseBroadFolder(folder: string): void {
  const real = realPath(folder)
  const within = (path: string): boolean =>
    path === real || path.startsWith(real.endsWith(sep) ? real : real + sep)
  if (
    parse(real).root === real ||
    within(realPath(homedir())) ||
    within(realPath(dirname(workspaceFolder('_'))))
  ) {
    throw new Error(
      'Pick one project folder. Live Collab does not share the whole disk, your home folder or ~/live-collab.'
    )
  }
}

/** Turns a raw EACCES/EPERM from reading the folder into a sentence that names the path. */
export function readableOrThrow<T>(read: () => T): T {
  try {
    return read()
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'EACCES' || error.code === 'EPERM') &&
      'path' in error &&
      typeof error.path === 'string'
    ) {
      throw new Error(
        `Live Collab cannot read ${error.path}. Pick a folder you own, or allow access in System Settings → Privacy & Security.`
      )
    }
    throw error
  }
}
