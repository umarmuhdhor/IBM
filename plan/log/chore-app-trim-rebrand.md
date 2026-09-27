# chore: hide unused Orca features, rename the app to Live Collab (27 Sep 2026)

Branch `chore/app-trim-rebrand` → PR to `main`. Decision record: `DECISIONS.md` D-alief-22.

## Why

Live Collab ships on vendored Orca. The app still showed Orca product surfaces that have nothing to do with the demo (Orca Mobile, Tasks, Automations, star prompts, tours, the pet, Orca account settings), and the auto-updater pointed at `stablyai/orca`, so an update would have replaced Live Collab with upstream Orca.

## What changed

- New `app/src/shared/radar-product-trim.ts`: one place that lists every hidden surface, the hidden settings panes and the auto-update switch. Code is hidden, not deleted, so the vendored tree stays close to upstream.
- Hidden: Tasks, Automations and Orca Mobile sidebar entries (and their Appearance toggles and View menu items), the setup guide (sidebar entry, Settings row, Help menu item), star nag, feature wall, feature tips, contextual tours, pet, caffeinate status segment, Claude/Codex account switchers, app icon picker.
- Hidden settings panes: Mobile, Mobile Emulator, Orca Account, Voice, Computer Use, Share Skills, Artifacts, Automations, Onboarding checklist.
- Auto-update off: no updater setup, no "Check for Updates" menu item, `updater:check` / `updater:download` do nothing.
- Rename: product name, titlebar, window titles, landing and dev dock titles say "Live Collab". The dev Keychain name and dev userData folder keep `IBM Bob Live Collab Dev` so existing dev secrets stay readable.
- New logo: hub mark (`LiveCollabMark`, inline SVG, `currentColor`) replaces the Bob mascot in the sidebar and on the landing; new app icons (`.icns`, `.ico`, `.png`) and README lockups.
- README: new name and lockup, plus a "Step by step in IBM Bob" section (Open in IBM Bob, Trust, switch mode, prompts, what to watch in the app).
- Upstream tests that assert Orca defaults mock the trim file with `radar-product-trim-off.ts` (every surface visible), so they keep testing Orca behavior.

## Verification

See the PR for command output. Dev app via CDP (`ORCA_BACKGROUND_LAUNCH=1 pnpm -C app dev`, port 9532): the sidebar shows Search and Live Collab only; Settings shows no Mobile, Orca Account, Voice, Computer Use, Share Skills, Artifacts, Automations or Onboarding checklist; Appearance shows no Show Tasks / Show Automations / Orca Mobile toggles and no app icon picker; titlebar reads "Live Collab" in light and dark.

## UI gate (better-interface)

Scope: left sidebar (Live Collab button icon), titlebar text, Settings sidebar, Appearance pane, landing mark and heading. Stack: React + Tailwind, Orca tokens (`app/src/renderer/src/assets/main.css`), shadcn primitives. Docs read: `app/AGENTS.md`, `app/docs/STYLEGUIDE.md`, `DESIGN.md`. All six domain skills loaded.

| Domain | Evidence | Result |
|---|---|---|
| Accessibility | DOM: sidebar mark `<svg aria-hidden="true">` inside `button` named "Live Collab"; `aria-current="page"` when open; landing mark `aria-hidden` next to the `h1` | Clear |
| Layout | Screenshots 1512 wide, light and dark: sidebar rows keep the Orca row height and edges; no gaps left where hidden rows were | Clear |
| Writing | "Live Collab" everywhere in titlebar, sidebar, page, status bar | Clear |
| Typography | No type changes; the h1 keeps `text-4xl font-bold` | Clear |
| Colors | The mark uses `currentColor`; white on the dark sidebar, black on light | Clear |
| UI | The icon follows the "one SVG, recolored per state" rule; see the LOW finding | 1 LOW (fixed) |

| Severity | Domain | Location | Before | After | Why |
|---|---|---|---|---|---|
| LOW | UI | `app/src/renderer/src/components/radar/LiveCollabSidebarButton.tsx:25` | `<LiveCollabMark className={cn('size-4', !active && 'opacity-60')} />` | `<LiveCollabMark className="size-4" />` | The mark already inherits the row's dimmed `currentColor`; the extra opacity dimmed it twice (about 36%), so it looked lighter than its label. Fixed by deletion. |

Not verified: the landing screen (the dev profile already has a project, so the landing does not show; covered by `LiveCollabMark.test.tsx`), 200% zoom. Verdict: **Approve**.
