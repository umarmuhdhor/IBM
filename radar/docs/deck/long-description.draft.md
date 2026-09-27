# IBM Bob Live Collab — Long Description (Problem & Solution Statement)

> Draft for lablab hackathon submission · max 500 words

---

## 1. Problem

AI coding agents were built for solo work. When a team of three developers each runs their own agent on a private copy of the codebase, three parallel realities start drifting apart — and collisions only surface at merge time.

The consequences are measurable:

- **41.7 %** of pull requests opened by different agents against the same repository conflict with each other (vs. 19.8 % when the same agent opens both), across 33,596 PRs and 2,807 repositories (arXiv 2607.04697).
- Teams that adopted AI coding tools saw PR review time increase **+91 %** and average PR size grow **+154 %** (Faros AI).
- Only **35 %** of developers say AI agents consistently follow their team's standards (Qodo State of AI Code Quality 2026).

IBM Bob itself does not yet offer shared sessions or cross-developer agent coordination — its current team features cover seats, billing, and analytics (Bob docs). Its own roadmap names "multiple agents coordinate on a single task" as an upcoming direction (Bob V2 blog). IBM Bob Live Collab builds that direction now, entirely on top of Bob's own primitives.

---

## 2. Solution: IBM Bob Live Collab

IBM Bob Live Collab turns Bob IDE from a solo tool into a live multiplayer workspace — without breaking the rule that every teammate must use their own IBM Bob account.

Three mechanisms make it safe:

1. **Live sync.** Every file written by anyone's Bob is pushed to a shared Collab Server (Cloudflare) and written to every teammate's disk within seconds.
2. **Hard file locks, enforced by Bob's own hook.** Before Bob writes a file, the `PreToolUse` hook requests a lock from the server. If another agent holds that file, the write is blocked and Bob explains why via the `why_blocked` MCP tool. No merge algorithm is needed: one writer, everyone else receives.
3. **A `pm-lead` agent that plans, arbitrates, and reviews.** Bob running in `pm-lead` mode (the PM's machine) breaks work into tasks, assigns file ownership upfront, resolves lock contention, and reviews every task before commit. All decisions are proposals — the human PM approves.

---

## 3. Target Users

Small developer teams (2–5 people) using IBM Bob IDE who collaborate on a shared codebase: hackathon teams, startup sprints, or any time-boxed build where agent drift is a real cost.

---

## 4. How Users Interact

| Touch point | What it does |
|---|---|
| **Bob IDE custom modes** (`coder` / `pm-lead`) | Scopes each agent's permissions and injects a shared team brief at session start via `SessionStart` hook |
| **Bob hooks** (`PreToolUse`, `PostToolUse`, `Stop`, `UserPromptSubmit`) | Enforce file locks, stream live activity to teammates, and broadcast turn boundaries |
| **`radar-mcp` MCP server** | Gives Bob tools: `why_blocked`, `propose_reassign`, `propose_plan` — letting the agent explain and negotiate instead of silently failing |
| **IBM Bob Live Collab desktop app** (macOS `.dmg`, fork of Orca) | Sidebar panels: Mission Control (PM view), Team (watch any teammate's Bob activity live), Files & Locks; runs the sync agent as a child process |
| **Web replay `/demo`** | Jurors replay a real recorded session without login or API keys, with a "Bob inside" panel showing prompts, reads, writes, and blocks |

---

## 5. Why It Is Creative and Unique

| Capability | Git + PR | Live Share / Replit | MCP Agent Mail | Clash | Amoeba / Mosaic | **IBM Bob Live Collab** |
|---|---|---|---|---|---|---|
| Changes visible live on remote disk | No | Yes (humans) | No | No | Partial | **Yes — AI and humans, down to disk** |
| File locks enforced for AI agents | No | No | Signal only | No | Advisory only | **Enforced in `PreToolUse` hook + server** |
| Cross-machine, cross-developer | Yes, but delayed | Yes | Yes | No | Yes | **Yes** |
| Upfront work planning by agent | Manual | No | No | No | Shared plan | **`pm-lead` agent + PM approval** |
| Review before commit | Manual PR | No | No | No | Approval gate | **`pm-lead` agent, per task** |
| Watch teammate's agent live | No | Shared terminal (humans) | No | No | Lane view | **Live Bob IDE activity stream from hooks (P0)** |
| Native IBM Bob support | — | — | Generic | Claude Code | Claude Code / Codex / Cursor | **Native: hook, custom mode, MCP** |

---

## 6. How It Solves the Problem in a New Way

Existing tools treat collaboration as a human-layer concern: developers share a screen, review a PR, or pass a message. IBM Bob Live Collab pushes coordination into the agent layer itself, using Bob's own extension points — hooks, modes, and MCP — rather than wrapping Bob from the outside.

The `PreToolUse` hook is the key insight: it fires *before* a write, giving the system a deterministic interception point that no external wrapper can replicate. Because every agent runs the same hook kit (`.bob/`), the rules are symmetric and tamper-evident. The `pm-lead` agent does not just observe — it holds the task plan, owns conflict resolution, and gates commits, turning a solo-agent workflow into a coordinated build without requiring a new AI framework.

---

<!-- word count: ~414 prose words (excluding table cells and Markdown syntax); ~496 including all table cell text. Both within the 500-word cap. -->
