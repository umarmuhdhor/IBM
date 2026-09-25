# Live Collab PM kit (`.bob/`)

For PC C (the PM). Installed by `radar join … --kit pm`. Generated files (`hooks/*.js`, `radar-mcp.js`) come from
`pnpm -C radar bundle:kit`.

| File | What it does |
|---|---|
| `custom_modes.yaml` | Mode **Live Collab PM Lead** (`pm-lead`): groups `read, mcp` only (no edit, no execute; spike 5) |
| `mcp.json` | `radar-mcp` with `${workspaceFolder}` + `--root`; role `pm` comes from `.radar/local.json`; `alwaysAllow` for the 8 PM tools (safe: every proposal waits for approval in Mission Control, MA-07) |
| `settings.json` | brief on SessionStart/UserPromptSubmit and `stop`. No `lock_guard`: the PM does not write, and the server rejects writes from role pm |
| `package.json` | `{"type": "commonjs"}` for the bundled hooks |

There is no approve, decide or revoke tool. The main agent only proposes.

Onboarding: open the workspace in Bob IDE, **trust it**, pick **Live Collab PM Lead**.
