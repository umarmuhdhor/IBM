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

From session B (bugs 5 and 6). Each is small; B did not touch these files.

1. `RadarPanel.tsx` line 173: pass `canRemove={connection?.role === 'mc'}` to `<TeamPanel …/>`. Without it the Remove button never shows.
2. `RadarPanel.tsx` around line 150: add a `connectionFailure === 'removed'` branch before the "Connection lost" fallback, with the text "The owner removed you from this workspace. Join with a new code in Multiplayer."
3. `app/src/main/radar/sync-agent.ts` `STOP_REASONS`: add `'removed'`. The CLI now prints `{"type":"stopped","reason":"removed"}` when the owner removes the member. The app already shows the right notice from the socket failure, so this only makes the sync status agree.
4. `ShareFolderCard.tsx`, the `ownerEnded` view: when `connectionFailure === 'signed-out'`, render `<ReclaimOwnerButton onReclaimed={onConnectionChange} />` (from `./ReclaimOwnerButton`) above "Forget this workspace". A good text for that case: "Another device took over as owner. If it is closed now, take back ownership on this Mac."
5. `radar/packages/sync/src/agent.ts` changed, so rebuild the bundled CLI (`pnpm -C app run build:radar-cli`) before the app build.
6. Deploy note: the server migrates to schema v6. Workspaces opened before the deploy have no `owner_member`, so reclaim is refused there and seat A is not protected on the server. Share `toko-demo` again after the deploy (the finish step already does this).
7. E2E for bugs 5 and 6: B rejoins with a new open code and keeps seat B; MC removes B, B sees the calm notice and its open task is cancelled; O opens MC on a second device with an owner code, closes it, then clicks "Take back ownership" on the first Mac while its folder keeps syncing.

## Bugs

- [x] 1. Empty folders sync: they appear for teammates and are deleted for them too. D-alief-19. (55a2497f)
- [x] 2. Too-large or binary local files that never sync get an app notice. (13003c11)
- [x] 3. User-facing server text and `common/src/events.ts` are in English. D-alief-18 amends R5; wire values such as `bebas` stay. (6846ee61, aab0e88b, 9ed45306, d5482180)
- [x] 4. The `.bob/` kit refusal sends a JSON status line. The app shows a notice with "Back up .bob and install the Bob kit", which makes a `.bob.bak-<time>` backup. (4ff557c1, ead32cc1)
- [x] 5. **(B)** Old member seats stop piling up: rejoining reuses or replaces the seat. The owner gets a remove-member action (server endpoint plus app button), and the removed member sees a calm notice. D-alief-20. (6349c2db, 1408befc, 6cc56646, 89f303e6, d5451044; UI wiring is request 1–3 above)
- [x] 6. **(B)** Owner recovery without the CLI: a coder reclaims ownership with a fresh owner code, kept secure. D-alief-21. (94b2dcdb, cb6fbc7f; button placement is request 4 above)
- [x] 7. Escape in the "Share a different folder?" confirmation closes only the confirmation. Also "Stop sharing?". (951be715)
- [ ] 8. **(A)** One "X is sharing …" card, not two.
- [ ] 9. **(A)** Quitting mid-upload resumes cleanly on the next start (tested on prod).
- [ ] 10. **(A)** Bob IDE steps for hooks and radar-mcp after a folder switch are written down. Alief runs them in Bob IDE.

## Extra fixes

- [x] Server calls in `app/src/main/radar/server-fetch.ts` go through the main HTTP client, not bare `fetch`. (12a5b848)
- [ ] The app's `rejected` notice is a list that clears once the file syncs, not a single string that stays forever (silent-failure-hunter finding 2).

## Phase gates

- [x] ecc:silent-failure-hunter run.
- [x] **(B)** ecc:security-reviewer on bugs 5 and 6. No CRITICAL or HIGH. One MEDIUM accepted and recorded in D-alief-20 (an existing member can use someone else's unclaimed open code for their own seat; same risk as before). Reported gap: the Remove and reclaim UI is not wired in yet, which is requests 1 and 4.
- [ ] ecc:typescript-reviewer and ecc:react-reviewer on the phase diff; CRITICAL and HIGH findings fixed.
- [ ] UI gate: screenshots from the prod-connected app, better-interface run, HIGH findings fixed.
- [ ] App rebuilt; server deployed; canary passes (health, `/j/<code>`, radar-cli.tgz, WebSocket).
- [ ] Full two-app e2e on prod.
- [ ] ecc:verification-loop counts and /ecc:code-review.
- [ ] Phase log `plan/log/fase-12k-*.md` with the prod version and rollback ID.
- [ ] Snapshot branch `lane/core-f12k` pushed, PR opened and bound.

## Finish

- [ ] Apps, e2e driver and local wrangler stopped; ports 8787 and 7788 are free.
- [ ] E2E members and folders removed from prod; `toko-demo` is ready for a fresh Share.
- [ ] Final report to Alief.

B done: 6349c2db, 1408befc, 94b2dcdb, 6cc56646, 89f303e6, cb6fbc7f, d5451044, c4e88301 (in that order, on `wip/core-12k-seats`, pushed). Cherry-pick those 8. Skip the last commit on the branch (docs(plan) for this file); copy the ticks and "Requests to session A" by hand. Checks on the worktree: radar tests all pass (common 142, server 218, sync 69, others), radar typecheck and lint clean, app radar tests 162 pass, app tc:node and tc:web clean. `radar/pnpm-lock.yaml` was changed by a local install and is not committed.
