import { app, safeStorage } from 'electron'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  isRadarConnection,
  type RadarConnection,
  type RadarConnectionSummary
} from '../../shared/radar-connection'
import { writeSecureFile } from '../../shared/secure-file'

function connectionPath(): string {
  return join(app.getPath('userData'), 'radar', 'connection.bin')
}

export function requireOsEncryption(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is unavailable for Live Collab connection')
  }
  if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend?.() === 'basic_text') {
    throw new Error('OS encryption is unavailable for Live Collab connection')
  }
}

export function saveRadarConnection(value: RadarConnection): void {
  if (!isRadarConnection(value)) {
    throw new Error('Invalid Live Collab connection')
  }
  requireOsEncryption()
  const path = connectionPath()
  const ciphertext = safeStorage.encryptString(JSON.stringify(value)).toString('base64')
  if (!writeSecureFile(path, ciphertext)) {
    rmSync(path, { force: true })
    throw new Error('Could not protect Live Collab connection file')
  }
}

export function readRadarConnection(): RadarConnection | null {
  let encoded: string
  try {
    encoded = readFileSync(connectionPath(), 'utf8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
  requireOsEncryption()
  const value: unknown = JSON.parse(safeStorage.decryptString(Buffer.from(encoded, 'base64')))
  if (!isRadarConnection(value)) {
    throw new Error('Invalid saved Live Collab connection')
  }
  return value
}

export function getRadarConnectionSummary(): RadarConnectionSummary | null {
  const connection = readRadarConnection()
  if (!connection) {
    return null
  }
  const { server, workspace, member, role } = connection
  return { server, workspace, member, role }
}

export function clearRadarConnection(): void {
  rmSync(connectionPath(), { force: true })
}
