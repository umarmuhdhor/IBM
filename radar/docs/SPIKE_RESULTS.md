# Spike results (fase 01, GATE 1)

> Run: Sat 26 Sep 2026 00:10–00:35 WITA, Umar's Mac, **IBM Bob IDE 2.2.0** (`com.ibm.software.bob`, VS Code 1.126.0 base, Electron 42.2.0), instance `ibm-coding-challenge-2` (us-east), workspace `radar/spike/` (trusted).
> Every Bob IDE test was driven automatically over CDP (`--remote-debugging-port=9223`, `radar/spike/automation/`), no human clicks. Evidence files live in `radar/spike/out/` (git-ignored); redacted copies in [`spike-payloads/`](spike-payloads/).
> Bobcoin: B1 0.345 + 18 test tasks ≈ 1.3.

## GATE 1 decision

| Key | Decision | Why |
|---|---|---|
| `ENFORCEMENT` | **hook+server** | Spike 1 passed: `PreToolUse` exit 2 stops all four edit tools, also inside a subagent (20a). |
| Block message channel | **stderr of the exit-2 hook reaches the model** (Bob quotes it and does not retry). Keep the mode instruction + `why_blocked` as backup. | Spike 2: contradicts the docs ("stderr only goes to the log"). Bob also followed the mode instruction and called the MCP tool after the block (17). |
| Brief channel | stdout of `SessionStart` and `UserPromptSubmit` | Spike 3 passed. |
| `SYNC` | **watch** (chokidar 4, debounce 150 ms) | Spike 4 (two folders, one Mac): p95 212 ms, 0 lost, 0 echo. Two-Mac run = Alief (TODO D4). |
| Hook timeout | **fail-open** | Spike 19: a hook that runs past `timeout` is killed and the edit goes through. `lock_guard` must answer well inside its timeout. |
| Mode groups | `coder` `[read, edit, execute, mcp]`, `pm-lead` `[read, mcp]` | Spike 5: `[read, mcp]` has no edit and no `execute_command`. `execute` works; `command` also works in 2.2.0 (legacy alias), but we keep the documented `execute`. |
| `EDIT_TOOLS_REGEX` | unchanged: `^(write_file\|apply_diff\|search_and_replace\|insert_content\|office_edit)$` | All four edit tools seen with `tool_input.path`. `office_edit` not exercised (no Office file). |

## Results (20 tests)

