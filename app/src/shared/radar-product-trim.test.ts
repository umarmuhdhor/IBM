import { describe, expect, it } from 'vitest'
import {
  RADAR_AUTO_UPDATE_DISABLED,
  RADAR_HIDDEN_SETTINGS_PANES,
  RADAR_HIDDEN_SURFACES
} from './radar-product-trim'

describe('Live Collab product trim', () => {
  it('hides the Orca sidebar entries that Live Collab does not use', () => {
    expect(RADAR_HIDDEN_SURFACES.tasksSidebarButton).toBe(true)
    expect(RADAR_HIDDEN_SURFACES.automationsSidebarButton).toBe(true)
    expect(RADAR_HIDDEN_SURFACES.mobileSidebarButton).toBe(true)
  })

  it('never checks the upstream Orca release feed', () => {
    expect(RADAR_AUTO_UPDATE_DISABLED).toBe(true)
  })

  it('hides Orca-only settings panes', () => {
    for (const id of ['mobile', 'orca-account', 'automations', 'setup-guide']) {
      expect(RADAR_HIDDEN_SETTINGS_PANES.has(id)).toBe(true)
    }
  })
})
