import { AgentTag, MemberChip } from '@radar/ui'
import type { RadarState } from '@radar/ui'
import { useAppStore } from '@/store'
import { openWorktreePath } from '@/components/sidebar/WorktreeOpenInMenu'

export function TeamPanel({ state }: { state: RadarState }) {
  const activeWorktreeId = useAppStore((store) => store.activeWorktreeId)
  const getKnownWorktreeById = useAppStore((store) => store.getKnownWorktreeById)
  const activeWorktree = activeWorktreeId ? getKnownWorktreeById(activeWorktreeId) : null
  return (
    <section aria-label="Team" className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Team</h3>
      <button type="button" disabled={!activeWorktree} onClick={() => { if (activeWorktree) { void openWorktreePath({ target: 'external-editor', worktreePath: activeWorktree.path, command: 'open -a "IBM Bob"' }) } }} className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50">Open in Bob IDE</button>
      {Object.values(state.members).map((member) => {
        const activity = state.bobActivity[member.id]?.[0]
        const status = member.online ? member.stale ? 'stale' : 'online' : 'offline'
        return (
          <article key={member.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <MemberChip member={member.id} initials={member.name.charAt(0)} status={status} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{member.name}</div>
              <div className="text-xs text-muted-foreground">{status} · {member.activeTaskId ?? 'No active task'}</div>
            </div>
            {activity && <AgentTag member={member.id} label={`${member.name} · Bob ${activity.mode || 'coder'}`} status={member.blocked ? 'blocked' : activity.kind === 'tool.pre' ? 'writing' : 'idle'} />}
          </article>
        )
      })}
      {Object.keys(state.members).length === 0 && <p className="text-xs text-muted-foreground">No members yet.</p>}
    </section>
  )
}
