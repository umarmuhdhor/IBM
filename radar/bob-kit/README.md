# bob-kit

Bob IDE kits installed into a workspace by `radar join` / `radar kit install`:

- `coder/.bob/`: mode `coder`, hooks, `radar-mcp` (fase 07), see `coder/.bob/README.md`
- `pm/.bob/`: mode `pm-lead`, PM tools (fase 08)
- `prompts/`: short prompts for coders (`coder-mulai`, `coder-lanjut`, `coder-selesai`)

Rebuild the generated files with `pnpm -C radar bundle:kit`.
