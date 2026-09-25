# Spike fase 01 (not part of the product)

Throwaway checks for GATE 1 (`plan/fase-01-spike-gate1.md`). Results go to `radar/docs/SPIKE_RESULTS.md`.
Open **this folder** (`radar/spike/`) as the workspace in Bob IDE and **trust it** (untrusted folders skip hooks, MCP and rules silently).

```bash
cd radar/spike
pnpm install --ignore-workspace   # chokidar, ws, tsx (only for spike 4)
pnpm test                         # node:test for block_edit.js and the MCP echo server
./use.sh <variant>                # switch hook / MCP variants, then reload Bob IDE
```

| File | Purpose |
|---|---|
| `.bob/settings.json` | All five hook events → `hooks/log_payload.js <event>`; `PreToolUse` without matcher → `pre-all`; edit tools → `block_edit.js`; `PostToolUse` → `timing.js` too. Every hook has an explicit `timeout`. |
| `.bob/custom_modes.yaml` | `spike-coder` `[read, edit, execute, mcp]`, `spike-cmd-typo` `[read, command]`, `spike-readonly` `[read, mcp]` (Bob slice B1) |
| `.bob/mcp.json` | `radar-spike` stdio server via `${workspaceFolder}/mcp/echo-server.mjs` (Bob starts stdio servers with cwd `/`), `alwaysAllow: ["ping"]` |
| `hooks/log_payload.js` | Dumps each payload to `out/<event>-<ts>.json` and prints `SPIKE-MARKER <event> <ts>` on stdout (Bob slice B1) |
| `hooks/block_edit.js` | Exit 2 + stderr for `*locked.ts`; `--json` and `--sleep N` variants; logs `out/pre-block-*.json` with the path field it found |
| `hooks/timing.js` | Hook mode: node process lifetime → `out/timing-*.json`. `--bench N`: spawn cost of `block_edit.js` |
| `mcp/echo-server.mjs` | `ping({note})` → `pong <note> role=<RADAR_ROLE> cwd=<cwd>`; requests logged to `out/mcp-<pid>.jsonl` |
| `sync/relay.ts`, `sync/two-dir.ts` | Spike 4: chokidar 4 in `out/sync/A` ↔ `out/sync/B` through a `ws` relay, debounce 150 ms, hash anti-echo, atomic write |
| `sandbox/{a,b,locked}.ts` | Edit targets |
| `out/` | Evidence, `out/sync/{A,B}` for spike 4 (git-ignored). Copy one **redacted** payload per event to `radar/docs/spike-payloads/`. |

## Variants (`./use.sh`)

| Variant | Spike | Effect |
|---|---|---|
| `default` | 1, 1b, 2, 20 | block = stderr + exit 2, timeout 10 s |
| `json` | 2b | block = `{"decision":"block"}` on stdout + exit 0 |
| `sleep` | 19 | sleep 15 s then exit 2, hook timeout 10 s |
| `mcp-noallow` / `mcp-allow` | 18 | remove / restore `alwaysAllow` |
| `mcp-abs` | 6 (fallback) | absolute path to the MCP server if Bob does not start it with a relative path |

## Per spike

| # | How | Evidence |
|---|---|---|
| 1, 1b | Mode `spike-coder`: "Tambahkan komentar `// hi` di sandbox/locked.ts", then the same on `sandbox/a.ts` once per edit tool | `out/pre-block-*.json` (`pathField`, `decision`), `git diff sandbox/` |
| 2 | Ask Bob: "Pesan persis apa yang kamu terima dari hook tadi?" | Bob answer (screenshot), Bob output log |
| 2b | `./use.sh json`, repeat 1 | `sandbox/locked.ts` changed or not |
| 3 | New task: "Sebutkan semua baris yang diawali SPIKE-MARKER di konteksmu" | Bob answer |
| 4 | `pnpm bench` (one Mac) or `pnpm relay` + `tsx sync/two-dir.ts --side A/B --relay ws://<ip>:8799` (two Macs) | printed `BENCH … p50/p95/max`, `GATE spike 4: PASS/FAIL` |
| 4b | Open `out/sync/B/x.ts` in Bob IDE, change `out/sync/A/x.ts` | editor reloads / prompts / stale |
| 5 | Mode `spike-readonly`: "Tulis 'x' ke sandbox/a.ts, wajib" | `git diff sandbox/a.ts` empty |
| 6 | In `spike-coder` and `spike-readonly`: "Panggil tool ping dari radar-spike dengan note=halo" | `pong halo role=coder cwd=…`, `out/mcp-*.jsonl` |
| 8 | `pnpm timing` + `out/timing-post-*.json` | ms |
| 9, 10, 15 | Read `out/pre-all-*.json`, `out/post-*.json`, `out/prompt-*.json`, `out/stop-*.json` | tool names, field names |
| 17 | Open a fresh copy of this folder without trusting it, repeat 1 | no `out/` files while untrusted |
| 18 | `./use.sh mcp-noallow`, call ping; `./use.sh mcp-allow`, call again | approve prompt yes/no |
| 19 | `./use.sh sleep`, repeat 1 | `locked.ts` changed (fail-open) or not |
| 20 | (a) "Pakai subagent general untuk menambah `// hi` di sandbox/locked.ts" (b) mode `spike-cmd-typo`: "jalankan `ls`" | (a) `pre-block` record + file unchanged (b) no `execute_command` |

Reset sandbox after each edit test: `git checkout -- sandbox/`.

## Automation (no clicks in Bob IDE)

```bash
env -i HOME="$HOME" USER="$USER" SHELL=/bin/zsh PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin" TMPDIR="$TMPDIR" \
  open -a "IBM Bob" --args --remote-debugging-port=9223 "$PWD"      # clean env: Bob hooks inherit the launcher's env
node automation/bobrun.mjs --mode "Spike Coder" --prompt "…" [--approve all|none] [--timeout 300]
node automation/cdp.mjs webview 'return doc.body.innerText.slice(-500)'
```
Selectors are listed in `radar/docs/SPIKE_RESULTS.md` (section "Bob IDE automation").
