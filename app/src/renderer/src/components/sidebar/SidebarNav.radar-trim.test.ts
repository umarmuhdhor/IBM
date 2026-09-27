import { describe, expect, it } from 'vitest'
import { shouldShowAutomationsButton, shouldShowMobileButton } from './SidebarNav'
import { buildSettingsNavigationMetadata } from '@/hooks/useSettingsNavigationMetadata'

describe('SidebarNav with the Live Collab trim', () => {
  it('hides Orca Mobile and Automations even when settings say show', () => {
    expect(shouldShowMobileButton({ showMobileButton: true })).toBe(false)
    expect(shouldShowAutomationsButton({ showAutomationsButton: true })).toBe(false)
  })

  it('drops Orca-only panes from the settings navigation', () => {
    const ids = buildSettingsNavigationMetadata({
      isMac: true,
      isWindows: false,
      isWebClient: false,
      repos: []
    }).map((section) => section.id)
    expect(ids).not.toContain('mobile')
    expect(ids).not.toContain('orca-account')
    expect(ids).toContain('general')
  })
})
