import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { WsClientMessage, WsServerMessage } from '@web-terminal/shared';
import { AuthService } from '../auth/auth-service.js';
import { SessionManager } from '../sessions/session-manager.js';
import { LocalPtyAdapter } from '../sessions/local-pty-adapter.js';
import { SSHAdapter } from '../sessions/ssh-adapter.js';
import { ConnectionManager } from '../connections/connection-manager.js';

export function setupWebSocket(
  server: Server,
  jwtSecret: string,
  sessionManager: SessionManager,
  ptyAdapter: LocalPtyAdapter,
  sshAdapter: SSHAdapter,
  connectionManager: ConnectionManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const authService = new AuthService(jwtSecret);

  const clientSessions = new Map<WebSocket, string>();

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url ?? '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const sessionId = url.searchParams.get('sessionId');

    if (!token || !sessionId) {
      sendStatus(ws, 'error', 'Missing token or sessionId');
      ws.close(4001, 'Missing parameters');
      return;
    }

    try {
      authService.verifyToken(token);
    } catch {
      sendStatus(ws, 'error', 'Invalid or expired token');
      ws.close(4003, 'Authentication failed');
      return;
    }

    const session = sessionManager.get(sessionId);
    if (!session) {
      sendStatus(ws, 'error', 'Session not found');
      ws.close(4004, 'Session not found');
      return;
    }

    if (session.type === 'local') {
      if (!ptyAdapter.isAttached(sessionId)) {
        if (ptyAdapter.tmuxSessionExists(sessionId)) {
          ptyAdapter.attach(sessionId);
        } else {
          ptyAdapter.createSession(sessionId);
        }
      }
    } else if (session.type === 'ssh') {
      if (!sshAdapter.isConnected(sessionId) && session.sshConnectionId) {
        const conn = connectionManager.get(session.sshConnectionId);
        if (!conn) {
          sendStatus(ws, 'error', 'SSH connection config not found');
          ws.close(4005, 'Connection not found');
          return;
        }
        const sshPassword = url.searchParams.get('sshPassword') ?? undefined;
        try {
          await sshAdapter.createSession(sessionId, conn, sshPassword);
        } catch (err) {
          sendStatus(ws, 'error', `SSH connection failed: ${(err as Error).message}`);
          ws.close(4006, 'SSH connection failed');
          return;
        }
      }
    }

    clientSessions.set(ws, sessionId);
    sessionManager.touch(sessionId);
    sendStatus(ws, 'connected', `Attached to session ${session.name}`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;
        const adapter = session.type === 'local' ? ptyAdapter : sshAdapter;
        switch (msg.type) {
          case 'input':
            if (msg.data) {
              adapter.write(sessionId, msg.data);
            }
            break;
          case 'resize':
            if (msg.cols && msg.rows) {
              adapter.resize(sessionId, msg.cols, msg.rows);
            }
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clientSessions.delete(ws);
      if (session.type === 'local') {
        ptyAdapter.detach(sessionId);
      }
      // SSH sessions stay connected for reconnect
    });
  });

  ptyAdapter.on('data', (sessionId: string, data: string) => {
    for (const [ws, sid] of clientSessions) {
      if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
        const msg: WsServerMessage = { type: 'output', data };
        ws.send(JSON.stringify(msg));
      }
    }
  });

  sshAdapter.on('data', (sessionId: string, data: string) => {
    for (const [ws, sid] of clientSessions) {
      if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
        const msg: WsServerMessage = { type: 'output', data };
        ws.send(JSON.stringify(msg));
      }
    }
  });

  sshAdapter.on('exit', (sessionId: string, _code: number) => {
    for (const [ws, sid] of clientSessions) {
      if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
        sendStatus(ws, 'disconnected', 'SSH session ended');
        ws.close(1000, 'SSH session ended');
      }
    }
  });

  ptyAdapter.on('exit', (sessionId: string, _code: number) => {
    for (const [ws, sid] of clientSessions) {
      if (sid === sessionId && ws.readyState === WebSocket.OPEN) {
        sendStatus(ws, 'disconnected', 'Session ended');
        ws.close(1000, 'Session ended');
      }
    }
  });

  return wss;
}

function sendStatus(ws: WebSocket, state: 'connected' | 'disconnected' | 'error', message: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const msg: WsServerMessage = { type: 'status', state, message };
  ws.send(JSON.stringify(msg));
}
