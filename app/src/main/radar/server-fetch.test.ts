import { afterEach, expect, it, vi } from 'vitest'
import { SERVER_UNREACHABLE, serverFetch } from './server-fetch'

afterEach(() => vi.unstubAllGlobals())

it('says the server cannot be reached instead of a raw TimeoutError or fetch failure', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
  )
  await expect(serverFetch('http://localhost:8787/v1/workspace/close', {})).rejects.toThrow(
    SERVER_UNREACHABLE
  )
})

it('passes HTTP errors through for the caller to read', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 409 })))
  expect((await serverFetch('http://localhost:8787/x', {})).status).toBe(409)
})
