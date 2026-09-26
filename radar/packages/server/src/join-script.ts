// IN-03 one-command join (D-alief-09): `curl -fsSL <server>/j/K7QM-3XPA | sh`. Served by the Worker with the
// server origin (and the code, for /j/<code>) filled in. It needs no file from the owner: Node comes from nodejs.org
// when missing or too old, the CLI from `<server>/radar-cli.tgz` (Worker static assets), both under ~/.radar, no sudo.
// The code is redeemed by `POST /v1/join`; the token it returns only ever lives in env and .radar/local.json.

/** Characters allowed in values baked into the script. Callers validate first; this is the last guard. */
const SAFE = /^[A-Za-z0-9:/._-]*$/;

export function joinScript(server: string, code: string): string {
  if (!SAFE.test(server) || !SAFE.test(code)) throw new Error('unsafe value for the join script');
  return SCRIPT.replace('__SERVER__', server).replace('__CODE__', code);
}

const SCRIPT = String.raw`#!/bin/sh
# Live Collab: gabung workspace dengan satu kode (IN-03).
# Pasang Node (kalau belum ada) + CLI radar di ~/.radar, gabung, buka IBM Bob IDE, lalu sinkron terus.
set -eu

SERVER='__SERVER__'
BASE="$HOME/.radar"
NODE_MAJOR=24

say() { printf '\033[1m%s\033[0m\n' "$*"; }
dim() { printf '\033[2m%s\033[0m\n' "$*"; }
die() { printf '\033[31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

node_major() { "$1" -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

pick_node() {
  if [ -x "$BASE/node/bin/node" ] && [ "$(node_major "$BASE/node/bin/node")" -ge "$NODE_MAJOR" ]; then
    NODE_BIN="$BASE/node/bin"; return 0
  fi
  if command -v node >/dev/null 2>&1 && [ "$(node_major node)" -ge "$NODE_MAJOR" ] && command -v npm >/dev/null 2>&1; then
    NODE_BIN="$(dirname "$(command -v node)")"; return 0
  fi
  return 1
}

install_node() {
  case "$(uname -s)" in Darwin) os=darwin ;; Linux) os=linux ;; *) die "OS $(uname -s) belum didukung." ;; esac
  case "$(uname -m)" in arm64|aarch64) arch=arm64 ;; x86_64|amd64) arch=x64 ;; *) die "CPU $(uname -m) belum didukung." ;; esac
  say "Memasang Node $NODE_MAJOR di $BASE/node (sekali saja)..."
  tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
  file="$(grep " node-v[0-9.]*-$os-$arch.tar.gz\$" "$tmp/SHASUMS256.txt" | head -1 | awk '{print $2}')"
  [ -n "$file" ] || die "Tidak menemukan Node $NODE_MAJOR untuk $os-$arch."
  curl -fSL --progress-bar "https://nodejs.org/dist/latest-v$NODE_MAJOR.x/$file" -o "$tmp/$file"
  want="$(grep " $file\$" "$tmp/SHASUMS256.txt" | awk '{print $1}')"
  got="$( (shasum -a 256 "$tmp/$file" 2>/dev/null || sha256sum "$tmp/$file") | awk '{print $1}')"
  [ "$want" = "$got" ] || die "Checksum Node tidak cocok; unduhan dibatalkan."
  tar -xzf "$tmp/$file" -C "$tmp"
  rm -rf "$BASE/node"
  mv "$tmp/$(basename "$file" .tar.gz)" "$BASE/node"
  rm -rf "$tmp"
  NODE_BIN="$BASE/node/bin"
}

add_path() {
  line='export PATH="$HOME/.radar/bin:$PATH"'
  [ "$NODE_BIN" = "$BASE/node/bin" ] && line='export PATH="$HOME/.radar/bin:$HOME/.radar/node/bin:$PATH"'
  for rc in "$HOME/.zprofile" "$HOME/.zshrc" "$HOME/.bash_profile"; do
    [ "$rc" = "$HOME/.bash_profile" ] && [ ! -f "$rc" ] && continue
    if [ -f "$rc" ] && grep -q '# Live Collab (radar)' "$rc"; then
      # Replace our own line so a later Node install is picked up.
      tmprc="$(mktemp)"
      awk -v l="$line" 'p { print l; p = 0; next } /# Live Collab \(radar\)/ { p = 1 } { print }' "$rc" > "$tmprc" && cat "$tmprc" > "$rc" && rm -f "$tmprc"
    else
      printf '\n# Live Collab (radar)\n%s\n' "$line" >> "$rc"
    fi
  done
}

main() {
  code='__CODE__'
  [ "$#" -gt 0 ] && [ -n "$1" ] && code="$1"
  [ -n "$code" ] || die "Kode gabung kosong. Pakai: curl -fsSL $SERVER/join.sh | sh -s KODE"
  command -v curl >/dev/null 2>&1 || die "curl tidak ada."
  mkdir -p "$BASE/bin"

  pick_node || install_node
  dim "node: $NODE_BIN/node ($("$NODE_BIN/node" -v))"

  say "Memasang CLI radar dari $SERVER..."
  PATH="$NODE_BIN:$PATH" "$NODE_BIN/npm" install -g --prefix "$BASE/cli" "$SERVER/radar-cli.tgz" \
    --no-audit --no-fund --no-update-notifier --loglevel=error --prefer-online </dev/null >/dev/null \
    || die "Gagal memasang CLI radar (cek koneksi internet)."
  entry="$BASE/cli/lib/node_modules/@radar/sync/dist/radar.mjs"
  [ -f "$entry" ] || die "CLI radar terpasang tapi file radar.mjs tidak ketemu."
  # Wrapper pins the Node chosen here, so nvm or an older system Node never runs the CLI.
  printf '#!/bin/sh\nexec "%s/node" "%s" "$@"\n' "$NODE_BIN" "$entry" > "$BASE/bin/radar"
  chmod +x "$BASE/bin/radar"
  add_path
  export PATH="$BASE/bin:$NODE_BIN:$PATH"

  # Kode terbuka (D-alief-10) butuh nama dan peran; kode yang sudah milik member mengabaikannya.
  name="$(printenv RADAR_NAME || true)"
  role="$(printenv RADAR_ROLE || true)"
  if [ -z "$name" ] && [ -r /dev/tty ]; then printf 'Nama kamu: ' >/dev/tty; read -r name </dev/tty || name=''; fi
  if [ -z "$role" ] && [ -r /dev/tty ]; then printf 'Peran (coder/pm) [coder]: ' >/dev/tty; read -r role </dev/tty || role=''; fi
  case "$role" in pm|PM) role=pm ;; *) role=coder ;; esac

  say "Menukar kode $code..."
  info="$(RADAR_SERVER="$SERVER" RADAR_CODE="$code" RADAR_NAME="$name" RADAR_ROLE="$role" "$NODE_BIN/node" --input-type=module -e '
    const body = { code: process.env.RADAR_CODE, role: process.env.RADAR_ROLE };
    if (process.env.RADAR_NAME) body.name = process.env.RADAR_NAME;
    const r = await fetch(process.env.RADAR_SERVER + "/v1/join", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch((e) => { console.error("Server tidak bisa dihubungi: " + e.message); process.exit(1); });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { console.error(j?.error?.message ?? ("HTTP " + r.status)); process.exit(1); }
    console.log([j.workspace, j.member, j.role, j.invite].join("\t"));
  ' </dev/null)" || die "Kode tidak bisa dipakai (lihat pesan di atas)."
  ws="$(printf '%s' "$info" | cut -f1)"
  member="$(printf '%s' "$info" | cut -f2)"
  role="$(printf '%s' "$info" | cut -f3)"
  invite="$(printf '%s' "$info" | cut -f4)"
  case "$ws" in ''|*[!A-Za-z0-9._-]*) die "Nama workspace dari server tidak valid." ;; esac

  dir="$HOME/live-collab/$ws"
  mkdir -p "$dir"
  say "Gabung ke $ws sebagai $member ($role) di $dir"

  RADAR_INVITE="$invite" "$BASE/bin/radar" join --dir "$dir" </dev/null &
  pid=$!
  trap 'kill "$pid" 2>/dev/null; exit 130' INT TERM

  i=0
  while [ "$i" -lt 60 ] && [ ! -f "$dir/.bob/mcp.json" ] && kill -0 "$pid" 2>/dev/null; do sleep 1; i=$((i + 1)); done
  if kill -0 "$pid" 2>/dev/null; then
    if [ "$(uname -s)" = Darwin ] && open -Ra "IBM Bob" 2>/dev/null; then
      open -a "IBM Bob" "$dir" && say "IBM Bob IDE dibuka di $dir. Klik Trust, pilih mode Live Collab $( [ "$role" = pm ] && echo 'PM Lead' || echo 'Coder')."
    else
      say "Buka folder $dir di IBM Bob IDE."
    fi
    say "Biarkan terminal ini terbuka selama kerja. Nanti lanjut lagi: cd $dir && radar start"
  fi
  wait "$pid"
}

# Everything runs from main, so a partly downloaded script never executes half-way.
main "$@"
`;
