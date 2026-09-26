import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { runProcess } from '../../shared/child-process/run-process'
import { radarCliDir } from './sync-agent'

// Why: Bob IDE starts the Live Collab hooks and radar-mcp with `node`. A teammate who installed
// only this app has no Node, so ~/.radar/bin gets `node` and `radar` shims that run the app's own
// Electron binary in Node mode, and the login shell PATH (which Bob IDE resolves) gains ~/.radar/bin.

const MARK = '# Live Collab (radar)'

async function shellHasNode(): Promise<boolean> {
  const result = await runProcess({
    program: process.env.SHELL || '/bin/zsh',
    args: ['-ilc', 'command -v node'],
    timeoutMs: 8000
  }).catch(() => null)
  return result?.code === 0 && result.stdout.trim().length > 0
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function writeShim(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`)
  chmodSync(path, 0o755)
}

function addPathLine(): void {
  const line = 'export PATH="$HOME/.radar/bin:$PATH"'
  for (const rc of ['.zprofile', '.zshrc', '.bash_profile']) {
    const file = join(homedir(), rc)
    if (rc === '.bash_profile' && !existsSync(file)) {
      continue
    }
    const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
    if (!text.includes(MARK)) {
      appendFileSync(file, `\n${MARK}\n${line}\n`)
    }
  }
}

/** Installs the shims once. Never replaces a real Node the user already has. */
export async function ensureNodeForBob(): Promise<void> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return
  }
  const bin = join(homedir(), '.radar', 'bin')
  mkdirSync(bin, { recursive: true })
  const electron = quote(process.execPath)
  writeShim(
    join(bin, 'radar'),
    `ELECTRON_RUN_AS_NODE=1 exec ${electron} ${quote(join(radarCliDir(), 'dist', 'radar.mjs'))} "$@"`
  )
  if (existsSync(join(bin, 'node')) || (await shellHasNode())) {
    addPathLine()
    return
  }
  writeShim(join(bin, 'node'), `ELECTRON_RUN_AS_NODE=1 exec ${electron} "$@"`)
  addPathLine()
}
