#!/usr/bin/env bash
# Capture the IBM Bob IDE task summary as judging evidence (R7 §2–§3).
#
# usage: bob-evidence.sh <nama> <NN> <slug> [--interactive] [--force]
#   <nama>         member id from plan/team.json (alief, umar, aarief, imelda)
#   <NN>           task number per member, two digits (01, 02, …)
#   <slug>         short description, [a-z0-9_]+ (e.g. toko_demo)
#   --interactive  pick the region by hand (screencapture -i) instead of the Bob IDE window
#   --force        overwrite an existing PNG without asking
#
# Output: bob_sessions/<team>_<nama>_task<NN>_<slug>_summary.png + one row in bob_sessions/INDEX.md
# exit 0 ok · 1 arguments · 2 window/screenshot failed
# (--md <path> and the secret filter, exit 3/4, are added by Bob slice C4 in fase 11.)
#
# Never reads .env or .radar/. macOS needs Screen Recording permission for the terminal once
# (System Settings → Privacy & Security → Screen Recording).
set -euo pipefail

usage() {
  sed -n '4,10p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 1
}

die() {
  echo "bob-evidence: $2" >&2
  exit "$1"
}

interactive=false
force=false
args=()
for arg in "$@"; do
  case "$arg" in
    --interactive) interactive=true ;;
    --force) force=true ;;
    -h | --help) usage ;;
    --*) die 1 "unknown option: $arg" ;;
    *) args+=("$arg") ;;
  esac
done
[[ ${#args[@]} -eq 3 ]] || usage
name="${args[0]}"
num="${args[1]}"
slug="${args[2]}"

root="$(git rev-parse --show-toplevel 2>/dev/null)" || die 1 "run inside the IBM repo"
team_file="$root/plan/team.json"
[[ -f "$team_file" ]] || die 1 "missing plan/team.json"

team="$(node -e 'const t=require(process.argv[1]); process.stdout.write(t.team || "")' "$team_file")"
lane="$(node -e '
  const t = require(process.argv[1]);
  const m = t.members.find((x) => x.id === process.argv[2]);
  process.stdout.write(m ? m.lane : "");
' "$team_file" "$name")"

[[ -n "$team" ]] || die 1 "plan/team.json has no 'team' field"
[[ -n "$lane" ]] || die 1 "unknown member '$name' (see plan/team.json)"
[[ "$num" =~ ^[0-9]{2}$ ]] || die 1 "task number must be two digits, got '$num'"
[[ "$slug" =~ ^[a-z0-9_]+$ ]] || die 1 "slug must match [a-z0-9_]+, got '$slug'"
[[ "$team" =~ ^[a-z0-9_]+$ ]] || die 1 "team name in plan/team.json must match [a-z0-9_]+"

sessions="$root/bob_sessions"
file="${team}_${name}_task${num}_${slug}_summary.png"
out="$sessions/$file"
# The IBM template .gitignore silently drops names like these (R5 §8); refuse before capturing.
[[ ! "$file" =~ (token|secret|password|credential|api_?key) ]] ||
  die 1 "'$file' would be git-ignored by the IBM template; pick another slug"
mkdir -p "$sessions"

if [[ -e "$out" && "$force" != true ]]; then
  if [[ -t 0 ]]; then
    read -r -p "$file already exists. Overwrite? [y/N] " answer
    [[ "$answer" =~ ^[Yy]$ ]] || die 1 "kept existing $file"
  else
    die 1 "$file already exists (pass --force to overwrite)"
  fi
fi

# Largest on-screen window owned by the IBM Bob IDE process (CGWindowListCopyWindowInfo).
find_bob_window() {
  osascript -l JavaScript <<'JXA'
ObjC.import('CoreGraphics');
const ref = $.CGWindowListCopyWindowInfo(
  $.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements,
  $.kCGNullWindowID,
);
const windows = ObjC.deepUnwrap(ObjC.castRefToObject(ref)) || [];
const owners = ['IBM Bob', 'Bob'];
const bob = windows
  .filter((w) => w.kCGWindowLayer === 0 && owners.includes(w.kCGWindowOwnerName))
  .map((w) => ({ id: w.kCGWindowNumber, area: w.kCGWindowBounds.Width * w.kCGWindowBounds.Height }))
  .filter((w) => w.area > 200 * 200)
  .sort((a, b) => b.area - a.area);
bob.length ? String(bob[0].id) : '';
JXA
}

if [[ "$interactive" == true ]]; then
  echo "bob-evidence: select the Bob IDE task summary with the mouse…" >&2
  screencapture -i -o "$out" || die 2 "interactive screenshot cancelled or failed"
else
  window_id="$(find_bob_window 2>/dev/null || true)"
  [[ -n "$window_id" ]] || die 2 "IBM Bob IDE window not found on screen (open it, or use --interactive)"
  screencapture -o -x -l "$window_id" "$out" || die 2 "screencapture failed (Screen Recording permission?)"
fi
[[ -s "$out" ]] || die 2 "screenshot is empty: $out"

index="$sessions/INDEX.md"
if [[ ! -f "$index" ]]; then
  cat >"$index" <<'MD'
# IBM Bob session evidence

| File | Member | Lane / phase | Date (WITA) | Summary | Files Bob helped with | Bobcoin |
|---|---|---|---|---|---|---|
MD
fi
if ! grep -qF "[$file]" "$index"; then
  date_wita="$(TZ=Asia/Makassar date '+%Y-%m-%d %H:%M')"
  echo "| [$file]($file) | $name | $lane / task $num | $date_wita | ${slug//_/ } | – | – |" >>"$index"
fi

echo "bob_sessions/$file"
