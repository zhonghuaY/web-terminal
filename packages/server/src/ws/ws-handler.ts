import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { WsClientMessage, WsServerMessage } from '@web-terminal/shared';
import { AuthService } from '../auth/auth-service.js';
import { SessionManager } from '../sessions/session-manager.js';
import { LocalPtyAdapter } from '../sessions/local-pty-adapter.js';
import { SSHAdapter } from '../sessions/ssh-adapter.js';
import { ConnectionManager } from '../connections/connection-manager.js';
import { PreferencesManager } from '../config/preferences-manager.js';
import { HighlightFilter } from '../terminal/highlight-filter.js';

import { execSync } from 'node:child_process';

const OUTPUT_BUFFER_INTERVAL_MS = 8;
const SCROLLBACK_BUFFER_SIZE = 128 * 1024; // 128 KB per session

class ScrollbackBuffer {
  private chunks: string[] = [];
  private totalLength = 0;
  private readonly maxSize: number;

  constructor(maxSize = SCROLLBACK_BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  append(data: string): void {
    this.chunks.push(data);
    this.totalLength += data.length;
    this.trim();
  }

  private trim(): void {
    while (this.totalLength > this.maxSize && this.chunks.length > 1) {
      const removed = this.chunks.shift()!;
      this.totalLength -= removed.length;
    }
    if (this.totalLength > this.maxSize && this.chunks.length === 1) {
      const excess = this.totalLength - this.maxSize;
      this.chunks[0] = this.chunks[0].slice(excess);
      this.totalLength = this.chunks[0].length;
    }
  }

  getContent(): string {
    return this.chunks.join('');
  }

  clear(): void {
    this.chunks.length = 0;
    this.totalLength = 0;
  }
}

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function tmuxStillExists(tmuxName: string): boolean {
  try {
    execSync(`tmux has-session -t ${shellQuote(tmuxName)} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

export function setupWebSocket(
  server: Server,
  jwtSecret: string,
  sessionManager: SessionManager,
  ptyAdapter: LocalPtyAdapter,
  sshAdapter: SSHAdapter,
  connectionManager: ConnectionManager,
  preferencesManager?: PreferencesManager,
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  const authService = new AuthService(jwtSecret);

  const clientSessions = new Map<WebSocket, string>();
  const sessionClients = new Map<string, Set<WebSocket>>();
  const sshConnecting = new Map<string, Promise<void>>();

  const outputBuffers = new Map<string, string[]>();
  const scrollbackBuffers = new Map<string, ScrollbackBuffer>();
  const sessionDimensions = new Map<string, { cols: number; rows: number }>();
  let flushTimer: ReturnType<typeof setInterval> | null = null;

  const highlightFilter = new HighlightFilter();

  function applyHighlight(data: string): string {
    const enabled = preferencesManager?.get().highlightKeywords ?? true;
    highlightFilter.setEnabled(enabled);
    return highlightFilter.apply(data);
  }

  function getScrollback(sessionId: string): ScrollbackBuffer {
    let buf = scrollbackBuffers.get(sessionId);
    if (!buf) {
      buf = new ScrollbackBuffer();
      scrollbackBuffers.set(sessionId, buf);
    }
    return buf;
  }

  function replayScrollback(ws: WebSocket, sessionId: string): void {
    const buf = scrollbackBuffers.get(sessionId);
    if (!buf) return;
    const content = buf.getContent();
    if (!content) return;
    const msg: WsServerMessage = { type: 'output', data: content };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

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
    getScrollback(sessionId).append(data);

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

    if (!sessionDimensions.has(sessionId)) {
      sessionDimensions.set(sessionId, { cols: 80, rows: 24 });
    }

    addClient(ws, sessionId);
    sessionManager.touch(sessionId);

    if (session.type === 'local') {
      const wasAlreadyAttached = ptyAdapter.isAttached(sessionId);
      if (!wasAlreadyAttached) {
        if (session.shellMode === 'shell') {
          ptyAdapter.createPlainSession(sessionId, 80, 24, session.lastCwd);
        } else if (session.tmuxSession) {
          ptyAdapter.attachExternal(sessionId, session.tmuxSession);
        } else if (ptyAdapter.tmuxSessionExists(sessionId)) {
          ptyAdapter.attach(sessionId);
        } else {
          ptyAdapter.createSession(sessionId, 80, 24, session.lastCwd);
        }
      }
      const applyStoredDims = () => {
        const dims = sessionDimensions.get(sessionId);
        if (dims && dims.cols > 2 && dims.rows > 2 && ptyAdapter.isAttached(sessionId)) {
          ptyAdapter.forceResize(sessionId, dims.cols, dims.rows);
          if (session.tmuxSession || ptyAdapter.getSessionMode(sessionId) === 'tmux') {
            ptyAdapter.refreshTmuxClient(sessionId, session.tmuxSession);
          }
        }
      };
      setTimeout(applyStoredDims, 100);
      setTimeout(applyStoredDims, 500);
      setTimeout(applyStoredDims, 1500);

      // For reconnecting clients: forceResize triggers SIGWINCH which causes
      // shell to redraw its prompt and tmux to redraw its screen.
      // The staggered applyStoredDims above handles this.
    } else if (session.type === 'ssh') {
      if (!sshAdapter.isConnected(sessionId) && session.sshConnectionId) {
        const existing = sshConnecting.get(sessionId);
        if (existing) {
          try {
            await existing;
          } catch (err) {
            sendStatus(ws, 'error', `SSH connection failed: ${(err as Error).message}`);
            ws.close(4006, 'SSH connection failed');
            return;
          }
        } else {
          const conn = connectionManager.get(session.sshConnectionId);
          if (!conn) {
            sendStatus(ws, 'error', 'SSH connection config not found');
            ws.close(4005, 'Connection not found');
            return;
          }
          const sshPassword = url.searchParams.get('sshPassword') ?? undefined;
          const connectPromise = sshAdapter.createSession(sessionId, conn, sshPassword);
          sshConnecting.set(sessionId, connectPromise);
          try {
            await connectPromise;
          } catch (err) {
            sendStatus(ws, 'error', `SSH connection failed: ${(err as Error).message}`);
            ws.close(4006, 'SSH connection failed');
            return;
          } finally {
            sshConnecting.delete(sessionId);
          }

          if (session.tmuxSession) {
            const safeName = shellQuote(session.tmuxSession);
            sshAdapter.write(sessionId, `tmux a -t ${safeName}\n`);
          } else if (session.lastCwd) {
            const safePath = shellQuote(session.lastCwd);
            sshAdapter.write(sessionId, `cd ${safePath} && clear\n`);
          }
        }
      }
    }

    replayScrollback(ws, sessionId);
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
              const prevDims = sessionDimensions.get(sessionId);
              const dimsChanged = !prevDims || prevDims.cols !== msg.cols || prevDims.rows !== msg.rows;
              sessionDimensions.set(sessionId, { cols: msg.cols, rows: msg.rows });
              if (session.type === 'local') {
                if (dimsChanged) {
                  ptyAdapter.forceResize(sessionId, msg.cols, msg.rows);
                } else {
                  adapter.resize(sessionId, msg.cols, msg.rows);
                }
                if (session.tmuxSession || ptyAdapter.getSessionMode(sessionId) === 'tmux') {
                  ptyAdapter.refreshTmuxClient(sessionId, session.tmuxSession);
                }
              } else {
                adapter.resize(sessionId, msg.cols, msg.rows);
              }
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
          const mode = ptyAdapter.getSessionMode(sid);
          if (mode === 'tmux') {
            ptyAdapter.detach(sid);
          }
          outputBuffers.delete(sid);
        }
      }
    });
  });

  ptyAdapter.on('data', (sessionId: string, data: string) => {
    enqueueOutput(sessionId, applyHighlight(data));
    ensureFlushTimer();
  });

  sshAdapter.on('data', (sessionId: string, data: string) => {
    enqueueOutput(sessionId, applyHighlight(data));
    ensureFlushTimer();
  });

  sshAdapter.on('titleChange', (sessionId: string, title: string) => {
    const prev = lastTitles.get(sessionId);
    if (prev === title) return;
    lastTitles.set(sessionId, title);

    const session = sessionManager.get(sessionId);
    if (session) {
      if (session.name !== title) sessionManager.rename(sessionId, title);
      if (session.type === 'ssh') sessionManager.setTmuxSession(sessionId, title);
    }
    sendTitleToClients(sessionId, title);
  });

  const lastCwds = new Map<string, string>();
  const cwdSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const CWD_SAVE_DEBOUNCE_MS = 2000;

  function debounceCwdSave(sessionId: string, cwd: string): void {
    const existing = cwdSaveTimers.get(sessionId);
    if (existing) clearTimeout(existing);
    cwdSaveTimers.set(sessionId, setTimeout(() => {
      cwdSaveTimers.delete(sessionId);
      sessionManager.setCwd(sessionId, cwd);
    }, CWD_SAVE_DEBOUNCE_MS));
  }

  sshAdapter.on('cwdChange', (sessionId: string, cwd: string) => {
    const prev = lastCwds.get(sessionId);
    if (prev === cwd) return;
    lastCwds.set(sessionId, cwd);
    debounceCwdSave(sessionId, cwd);
  });

  sshAdapter.on('error', (sessionId: string, err: Error) => {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        sendStatus(ws, 'error', `SSH error: ${err.message}`);
      }
    }
  });

  sshAdapter.on('exit', (sessionId: string, _code: number) => {
    const pendingSave = cwdSaveTimers.get(sessionId);
    if (pendingSave) {
      clearTimeout(pendingSave);
      cwdSaveTimers.delete(sessionId);
      const cwd = lastCwds.get(sessionId);
      if (cwd) sessionManager.setCwd(sessionId, cwd);
    }
    lastCwds.delete(sessionId);
    outputBuffers.delete(sessionId);
    scrollbackBuffers.delete(sessionId);

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
    const pendingSave = cwdSaveTimers.get(sessionId);
    if (pendingSave) {
      clearTimeout(pendingSave);
      cwdSaveTimers.delete(sessionId);
      const cwd = lastCwds.get(sessionId);
      if (cwd) sessionManager.setCwd(sessionId, cwd);
    }
    lastCwds.delete(sessionId);
    lastTitles.delete(sessionId);
    outputBuffers.delete(sessionId);

    const session = sessionManager.get(sessionId);
    if (session?.type === 'local' && session.shellMode !== 'shell') {
      scrollbackBuffers.delete(sessionId);
      const tmuxName = session.tmuxSession ?? `wt-${sessionId}`;
      if (ptyAdapter.tmuxSessionExists(sessionId) || tmuxStillExists(tmuxName)) {
        sessionManager.setShellMode(sessionId, 'shell');
        const startDir = session.lastCwd || process.env.HOME || '/';
        const dims = sessionDimensions.get(sessionId) ?? { cols: 80, rows: 24 };
        try {
          ptyAdapter.createPlainSession(sessionId, dims.cols, dims.rows, startDir);
          const clients = sessionClients.get(sessionId);
          if (clients) {
            for (const ws of clients) {
              if (ws.readyState === WebSocket.OPEN) {
                sendStatus(ws, 'connected', 'Switched to plain shell');
                const modeMsg: WsServerMessage = { type: 'modeChange', shellMode: 'shell' };
                ws.send(JSON.stringify(modeMsg));
              }
            }
          }
          return;
        } catch {
          // Fall through to normal disconnect
        }
      }
    }

    scrollbackBuffers.delete(sessionId);

    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        sendStatus(ws, 'disconnected', 'Session ended');
        ws.close(1000, 'Session ended');
      }
    }
  });

  const TITLE_POLL_INTERVAL_MS = 1000;
  const lastTitles = new Map<string, string>();

  function sendTitleToClients(sessionId: string, title: string) {
    const clients = sessionClients.get(sessionId);
    if (!clients) return;
    const msg: WsServerMessage = { type: 'titleChange', title };
    const payload = JSON.stringify(msg);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    }
  }

  const titlePollTimer = setInterval(async () => {
    const activeIds = ptyAdapter.getActiveSessionIds();
    for (const sessionId of activeIds) {
      try {
        const mode = ptyAdapter.getSessionMode(sessionId);

        if (mode === 'shell') {
          const nestedTmux = await ptyAdapter.detectTmuxInPlainShell(sessionId);
          const session = sessionManager.get(sessionId);

          if (nestedTmux) {
            if (session) {
              const wasNotTmux = session.shellMode !== 'tmux';
              const tmuxChanged = session.tmuxSession !== nestedTmux;
              if (wasNotTmux || tmuxChanged) {
                if (wasNotTmux) {
                  sessionManager.setShellMode(sessionId, 'tmux');
                  const dims = sessionDimensions.get(sessionId);
                  if (dims) ptyAdapter.forceResize(sessionId, dims.cols, dims.rows);
                }
                sessionManager.setTmuxSession(sessionId, nestedTmux);
              }
            }

            const title = `tmux: ${nestedTmux}`;
            const prev = lastTitles.get(sessionId);
            if (prev !== title) {
              lastTitles.set(sessionId, title);
              if (session) sessionManager.rename(sessionId, title);
              sendTitleToClients(sessionId, title);
            }
          } else {
            if (session && (session.shellMode === 'tmux' || session.tmuxSession)) {
              sessionManager.setShellMode(sessionId, 'shell');
            }

            const cwd = await ptyAdapter.getPlainSessionCwd(sessionId);
            if (cwd) {
              const prevCwd = lastCwds.get(sessionId);
              if (prevCwd !== cwd) {
                lastCwds.set(sessionId, cwd);
                debounceCwdSave(sessionId, cwd);

                const home = process.env.HOME ?? '';
                const displayPath = home && cwd.startsWith(home)
                  ? '~' + cwd.slice(home.length)
                  : cwd;
                const prev = lastTitles.get(sessionId);
                if (prev !== displayPath) {
                  lastTitles.set(sessionId, displayPath);
                  if (session) sessionManager.rename(sessionId, displayPath);
                  sendTitleToClients(sessionId, displayPath);
                }
              }
            }
          }
          continue;
        }

        const cmd = await ptyAdapter.getPaneCommand(sessionId);

        let resolvedTitle: string | null = null;

        if (cmd === 'tmux') {
          resolvedTitle = await ptyAdapter.detectNestedTmuxSession(sessionId);
        }

        if (!resolvedTitle) {
          resolvedTitle = await ptyAdapter.getPaneTitle(sessionId);
        }

        if (!resolvedTitle) continue;
        const prev = lastTitles.get(sessionId);
        if (prev === resolvedTitle) continue;
        lastTitles.set(sessionId, resolvedTitle);

        const session = sessionManager.get(sessionId);
        if (session && session.name !== resolvedTitle) {
          sessionManager.rename(sessionId, resolvedTitle);
        }

        sendTitleToClients(sessionId, resolvedTitle);

        const cwd = await ptyAdapter.getPaneCwd(sessionId);
        if (cwd) {
          const prevCwd = lastCwds.get(sessionId);
          if (prevCwd !== cwd) {
            lastCwds.set(sessionId, cwd);
            debounceCwdSave(sessionId, cwd);
          }
        }
      } catch {
        // ignore polling errors
      }
    }

    for (const id of lastTitles.keys()) {
      if (!ptyAdapter.isAttached(id)) {
        lastTitles.delete(id);
        lastCwds.delete(id);
      }
    }
  }, TITLE_POLL_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(titlePollTimer);
    for (const timer of cwdSaveTimers.values()) clearTimeout(timer);
    cwdSaveTimers.clear();
  });

  return wss;
}

function sendStatus(ws: WebSocket, state: 'connected' | 'disconnected' | 'error', message: string): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const msg: WsServerMessage = { type: 'status', state, message };
  ws.send(JSON.stringify(msg));
}
