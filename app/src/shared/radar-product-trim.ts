// Why: Live Collab ships on vendored Orca. Orca's own product surfaces (mobile pairing,
// scheduled automations, upstream auto-update, star prompts, tours, pet) are hidden
// here instead of deleted, so the vendored code stays close to upstream.
// Also hidden: sidebar and status-bar controls for Orca worktrees, agent usage meters and
// resource/port monitors, which Live Collab does not use (fase 15g).
export type RadarHiddenSurface =
  | 'tasksSidebarButton'
  | 'automationsSidebarButton'
  | 'mobileSidebarButton'
  | 'setupGuideSidebarEntry'
  | 'starNag'
  | 'featureWall'
  | 'featureTips'
  | 'contextualTours'
  | 'pet'
  | 'caffeinateStatus'
  | 'providerAccountSwitchers'
  | 'appIconPicker'
  | 'sidebarSearch'
  | 'activityViewButton'
  | 'workspaceOptionsButton'
  | 'newWorkspaceButton'
  | 'workspaceBoardButton'
  | 'revealWorkspaceButton'
  | 'usageMeters'
  | 'resourceUsageStatus'
  | 'portsStatus'

export const RADAR_HIDDEN_SURFACES: Readonly<Record<RadarHiddenSurface, boolean>> = {
  tasksSidebarButton: true,
  automationsSidebarButton: true,
  mobileSidebarButton: true,
  setupGuideSidebarEntry: true,
  starNag: true,
  featureWall: true,
  featureTips: true,
  contextualTours: true,
  pet: true,
  caffeinateStatus: true,
  providerAccountSwitchers: true,
  appIconPicker: true,
  sidebarSearch: true,
  activityViewButton: true,
  workspaceOptionsButton: true,
  newWorkspaceButton: true,
  workspaceBoardButton: true,
  revealWorkspaceButton: true,
  usageMeters: true,
  resourceUsageStatus: true,
  portsStatus: true
}

// Why: electron-builder's publish feed and the updater feed URL both point to
// stablyai/orca, so an update would replace Live Collab with upstream Orca.
export const RADAR_AUTO_UPDATE_DISABLED: boolean = true

export const RADAR_HIDDEN_SETTINGS_PANES: ReadonlySet<string> = new Set([
  'mobile',
  'mobile-emulator',
  'orca-account',
  'voice',
  'computer-use',
  'share-skills',
  'artifacts',
  'automations',
  'setup-guide'
])

/** Spread helper for menu/list builders: `...radarUnlessHidden('pet', item)`. */
export function radarUnlessHidden<T>(surface: RadarHiddenSurface, item: T): T[] {
  return RADAR_HIDDEN_SURFACES[surface] ? [] : [item]
}
