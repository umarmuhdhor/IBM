#!/usr/bin/env bash
# Round A setup (fase 13 step 2): one coder, one plain clone of toko-demo, no Radar.
# usage: bash radar/scripts/ab/setup-round-a.sh <toko-demo clone> <A|B> <start sha>
# Creates branch ab/a-coder<X> at the start commit. Refuses when the Radar kit (.bob hooks) or .radar/ is present,
# so round A really runs without hooks. After the round: bash … --bundle <clone> <X> writes round-a-<X>.bundle
# for the person running merge-check (coders are not collaborators on the repo, so no push).
set -euo pipefail

usage() {
  echo "usage: $0 <toko-demo clone> <A|B> <start sha>" >&2
  echo "       $0 --bundle <toko-demo clone> <A|B>" >&2
  exit 2
}

if [[ "${1:-}" == "--bundle" ]]; then
  [[ $# -eq 3 ]] || usage
  dir=$2 member=$3
  branch="ab/a-coder${member}"
  out="$(pwd)/round-a-${member}.bundle"
  git -C "$dir" bundle create "$out" "$branch"
  echo "bundle: $out (kirim ke yang menjalankan merge-check)"
  echo "di mesin merge: git -C <clone> fetch $out ${branch}:${branch}"
  exit 0
fi

[[ $# -eq 3 ]] || usage
dir=$1 member=$2 base=$3
[[ "$member" == "A" || "$member" == "B" ]] || usage
git -C "$dir" rev-parse --git-dir >/dev/null 2>&1 || { echo "$dir bukan clone git" >&2; exit 1; }

if [[ -e "$dir/.radar" || -e "$dir/.bob/hooks/lock_guard.js" ]]; then
  echo "Radar masih terpasang di $dir (.radar/ atau .bob/hooks). Putaran A harus tanpa Radar:" >&2
  echo "pakai clone baru, atau pindahkan .radar dan .bob keluar folder secara manual." >&2
  exit 1
fi
if [[ -n "$(git -C "$dir" status --porcelain)" ]]; then
  echo "$dir punya perubahan belum di-commit; putaran A harus mulai dari tree bersih." >&2
  exit 1
fi

git -C "$dir" cat-file -e "${base}^{commit}" 2>/dev/null || { echo "commit awal $base tidak ada di $dir (git fetch dulu)" >&2; exit 1; }
branch="ab/a-coder${member}"
git -C "$dir" checkout -q -B "$branch" "$base"

echo "siap: $dir di $branch ($(git -C "$dir" rev-parse --short HEAD))"
echo "prompt: radar/docs/experiment-data/prompts.md (kata demi kata). Commit sekali per task: git -C $dir commit -am \"task <n>\""
echo "stopwatch mulai sekarang (batas 45 menit). Setelah putaran: $0 --bundle $dir $member"
