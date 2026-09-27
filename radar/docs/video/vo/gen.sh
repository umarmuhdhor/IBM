#!/usr/bin/env bash
# Generate the voice-over, one MP3 + character alignment per scene, with ElevenLabs.
# Key: ELEVENLABS_API_KEY in the environment or in the repo-root .env (gitignored).
# Usage: radar/docs/video/vo/gen.sh voices                 # list voices on the account
#        radar/docs/video/vo/gen.sh <voice_id> [out_dir]   # render every scene in script.json
# Env:   MODEL (default eleven_v3), ONLY=<id> to render one scene.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../../.." && pwd)"
if [ -z "${ELEVENLABS_API_KEY:-}" ] && [ -f "$ROOT/.env" ]; then
  ELEVENLABS_API_KEY="$(grep -E '^ELEVENLABS_API_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
fi
: "${ELEVENLABS_API_KEY:?set ELEVENLABS_API_KEY in the env or in $ROOT/.env}"
export ELEVENLABS_API_KEY
MODEL="${MODEL:-eleven_v3}"

if [ "${1:-}" = "voices" ]; then
  curl -fsS "https://api.elevenlabs.io/v1/voices" -H "xi-api-key: $ELEVENLABS_API_KEY" |
    node -e 'const v=JSON.parse(require("fs").readFileSync(0)).voices;for(const x of v)console.log([x.voice_id,x.name,x.labels?.gender,x.labels?.accent,x.labels?.description||x.labels?.descriptive||""].join("\t"))'
  exit 0
fi
VOICE="${1:?voice_id required (run: gen.sh voices)}"
OUT="${2:-$DIR/out}"
mkdir -p "$OUT"
# Scenes run one at a time: the Starter plan allows few concurrent requests.
node - "$DIR/script.json" "$OUT" "$VOICE" "$MODEL" "${ONLY:-}" <<'EOF'
const fs = require("fs");
const [script, out, voice, model, only] = process.argv.slice(2);
// Written form → how it should be said.
const SAY = [
  [/radar-mcp/g, "radar M C P"], [/\bMCP\b/g, "M C P"], [/checkout\.ts/g, "checkout dot T S"],
  [/PreToolUse/g, "Pre-Tool-Use"], [/why_blocked/g, "why blocked"], [/calculateTotal/g, "calculate total"],
  [/\bPM\b/g, "P M"], [/\bIDE\b/g, "I D E"], [/\bAI\b/g, "A I"],
];
const say = t => SAY.reduce((s, [re, r]) => s.replace(re, r), t);
(async () => {
  for (const s of JSON.parse(fs.readFileSync(script, "utf8"))) {
    if (only && s.id !== only) continue;
    const body = { text: say(s.text), model_id: model };
    if (model !== "eleven_v3") body.voice_settings = { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
    else body.voice_settings = { stability: 0.5 };
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) { console.error(s.id, r.status, await r.text()); process.exit(1); }
    const j = await r.json();
    fs.writeFileSync(`${out}/${s.id}.mp3`, Buffer.from(j.audio_base64, "base64"));
    const a = j.alignment;
    fs.writeFileSync(`${out}/${s.id}.align.json`, JSON.stringify({ text: body.text, chars: a.characters, start: a.character_start_times_seconds, end: a.character_end_times_seconds }));
    console.log(`${s.id}\t${a.character_end_times_seconds.at(-1).toFixed(2)}s`);
  }
})();
EOF
