import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { WsClientMessage, WsServerMessage } from '@web-terminal/shared';
import { AuthService } from '../auth/auth-service.js';
import { SessionManager } from '../sessions/session-manager.js';
import { LocalPtyAdapter } from '../sessions/local-pty-adapter.js';
import { SSHAdapter } from '../sessions/ssh-adapter.js';
import { ConnectionManager } from '../connections/connection-manager.js';

const OUTPUT_BUFFER_INTERVAL_MS = 8;

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
  const sessionClients = new Map<string, Set<WebSocket>>();

  const outputBuffers = new Map<string, string[]>();
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  function addClient(ws: WebSocket, sessionId: string) {
    clientSessions.set(ws, sessionId);
    let clients = sessionClients.get(sessionId);
    if (!clients) {
      clients = new Set();
      sessionClients.set(sessionId, clients);
    }
    clients.add(ws);
  }

  function removeClient(ws: WebSocket) {
    const sessionId = clientSessions.get(ws);
    clientSessions.delete(ws);
    if (sessionId) {
      const clients = sessionClients.get(sessionId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) sessionClients.delete(sessionId);
      }
    }
    return sessionId;
  }

  function broadcastToSession(sessionId: string, data: string) {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    const msg: WsServerMessage = { type: 'output', data };
    const payload = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function enqueueOutput(sessionId: string, data: string) {
    let buffer = outputBuffers.get(sessionId);
    if (!buffer) {
      buffer = [];
      outputBuffers.set(sessionId, buffer);
    }
    buffer.push(data);
  }

  function flushOutputBuffers() {
    for (const [sessionId, chunks] of outputBuffers) {
      if (chunks.length === 0) continue;
      const merged = chunks.join('');
      chunks.length = 0;
      broadcastToSession(sessionId, merged);
    }
  }

  function ensureFlushTimer() {
    if (flushTimer) return;
    flushTimer = setInterval(() => {
      flushOutputBuffers();
      if (outputBuffers.size === 0 && flushTimer) {
        clearInterval(flushTimer);
        flushTimer = null;
      }
    }, OUTPUT_BUFFER_INTERVAL_MS);
  }

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
        if (session.tmuxSession) {
          ptyAdapter.attachExternal(sessionId, session.tmuxSession);
        } else if (ptyAdapter.tmuxSessionExists(sessionId)) {
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

    const existingClients = sessionClients.get(sessionId);
    if (existingClients) {
      for (const existingWs of existingClients) {
        if (existingWs !== ws && existingWs.readyState === WebSocket.OPEN) {
          existingWs.close(4010, 'Replaced by new connection');
        }
      }
    }

    addClient(ws, sessionId);
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
      const sid = removeClient(ws);
      if (sid && session.type === 'local') {
        const remaining = sessionClients.get(sid);
        if (!remaining || remaining.size === 0) {
          ptyAdapter.detach(sid);
          outputBuffers.delete(sid);
        }
      }
    });
  });

  ptyAdapter.on('data', (sessionId: string, data: string) => {
    enqueueOutput(sessionId, data);
    ensureFlushTimer();
  });

  sshAdapter.on('data', (sessionId: string, data: string) => {
    enqueueOutput(sessionId, data);
    ensureFlushTimer();
  });

  sshAdapter.on('exit', (sessionId: string, _code: number) => {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        sendStatus(ws, 'disconnected', 'SSH session ended');
        ws.close(1000, 'SSH session ended');
      }
    }
  });

  ptyAdapter.on('exit', (sessionId: string, _code: number) => {
    outputBuffers.delete(sessionId);
    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
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
