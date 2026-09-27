# How IBM Bob built IBM Bob Live Collab

IBM Bob plays two roles in this project. It is the **runtime** of the product: every coder and the PM work inside Bob IDE, and Live Collab steers Bob through custom modes, hooks and an MCP server. It is also the **builder**: each team member did slices of the product in Bob IDE, and each slice has a task summary screenshot and a `Bob-Assisted` commit trailer.

Evidence: [`bob_sessions/INDEX.md`](bob_sessions/INDEX.md) (one row per session, generated from `bob_sessions/index/<member>.md`). Protocol: [`plan/ref/R7-bukti-bob.md`](plan/ref/R7-bukti-bob.md). Check: `pnpm -C radar evidence:check`.

## 1. Bob inside the product (runtime)

A teammate joins with `radar join … --kit coder|pm`. That installs a `.bob/` kit (source: [`radar/bob-kit`](radar/bob-kit)) in the synced workspace. Bob IDE picks it up once the workspace is trusted.

### Custom modes

| Mode | Slug | Tool groups | Job |
|---|---|---|---|
| Live Collab Coder | `coder` | read, edit, execute, mcp | Works only on its own task's files; when Radar refuses an edit it calls `why_blocked` and must not retry or work around it through the shell (mode rules) |
| Live Collab PM Lead | `pm-lead` | `[read, mcp]` | Main agent. It plans, arbitrates and reviews, but it cannot write files and it cannot approve anything |

### Hooks (`.bob/settings.json`)

| Event | Script | What it does |
|---|---|---|
| `SessionStart` | `brief.js start` | Prints a ≤ 6-line team brief into Bob's context: who you are, your task, your files, who holds what |
| `UserPromptSubmit` | `brief.js prompt` | Adds only what changed since the last prompt (PM decisions, notifications, new locks). Prints nothing when there is nothing new, to save Bobcoin |
| `PreToolUse` (write tools) | `lock_guard.js` | Asks the server whether this member may write the file. If the answer is block, the hook exits 2 and the server message goes to Bob on stderr. Bob IDE cancels the edit and Bob explains it. Budget: 1.6 s, then fail-open |
| `PostToolUse` | `mark_ai_edit.js` | Streams `tool.post` activity and marks AI-written lines (`POST /v1/ai-edits`) |
| `Stop` | `stop.js` | Sends `turn.end` for the Watch Bob timeline |

Every hook also sends Bob IDE activity to `POST /v1/bob/activity`. That is how teammates can watch another person's Bob live in the desktop app. Prompt text is only sent when the member opts in (`shareprompts`).

### MCP server `radar-mcp` (13 tools, stdio)

- **Coder:** `my_tasks`, `why_blocked`, `request_file`, `submit_task`, `team_activity`.
- **PM:** `team_status`, `propose_plan`, `list_requests`, `propose_decision`, `get_task_diff`, `propose_review`, `notify`, `session_report`.

### Governance

- The PM agent can only *propose*. Every approval goes through Mission Control with the `mc` token, and the server answers 403 to the PM token (MA-07; tested against the real Worker).
- The server makes the final call on every write. The hook is the first layer. A write that skips the hook (manual edit) is rejected by the server and restored by the sync agent.

### Verified against the real server

Fase 10 ran the kit against the real Worker + Durable Object:
- [`radar/packages/mcp/test/server.int.test.ts`](radar/packages/mcp/test/server.int.test.ts) runs the bundled hooks, radar-mcp and real sync agents together.
- Seven Bob IDE sessions ran against a local `wrangler dev` (screenshots task 09–15).

What they showed:
- Bob PM planned without giving the same file to two tasks.
- Bob coder was blocked by the hook, called `why_blocked` right away, and did not retry or use the shell.
- The PM agent chose `antre` for a contested file, and the decision reached the other coder's next brief.
- When a changed export broke a caller in the author's own task, the PM agent returned the task. When only another task's importer was affected, it chose "approve and notify".

## 2. Bob as a builder

