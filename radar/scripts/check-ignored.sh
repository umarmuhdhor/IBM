#!/usr/bin/env bash
# Fails when a source file is silently dropped by the IBM template .gitignore (R5 §8, NFR-11).
# Example: `access-token.ts` matches `*token*` and would never be committed.
# Works from the repo root or from radar/.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

# Build output, dependencies and local-only files are expected to be ignored.
allowed='(^|/)(node_modules|dist|out|build|coverage|\.next|\.wrangler|\.data|\.radar|\.turbo)/|(^|/)(next-env\.d\.ts|\.dev\.vars(\..*)?|\.env(\..*)?|\.DS_Store)$|\.tsbuildinfo$|\.log$|\.tgz$'

ignored="$(git ls-files --others --ignored --exclude-standard --directory -- radar app/src bob_sessions |
  grep -vE "$allowed" || true)"

if [[ -n "$ignored" ]]; then
  echo "check:ignored FAILED: these files match .gitignore patterns and would not be committed:" >&2
  echo "$ignored" | sed 's/^/  /' >&2
  echo "Rename them (R5 §8), e.g. token.ts -> access.ts, tokens.css -> theme-vars.css." >&2
  exit 1
fi
echo "check:ignored OK: no source file is hidden by .gitignore"
