# @radar/common

Contracts in code for every Radar package (R1 §2.1). Owned by Lane Core; other lanes propose changes in
`plan/log/DECISIONS.md`.

Build before bundling kits or running the Worker: `pnpm -C radar --filter @radar/common build` (emits `dist/`, gitignored).

## Entry points

| Import | Runtime | Contents |
|---|---|---|
| `@radar/common` | Worker, browser, Node | everything below except the file-system helpers. No `node:*` imports and no `process.` (enforced by `bundle.test.ts`). |
| `@radar/common/node` | Node only | `loadLocalConfig`, `findLocalConfigFile`, `LocalConfigFile`, `loadState`, `saveState`, `createIgnoreMatcher(root)`, `ConfigMissingError`, `ConfigInvalidError`. |

## Main entry by module

| Module | Exports | Ref |
|---|---|---|
| `constants` | timing, limits, colours, `WS_PING_FRAME`/`WS_PONG_FRAME`, `EDIT_TOOLS_REGEX`, `ACTIVITY_TIMEOUT_MS` | R5 §4 |
| `types`, `schemas` | zod schemas + inferred types for every REST body (`LockCheckReq/Res`, `BriefQuery`, `BobActivityReq`, `ProposalCreateReq`, `StateRes`, …), `RadarEvent` union, `parseRadarEvent` | R2 §3, R3 §2 |
| `ws`, `term` | WebSocket envelope `{ t, d }` schemas, `WS_CLOSE_UNAUTHORIZED` (4401), terminal frames | R3 §3 |
| `events` | `EVENT_TYPES`, `feedText` (PRD feed lines), `formatClock` (HH:mm WITA) | R2 §3 |
| `reducer` | `initialState`, `applyEvent`, `applyEvents`, `stateFromSnapshot` | R3 §3 |
| `selectors` | `tasksByColumn`, `pendingDecisions`, `needsYouCount`, `memberStatus(state, id, now)`, `bobTimeline`, `fileTree`, `compareIds` | UI-01…05 |
| `paths` | `toPosix`, `normalizeRelative`, `toWorkspaceRelative` (throws `PathOutsideWorkspaceError`), `tryWorkspaceRelative` (returns `null`), `isInside`, `basename` | R5 §2 |
| `hook-payload` | `normalizeHookPayload` (real Bob IDE 2.2.0 snake_case payloads and the docs shape) | D-umar-01 P1–P2 |
| `ignore` | `DEFAULT_IGNORE_PATTERNS`, `createIgnoreMatcherFromText`, `isProbablyBinary`, `exceedsMaxSize` | R5 §6 |
| `hash` | `sha256Hex` (Web Crypto) | R4 §5 |
| `http` | `radarFetch` with timeout, `RadarHttpError`, `RadarTimeoutError`, `RadarNetworkError` | R3 §1 |
| `brief` | `clampBrief` (6 lines × 160 chars) | NFR-06 |

## Behaviour worth knowing

- **Reducer.** Pure and deterministic. Events with `id <= state.cursor` are skipped, so a snapshot followed by
  overlapping live events is safe. Unknown event types only advance the cursor (older clients survive newer servers).
- **Ordering.** `state.feed` and the per-member Bob activity are **newest first** and capped (`FEED_MAX_ITEMS`,
  `BOB_ACTIVITY_MAX_ITEMS`). `bobTimeline()` returns one member's items oldest first for the timeline view.
- **`StateRes` uses arrays on the wire** (`members`, `tasks`, `locks`, …). Call `stateFromSnapshot(res)` to get the keyed
  `RadarState`; it also rebuilds the feed from `recentEvents`.
- **`memberStatus` takes `now`** so views and tests control the clock (writing indicator = `WRITING_INDICATOR_MS`).
- **No CRLF normalization.** Hashes and versions are over the exact bytes the sync agent read; line endings are the
  repository's business (`.gitattributes`).
- **Paths** are POSIX and workspace-relative everywhere on the wire. Absolute or `..` paths are rejected.

## Mock server (for other lanes)

`radar/scripts/mock-server.ts` implements every R3 route and the WebSocket protocol in memory, using this package's
reducer and schemas, so the app, sync agent, hooks and radar-mcp can be built before the Worker is deployed.

```bash
pnpm -C radar dev:mock                       # port 8787, demo scenario plays when the first mc/app client connects
pnpm -C radar dev:mock -- --instant          # demo end state immediately
pnpm -C radar dev:mock -- --scenario none    # empty workspace toko-demo with members A, B (coder) and C (pm)
pnpm -C radar dev:mock -- --speed 0.5 --port 8788
```

Dev tokens: `tok-a` (A, coder), `tok-b` (B, coder), `tok-c` (C, pm), `mc-dev` (Mission Control). Admin routes take the
`x-admin-secret` header (default `dev-admin`, or `ADMIN_SECRET` from the environment). These values exist only in the
mock; the real server's tokens come from `/admin/init`.
