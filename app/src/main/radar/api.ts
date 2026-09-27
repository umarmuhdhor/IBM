import { readRadarConnection } from './secure-store'
import { serverFetch } from './server-fetch'
import { errorMessage, sharedFolderSeat } from './join'

function requireNonempty(value: string, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${field}`)
  }
  return value
}

type Seat = 'decider' | 'mc' | 'member'

/**
 * The token a request goes out with. 'decider': the PM or Mission Control (D-umar-08). 'member': the coder's own
 * token, or for Mission Control the shared folder's own seat, since the owner is also a coder (D-umar-08).
 */
function tokenFor(seat: Seat): { server: string; token: string } {
  const connection = readRadarConnection()
  if (!connection) {
    throw new Error('Join a Live Collab workspace first.')
  }
  if (seat === 'mc' && connection.role === 'mc') {
    return connection
  }
  if (seat === 'decider' && (connection.role === 'mc' || connection.role === 'pm')) {
    return connection
  }
  if (seat === 'member') {
    if (connection.role === 'coder') {
      return connection
    }
    const own = connection.role === 'mc' ? sharedFolderSeat(connection) : null
    if (own) {
      return { server: connection.server, token: own.token }
    }
    throw new Error('Only a coder works on tasks.')
  }
  throw new Error(seat === 'mc' ? 'Mission Control connection is required' : 'Only the PM or the owner decides.')
}

async function post(seat: Seat, path: string, body: Record<string, unknown>): Promise<void> {
  const { server, token } = tokenFor(seat)
  const url = new URL(path, server)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid Live Collab server URL')
  }
  const response = await serverFetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000)
  })
  if (!response.ok) {
    throw new Error(await errorMessage(response))
  }
}

/** The member id this app works as: the coder itself, or the owner's own seat for Mission Control. */
export function mySeat(): string | null {
  const connection = readRadarConnection()
  if (!connection) {
    return null
  }
  if (connection.role === 'coder') {
    return connection.member
  }
  return connection.role === 'mc' ? (sharedFolderSeat(connection)?.member || null) : null
}

export function decideProposal(id: string, approve: boolean, note: string): Promise<void> {
  if (typeof approve !== 'boolean') {
    throw new Error('Invalid decision')
  }
  return post(
    'decider',
    `/v1/proposals/${encodeURIComponent(requireNonempty(id, 'proposal'))}/decision`,
    {
      approve,
      note: typeof note === 'string' ? note : ''
    }
  )
}

export function revokeLock(path: string, reason: string): Promise<void> {
  return post('mc', '/v1/locks/revoke', {
    path: requireNonempty(path, 'path'),
    reason: requireNonempty(reason, 'reason')
  })
}

export function cancelTask(id: string): Promise<void> {
  return post(
    'mc',
    `/v1/tasks/${encodeURIComponent(requireNonempty(id, 'task'))}/cancel`,
    {}
  )
}

export function setTaskStep(id: string, index: number, done: boolean): Promise<void> {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error('Invalid step index')
  }
  if (typeof done !== 'boolean') {
    throw new Error('Invalid done value')
  }
  return post(
    'member',
    `/v1/tasks/${encodeURIComponent(requireNonempty(id, 'task'))}/steps`,
    { index, done }
  )
}

export function submitTask(id: string, summary: string): Promise<void> {
  return post(
    'member',
    `/v1/tasks/${encodeURIComponent(requireNonempty(id, 'task'))}/submit`,
    { summary: requireNonempty(summary, 'summary') }
  )
}

/** Makes the task the one this coder's Bob works on, so its first edit lands in it. */
export function activateTask(id: string): Promise<void> {
  return post('member', `/v1/tasks/${encodeURIComponent(requireNonempty(id, 'task'))}/activate`, {})
}
