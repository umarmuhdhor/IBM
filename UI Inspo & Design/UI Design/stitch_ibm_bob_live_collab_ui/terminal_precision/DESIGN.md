---
name: Terminal Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c3c6d8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8c90a2'
  outline-variant: '#424656'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002979'
  primary-container: '#0f62fe'
  on-primary-container: '#f3f3ff'
  inverse-primary: '#0052dd'
  secondary: '#ffb0cd'
  on-secondary: '#64003a'
  secondary-container: '#871c54'
  on-secondary-container: '#ff99c2'
  tertiary: '#64de81'
  on-tertiary: '#003915'
  tertiary-container: '#008139'
  on-tertiary-container: '#d5ffd5'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174c'
  on-primary-fixed-variant: '#003da9'
  secondary-fixed: '#ffd9e5'
  secondary-fixed-dim: '#ffb0cd'
  on-secondary-fixed: '#3e0022'
  on-secondary-fixed-variant: '#841a51'
  tertiary-fixed: '#81fb9a'
  tertiary-fixed-dim: '#64de81'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005322'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 1rem
    fontWeight: '600'
    lineHeight: 1.5rem
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.45rem
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.35rem
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.2rem
  label-code:
    fontFamily: Space Mono
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.125rem
  label-agent:
    fontFamily: Space Mono
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
    letterSpacing: 0.04em
  label-meta:
    fontFamily: IBM Plex Sans
    fontSize: 0.75rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

This design system defines an ultra-focused desktop developer environment built for real-time collaboration. Inspired by the quiet rigor of Amoeba and the kinetic efficiency of Linear, the aesthetic is deeply calm, ruthlessly minimal, and utilitarian. 

It strips away all visual fluff: no blurred glass, no gradients, and zero drop shadows. Instead, it relies on strict structural framing, high typographic legibility, near-black negative space, and crisp 1px hairline rules to partition tasks, code streams, and team activities. The atmosphere is that of an engineered instrument—unobtrusive during flow states, yet razor-sharp when human intervention is demanded.

## Colors

The palette is strictly calibrated for dark-mode developer environments to prevent ocular fatigue over long working sessions while maintaining distinct situational hierarchy.

### Canvas & Structural Surfaces
- **Canvas Base (`#0E0E10`):** Root background offering deep, non-reflective negative space.
- **Panel Surface (`#161616`):** Docked sidebars, terminal shells, header bars, and split-view columns.
- **Card / Module Surface (`#1E1E20`):** Actionable containers, thread blocks, file item hovers, and floating inspector panes.
- **Hairline Border (`#2A2A2D`):** Universal 1px structural separator for all panels, inputs, and components.

### Typography
- **Primary Text (`#F4F4F4`):** High contrast, primary reads, active titles, and selected state labels.
- **Muted Text (`#A8A8A8`):** Unfocused labels, file paths, metadata, timestamps, and placeholder states.

### Signals & Actions
- **Primary Action (`#0F62FE`):** IBM Blue reserved exclusively for committed interactive triggers, primary CTA buttons, and focused active rings.
- **Attention Accent (`#FF7EB6`):** Vibrant magenta reserved solely for the "Needs you" attention cue, rendered as a dedicated left hairline border on urgent threads or approval blocks.
- **Status Green (`#42BE65`):** Passing builds, operational agents, connected states.
- **Status Yellow (`#F1C21B`):** Diff warnings, pending merges, review blocks.
- **Status Red (`#FA4D56`):** Test failures, fatal exceptions, disconnected sockets.

### Team Collab Colors
Individual team members are assigned dedicated identity colors for presence cursors, avatars, and agent delegation chips:
- **Andi:** Blue (`#78A9FF`)
- **Budi:** Purple (`#BE95FF`)
- **Citra:** Orange (`#FF832B`)

## Typography

Typography is split strictly into two functional domains:
1. **IBM Plex Sans:** The primary UI typeface used for navigation, views, modal dialogues, and human conversation threads. It maintains objective clarity and balance at compact sizes.
2. **Space Mono (acting as IBM Plex Mono equivalent):** Dedicated to technical artifacts—file paths, code snippets, git hashes, keybindings, line numbers, and collaborative agent badges.

### Micro Scale Rules
- Maintain dense hierarchy: UI labels hover between `11px` and `14px` (`body-sm` to `body-md`) to ensure rich data density typical of pro-grade desktop IDEs.
- Monospace tokens are strictly uppercase for status/agent tags (`label-agent`) and lowercase for path/stack strings.

