#!/usr/bin/env bash
# Generate the voice-over, one MP3 per scene, with ElevenLabs.
# Key: ELEVENLABS_API_KEY in the environment or in the repo-root .env (gitignored).
# Usage: radar/docs/video/vo/gen.sh voices        # list voices on the account
#        radar/docs/video/vo/gen.sh <voice_id>    # render every scene in script.json
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/../../../.." && pwd)"
if [ -z "${ELEVENLABS_API_KEY:-}" ] && [ -f "$ROOT/.env" ]; then
  ELEVENLABS_API_KEY="$(grep -E '^ELEVENLABS_API_KEY=' "$ROOT/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')"
fi
: "${ELEVENLABS_API_KEY:?set ELEVENLABS_API_KEY in the env or in $ROOT/.env}"
API=https://api.elevenlabs.io/v1
MODEL="${MODEL:-eleven_multilingual_v2}"

if [ "${1:-}" = "voices" ]; then
  curl -fsS "$API/voices" -H "xi-api-key: $ELEVENLABS_API_KEY" |
    node -e 'const v=JSON.parse(require("fs").readFileSync(0)).voices;for(const x of v)console.log([x.voice_id,x.name,x.labels?.gender,x.labels?.accent,x.labels?.description||x.labels?.descriptive||""].join("\t"))'
  exit 0
fi
VOICE="${1:?voice_id required (run: gen.sh voices)}"
mkdir -p "$DIR/out"
node -e 'for(const s of require(process.argv[1]))console.log(s.id+"\t"+s.text)' "$DIR/script.json" |
while IFS=$'\t' read -r id text; do
  body="$(node -e 'console.log(JSON.stringify({text:process.argv[1],model_id:process.argv[2],voice_settings:{stability:0.45,similarity_boost:0.8,style:0.25,use_speaker_boost:true}}))' "$text" "$MODEL")"
  curl -fsS "$API/text-to-speech/$VOICE?output_format=mp3_44100_128" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
    -d "$body" -o "$DIR/out/$id.mp3"
  printf '%s\t%ss\n' "$id" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DIR/out/$id.mp3")"
done
