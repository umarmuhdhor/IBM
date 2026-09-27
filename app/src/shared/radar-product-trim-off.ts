import type { RadarHiddenSurface } from './radar-product-trim'

// Why: tests for upstream Orca behavior mock radar-product-trim with this module so every surface stays visible.
export const RADAR_HIDDEN_SURFACES: Readonly<Record<RadarHiddenSurface, boolean>> = {
  tasksSidebarButton: false,
  automationsSidebarButton: false,
  mobileSidebarButton: false,
  setupGuideSidebarEntry: false,
  starNag: false,
  featureWall: false,
  featureTips: false,
  contextualTours: false,
  pet: false,
  caffeinateStatus: false,
  providerAccountSwitchers: false,
  appIconPicker: false,
  sidebarSearch: false,
  activityViewButton: false,
  workspaceOptionsButton: false,
  newWorkspaceButton: false,
  workspaceBoardButton: false,
  revealWorkspaceButton: false,
  usageMeters: false,
  resourceUsageStatus: false,
  portsStatus: false
}
export const RADAR_AUTO_UPDATE_DISABLED: boolean = false
export const RADAR_HIDDEN_SETTINGS_PANES: ReadonlySet<string> = new Set()
export function radarUnlessHidden<T>(_surface: RadarHiddenSurface, item: T): T[] {
  return [item]
}
