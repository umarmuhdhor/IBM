# Phase 12k bug list (core lane, lane/core-f12k)

Progress tracker for Phase C. Each fix starts with a failing test and gets one commit. Tick a box when its commit has landed on `lane/core`.

## Split between two sessions (27 Sep, 13:40 WITA)

| Session | Where | Owns |
|---|---|---|
| A (first session) | `/Users/af/dumpProject/IBM`, branch `lane/core` | Bugs 8, 9, 10, the `rejected` list fix, and every prod step: deploy, canary, prod e2e, reviews, UI gate, phase log, PR, Finish. |
| B (second session) | worktree `/Users/af/dumpProject/IBM-12k-b`, branch `wip/core-12k-seats` | Bugs 5 and 6, plus ecc:security-reviewer on them. |

Rules for session B:
- Touch only these files: `radar/packages/server/**`, `radar/packages/common/src/{schemas,http,reducer,selectors,types}.ts` (additive, optional fields only), the app Team view and `JoinWithCodeCard.tsx`, and new IPC in `app/src/main/radar/join.ts`, `app/src/preload/api/radar-join-bridge.ts`, `app/src/shared/radar-join.ts`. Do not edit `ShareFolderCard.tsx`, `RadarPanel.tsx`, `SyncConflictsNote.tsx`, `open-folder.ts` or `app/src/main/radar/sync-agent.ts` (session A has them). If one is needed, write the change needed in this file under "Requests to session A".
- Decisions: use D-alief-20 and up, in Indonesian, in `plan/log/DECISIONS.md`.
- Tests: TDD, one commit per fix, local only (server tests use the in-process harness). Never deploy, never touch prod, never run the e2e driver on :7788.
- Tick only your own boxes below. When done, push `wip/core-12k-seats` to origin (no PR) and write "B done: <commits>" at the bottom of this file. Session A cherry-picks the commits onto `lane/core`, deploys, and runs the prod e2e.

## Requests to session A

(none yet)

## Where to restart (stopped 27 Sep, 15:00 WITA)

Session A stopped here on Alief's request. `lane/core` and `lane/core-f12k` are pushed; both point at the commit that added this section.

Ringkas, mulai lagi dari sini:
1. Tunggu "B done", lalu cherry-pick commit B ke `lane/core`.
2. Deploy dan canary, lalu rebuild app.
3. E2E di prod untuk bug 5 dan 6.
4. UI gate untuk tampilan Team dan code review untuk commit B.
5. Buka PR `lane/core-f12k`.
6. Alief menjalankan langkah Bob IDE untuk bug 10.
7. Finish: bersihkan anggota dan folder e2e di prod, lalu laporan akhir.

Details for each step are under "Next steps" below.

State:
- Prod live `0f415a37-afc4-45e1-beaa-7d7448afaaf0`, rollback `47e6cba5-ad94-42cb-8b58-3a0baaa73b8c`. It has everything up to d948fb06 except the app-only fix ffea1db3 and the CLI fix 569bd085 (those ship with the app build, not the server).
- Prod workspace is the synthetic `k2` (owner `af`, teammate "E2E Budi"). E2E profiles and folders are in session 2a01b0f7's scratchpad `e2e/` folder (`profiles/O`, `profiles/B`, `work/k2`).
- Session B was still working on bugs 5 and 6 in `/Users/af/dumpProject/IBM-12k-b` (`wip/core-12k-seats`); it had 6349c2db and 1408befc, not pushed yet.

Next steps, in order:
1. Wait for "B done" at the bottom of the worktree's `plan/fixbug.md`, then `git fetch origin` and cherry-pick B's commits onto `lane/core`. Run the common, server and sync tests and the app radar tests.
2. Deploy with `pnpm -C radar --filter "@radar/server^..." build && pnpm -C radar --filter @radar/server run deploy`, then run the canary. Rebuild the app with `pnpm -C app run build:radar-cli && pnpm -C app run build:electron-vite`.
3. Start the e2e driver (`node driver.mjs` on :7788), launch O and B, and run the prod e2e for bugs 5 and 6: rejoin reuses the seat, remove member plus the calm notice, owner reclaim. Smoke-test bugs 1, 2, 4, 7, 8 and 9 again.
4. UI gate on the Team view, verification-loop counts and a code review of B's commits. Fill the phase log and tick the boxes here.
5. Refresh the snapshot (`git branch -f snap/core-f12k HEAD`, then push to `lane/core-f12k`), open the PR with `gh pr create --base main --head lane/core-f12k`, and bind it.
6. Alief runs the bug 10 Bob IDE steps below.
7. Finish: stop the apps and the driver, free ports 8787 and 7788, remove the e2e members and folders from prod, and write the final report.

## Bugs