| # | Test | Result | Evidence | Notes |
|---|---|---|---|---|
| 1 | `PreToolUse` fires, exit 2 prevents the write | **pass** | `out/pre-block-*55726.json`, `git diff sandbox/` empty | Tool `apply_diff`, path in `tool_input.path` (relative to workspace). `PreToolUse` fires **before** the approval dialog. No `PostToolUse` for a blocked call. |
| 1b | Every edit tool is caught | **pass** | `out/pre-block-*61219/61458/61604/61729.json` | `write_file` {path, content, line_count}, `apply_diff` {path, diff}, `search_and_replace` {path, search, replace}, `insert_content` {path, line, content}. No other edit tool seen. |
| 2 | What the model receives after a block | **pass (better than docs)** | Bob transcript: "Failed to apply diff … SPIKE-BLOCK: locked.ts dipegang Bob milik A (T-1)…" then "I will not retry" | The hook's **stderr is passed to the model** verbatim. Bob did not retry. With MCP working, Bob also called `ping note=blocked` as the mode instruction asked (see 17). |
| 2b | JSON decision on stdout | **fail (as expected)** | `out/pre-block-*` `mode: json`; `locked.ts` changed | `{"decision":"block"}` + exit 0 is ignored. Contract stays exit 2. |
| 3 | stdout of `SessionStart`/`UserPromptSubmit` in context | **pass** | Bob listed `SPIKE-MARKER start …` and `SPIKE-MARKER prompt …` | `SessionStart` fires **per task** (`source: "startup"`), ~50 ms before `UserPromptSubmit`. `PostToolUse` stdout is also shown in the transcript (in context: BELUM DIVERIFIKASI) → product hooks must keep `PostToolUse` stdout empty. |
| 4 | Edit → chokidar → second folder < 1 s | **pass (one Mac)** | `pnpm bench`: `files=50 received=50 lost=0 echoes=0 p50=190ms p95=212ms max=259ms` | Two Macs over `--relay ws://<ip>:8799`: **LANGKAH MANUAL** Alief (TODO D4). |
| 4b | Editor reloads a file changed outside | **pass** | CDP read of the editor before/after appending a line to an open `b.ts` | Clean buffer reloads silently, no dialog. Dirty buffer: not tested (VS Code behaviour: conflict on save). |
| 5 | `[read, mcp]` cannot write | **pass** | Bob: "I can only observe"; tool list has no edit tools and no `execute_command` | Read-only tools listed: read_file, list_files, glob, grep, symbols, IBM docs search, ask_followup_question, start_workflow, `mcp__radar-spike__ping`. |
| 6 | MCP stdio tool from two modes | **pass** (after fix) | `pong halo role=coder cwd=/` in `spike-coder` and `spike-readonly`; `out/mcp-*.jsonl` | Workspace `.bob/mcp.json` is read. **Bob starts stdio servers with cwd `/`**, so a relative `args` path fails (`Cannot find module '/mcp/echo-server.mjs'`). `${workspaceFolder}/mcp/echo-server.mjs` works. Client `mcp-use` 2.2.5, protocol `2025-11-25`. Tool name in hooks: `mcp__radar-spike__ping`. Editing `mcp.json` hot-restarts the server. |
| 7 | Hooks in Bob Shell | skipped (optional) | – | Bob Shell not used for P0. |
| 8 | Hook overhead | **pass** | `pnpm timing`: spawn `block_edit.js` p50 46.8 ms, p95 61.6 ms; in-Bob `timing.js` lifetime p50 36.8 ms, max 49.3 ms (n=24) | Leaves ~250 ms of the 300 ms NFR-01 budget for the server call. Node 25.8.1 on the Mac (Node 24 not installed via nvm). |
| 9 | Tool group names, shell tool | **pass** | `out/pre-all-*.json` | Valid groups per docs: read, edit, execute, mcp, skill, workflow, todo, subtask, subagent, mode. Shell tool = `execute_command` {command}. Other tools seen: read_file {path, range}, FindSymbol, update_todo_list {todos}, spawn_subagent {name, description}, `mcp__<server>__<tool>`. |
| 10 | Payload shape IDE vs Shell | **pass (IDE only)** | `spike-payloads/*.json` | Bob IDE 2.2.0 sends the **snake_case shape**, not the docs example: `{session_id, cwd, hook_event_name, tool_name, tool_input, tool_use_id}`; `PostToolUse` adds `tool_response` (string, not `output`). Shell: skipped. |
| 11 | Bob Shell in the Orca terminal | skipped (optional, P1, lane App) | – | |
| 12 | xterm tap | skipped (optional, P1, lane App) | – | |
| 13 | `pnpm -C app build:unpack` | not run here (lane App, Aarief) | – | Handoff to fase 09/11b. |
| 14 | Account login | **partial** | Status bar: `Bob Settings · ibm-coding-challenge-2 (Region: us-east)` | Logged in, version 2.2.0 ≥ 2.1.0. Instance name is `ibm-coding-challenge-2`, not `ibm-coding-challenge-uat` as written in the plan: confirm with the team (TODO D2). |
| 15 | Payload for the activity stream | **pass** | `spike-payloads/` | `UserPromptSubmit` has `prompt` (full text). `PostToolUse` has `tool_input` (edit content/diff → `linesChanged` computable) and `tool_response` (read_file returns the **file content**: never forward it). `Stop` has `last_assistant_message` (the docs say session ID only). `session_id` = Bob **Task Id** (32 hex), shared by a subagent. No `mode` field. |
| 16 | Automatic screenshot | **pass** | `bob_sessions/uaai_umar_task01_spike_hooks_summary.png` | CDP clicks Tasks → task → header; `bob-evidence.sh` captures the window once Bob is frontmost (`osascript -e 'tell application "IBM Bob" to activate'`), otherwise "window not found". |
| 17 | Workspace trust | **pass** | copy of `spike/` outside the repo: banner "Restricted Mode", **Bob panel empty** (no chat at all); after Trust: hook blocks, `out/` filled | Untrusted does not silently skip hooks: the Bob agent is unavailable. `radar/spike/` inherited trust from the trusted parent folder. |
| 18 | MCP auto-approve | **partial** | `bobrun --approve none` | Without `alwaysAllow`: approval prompt. With `alwaysAllow`: runs without a prompt, **except the first call right after `mcp.json` changes** (server hot-restart). Fresh Bob launch: no prompt. |
| 19 | Hook timeout | **fail-open** | `./use.sh sleep` (sleep 15 s, `timeout: 10`): `locked.ts` changed | Hook is killed at the timeout and the tool runs. |
| 20 | (a) subagent, (b) `command` group | (a) **pass** (b) **fail** | (a) `out/pre-block-*` in session of the parent task, file unchanged. (b) mode `[read, command]` ran `execute_command ls sandbox` | (a) Hook runs inside `spawn_subagent` (`general`) and blocks. (b) `command` is accepted in 2.2.0 (the docs list only `execute`). Both names give `execute_command`. |

