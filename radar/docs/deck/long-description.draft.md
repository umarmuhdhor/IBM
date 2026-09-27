# IBM Bob Live Collab — Long Description (Problem & Solution Statement)

> Draft for lablab hackathon submission · max 500 words

---

## 1. Problem

AI coding agents were built for solo work. When a team of three developers each runs their own agent on a private copy of the codebase, three parallel realities start drifting apart — and collisions only surface at merge time.

The consequences are measurable:

- **41.7 %** of PR pairs opened by different agents against the same repository conflict with each other (vs. 19.8 % when the same agent opens both), across 33,596 PRs and 2,807 repositories (arXiv 2607.04697).
- Teams that adopted AI coding tools saw PR review time increase **+91 %** and average PR size grow **+154 %** (Faros AI).
- Only **35 %** of developers say AI agents consistently follow their team's standards (Qodo State of AI Code Quality 2026).

IBM Bob itself does not yet offer shared sessions or cross-developer agent coordination — its current team features cover seats, billing, and analytics (Bob docs). Its own roadmap names "multiple agents coordinate on a single task" as an upcoming direction (Bob V2 blog). IBM Bob Live Collab builds that direction now, entirely on top of Bob's own primitives.

---

## 2. Solution: IBM Bob Live Collab

IBM Bob Live Collab turns Bob IDE from a solo tool into a live multiplayer workspace — without breaking the rule that every teammate must use their own IBM Bob account.

Three mechanisms make it safe:

1. **Live sync.** Every file written by anyone's Bob is pushed to a shared Collab Server (Cloudflare) and written to every teammate's disk in under a second.
2. **Hard file locks, enforced by Bob's own hook.** Before Bob writes a file, the `PreToolUse` hook requests a lock from the server. If another agent holds that file, the write is blocked and Bob explains why via the `why_blocked` MCP tool. No merge algorithm is needed: one writer, everyone else receives.
3. **A `pm-lead` agent that plans, arbitrates, and reviews.** Bob running in `pm-lead` mode (the PM's machine) breaks work into tasks, assigns file ownership upfront, resolves lock contention, and reviews every task before commit. All decisions are proposals — the human PM approves.

---

## 3. Target Users

Small developer teams (2–5 people) using IBM Bob IDE who collaborate on a shared codebase: hackathon teams, startup sprints, or any time-boxed build where agent drift is a real cost.

---

## 4. How Users Interact

| Touch point | What it does |
|---|---|
| **Bob IDE custom modes** (`coder` / `pm-lead`) | Give each agent its role, tools, and rules |
| **Bob hooks** (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`) | Inject the team brief, enforce file locks, stream live activity to teammates, and mark turn boundaries |
| **`radar-mcp` MCP server** | Gives Bob tools such as `why_blocked`, `request_file`, `propose_plan`, `propose_decision`, `propose_review`, letting the agent explain and negotiate instead of silently failing |
| **IBM Bob Live Collab desktop app** (macOS `.dmg`, fork of Orca) | Sidebar panels: Mission Control (PM view), Team (watch any teammate's Bob activity live), Files & Locks; runs the sync agent as a child process |
| **Web replay `/demo`** | Jurors replay a real recorded session without login or API keys, with a "Bob inside" panel showing prompts, reads, writes, and blocks |

---

## 5. Why It Is Creative and Unique

| Capability | Git + PR | Live Share / Replit | MCP Agent Mail | Clash | Amoeba | Mosaic | **IBM Bob Live Collab** |
|---|---|---|---|---|---|---|---|
| Changes visible live on other machines | No | Yes (humans) | No | No | Yes (session diff) | No (async handoff) | **Yes — AI and humans, down to disk** |
| File locks for AI agents | No | No | Signal only | No | Advisory only | No | **Enforced in `PreToolUse` hook + server** |
| Cross-machine, cross-developer | Yes, but delayed | Yes | Yes | No | Yes | Yes | **Yes** |
| Upfront work planning | Manual | No | No | No | Shared plan | No | **`pm-lead` agent + PM approval** |
| Review before commit | Manual PR | No | No | No | Approval gate | No | **`pm-lead` agent + PM, per task** |
| Watch teammate's agent live | No | Shared terminal (humans) | No | No | Live lanes | Yes (shared terminal) | **Live Bob IDE activity stream from hooks** |
| IBM Bob support | — | — | Generic | Claude Code | Claude Code, Codex | Claude Code, Cursor | **Native: hook, custom mode, MCP** |

---

## 6. How It Solves the Problem in a New Way

Existing tools treat collaboration as a human-layer concern: developers share a screen, review a PR, or pass a message. IBM Bob Live Collab pushes coordination into the agent layer itself, using Bob's own extension points — hooks, modes, and MCP — rather than wrapping Bob from the outside.

The `PreToolUse` hook is the key insight: it fires *before* a write, giving the system a deterministic interception point that no external wrapper can replicate. Because every agent runs the same hook kit (`.bob/`), the rules are symmetric, and the server rejects any write without a lock even if a hook is skipped. The `pm-lead` agent does not just observe — it proposes the task plan, lock decisions, and reviews, and the human PM approves before anything is committed, turning a solo-agent workflow into a coordinated build without requiring a new AI framework.

---

<!-- word count (recounted): ~560 prose words without tables, ~830 including table cells. OVER the 500-word cap — trim in fase 14 step 8 (SUBMISSION.md). -->
