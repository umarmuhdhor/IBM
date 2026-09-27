import { create } from 'zustand'
import type { RadarConnectionSummary } from '../../../../shared/radar-connection'
import type { TopLevelView } from '../../../../shared/ui-chrome-types'
import { useAppStore } from '@/store'
import type { RadarPanelTab } from './radar-panel-tab'

type PreviousView = Exclude<TopLevelView, 'live-collab'>

type LiveCollabPageStore = {
  /** Last tab used; session memory only, so a fresh launch opens Multiplayer. */
  tab: RadarPanelTab
  connection: RadarConnectionSummary | null
  previousView: PreviousView
  setTab: (tab: RadarPanelTab) => void
  setConnection: (connection: RadarConnectionSummary | null) => void
}

export const useLiveCollabPageStore = create<LiveCollabPageStore>()((set) => ({
  tab: 'multiplayer',
  connection: null,
  previousView: 'terminal',
  setTab: (tab) => set({ tab }),
  setConnection: (connection) => set({ connection })
}))

// Why: mirrors openMobilePage/closeMobilePage, kept here so the Orca ui slice only gains the view name.
export function openLiveCollabPage(): void {
  const { activeView, setActiveView } = useAppStore.getState()
  if (activeView === 'live-collab') {
    return
  }
  useLiveCollabPageStore.setState({ previousView: activeView })
  setActiveView('live-collab')
}

export function closeLiveCollabPage(): void {
  const { activeView, setActiveView } = useAppStore.getState()
  if (activeView === 'live-collab') {
    setActiveView(useLiveCollabPageStore.getState().previousView)
  }
}

export function toggleLiveCollabPage(): void {
  if (useAppStore.getState().activeView === 'live-collab') {
    closeLiveCollabPage()
  } else {
    openLiveCollabPage()
  }
}
