# IBM Bob Live Collab — project rules for Claude Code

Hackathon project (IBM Bob 2.0, lablab, deadline Sun 27 Sep 2026 23:00 WITA). Community project, not an official IBM product.
Start with `README.md` → `PLAN.md` → `ARCHITECTURE.md`. Phase work is driven by `plan/PROMPT.md` (lines `LANE:` + `FASE:`).

## Team & lanes (only touch your lane's folders — PLAN.md §2)
| Person | Lane | Folders |
|---|---|---|
| Alief | Core: Cloudflare Worker + Durable Object server, sync agent | `radar/packages/{common,server,sync}`, `radar/scripts/*` (server) |
| Umar | Bob: modes, hooks, radar-mcp, spike, Bob evidence | `radar/packages/{hooks,mcp}`, `radar/bob-kit`, `radar/spike`, `bob_sessions/` |
| Aarief | App: Orca-based desktop app, `@radar/ui` components, watch terminal, .dmg | `app/**`, `radar/packages/ui` |
| Imelda | Web & media: landing + replay (Cloudflare Pages), video, deck, submission text | `radar/packages/web`, `radar/docs/{deck,video,SUBMISSION.md}` |

## Always
- **IBM Bob IDE is the core component (judging requirement).** All coding and PM work in the demo happens in Bob IDE (modes `coder`/`pm-lead`, hooks, `radar-mcp`). Bob Shell is optional. Never design a feature that only works in Bob Shell as P0.
- Toolchain: `nvm use 24`; pnpm 12; run commands with `pnpm -C app …` or `pnpm -C radar …` (no root package.json).
- Load the lane's skills automatically (PLAN.md §11) — do not wait to be asked.
- `app/` is vendored Orca (MIT): additive changes only; read `app/AGENTS.md` + `app/CLAUDE.md`; use skill `live-collab-app`.
- Contracts (`plan/ref/R1–R7`, `radar/packages/common`) change only via Alief; others log a proposal in `plan/log/DECISIONS.md`.
- No secrets in git (repo is PUBLIC). File names must not contain `token`, `secret`, `password`, `credentials`, `apikey`, nor be `config.json` (IBM template .gitignore silently drops them).
- Code written by IBM Bob is committed separately with trailer `Bob-Assisted: bob_sessions/<png>` (plan/ref/R7).
- Bob evidence is YOUR job, automatically: after the human says "bob selesai", run `radar/scripts/bob-evidence.sh <name> <NN> <slug>` (captures the Bob IDE window, names it `bob_sessions/uaai_<name>_task<NN>_<slug>_summary.png`, updates INDEX.md). The human only opens Tasks → task → header in Bob IDE.
- Git flow (PLAN.md §6): work on your lane branch; after each phase push and open a PR to `main` with `gh pr create`; squash-merge when CI is green; then everyone rebases on `origin/main`. Never merge `main` into a lane branch; never force-push shared branches (only `--force-with-lease` on your own lane after the one-time rebase).
- Data: synthetic only; log any new external data source in `DATA_SOURCES.md`.

## UI gate — automatic before any commit/PR that touches UI
Triggered when the diff touches `app/src/renderer/**`, `radar/packages/ui/**`, or `radar/packages/web/**`:
1. Screenshot the changed view (app: `electron-automation` skill or Playwright `_electron.launch()`; web: Playwright at 1440 and 390 wide).
2. Run the `better-interface` skill on it; fix every HIGH finding; paste the findings table into the phase log.
3. Animations changed → also run `review-animations`. Use `apple-design` / `emil-design-eng` while building motion and polish.
4. Style direction: **app + replay = dark, Orca look first** (DESIGN.md §0); **landing = light "warm paper"** (DESIGN.md §5.11, `UI Inspo & Design/landing-style/README.md`). Stitch mockups are guidelines only; never ship invented numbers.
