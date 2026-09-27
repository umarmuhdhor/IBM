import { ipcRenderer } from 'electron'
import type { RadarConnectionSummary } from '../../shared/radar-connection'
import type {
  RadarJoinCode,
  RadarJoinResult,
  RadarJoinRole,
  RadarOpenFolderResult,
  RadarSyncStatus
} from '../../shared/radar-join'

export type RadarJoinApi = {
  joinWithCode: (
    code: string,
    server?: string,
    name?: string,
    role?: RadarJoinRole
  ) => Promise<RadarJoinResult>
  createJoinCode: () => Promise<RadarJoinCode>
  /** Mission Control only (D-alief-20): removes a teammate's seat; their open tasks are cancelled. */
  removeMember: (member: string) => Promise<void>
  /**
   * D-alief-21: the owner takes back Mission Control after another device took over and is gone. Uses the shared
   * folder's seat; the owner code never reaches the renderer.
   */
  reclaimOwner: () => Promise<RadarConnectionSummary>
  /** Shares `folder` (the one open in the app), or opens a folder picker when it is null; null when cancelled. */
  shareFolder: (folder: string | null, server?: string) => Promise<RadarOpenFolderResult | null>
  /** Owner only: removes the workspace from the server for everyone and disconnects this app. */
  stopSharing: () => Promise<void>
  getSyncStatus: () => Promise<RadarSyncStatus>
  openInBob: () => Promise<string | null>
  /** Replaces the folder's `.bob/` with the Bob kit; the old one is kept as `.bob.bak-<time>`. */
  installBobKit: () => Promise<void>
  showFolder: () => Promise<string>
  onSyncStatus: (callback: (status: RadarSyncStatus) => void) => () => void
  /** The name this person chose once; used for every share and join so teammates see one name. */
  getProfileName: () => Promise<string | null>
  /** Copies a join code from the main process, which works even when the window is not focused. */
  copyText: (text: string) => Promise<void>
}

export const radarJoinApi: RadarJoinApi = {
  joinWithCode: (code, server, name, role) =>
    ipcRenderer.invoke('radar:join-with-code', { code, server, name, role }),
  createJoinCode: () => ipcRenderer.invoke('radar:create-join-code'),
  removeMember: (member) => ipcRenderer.invoke('radar:remove-member', member),
  reclaimOwner: () => ipcRenderer.invoke('radar:reclaim-owner'),
  shareFolder: (folder, server) => ipcRenderer.invoke('radar:share-folder', { folder, server }),
  stopSharing: () => ipcRenderer.invoke('radar:stop-sharing'),
  getSyncStatus: () => ipcRenderer.invoke('radar:sync-status'),
  openInBob: () => ipcRenderer.invoke('radar:open-in-bob'),
  installBobKit: () => ipcRenderer.invoke('radar:install-kit'),
  showFolder: () => ipcRenderer.invoke('radar:show-folder'),
  copyText: (text) => ipcRenderer.invoke('radar:copy-text', text),
  getProfileName: () => ipcRenderer.invoke('radar:profile-name'),
  onSyncStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: RadarSyncStatus): void =>
      callback(status)
    ipcRenderer.on('radar:sync', listener)
    return () => ipcRenderer.removeListener('radar:sync', listener)
  }
}
