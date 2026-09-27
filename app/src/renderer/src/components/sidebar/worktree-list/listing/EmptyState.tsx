import React from 'react'
import { CircleX, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'

export function SidebarWorktreeListEmptyState({
  hasFilters,
  onClearFilters
}: {
  hasFilters: boolean
  onClearFilters: () => void
}): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  return (
    <div
      data-worktree-sidebar-container
      data-contextual-tour-target="workspace-list"
      className="relative min-h-0 flex-1"
    >
      <div className="worktree-sidebar-scrollbar flex h-full flex-col overflow-y-auto overflow-x-hidden pl-1 scrollbar-sleek pt-px">
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-[11px] text-muted-foreground">
          <span>
            {translate('auto.components.sidebar.WorktreeList.b7acbf038b', 'No workspaces found')}
          </span>
          {/* Live Collab: Room shares the folder open here, so point at the one action that adds it. */}
          {!hasFilters && (
            <>
              <span>Add a project folder, then share it with your team in Live Collab → Room.</span>
              <Button
                variant="secondary"
                size="xs"
                onClick={() => openModal('add-repo')}
                className="gap-1.5 border border-border/80 text-[11px]"
              >
                <FolderPlus className="size-3.5" />
                Add project
              </Button>
            </>
          )}
          {hasFilters && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onClearFilters}
              className="gap-1.5 border border-border/80 text-[11px]"
            >
              <CircleX className="size-3.5" />
              {translate('auto.components.sidebar.WorktreeList.370c6a55dd', 'Clear Filters')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
