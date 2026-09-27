import { useEffect, useState } from 'react'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import type { RadarJoinCode } from '../../../../shared/radar-join'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { useRadarStore } from '@/store/radar-store'
import { MissionControlView } from './MissionControlView'
import { TeamPanel } from './TeamPanel'
import { InviteCodesCard } from './InviteCodesCard'
import { JoinWithCodeCard } from './JoinWithCodeCard'
import { RadarSettingsPane } from './RadarSettingsPane'
import { ShareFolderCard } from './ShareFolderCard'
import { WatchBobView } from './WatchBobView'
import { TaskBoardView } from './TaskBoardView'
import type { RadarPanelTab } from './radar-panel-tab'

const TABS: RadarPanelTab[] = ['mission', 'tasks', 'team', 'multiplayer']

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
    mission: 'Overview',
    team: 'Team',
    multiplayer: 'Room',
    tasks: tasksLabel,
    settings: 'Room',
    watch: 'Watch Bob'
  }
  const [watchedMemberId, setWatchedMemberId] = useState<string | null>(null)
  const [ownerSeat, setOwnerSeat] = useState<string | null>(null)
  // Why: the owner (Mission Control) is also a coder; their own seat comes from the shared folder.
  useEffect(() => {
    let live = true
    if (connection?.role === 'mc') {
      void window.api.radar.mySeat().then((seat) => live && setOwnerSeat(seat), () => live && setOwnerSeat(null))
    }
    return () => {
      live = false
    }
  }, [connection?.role, connection?.workspace])
  const seatId = connection?.role === 'coder' ? connection.member : connection?.role === 'mc' ? ownerSeat : null
  const pm = state ? Object.values(state.members).find((member) => member.role === 'pm') : undefined
  // D-umar-10: the owner is normally the PM; Mission Control decides when its own seat is the PM, or when there is none.
  const canDecide = connection?.role === 'pm' || (connection?.role === 'mc' && (!pm || pm.id === seatId))
  const decideNote = pm ? `${pm.name} (PM) approves plans and reviews.` : 'Only the PM or the owner can decide.'
  const [sharedCode, setSharedCode] = useState<RadarJoinCode | null>(null)
  // Why: codes made for a folder this app no longer shares are dead; a new share starts an empty list.
  const inviteKey = `${connection?.workspace ?? ''}/${sharedCode?.code ?? ''}`
  const tabs: RadarPanelTab[] = watchedMemberId ? [...TABS, 'watch'] : TABS
  const barTab: RadarPanelTab = tab === 'settings' ? 'multiplayer' : tab

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
            aria-current={barTab === item ? 'page' : undefined}
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              barTab === item
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary'
            )}
          >
            {LABEL[item]}
          </button>
        ))}
      </div>
      <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto">
        {tab === 'multiplayer' || tab === 'settings' ? (
          // Why: fixed slots keep ShareFolderCard mounted (and its message) when sharing turns this app into Mission Control.
          <div className="mx-auto max-w-3xl space-y-3 p-4">
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
                The server rejected this app’s token. Check it under Connection details
              </Button>
            )}
            {/* Why: teammates join with code + name + role above; server, workspace and tokens are for the owner. */}
            <details
              key={tab}
              open={tab === 'settings'}
              className="rounded-lg border border-border bg-card"
            >
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                Connection details
                <span className="ml-2 text-xs font-normal text-muted-foreground">server, workspace, access token, privacy</span>
              </summary>
              <div className="border-t border-border px-1 pb-2">
                <RadarSettingsPane
                  connection={connection}
                  connected={connected}
                  connectionFailure={connectionFailure}
                  workspacePath={workspacePath}
                  onConnectionChange={onConnectionChange}
                />
              </div>
            </details>
          </div>
        ) : !connection ? (
          <div className="m-4 space-y-3">
            <ShareFolderCard
              connection={connection}
              folder={workspacePath}
              sharedCode={sharedCode}
              onConnectionChange={onConnectionChange}
              onShared={(code) => {
                // Why: this view unmounts once connected; Room shows the copied code again.
                setSharedCode(code)
                onTabChange('multiplayer')
              }}
            />
            <JoinWithCodeCard connection={connection} onConnectionChange={onConnectionChange} />
            <Button variant="link" size="xs" onClick={() => onTabChange('settings')}>
              Workspace owner? Open connection details
            </Button>
          </div>
        ) : !connected || !state ? (
          <div className="m-4 rounded-lg border border-border bg-card p-4 text-sm">
            <p>
              {connected
                ? 'Waiting for workspace state from the server.'
                : connectionFailure === 'workspace-closed'
                  ? 'The owner stopped sharing this workspace. Join with a new code in Room.'
                  : connectionFailure === 'signed-out'
                    ? 'You signed in on another device, so this app was signed out.'
                    : connectionFailure === 'removed'
                      ? 'The owner removed you from this workspace. Join with a new code in Room.'
                      : 'Connection lost. The app keeps trying to reconnect.'}
            </p>
            <button
              type="button"
              onClick={() => onTabChange('multiplayer')}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Open Room
            </button>
          </div>
        ) : tab === 'tasks' ? (
          <TaskBoardView state={state} role={connection?.role ?? null} seatId={seatId} />
        ) : tab === 'team' ? (
          <TeamPanel state={state} now={now} onWatch={watch} onOpenTasks={() => onTabChange('tasks')} canRemove={connection?.role === 'mc'} />
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
          <MissionControlView state={state} canDecide={canDecide} readOnlyNote={decideNote} now={now} onOpenTasks={() => onTabChange('tasks')} />
        )}
      </div>
    </div>
  )
}
