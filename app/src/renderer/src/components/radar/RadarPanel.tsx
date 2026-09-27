import { useState } from 'react'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import type { RadarJoinCode } from '../../../../shared/radar-join'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { useRadarStore } from '@/store/radar-store'
import { MissionControlView } from './MissionControlView'
import { TeamPanel } from './TeamPanel'
import { FilesLocksView } from './FilesLocksView'
import { InviteCodesCard } from './InviteCodesCard'
import { JoinWithCodeCard } from './JoinWithCodeCard'
import { RadarSettingsPane } from './RadarSettingsPane'
import { ShareFolderCard } from './ShareFolderCard'
import { WatchBobView } from './WatchBobView'
import { TaskBoardView } from './TaskBoardView'
import type { RadarPanelTab } from './radar-panel-tab'

const TABS: RadarPanelTab[] = ['multiplayer', 'tasks', 'mission', 'team', 'files', 'settings']

type Props = {
  tab: RadarPanelTab
  connection: RadarConnectionSummary | null
  onConnectionChange: (connection: RadarConnectionSummary | null) => void
  onTabChange: (tab: RadarPanelTab) => void
}

export function RadarPanel({ tab, connection, onConnectionChange, onTabChange }: Props) {
  const state = useRadarStore((store) => store.state)
  const connected = useRadarStore((store) => store.connected)
  const connectionFailure = useRadarStore((store) => store.connectionFailure)
  const now = useRadarStore((store) => store.now)
  const activeWorktreeId = useAppStore((store) => store.activeWorktreeId)
  const getKnownWorktreeById = useAppStore((store) => store.getKnownWorktreeById)
  const workspacePath = activeWorktreeId
    ? (getKnownWorktreeById(activeWorktreeId)?.path ?? null)
    : null
  const tasksLabel = connection?.role === 'coder' ? 'My tasks' : 'Tasks'
  const LABEL: Record<RadarPanelTab, string> = {
    mission: 'Mission Control',
    team: 'Team',
    files: 'Files & locks',
    multiplayer: 'Multiplayer',
    tasks: tasksLabel,
    settings: 'Settings',
    watch: 'Watch Bob'
  }
  const [watchedMemberId, setWatchedMemberId] = useState<string | null>(null)
  const [sharedCode, setSharedCode] = useState<RadarJoinCode | null>(null)
  // Why: codes made for a folder this app no longer shares are dead; a new share starts an empty list.
  const inviteKey = `${connection?.workspace ?? ''}/${sharedCode?.code ?? ''}`
  const tabs: RadarPanelTab[] = watchedMemberId ? [...TABS, 'watch'] : TABS

  const watch = (memberId: string) => {
    setWatchedMemberId(memberId)
    onTabChange('watch')
  }
  const stopWatching = () => {
    setWatchedMemberId(null)
    onTabChange('team')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{LABEL[tab]}</h2>
        <span
          role="status"
          className={`text-xs ${connected ? 'text-[var(--lc-ok)]' : 'text-destructive'}`}
        >
          {connected ? '● Live Collab' : '● Disconnected'}
        </span>
        {connected && state && (
          <span className="text-xs text-muted-foreground">
            {Object.values(state.members).filter((member) => member.online).length} online
          </span>
        )}
      </header>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
        {tabs.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onTabChange(item)}
            aria-current={tab === item ? 'page' : undefined}
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              tab === item
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            )}
          >
            {LABEL[item]}
          </button>
        ))}
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {tab === 'multiplayer' ? (
          // Why: fixed slots keep ShareFolderCard mounted (and its message) when sharing turns this app into Mission Control.
          <div className="space-y-3 p-4">
            {/* Teammates see it too: once the owner stops sharing, anyone can share the next folder. */}
            <ShareFolderCard
              connection={connection}
              folder={workspacePath}
              sharedCode={sharedCode}
              onConnectionChange={onConnectionChange}
              onShared={setSharedCode}
            />
            {connection?.role !== 'mc' && (
              <JoinWithCodeCard connection={connection} onConnectionChange={onConnectionChange} />
            )}
            {connection?.role === 'mc' && <InviteCodesCard key={inviteKey} />}
            {connectionFailure === 'access-rejected' && (
              <Button variant="link" size="xs" onClick={() => onTabChange('settings')}>
                The server rejected this app’s token. Check it in Settings
              </Button>
            )}
          </div>
        ) : tab === 'settings' ? (
          <div className="px-4 pt-3">
            {/* Why: teammates join with code + name + role in Multiplayer; server, workspace and tokens are for the owner. */}
            <RadarSettingsPane
              connection={connection}
              connected={connected}
              connectionFailure={connectionFailure}
              workspacePath={workspacePath}
              onConnectionChange={onConnectionChange}
            />
          </div>
        ) : !connection ? (
          <div className="m-4 space-y-3">
            <ShareFolderCard
              connection={connection}
              folder={workspacePath}
              sharedCode={sharedCode}
              onConnectionChange={onConnectionChange}
              onShared={(code) => {
                // Why: this view unmounts once connected; Multiplayer shows the copied code again.
                setSharedCode(code)
                onTabChange('multiplayer')
              }}
            />
            <JoinWithCodeCard connection={connection} onConnectionChange={onConnectionChange} />
            <Button variant="link" size="xs" onClick={() => onTabChange('settings')}>
              Workspace owner? Connect Mission Control in settings
            </Button>
          </div>
        ) : !connected || !state ? (
          <div className="m-4 rounded-lg border border-border bg-card p-4 text-sm">
            <p>
              {connected
                ? 'Waiting for workspace state from the server.'
                : connectionFailure === 'workspace-closed'
                  ? 'The owner stopped sharing this workspace. Join with a new code in Multiplayer.'
                  : connectionFailure === 'signed-out'
                    ? 'You signed in on another device, so this app was signed out.'
                    : connectionFailure === 'removed'
                      ? 'The owner removed you from this workspace. Join with a new code in Multiplayer.'
                      : 'Connection lost. The app keeps trying to reconnect.'}
            </p>
            <button
              type="button"
              onClick={() => onTabChange('multiplayer')}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Open Multiplayer
            </button>
          </div>
        ) : tab === 'tasks' ? (
          <TaskBoardView
            state={state}
            role={connection?.role ?? null}
            memberId={connection?.member ?? null}
          />
        ) : tab === 'mission' ? (
          <MissionControlView state={state} canDecide={connection?.role === 'mc'} now={now} />
        ) : tab === 'team' ? (
          <>
            {connection?.role === 'mc' && (
              <div className="p-4 pb-0">
                <InviteCodesCard key={inviteKey} />
              </div>
            )}
            <TeamPanel state={state} now={now} onWatch={watch} canRemove={connection?.role === 'mc'} />
          </>
        ) : tab === 'watch' ? (
          watchedMemberId ? (
            <WatchBobView state={state} memberId={watchedMemberId} onStopWatching={stopWatching} />
          ) : (
            <div className="m-4 rounded-lg border border-border bg-card p-4 text-sm">
              <p>Pick a teammate in Team to watch their Bob.</p>
              <button
                type="button"
                onClick={() => onTabChange('team')}
                className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs"
              >
                Open Team
              </button>
            </div>
          )
        ) : (
          <FilesLocksView state={state} now={now} />
        )}
      </div>
    </div>
  )
}
