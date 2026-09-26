import { access } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import type { RadarChecks } from '../../shared/radar-checks'

// Same launcher as the `bob` TUI agent: Bob Shell 2.0.5 needs Node 24 for node:sqlite.
const BOB_LAUNCHER =
  'if [ -s "$HOME/.nvm/nvm.sh" ]; then . "$HOME/.nvm/nvm.sh" >/dev/null && nvm exec 24 bob "$@"; else exec bob "$@"; fi'
const BOB_VERSION_TIMEOUT_MS = 10_000

async function readBobVersion(): Promise<string | null> {
  try {
    const result = await runProcess({
      program: 'sh',
      args: ['-c', BOB_LAUNCHER, 'bob', '--version'],
      timeoutMs: BOB_VERSION_TIMEOUT_MS,
      maxOutputBytes: 4096
    })
    // nvm prints "Running node vX" first; Bob follows the version with a "commit:" line.
    const version = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .find((line) => !line.startsWith('Running node') && /\d+\.\d+\.\d+/.test(line))
    return result.code === 0 && !result.timedOut && version ? version : null
  } catch {
    return null
  }
}

async function hasBobSettings(workspacePath: string | null): Promise<boolean | null> {
  if (!workspacePath || !isAbsolute(workspacePath)) {
    return null
  }
  try {
    await access(join(workspacePath, '.bob', 'settings.json'))
    return true
  } catch {
    return false
  }
}

export async function runRadarChecks(workspacePath: string | null): Promise<RadarChecks> {
  const [bobVersion, bobSettings] = await Promise.all([
    readBobVersion(),
    hasBobSettings(workspacePath)
  ])
  return { bobVersion, bobSettings }
}
