// Spike 4 relay: a tiny `ws` server that forwards every message to every other client.
// usage: tsx sync/relay.ts [--port 8799]
import { WebSocketServer, WebSocket } from 'ws';

export const DEFAULT_PORT = 8799;

export function startRelay(port = DEFAULT_PORT): Promise<WebSocketServer> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port });
    wss.on('connection', (socket, req) => {
      console.log(`[relay] client connected ${req.socket.remoteAddress} (${wss.clients.size} total)`);
      socket.on('message', (data, isBinary) => {
        for (const client of wss.clients) {
          if (client !== socket && client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
        }
      });
      socket.on('close', () => console.log(`[relay] client left (${wss.clients.size} total)`));
    });
    wss.once('listening', () => {
      console.log(`[relay] listening on ws://0.0.0.0:${port}`);
      resolve(wss);
    });
    wss.once('error', reject);
  });
}

if (require.main === module) {
  const i = process.argv.indexOf('--port');
  const port = i > -1 ? Number(process.argv[i + 1]) : DEFAULT_PORT;
  startRelay(port).catch((err: Error) => {
    console.error(`[relay] ${err.message}`);
    process.exit(1);
  });
}
