import http from 'node:http';
import express from 'express';
import type { HealthResponse } from '@web-terminal/shared';
import { ConfigManager } from './config/config-manager.js';
import { createAuthRouter } from './auth/auth-router.js';
import { createJwtMiddleware } from './middleware/jwt-middleware.js';
import { SessionManager } from './sessions/session-manager.js';
import { LocalPtyAdapter } from './sessions/local-pty-adapter.js';
import { SSHAdapter } from './sessions/ssh-adapter.js';
import { createSessionRouter } from './sessions/session-router.js';
import { ConnectionManager } from './connections/connection-manager.js';
import { createConnectionRouter } from './connections/connection-router.js';
import { setupWebSocket } from './ws/ws-handler.js';

export function createApp(opts?: { configDir?: string }) {
  const configManager = new ConfigManager(opts?.configDir);
  const sessionManager = new SessionManager(opts?.configDir);
  const ptyAdapter = new LocalPtyAdapter();
  const sshAdapter = new SSHAdapter();
  const connectionManager = new ConnectionManager(opts?.configDir);

  const app = express();
  app.use(express.json());

  const startTime = Date.now();

  app.get('/health', (_req, res) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const response: HealthResponse = {
      status: 'ok',
      activeSessions: sessionManager.list().length,
      uptime: `${hours}h ${minutes}m ${seconds}s`,
      version: '0.1.0',
    };
    res.json(response);
  });

  app.use('/api/auth', createAuthRouter(configManager));

  const jwtMiddleware = createJwtMiddleware(configManager.getJwtSecret());
  app.use('/api/sessions', jwtMiddleware, createSessionRouter(sessionManager, ptyAdapter));
  app.use('/api/connections', jwtMiddleware, createConnectionRouter(connectionManager));

  return { app, configManager, sessionManager, ptyAdapter, sshAdapter, connectionManager };
}

if (process.argv[1] && !process.argv[1].includes('vitest')) {
  const { app, configManager, sessionManager, ptyAdapter, sshAdapter, connectionManager } = createApp();
  const server = http.createServer(app);

  setupWebSocket(server, configManager.getJwtSecret(), sessionManager, ptyAdapter, sshAdapter, connectionManager);

  const port = parseInt(process.env.PORT || '8090', 10);
  const host = process.env.HOST || '0.0.0.0';

  server.listen(port, host, () => {
    console.log(`web-terminal server listening on http://${host}:${port}`);
  });
}
