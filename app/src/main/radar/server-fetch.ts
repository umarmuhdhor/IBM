import { getMainHttpClient } from '../network/http-client'

export const SERVER_UNREACHABLE = "Can't reach the Live Collab server. Try again."

/**
 * fetch that turns a network failure or timeout into one sentence the user can act on.
 * Why the main HTTP port: on the desktop it is Chromium's net.fetch, which follows the proxy and has no
 * undici unread-body crash (orca#8695); a bare global fetch would bypass both.
 */
export async function serverFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await getMainHttpClient().fetch(url, init)
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    console.warn('[radar] server unreachable:', new URL(url).pathname, why)
    throw new Error(SERVER_UNREACHABLE, { cause: error })
  }
}
