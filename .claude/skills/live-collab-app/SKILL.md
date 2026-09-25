---
name: live-collab-app
description: Rules and commands for working on the IBM Bob Live Collab desktop app (the vendored Orca Electron app in app/) and its shared UI. Use whenever a task touches app/src/**, radar/packages/ui, the Live Collab sidebar/Mission Control/Team/Watch terminal views, the IBM Bob agent registration, or packaging the .app/.dmg.
---

# Working on the Live Collab desktop app (Orca fork in `app/`)

## Ground rules
1. `app/` is a vendored copy of stablyai/orca @ bf40d35 (MIT). Read `app/AGENTS.md` and `app/CLAUDE.md` first and follow them.
2. **Additive changes only.** New code goes in `app/src/renderer/src/components/radar/`, `app/src/renderer/src/lib/radar/`, `app/src/renderer/src/store/radar-store.ts`, `app/src/main/radar/`. Touch existing Orca files only with one-line hooks (import + render, registry entries). Never modify the pty daemon, `cloud/`, `mobile/`, or relay code.
3. **Look & feel = Orca first.** Reuse Orca's existing shadcn/Radix components, Tailwind tokens, icons (lucide) and layout patterns (look at the sidebar, Agent Dashboard and Workspace board code). Live Collab only adds: person colors (A #78A9FF, B #BE95FF, C #FF832B), the "Needs you" magenta accent (#FF7EB6), status colors, and the `BobTrace` mono line. Stitch mockups in `UI Inspo & Design/UI Design/` are **mood/layout guidelines only** — do not copy their invented numbers or serif fonts.
4. File names must not contain `token`, `secret`, `password`, `credentials` and must not be `config.json` (IBM template .gitignore silently ignores them).
5. Tokens live only in the main process (`safeStorage`). Never log them in the renderer.

## Toolchain
Orca needs **Node 24 + pnpm 12** (`app/package.json` engines/packageManager). The `radar/` workspace works on Node 20+.
```bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24
pnpm -C app install
pnpm -C app dev            # run the app
pnpm -C app tc             # typecheck (run after every change)
pnpm -C app exec oxlint <changed files>   # do NOT run the full `pnpm lint` (very slow ratchets)
pnpm -C app test -- src/renderer/src/components/radar
pnpm -C app build:unpack   # .app without signing; dmg: see radar/plan/fase-11
```

## Visual feedback loop (see your own UI)
Launch the dev app with remote debugging and inspect it with the `electron-automation` skill:
```bash
pnpm -C app dev -- --remote-debugging-port=9222   # or set ELECTRON_EXTRA_LAUNCH_ARGS if the script ignores args
npx agent-browser connect 9222 && npx agent-browser screenshot /tmp/lc.png
```
Compare screenshots with `DESIGN.md` §5 and the Orca look before calling a UI step done.

## Useful helpers
- UI quality gate before every UI PR: screenshot the view, then run the `better-interface` skill; fix HIGH findings. Motion/polish: `apple-design`, `emil-design-eng`, `review-animations`.
- Playwright can drive the Electron app for smoke tests/screenshots: `_electron.launch({ args: ['.'], cwd: 'app' })` (Orca already has Playwright e2e config under `app/tests`).
- Agent `electron-pro` (`.claude/agents/`) for main/preload/IPC/security/packaging questions.
- ECC: `react-patterns`, `react-testing`, `frontend-patterns`, `frontend-a11y`, agents `react-reviewer`, `react-build-resolver`, `typescript-reviewer`.
- Map of Orca integration points: `radar/docs/ORCA_MAP.md` (produced by Bob slice C1).