## Open questions (PRD §18)

| OQ | Answer |
|---|---|
| 1. What does the model get after exit 2? | **Bob IDE 2.2.0:** the hook's stderr text, as the tool error. Bob stops and does not retry. Shell: not tested. |
| 2. Tool group names, does `mcp` exist? | `read`, `edit`, `execute` (alias `command` also works in 2.2.0), `mcp`, `skill`, `workflow`, `todo`, `subtask`, `subagent`, `mode`. `mcp` exists and works. |
| 3. Shell tool name | `execute_command` (`tool_input.command`). |
| 4. Does Bob IDE reload files changed outside? | Yes, silently, for a clean buffer. |
| 5. Hooks the same in Shell and IDE? | IDE confirmed; Shell not tested (optional, not P0). |

## Facts for fase 02 / 07 / 08

- Hook payload (IDE 2.2.0): `hook_event_name`, `session_id`, `cwd` (absolute workspace root), `tool_name`, `tool_input.path` (workspace-relative), `tool_use_id`, `tool_response` (PostToolUse), `prompt` (UserPromptSubmit), `source` (SessionStart), `last_assistant_message` (Stop). The docs shape (`event`, `tool`, `input`, `output`) was **not** seen.
- Hook cwd = workspace root. No `BOB_*` env vars. Hooks inherit the environment of whatever launched Bob (a Bob started from a terminal passes that terminal's env to hooks).
- A `.js` hook inherits `"type"` from the nearest `package.json`. In a repo with `"type": "module"` a CommonJS hook must be `.cjs` or sit under its own `package.json`.
- MCP stdio server: cwd `/`; pass the workspace with `${workspaceFolder}` (in `args`, or `env`). `radar-mcp` must not resolve `.radar/local.json` from `process.cwd()`.
- Settings and `mcp.json` changes are picked up without restarting Bob.
- Keep `PostToolUse` hook stdout empty (it shows up in the transcript).

## Bob IDE automation (for later slices and C4)

| Step | How |
|---|---|
| App name / version | `/Applications/IBM Bob.app`, bundle `com.ibm.software.bob`, 2.2.0 |
| Launch | quit (`osascript -e 'tell application "IBM Bob" to quit'`), then `env -i HOME=… PATH=… open -a "IBM Bob" --args --remote-debugging-port=9223 <folder>` |
| CDP targets | `page` = workbench (`vscode-file://…/workbench.html`); `iframe` `vscode-webview://…` = Bob chat, content in the inner `iframe` (`contentDocument`) |
| New task | page: `[aria-label="New Task"]` |
| Mode | webview: `[data-testid="mode-selector-trigger"]` → option text (`Agent`, `Plan`, `Ask`, custom mode names) |
| Prompt | webview: focus `[contenteditable=true]`, `document.execCommand('insertText', …)` (newlines are dropped), click `button[aria-label="Send message"]` |
| Approvals | webview: buttons with text `Approve once` / `Reject` under "Tools awaiting approval" |
| Running / idle | webview text contains `esc to cancel` while running |
| Tasks → header | page `[aria-label="Tasks"]`; task row = element with the prompt text + "just now"; header = `div.cursor-pointer` around the `NN.Nk / NNN.Nk` counter → panel with Context Length, Task Id, Workspace, Bobcoins |
| Trust | agent-browser `find text "Manage" click` → button `Trust` |
| agent-browser | 0.38.1 sees only the page target, not the chat webview → use raw CDP (`automation/cdp.mjs`) |

## Bob IDE UI automation over CDP (Bob slice A1 attempt, 26 Sep 2026 00:11 WITA, Lane Core)

Goal: drive the Bob IDE chat without a human (type prompt, submit, poll, capture evidence).

- App: `/Applications/IBM Bob.app`, process name `IBM Bob`, version **2.2.0** (UA `IBMBob/1.126.0+bob2.2.0`, Electron 42.2.0, Chrome 148).
- Launch: `osascript -e 'tell application "IBM Bob" to quit'`, wait 3 s, then
  `open -a "IBM Bob" --args --remote-debugging-port=9223 "<folder>"`. `http://127.0.0.1:9223/json/version` answers.
- `agent-browser` is not installed on Alief's Mac. Used instead: raw CDP over WebSocket (Node 24 global `WebSocket`),
  or Playwright `chromium.connectOverCDP` from `app/node_modules/playwright` for the workbench page.
- The chat UI lives in an out-of-process webview. Playwright `page.frames()` does **not** list it; attach to the target from
  `/json/list` with `type === "iframe"` and URL containing `extensionId=IBM.bob-code`, then `Runtime.evaluate` inside
  `document.querySelector('iframe').contentDocument` (same origin, inner `active-frame`).
- Selectors that worked (inside that document):
  - prompt input: `[role=textbox]` (contenteditable DIV); fill with `focus()` + `document.execCommand('insertText', false, text)`
  - send: `button[aria-label="Send message"]`
  - mode: `button[data-testid=mode-selector-trigger]`; modes in 2.2.0 are **Agent / Plan / Ask** (no "Code")
  - permissions: `button[aria-label=Permissions]` opens per-task auto-approve (Read, Edit, Execute, MCP, Skill, Todo, Subtask, Subagent on; Browser, Mode off)
  - retry after error: `button` with text `Retry`
- Workspace trust dialog: did not appear for the repo root (already trusted).
- Evidence: `radar/scripts/bob-evidence.sh alief 99 uji --force` captured the Bob window (Screen Recording permission works). Test PNG and index row deleted.

**Failure (step 6, polling):** every request ended with "Request Failed". Extension log
(`~/Library/Application Support/IBM Bob/logs/<session>/window1/exthost/IBM.bob-code/IBM Bob.log`):
`[ChatManager] Agent loop failed … ProviderError … Caused by: Forbidden`, plus repeated
`ModelInfoError: Model information unavailable`. Retry failed the same way. The status bar shows instance
`ibm-coding-challenge-2 (Region: us-east)`, not `ibm-coding-challenge-uat` from TODO D2. This is an account/instance
problem, not an automation problem. Fix: TODO D2 (log in with the hackathon IBMid, pick the right instance, check Bobcoin).

Follow-up 00:20 WITA: account refresh (Settings → General → Refresh) did not help. A new task with the prompt
"Reply with the single word: ok" fails with `{"cause":"Forbidden"}` in both Agent and Ask mode. The model-info call
(`fetchModelInfo`) also fails before any prompt is sent, so the block is account-level, not prompt content.
Settings show team `ibm-coding-challenge-2 (region: us-east)` as the only team, enterprise plan, budget 40.00 (0 used),
"Your plan renews on Sep 24" (a date already in the past). New-task button on the workbench: `[aria-label="New Task"]`.

> Umar's Mac (same team `ibm-coding-challenge-2`, same Bob 2.2.0) does **not** get the 403: every test above ran. So the 403 is specific to Alief's IBMid/account, not the team or the instance.
