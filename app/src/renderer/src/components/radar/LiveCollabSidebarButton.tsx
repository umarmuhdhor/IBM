import bobLogoUrl from '../../../../../resources/app-icons/bob-live-collab.png?url'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { useRadarStore } from '@/store/radar-store'
import { getRadarViewModel } from './radar-view-model'
import { toggleLiveCollabPage } from './live-collab-page-store'

/** One sidebar entry under Orca Mobile; the Live Collab page's own tab bar is the only section nav. */
export function LiveCollabSidebarButton(): React.JSX.Element {
  const active = useAppStore((s) => s.activeView === 'live-collab')
  const needsYou = useRadarStore((s) => (s.state ? getRadarViewModel(s.state).needsYou : 0))

  return (
    <button
      type="button"
      onClick={toggleLiveCollabPage}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium tracking-tight transition-colors',
        active
          ? 'bg-worktree-sidebar-accent text-worktree-sidebar-accent-foreground'
          : 'text-worktree-sidebar-foreground/60 hover:bg-worktree-sidebar-foreground/8'
      )}
    >
      <img
        src={bobLogoUrl}
        alt=""
        className={cn('size-4 shrink-0 object-contain', !active && 'opacity-60')}
        draggable={false}
      />
      <span className="min-w-0 flex-1 truncate">Live Collab</span>
      {needsYou > 0 ? (
        <span
          aria-label={`${needsYou} needs you`}
          className="shrink-0 rounded-full bg-[var(--lc-needs-you)] px-1.5 py-px text-[10px] font-semibold text-black"
        >
          {needsYou}
        </span>
      ) : null}
    </button>
  )
}
