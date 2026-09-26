import { useState } from 'react'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
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
import { WatchBobView } from './WatchBobView'
import type { RadarPanelTab } from './radar-panel-tab'

const LABEL: Record<RadarPanelTab, string> = {
  mission: 'Mission Control',
  team: 'Team',
  files: 'Files & locks',
  settings: 'Settings',
  watch: 'Watch Bob'
}
const TABS: RadarPanelTab[] = ['mission', 'team', 'files', 'settings']

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
  const [watchedMemberId, setWatchedMemberId] = useState<string | null>(null)
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
        {tab === 'settings' ? (
          <>
            <div className="space-y-3 p-4 pb-0">
              {connection?.role === 'mc' ? (
                <InviteCodesCard />
              ) : (
                <JoinWithCodeCard connection={connection} onConnectionChange={onConnectionChange} />
              )}
            </div>
            <RadarSettingsPane
              connection={connection}
              connected={connected}
              connectionFailure={connectionFailure}
              workspacePath={workspacePath}
              onConnectionChange={onConnectionChange}
            />
          </>
        ) : !connection ? (
          <div className="m-4 space-y-3">
            <JoinWithCodeCard connection={connection} onConnectionChange={onConnectionChange} />
            <Button variant="link" size="xs" onClick={() => onTabChange('settings')}>
              Workspace owner? Connect Mission Control in settings
            </Button>
          </div>
        ) : !connected || !state ? (
          <div className="m-4 rounded-lg border border-border bg-card p-4 text-sm">
            <p>
              {connection
                ? connected
                  ? 'Waiting for workspace state from the server.'
                  : 'Connection lost. Open settings to reconnect.'
                : 'Connect to a Live Collab workspace.'}
            </p>
            <button
              type="button"
              onClick={() => onTabChange('settings')}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Open settings
            </button>
          </div>
        ) : tab === 'mission' ? (
          <MissionControlView state={state} canDecide={connection?.role === 'mc'} />
        ) : tab === 'team' ? (
          <>
            {connection?.role === 'mc' && (
              <div className="p-4 pb-0">
                <InviteCodesCard />
              </div>
            )}
            <TeamPanel state={state} now={now} onWatch={watch} />
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
