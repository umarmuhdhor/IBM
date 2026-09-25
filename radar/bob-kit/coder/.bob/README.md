# Live Collab coder kit (`.bob/`)

Installed into a workspace by `radar join` / `radar kit install coder`. Generated files (`hooks/*.js`, `radar-mcp.js`) come from
`pnpm -C radar bundle:kit`; do not edit them by hand.

| File | What it does |
|---|---|
| `custom_modes.yaml` | Mode **Live Collab Coder** (`coder`): groups `read, edit, execute, mcp` |
| `rules-coder/01-radar.md` | What to do when an edit is refused (never retry, never via shell, call `why_blocked`) |
| `settings.json` | 5 lifecycle hooks: brief (SessionStart/UserPromptSubmit), `lock_guard` (PreToolUse, edit tools), `mark_ai_edit` (PostToolUse), `stop` |
| `mcp.json` | `radar-mcp` over stdio with `${workspaceFolder}` (Bob starts stdio servers with cwd `/`) and `alwaysAllow` for the 5 coder tools |
| `package.json` | `{"type": "commonjs"}` so the bundled hooks run as CommonJS even in a `"type": "module"` project |

## Onboarding (Bob IDE ≥ 2.1.0)

1. Open the workspace folder in Bob IDE and **trust it**. An untrusted folder shows "Restricted Mode" and an empty Bob panel.
2. Pick the mode **Live Collab Coder**.
3. Start a new task: the first lines of Bob's context are the `[Radar]` brief.
4. Do not edit `.bob/mcp.json` right before a demo: the first MCP call after a change asks for approval once.

Facts behind these choices: `radar/docs/SPIKE_RESULTS.md`, `plan/log/DECISIONS.md` D-umar-01.