- [x] 1. Empty folders sync: they appear for teammates and are deleted for them too. D-alief-19. (55a2497f)
- [x] 2. Too-large or binary local files that never sync get an app notice. (13003c11)
- [x] 3. User-facing server text and `common/src/events.ts` are in English. D-alief-18 amends R5; wire values such as `bebas` stay. (6846ee61, aab0e88b, 9ed45306, d5482180)
- [x] 4. The `.bob/` kit refusal sends a JSON status line. The app shows a notice with "Back up .bob and install the Bob kit", which makes a `.bob.bak-<time>` backup. (4ff557c1, ead32cc1)
- [ ] 5. **(B)** Old member seats stop piling up: rejoining reuses or replaces the seat. The owner gets a remove-member action (server endpoint plus app button), and the removed member sees a calm notice.
- [ ] 6. **(B)** Owner recovery without the CLI: a coder reclaims ownership with a fresh owner code, kept secure.
- [x] 7. Escape in the "Share a different folder?" confirmation closes only the confirmation. Also "Stop sharing?". (951be715)
- [x] 8. **(A)** One "X is sharing …" card, not two. (c5d1b784)
- [x] 9. **(A)** Quitting mid-upload resumes cleanly on the next start. Verified on prod: the relaunch finished the share in 4.8 s, 2401 files. (23b7d3c6)
- [ ] 10. **(A)** Bob IDE steps for hooks and radar-mcp after a folder switch are written down. Alief runs them in Bob IDE.

## Extra fixes

- [x] Server calls in `app/src/main/radar/server-fetch.ts` go through the main HTTP client, not bare `fetch`. (12a5b848)
- [x] The app's `rejected` notice is a list that clears once the file syncs, not a single string that stays forever (silent-failure-hunter finding 2). (d8859df9, 55302886)
- [x] Status file count leaves out deleted files and empty-folder markers (found on prod: "Syncing 5 files" after deletes). (ac15dc81)
- [x] The `.bob.bak-<time>/` backup from a kit install never syncs (found on prod while testing bug 4). (d3d94b4b)
- [x] React review: sharing confirmations are alert dialogs and take Escape only from inside; a new Bob kit notice drops the old install error. (6af8ed58, e793ec36)

## Phase gates

- [x] ecc:silent-failure-hunter run.
- [ ] **(B)** ecc:security-reviewer on bugs 5 and 6.
- [x] ecc:typescript-reviewer and ecc:react-reviewer on the phase diff; CRITICAL and HIGH findings fixed. (6af8ed58, e793ec36, ffea1db3)
- [x] UI gate: screenshots from the prod-connected app, better-interface run, HIGH findings fixed. (d948fb06; table in the phase log). Redo for the bug 5/6 Team view after the cherry-pick.
- [ ] App rebuilt; server deployed; canary passes (health, `/j/<code>`, radar-cli.tgz, WebSocket).
- [ ] Full two-app e2e on prod.
- [ ] ecc:verification-loop counts and /ecc:code-review. Done for session A's commits (APPROVE, 569bd085); redo counts and review B's commits after the cherry-pick.
- [ ] Phase log `plan/log/fase-12k-bugfix.md` with the prod version and rollback ID. Draft committed; fill bug 5/6, final live ID, Batasan.
- [ ] Snapshot branch `lane/core-f12k` pushed (03401731), PR opened and bound. Pushed; PR not opened yet.

## Finish

- [ ] Apps, e2e driver and local wrangler stopped; ports 8787 and 7788 are free.
- [ ] E2E members and folders removed from prod; `toko-demo` is ready for a fresh Share.
- [ ] Final report to Alief.

## Bug 10: Bob IDE steps for Alief after a folder switch

Run these after session A deploys and posts the prod version. They check that hooks and radar-mcp follow the owner to the new folder.

1. In the app, open folder **X** and click Share. Then open folder **Y** (a throwaway folder with a few text files) and use Multiplayer → "Share a different folder…" → "Replace with Y". Wait for "Y is shared · N files".
2. If a notice says `.bob/` already has other files, click "Back up .bob and install the Bob kit". Check that `Y/.bob.bak-<time>/` exists and `Y/.bob/settings.json` is the Live Collab one.
3. Click "Open in IBM Bob". In Bob IDE, trust the folder.
4. Hooks: pick the mode **Live Collab Coder** and start a new task. The first lines of the context should be the `[Radar]` brief: "You are A (coder)." and the workspace should be **Y**, not X.
5. radar-mcp: open the MCP servers list. `radar` should be connected. If it shows an error or X's path, restart it once. Then ask Bob "What are my tasks?"; `my_tasks` should answer for workspace Y.
6. Locks: from a second app (teammate), lock `Y/<file>` lines 1–5. Ask Bob in Y to edit line 2. It should be refused with "lines 1–5 are locked by …", and `why_blocked` should name the teammate.
7. Old folder X: in a Bob window still on X, send a prompt. The brief should say the workspace is no longer shared, not show X's old tasks.
8. Say "bob selesai" after each step you want captured. Session A saves the Bob window as evidence.
