// Live Collab: bundles the radar sync CLI + Bob kit into resources/radar-cli, which ships as an
// extraResource so the app can sync a joined workspace without Node installed (D-alief-09).
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const out = fileURLToPath(new URL('../../resources/radar-cli', import.meta.url))
const sync = fileURLToPath(new URL('../../../radar/packages/sync', import.meta.url))
execFileSync(process.execPath, ['scripts/bundle-standalone.mjs', out], {
  cwd: sync,
  stdio: 'inherit'
})
