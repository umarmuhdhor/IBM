#!/usr/bin/env bash
# Switch spike variants in .bob/ (fase 01). Run from anywhere; edits radar/spike/.bob/*.json in place.
#
# usage: ./use.sh <variant>
#   default      block_edit.js: stderr + exit 2, timeout 10       (spike 1, 1b, 2, 20)
#   json         block_edit.js --json: JSON on stdout + exit 0     (spike 2b)
#   sleep        block_edit.js --sleep 15 with timeout 10          (spike 19)
#   mcp-allow    .bob/mcp.json with alwaysAllow ["ping"]           (spike 6, 18b)
#   mcp-noallow  .bob/mcp.json without alwaysAllow                 (spike 18a)
#   mcp-abs      .bob/mcp.json with an absolute server path        (fallback when spike 6 fails on a relative path)
# After switching, reload Bob IDE (Developer: Reload Window) or start a new task so Bob rereads .bob/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
variant="${1:-}"
[[ -n "$variant" ]] || { sed -n '4,11p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

node - "$here" "$variant" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const [dir, variant] = process.argv.slice(2);
const settingsFile = path.join(dir, '.bob', 'settings.json');
const mcpFile = path.join(dir, '.bob', 'mcp.json');
const edit = (file, fn) => {
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  fn(json);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`use.sh: ${variant} → ${path.relative(dir, file)}`);
};
const blockHook = (json) =>
  json.hooks.PreToolUse.find((e) => e.matcher).hooks[0];
const server = (json) => json.mcpServers['radar-spike'];
const variants = {
  default: () => edit(settingsFile, (j) => Object.assign(blockHook(j), { command: 'node hooks/block_edit.js', timeout: 10 })),
  json: () => edit(settingsFile, (j) => Object.assign(blockHook(j), { command: 'node hooks/block_edit.js --json', timeout: 10 })),
  sleep: () => edit(settingsFile, (j) => Object.assign(blockHook(j), { command: 'node hooks/block_edit.js --sleep 15', timeout: 10 })),
  'mcp-allow': () => edit(mcpFile, (j) => { server(j).alwaysAllow = ['ping']; }),
  'mcp-noallow': () => edit(mcpFile, (j) => { delete server(j).alwaysAllow; }),
  'mcp-abs': () => edit(mcpFile, (j) => { server(j).args = [path.join(dir, 'mcp', 'echo-server.mjs')]; }),
};
if (!variants[variant]) { console.error(`use.sh: unknown variant '${variant}'`); process.exit(1); }
variants[variant]();
JS
