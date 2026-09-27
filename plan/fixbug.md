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

## Bugs

- [x] 1. Empty folders sync: they appear for teammates and are deleted for them too. D-alief-19. (55a2497f)
- [x] 2. Too-large or binary local files that never sync get an app notice. (13003c11)
- [x] 3. User-facing server text and `common/src/events.ts` are in English. D-alief-18 amends R5; wire values such as `bebas` stay. (6846ee61, aab0e88b, 9ed45306, d5482180)
- [x] 4. The `.bob/` kit refusal sends a JSON status line. The app shows a notice with "Back up .bob and install the Bob kit", which makes a `.bob.bak-<time>` backup. (4ff557c1, ead32cc1)
- [ ] 5. **(B)** Old member seats stop piling up: rejoining reuses or replaces the seat. The owner gets a remove-member action (server endpoint plus app button), and the removed member sees a calm notice.
- [ ] 6. **(B)** Owner recovery without the CLI: a coder reclaims ownership with a fresh owner code, kept secure.
- [x] 7. Escape in the "Share a different folder?" confirmation closes only the confirmation. Also "Stop sharing?". (951be715)
- [ ] 8. **(A)** One "X is sharing …" card, not two.
- [ ] 9. **(A)** Quitting mid-upload resumes cleanly on the next start (tested on prod).
- [ ] 10. **(A)** Bob IDE steps for hooks and radar-mcp after a folder switch are written down. Alief runs them in Bob IDE.

## Extra fixes

- [x] Server calls in `app/src/main/radar/server-fetch.ts` go through the main HTTP client, not bare `fetch`. (12a5b848)
- [ ] The app's `rejected` notice is a list that clears once the file syncs, not a single string that stays forever (silent-failure-hunter finding 2).

## Phase gates

- [x] ecc:silent-failure-hunter run.
- [ ] **(B)** ecc:security-reviewer on bugs 5 and 6.
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