## Layout & Spacing

The layout model is anchored strictly to an absolute **4px base unit**. All padding, margin, row height, and column configurations must be multiples of 4px.

### Workbench Layout
- **Multi-Pane Modular Split:** The screen layout relies on full-bleed docking windows (Collapsible Side Dock: 260px fixed width; Main Workspace: dynamic flex 1; Inspector / Live Agent Stream: 320px fixed width).
- **Separation:** No ambient gaps or margins between docked workbenches. Pane borders are constructed exclusively with contiguous `1px solid #2A2A2D` hairline edges.
- **Canvas Viewports:** Floating cards or modal dialogs within canvas space utilize `space-lg` (16px) margins and `space-md` (12px) internal content gutters.

## Elevation & Depth

This system operates without simulated lighting. **Drop shadows, blur filters, and gradients are banned.** Depth and spatial hierarchy are constructed purely through tonal stratification and hairlines.

### Spatial Strata
- **Base Level (Canvas):** `#0E0E10` — The lowest structural plane.
- **Dock Level (Sidebars / Tab Strips):** `#161616` bounded by 1px `#2A2A2D` dividers.
- **Component Level (Cards / Rows):** `#1E1E20` resting flat against `#161616` or `#0E0E10`.
- **Flyout Level (Menus / Tooltips):** `#1E1E20` framed by a sharper 1px border (`#2A2A2D`), completely shadowless.

### "Needs You" Accent Elevation
Visual priority does not lift upward on the Z-axis; it marks sideways. When an item requires user confirmation or collaborator handoff, it gains a crisp `border-left: 2px solid #FF7EB6` while remaining coplanar.

## Shapes

The interface is sharp and disciplined (`roundedness: 1`). 

- Standard panels, panes, and input fields use a tight `4px` (`0.25rem`) border radius, preserving compact, industrial alignments.
- Floating popovers and elevated dialogs use a maximum radius of `8px` (`0.5rem`).
- Only collaborative identity chips and agent pills deviate into fully rounded pill structures to clearly distinguish human/agent tokens from square UI controls.

## Components

### Buttons
- **Primary:** Background `#0F62FE`, color `#F4F4F4`, border none, 4px border radius. Hover state transitions to `#0353E9`. Active state `#002D9C`.
- **Secondary / Ghost:** Background `transparent`, color `#F4F4F4`, border `1px solid #2A2A2D`. Hover triggers background `#1E1E20` with border `#3A3A3E`.
- **Height / Padding:** Standard 32px height, horizontal padding 12px, font size 13px.

### Agent & Collab Tags (Pills)
- Rendered in uppercase `Space Mono` (`label-agent`, 11px) inside a pill-radius container.
- **Color Structure:** Dynamic 18% opacity tint of the member/agent color for background, 100% solid member/agent color for border and text.
  - *Andi Agent:* Background `rgba(120, 169, 255, 0.18)`, border `1px solid #78A9FF`, text `#78A9FF`.
  - *Budi Agent:* Background `rgba(190, 149, 255, 0.18)`, border `1px solid #BE95FF`, text `#BE95FF`.
  - *Citra Agent:* Background `rgba(255, 131, 43, 0.18)`, border `1px solid #FF832B`, text `#FF832B`.

### Cards & Activity Rows
- Background `#1E1E20`, border `1px solid #2A2A2D`, corner radius 4px.
- **Attention State ("Needs You"):** Retains base card styles but overrides the left border to `2px solid #FF7EB6`.

### Input Fields & Terminal Prompts
- Background `#161616`, border `1px solid #2A2A2D`, text `#F4F4F4`, placeholder `#A8A8A8`. 
- Focus state switches border strictly to `1px solid #0F62FE` without outer glow rings. Font mapped to `IBM Plex Sans` for chat/inputs, or `Space Mono` for console entries.

### Checkboxes & Radios
- Size: 14px x 14px. Hairline border `1px solid #2A2A2D`, background `#161616`.
- Checked state: Background `#0F62FE`, border `#0F62FE`, rendering a 1px crisp white geometric check or square center.

### Icons
- 16px geometric icons (Lucide standard), 1.5px stroke weight, neutral `#A8A8A8` default fill-none, highlighting to `#F4F4F4` on interactive hover.