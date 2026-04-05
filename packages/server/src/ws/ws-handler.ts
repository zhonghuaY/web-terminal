import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { WsClientMessage, WsServerMessage } from '@web-terminal/shared';
import { AuthService } from '../auth/auth-service.js';
import { SessionManager } from '../sessions/session-manager.js';
import { LocalPtyAdapter } from '../sessions/local-pty-adapter.js';

export function setupWebSocket(
  server: Server,
  jwtSecret: string,
  sessionManager: SessionManager,
  ptyAdapter: LocalPtyAdapter,
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const authService = new AuthService(jwtSecret);

  const clientSessions = new Map<WebSocket, string>();

  wss.on('connection', (ws, req) => {
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
    }

    clientSessions.set(ws, sessionId);
    sessionManager.touch(sessionId);
    sendStatus(ws, 'connected', `Attached to session ${session.name}`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsClientMessage;
        switch (msg.type) {
          case 'input':
            if (msg.data && session.type === 'local') {
              ptyAdapter.write(sessionId, msg.data);
            }
            break;
          case 'resize':
            if (msg.cols && msg.rows && session.type === 'local') {
              ptyAdapter.resize(sessionId, msg.cols, msg.rows);
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
