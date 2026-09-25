import { LayoutDashboard, Users, Files, Settings2 } from 'lucide-react'
import type { RadarPanelTab } from './radar-panel-tab'

type Props = {
  needsYou: number
  onOpen: (tab: RadarPanelTab) => void
}

const ITEMS = [
  { tab: 'mission', label: 'Mission Control', icon: LayoutDashboard },
  { tab: 'team', label: 'Team', icon: Users },
  { tab: 'files', label: 'Files & locks', icon: Files },
  { tab: 'settings', label: 'Settings', icon: Settings2 }
] as const

export function RadarSidebarSection({ needsYou, onOpen }: Props) {
  return (
    <nav aria-label="Live Collab" className="border-b border-worktree-sidebar-border px-2 py-2">
      <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-worktree-sidebar-foreground/50">LIVE COLLAB</div>
      {ITEMS.map(({ tab, label, icon: Icon }) => (
        <button key={tab} type="button" onClick={() => onOpen(tab)} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-worktree-sidebar-foreground/70 hover:bg-worktree-sidebar-foreground/8">
          <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {tab === 'mission' && needsYou > 0 && <span aria-label={`${needsYou} needs you`} className="rounded-full bg-[var(--lc-needs-you)] px-1.5 text-[10px] text-black">{needsYou}</span>}
        </button>
      ))}
    </nav>
  )
}
