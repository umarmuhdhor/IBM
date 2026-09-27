# fix: one Live Collab entry in the sidebar, opened as a full page (27 Sep 2026)

Branch `fix/app-live-collab-nav` → PR to `main`.

## Why

The sidebar had a "LIVE COLLAB" section with six items (Multiplayer, Tasks, Mission Control, Team, Files & locks, Settings). The panel it opened already has the same six tabs at the top, so the navigation was shown twice. The panel was also a sheet that floated over the editor and terminal.

## Decisions (agreed with Alief)

| # | Decision |
|---|---|
| Q1 | The button opens the last tab used; Multiplayer on first open. |
| Q2 | The "needs you" count moves onto the Live Collab button. |
| Q3 | The button is highlighted while the page is open; a second click goes back. |
| Q4 | The button is not hideable (core demo feature). |
| Q5 | Label "Live Collab" with the Bob Live Collab mark as its icon. |
| Q7 | Live Collab is a full page (`activeView: 'live-collab'`), like Orca Mobile, instead of an overlay. Esc also goes back. |
| Q8 | The last tab is remembered for the session only. |

## What changed

- New: `components/radar/LiveCollabSidebarButton.tsx`, `LiveCollabPage.tsx`, `live-collab-page-store.ts` (tab, connection, previous view, open/close/toggle).
- `use-radar-session.ts` stores the connection in the page store; the sidebar still owns the subscription.
- Removed `RadarSidebarSection.tsx` (+ test) and the sheet from `sidebar/index.tsx` (now vendored Orca plus one hook line).
- One-line Orca hooks: `SidebarNav.tsx` (button after Orca Mobile), `AppWorkspaceShell.tsx` (page), `'live-collab'` in `TopLevelView`, `UiViewHistory`, `TopLevelViewSchema`, `isTopLevelView` lookup and the right-sidebar suppressed views.

## Verification

- `pnpm -C app tc`: pass.
- Vitest (radar, Sidebar, SidebarNav, top-level-view, right-sidebar-visibility, ui hydration): 173/173 pass; new `LiveCollabSidebarButton.test.tsx` 3/3.
- `pnpm -C app run check:code-quality:changed`: pass.
- Dev app via CDP (`ORCA_BACKGROUND_LAUNCH=1`, port 9339): the sidebar shows a single Live Collab row under Orca Mobile; a click opens the full page with its tab bar (no overlap with the editor); Esc returns to the workspace with Terminal and `01-radar.md` tabs intact.

## UI gate (better-interface)

Scope: sidebar Live Collab button and the Live Collab page shell (the tab contents did not change).

| Domain | Evidence | Result |
|---|---|---|
| Accessibility | AX tree: `button "Live Collab"`, `aria-current="page"` when open, Esc closes, focus ring visible after keyboard use | 1 LOW (fixed) |
| Layout | Screenshot: same row height, padding and edges as Orca Mobile | Clear |
| Writing | "Live Collab" matches the page header and status bar | Clear |
| Typography | 13px medium, same as the Orca nav rows | Clear |
| Colors | Orca sidebar tokens; badge uses `--lc-needs-you` with a number (not color alone) | Clear |
| UI | Brand mark as icon is a deliberate choice (Q5); no motion added | Clear |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| LOW | Accessibility | `components/radar/LiveCollabSidebarButton.tsx:27` | `<img alt="" aria-hidden="true">` | `<img alt="">` | `alt=""` already hides a decorative image; the extra ARIA was redundant. Fixed. |

Not verified: 200% zoom and narrow-window reflow of the page (desktop app, sidebar min width 220px). Verdict: **Approve**.