| Member | Slice | Bob mode | What Bob built | Bobcoin |
|---|---|---|---|---|
| Alief (core) | A1 | Code | `toko-demo` example repo (Vite + React + TS, 6 experiment tasks) | 1.80 |
| Alief | A2 | Code | Lock engine `checkWrite` + `blockFor` from the 12-row decision table, 18 tests | 5.28 |
| Alief | A3 | Code | Commit message formatter with Radar trailers | 0.063 |
| Alief | A4 | Ask | Cross-review of `locks.ts` against the lock spec: 11 findings adjudicated, 1 spec row added | 0.098 |
| Umar (bob) | B1 | Code | Spike hooks: payload logger, block hook, test modes | 0.345 |
| Umar | B2 | Code | `coder` custom mode + rules | 0.354 |
| Umar | B3 | Code | Hooks `lock_guard` + `brief` | 0.914 |
| Umar | B4a | Code | radar-mcp coder tools | 1.13 |
| Umar | B4b | Code | radar-mcp PM tools | 1.33 |
| Aarief (app) | C1 | Ask | Onboarding the Orca codebase (~23k files) → `radar/docs/ORCA_MAP.md` | 0.709 |
| Aarief | C2 | Agent | IBM Bob registered as an agent in the desktop app | not recorded |
| Aarief | C3 | Code | `@radar/ui` presentational components | 2.27 |
| Aarief | C4 | Code | Evidence export + audit scripts (`evidence-check.ts`) | 2.06 |
| Imelda (web) | I1 | Code | Replay player + `/demo` | 4.30 |
| Imelda | I2 | Code | Landing page | 0.873 |

Each screenshot's task header shows the exact prompt Bob received. Code written by Bob was committed unchanged with `Bob-Assisted: bob_sessions/<png>`. Reviews and fixes went into separate commits, so the Bob part of the diff stays visible.

Umar also used Bob to test Bob. Ten behaviour sessions (task 05, 07, 08 against a scripted server, task 09–15 against the real Worker) checked that the modes, hooks and tools produce the agent behaviour the product needs. These sessions wrote no product code.

## 3. Numbers

| | Alief | Umar | Aarief | Imelda | Team |
|---|---|---|---|---|---|
| Summary screenshots in `bob_sessions/` | 4 | 15 | 4 | 2 | 25 |
| Slices with a `Bob-Assisted` trailer on `main` | 3 | 5 | 4 | 2 | 14 |
| Bobcoin recorded | 7.24 | 5.56 (4.07 building, 1.49 behaviour tests) | 5.04 (C2 not recorded) | 5.17 | 23.01 |

Numbers come from the rows in `bob_sessions/index/*.md` (C1 from `plan/log/fase-09.md`). They cover the state at Sun 27 Sep 09:00 WITA; slices after that time are not counted here.

## 4. What we learned about Bob IDE 2.2 (spike, fase 01)

Full table: [`radar/docs/SPIKE_RESULTS.md`](radar/docs/SPIKE_RESULTS.md).

- **Hook payload.** Bob IDE sends a snake_case payload (`session_id`, `hook_event_name`, `tool_name`, `tool_input.path`). This is not the example shape in the docs, so the normalizer accepts both.
- **Blocking a write.** Exit 2 cancels the write, and stderr reaches the model as the tool error. Bob then explains the block instead of retrying. That became the main block path.
- **Session hooks.** `SessionStart` fires once per task (`source: "startup"`). stdout from `SessionStart` and `UserPromptSubmit` is added to Bob's context.
- **Hook timeout.** A hook that times out is killed and the tool runs anyway (fail-open). `lock_guard` therefore keeps its own 1.6 s budget. The server is the hard guarantee.
- **Workspace trust.** An untrusted workspace shows an empty Bob panel. Every setup step starts with "trust the workspace".
- **MCP.** Bob starts stdio MCP servers with `cwd=/`, so the kit uses `${workspaceFolder}` paths. `alwaysAllow` removes the approval prompt, except for the first call after `mcp.json` changes.
- **ES module projects.** Bundled hooks are CommonJS. The kit ships `.bob/package.json` with `{"type":"commonjs"}` so the hooks also run in projects with `"type": "module"`.
- **`.bobignore`.** The IBM template `.bobignore` ignores `*config.json`, so Bob cannot read `tsconfig.json`. We accepted this; no slice depended on it.

## 5. watsonx

Not used.
