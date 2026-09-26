export const SERVER_UNREACHABLE = "Can't reach the Live Collab server. Try again."

/** fetch that turns a network failure or timeout into one sentence the user can act on. */
export async function serverFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error(SERVER_UNREACHABLE)
  }
}
