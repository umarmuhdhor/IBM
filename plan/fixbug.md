# Phase 12k bug list (core lane, lane/core-f12k)

Progress tracker for Phase C. Each fix starts with a failing test and gets one commit. Tick a box when its commit has landed on `lane/core`.

## Bugs

- [ ] 1. Empty folders sync: they appear for teammates and are deleted for them too.
- [x] 2. Too-large or binary local files that never sync get an app notice. (13003c11)
- [x] 3. User-facing server text and `common/src/events.ts` are in English. D-alief-18 amends R5; wire values such as `bebas` stay. (6846ee61, aab0e88b, 9ed45306, d5482180)
- [x] 4. The `.bob/` kit refusal sends a JSON status line. The app shows a notice with "Back up .bob and install the Bob kit", which makes a `.bob.bak-<time>` backup. (4ff557c1, ead32cc1)
- [ ] 5. Old member seats stop piling up: rejoining reuses or replaces the seat. The owner gets a remove-member action (server endpoint plus app button), and the removed member sees a calm notice.
- [ ] 6. Owner recovery without the CLI: a coder reclaims ownership with a fresh owner code, kept secure.
- [ ] 7. Escape in the "Share a different folder?" confirmation closes only the confirmation.
- [ ] 8. One "X is sharing …" card, not two.
- [ ] 9. Quitting mid-upload resumes cleanly on the next start (tested on prod).
- [ ] 10. Bob IDE steps for hooks and radar-mcp after a folder switch are written down. Alief runs them in Bob IDE.

## Extra fixes

- [x] Server calls in `app/src/main/radar/server-fetch.ts` go through the main HTTP client, not bare `fetch`. (12a5b848)
- [ ] The app's `rejected` notice is a list that clears once the file syncs, not a single string that stays forever (silent-failure-hunter finding 2).

## Phase gates

- [x] ecc:silent-failure-hunter run.
- [ ] ecc:security-reviewer on bugs 5 and 6.
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
