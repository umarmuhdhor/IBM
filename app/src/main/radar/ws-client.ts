import type { RadarConnection } from '../../shared/radar-connection'
import type { RadarWsUpdate } from '../../shared/radar-update'
import { WS_CLOSE_UNAUTHORIZED, WS_PING_FRAME, WS_PING_MS } from '@radar/common'

const INITIAL_RECONNECT_MS = 500
const MAX_RECONNECT_MS = 8_000

type SocketLike = {
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  onclose: ((event: CloseEvent) => void) | null
  onerror: ((event: Event) => void) | null
  send: (value: string) => void
  close: () => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function websocketUrl(server: string): string {
  const url = new URL(server)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Live Collab server must use HTTP or HTTPS')
  }
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = '/ws'
  url.search = ''
  url.hash = ''
  return url.toString()
}

export class RadarWsClient {
  private socket: SocketLike | null = null
  private stopped = true
  private reconnectDelayMs = INITIAL_RECONNECT_MS
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly connection: RadarConnection,
    private readonly onUpdate: (update: RadarWsUpdate) => void,
    private readonly createSocket: (url: string) => SocketLike = (url) => new WebSocket(url)
  ) {}

  connect(): void {
    if (!this.stopped) {
      return
    }
    this.stopped = false
    this.openSocket()
  }

  disconnect(): void {
    this.stopped = true
    this.clearTimers()
    const socket = this.socket
    this.socket = null
    socket?.close()
    this.onUpdate({ kind: 'status', connected: false })
  }

  private openSocket(): void {
    if (this.stopped) {
      return
    }
    const socket = this.createSocket(websocketUrl(this.connection.server))
    this.socket = socket
    socket.onopen = () => {
      if (this.socket !== socket || this.stopped) {
        return
      }
      socket.send(
        JSON.stringify({
          t: 'hello',
          d: {
            token: this.connection.token,
            client: this.connection.role === 'mc' ? 'mc' : 'app',
            clientVersion: '0.1'
          }
        })
      )
    }
    socket.onmessage = (message) => {
      if (this.socket !== socket || typeof message.data !== 'string') {
        return
      }
      let frame: unknown
      try {
        frame = JSON.parse(message.data)
      } catch {
        return
      }
      if (!isRecord(frame) || typeof frame.t !== 'string') {
        return
      }
      if (frame.t === 'welcome') {
        this.reconnectDelayMs = INITIAL_RECONNECT_MS
        this.onUpdate({ kind: 'status', connected: true })
        this.startPing(socket)
      } else if (frame.t === 'state') {
        this.onUpdate({ kind: 'state', data: frame.d })
      } else if (frame.t === 'event') {
        const latencyMs =
          isRecord(frame.d) && typeof frame.d.ts === 'number'
            ? Math.max(0, Date.now() - frame.d.ts)
            : null
        this.onUpdate({ kind: 'event', data: frame.d, latencyMs })
      }
    }
    socket.onclose = (event) => {
      if (this.socket !== socket || this.stopped) {
        return
      }
      this.socket = null
      this.clearTimers()
      this.onUpdate({
        kind: 'status',
        connected: false,
        failure: event.code === WS_CLOSE_UNAUTHORIZED ? 'access-rejected' : 'connection-lost'
      })
      if (event.code === WS_CLOSE_UNAUTHORIZED) {
        this.stopped = true
        return
      }
      const delay = this.reconnectDelayMs
      this.reconnectDelayMs = Math.min(MAX_RECONNECT_MS, delay * 2)
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null
        this.openSocket()
      }, delay)
    }
    socket.onerror = () => socket.close()
  }

  private startPing(socket: SocketLike): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
    }
    this.pingTimer = setInterval(() => {
      if (this.socket === socket) {
        socket.send(WS_PING_FRAME)
      }
    }, WS_PING_MS)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}
