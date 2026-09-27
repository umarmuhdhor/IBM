import { existsSync, readdirSync, renameSync } from 'node:fs'

/**
 * A teammate always joins into an empty ~/live-collab/<workspace>. A folder left over from an earlier session can
 * hold files the owner never had; the sync agent would upload them into the owner's project. So an existing
 * non-empty folder is moved aside to `<folder>.old-<timestamp>` first, and nothing is deleted.
 * Returns the new path of the old folder, or null when there was nothing to move.
 */
export function moveAsideOldFolder(folder: string, now = Date.now()): string | null {
  if (!existsSync(folder) || readdirSync(folder).length === 0) {
    return null
  }
  const stamp = new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  let target = `${folder}.old-${stamp}`
  for (let n = 2; existsSync(target); n++) {
    target = `${folder}.old-${stamp}-${n}`
  }
  renameSync(folder, target)
  return target
}
