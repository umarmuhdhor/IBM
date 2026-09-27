# Submission (fase 14)

> Skeleton from fase 00. Filled in by the owning phase.

## IBM Bob Usage Statement

> Owner: Umar (lane Bob). Source of truth: [`BOB_DEVELOPMENT.md`](../../BOB_DEVELOPMENT.md), evidence in [`bob_sessions/INDEX.md`](../../bob_sessions/INDEX.md). Limit 500 words.

IBM Bob is both the engine of IBM Bob Live Collab and the tool we built it with.

**Bob inside the product.** Every coder and the PM work in Bob IDE. Joining a workspace installs a `.bob/` kit that turns Bob into a team player:

- Two **custom modes**. `coder` works only on its own task's files. `pm-lead` has read and MCP tools only: it can plan, arbitrate and review, but it cannot write code or approve its own proposals.
- **Hooks.** A `PreToolUse` hook asks the Live Collab server before every write. If another teammate's Bob holds the file, the hook exits 2 and the server's explanation reaches Bob as the tool error. Bob then explains the block, calls `why_blocked`, and moves to other work instead of retrying. `SessionStart` and `UserPromptSubmit` hooks inject a short team brief (your task, your files, new PM decisions, notifications). `PostToolUse` and `Stop` hooks stream Bob IDE activity, so teammates can watch each other's Bob live in the desktop app.
- **`radar-mcp`**, an MCP server with 13 tools. Coders get `my_tasks`, `why_blocked`, `request_file`, `submit_task` and `team_activity`. The PM agent gets `propose_plan`, `propose_decision`, `get_task_diff`, `propose_review`, `notify` and more. Every proposal still needs a human click in Mission Control.

We verified this against the real server with an integration test and seven Bob IDE sessions. Bob PM planned without giving one file to two tasks. Bob coder stopped at the lock without shell workarounds. The PM agent returned a task whose own callers were broken, and approved-and-notified when only a teammate's file was affected.

**Bob as the builder.** Each of the four members built slices in Bob IDE. Every slice has a task-summary screenshot in `bob_sessions/`, and its code was committed unchanged with a `Bob-Assisted` trailer; human fixes went into separate commits.

- **Alief:** the `toko-demo` repo, the lock engine's `checkWrite` decision table, and the commit formatter. Bob also cross-reviewed the lock engine against the spec in Ask mode.
- **Umar:** the hook spike that settled how Bob IDE 2.2 reports blocks, the `coder` mode, the hooks, and both sets of MCP tools.
- **Aarief:** Bob onboarded the ~23k-file Orca codebase our desktop app is forked from, registered Bob as an app agent, and built the UI components and the evidence scripts.
- **Imelda:** the replay player and the landing page.

We also used Bob to test Bob: ten behaviour sessions checked the modes, hooks and tools before the demo.

**Numbers** (Sun 27 Sep, 09:00 WITA):
- 25 task-summary screenshots.
- 14 slices with `Bob-Assisted` trailers on `main`.
- About 23 Bobcoin recorded across the four accounts (Alief 7.24, Umar 5.56, Aarief 5.04, Imelda 5.17).

**What we learned about Bob IDE 2.2:** an exit-2 hook message reaches the model, hooks fail open on timeout (so the server stays the real guard), and untrusted workspaces disable the Bob panel.

**watsonx:** not used.
