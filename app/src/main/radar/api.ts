import { readRadarConnection } from './secure-store'

function requireNonempty(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`)
  }
  return value
}

async function postAsMissionControl(path: string, body: Record<string, unknown>): Promise<void> {
  const connection = readRadarConnection()
  if (!connection || connection.role !== 'mc') {
    throw new Error('Mission Control connection is required')
  }
  const url = new URL(path, connection.server)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid Live Collab server URL')
  }
  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    throw new Error(`Live Collab request failed (${response.status})`)
  }
}

export function decideProposal(id: string, approve: boolean, note: string): Promise<void> {
  if (typeof approve !== 'boolean') {
    throw new Error('Invalid decision')
  }
  return postAsMissionControl(
    `/v1/proposals/${encodeURIComponent(requireNonempty(id, 'proposal'))}/decision`,
    {
      approve,
      note: typeof note === 'string' ? note : ''
    }
  )
}

export function revokeLock(path: string, reason: string): Promise<void> {
  return postAsMissionControl('/v1/locks/revoke', {
    path: requireNonempty(path, 'path'),
    reason: requireNonempty(reason, 'reason')
  })
}

export function cancelTask(id: string): Promise<void> {
  return postAsMissionControl(
    `/v1/tasks/${encodeURIComponent(requireNonempty(id, 'task'))}/cancel`,
    {}
  )
}
