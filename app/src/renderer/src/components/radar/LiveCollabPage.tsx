import { useMobilePageEscape } from '@/components/mobile/use-mobile-page-escape'
import { RadarPanel } from './RadarPanel'
import { closeLiveCollabPage, useLiveCollabPageStore } from './live-collab-page-store'

/** Full-page Live Collab view (activeView 'live-collab'), opened from the sidebar like Orca Mobile. */
export default function LiveCollabPage(): React.JSX.Element {
  const tab = useLiveCollabPageStore((store) => store.tab)
  const connection = useLiveCollabPageStore((store) => store.connection)
  const setTab = useLiveCollabPageStore((store) => store.setTab)
  const setConnection = useLiveCollabPageStore((store) => store.setConnection)
  // Why: same Esc contract as the Mobile/Tasks pages (blur a field first, then close).
  useMobilePageEscape(closeLiveCollabPage)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RadarPanel
        tab={tab}
        connection={connection}
        onConnectionChange={setConnection}
        onTabChange={setTab}
      />
    </div>
  )
}
