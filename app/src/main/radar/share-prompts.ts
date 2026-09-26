import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

// Hooks read `shareprompts` (boolean) from <workspace>/.radar/local.json (R1 §6, R3 §2.24).
function localJsonPath(workspacePath: string): string {
  if (!isAbsolute(workspacePath)) {
    throw new Error('Workspace path must be absolute')
  }
  return join(workspacePath, '.radar', 'local.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readLocalJson(file: string): Promise<Record<string, unknown>> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') {
      return {}
    }
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('.radar/local.json is not valid JSON')
  }
  if (!isRecord(parsed)) {
    throw new Error('.radar/local.json is not a JSON object')
  }
  return parsed
}

export async function readSharePrompts(workspacePath: string): Promise<boolean> {
  const config = await readLocalJson(localJsonPath(workspacePath))
  return config.shareprompts === true
}

export async function writeSharePrompts(workspacePath: string, enabled: boolean): Promise<boolean> {
  const file = localJsonPath(workspacePath)
  const folder = await stat(workspacePath).catch(() => null)
  if (!folder?.isDirectory()) {
    throw new Error('Workspace folder does not exist')
  }
  const next = { ...(await readLocalJson(file)), shareprompts: enabled }
  await mkdir(join(workspacePath, '.radar'), { recursive: true })
  // local.json can hold the access token, so keep it owner-only and swap it in atomically.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 })
  await chmod(tmp, 0o600)
  await rename(tmp, file)
  return enabled
}
