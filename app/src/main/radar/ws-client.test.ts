import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RadarConnection } from '../../shared/radar-connection'

class FakeSocket {
  static instances: FakeSocket[] = []
  readonly sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly url: string) {
    FakeSocket.instances.push(this)
  }

  send(value: string): void {
    this.sent.push(value)
  }

  close(): void {
    this.onclose?.({ code: 1000 })
  }

  receive(value: unknown): void {
    this.onmessage?.({ data: JSON.stringify(value) })
  }
}

const { RadarWsClient } = await import('./ws-client')

const connection: RadarConnection = {
  server: 'https://live.example.test',
  workspace: 'demo',
  member: 'A',
  role: 'mc',
  token: 'synthetic-value'
}

describe('Radar WebSocket client', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.instances.length = 0
  })

  afterEach(() => vi.useRealTimers())

  it('sends the authenticated hello and exact keepalive frame', () => {
    const updates = vi.fn()
    const client = new RadarWsClient(connection, updates, (url) => new FakeSocket(url))
    client.connect()
    const socket = FakeSocket.instances[0]!
    expect(socket.url).toBe('wss://live.example.test/ws')
    socket.onopen?.()
    expect(JSON.parse(socket.sent[0]!)).toEqual({
      t: 'hello',
      d: { token: connection.token, client: 'mc', clientVersion: '0.1' }
    })
    socket.receive({ t: 'welcome', d: { workspace: 'demo' } })
    vi.advanceTimersByTime(20_000)
    expect(socket.sent[1]).toBe('{"t":"ping"}')
    client.disconnect()
  })

  it('connects PM Lead with the member app client', () => {
    const client = new RadarWsClient({ ...connection, role: 'pm' }, vi.fn(), (url) => new FakeSocket(url))
    client.connect()
    const socket = FakeSocket.instances[0]!
    socket.onopen?.()
    expect(JSON.parse(socket.sent[0]!).d.client).toBe('app')
    client.disconnect()
  })

  it('forwards only state and event payloads with feed latency', () => {
    const updates = vi.fn()
    const client = new RadarWsClient(connection, updates, (url) => new FakeSocket(url))
    client.connect()
    const socket = FakeSocket.instances[0]!
    socket.receive({ t: 'state', d: { cursor: 4 } })
    socket.receive({ t: 'event', d: { id: 5, ts: Date.now() - 37, type: 'task.created' } })
    expect(updates).toHaveBeenCalledWith({ kind: 'state', data: { cursor: 4 } })
    expect(updates).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'event', data: expect.objectContaining({ id: 5 }) })
    )
    expect(updates.mock.calls.at(-1)?.[0].latencyMs).toBe(37)
    client.disconnect()
  })

  it('reconnects with bounded backoff and stops after disconnect', () => {
    const client = new RadarWsClient(connection, vi.fn(), (url) => new FakeSocket(url))
    client.connect()
    FakeSocket.instances[0]!.onclose?.({ code: 1006 })
    vi.advanceTimersByTime(499)
    expect(FakeSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(2)
    FakeSocket.instances[1]!.onclose?.({ code: 1006 })
    vi.advanceTimersByTime(1_000)
    expect(FakeSocket.instances).toHaveLength(3)
    client.disconnect()
    vi.advanceTimersByTime(10_000)
    expect(FakeSocket.instances).toHaveLength(3)
  })

  it('does not retry a rejected credential', () => {
    const updates = vi.fn()
    const client = new RadarWsClient(connection, updates, (url) => new FakeSocket(url))
    client.connect()
    FakeSocket.instances[0]!.onclose?.({ code: 4401 })
    vi.advanceTimersByTime(30_000)
    expect(FakeSocket.instances).toHaveLength(1)
    expect(updates).toHaveBeenCalledWith({ kind: 'status', connected: false, failure: 'access-rejected' })
  })
})
