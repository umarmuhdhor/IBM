import type { RadarState } from '@radar/ui'

export function NotificationsPanel({ state }: { state: RadarState }) {
  const notifications = state.feed.filter((item) => item.type === 'lock.blocked' || item.type === 'file.rejected' || item.type === 'proposal.created').slice(0, 10)
  return (
    <section aria-label="Notifications" className="space-y-2">
      <h3 className="text-sm font-semibold">Notifications</h3>
      {notifications.length === 0 ? <p className="text-xs text-muted-foreground">No recent alerts.</p> : notifications.map((item) => (
        <div key={item.id} className="rounded-md border border-border bg-card px-3 py-2 text-xs">
          <span className={item.type === 'lock.blocked' || item.type === 'file.rejected' ? 'text-destructive' : 'text-[var(--lc-needs-you)]'} aria-hidden="true">● </span>{item.text}
        </div>
      ))}
    </section>
  )
}
