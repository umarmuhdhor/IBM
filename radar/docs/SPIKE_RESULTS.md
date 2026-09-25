# Spike results (fase 01, GATE 1)

> Skeleton from fase 00. Filled in by the owning phase.

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
