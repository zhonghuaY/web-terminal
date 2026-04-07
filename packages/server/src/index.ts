import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import type { HealthResponse } from '@web-terminal/shared';
import { ConfigManager } from './config/config-manager.js';
import { createAuthRouter } from './auth/auth-router.js';
import { createJwtMiddleware } from './middleware/jwt-middleware.js';
import { requestLogger } from './middleware/request-logger.js';
import { SessionManager } from './sessions/session-manager.js';
import { LocalPtyAdapter } from './sessions/local-pty-adapter.js';
import { SSHAdapter } from './sessions/ssh-adapter.js';
import { createSessionRouter } from './sessions/session-router.js';
import { ConnectionManager } from './connections/connection-manager.js';
import { createConnectionRouter } from './connections/connection-router.js';
import { PreferencesManager } from './config/preferences-manager.js';
import { createPreferencesRouter } from './config/preferences-router.js';
import { setupWebSocket } from './ws/ws-handler.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(opts?: { configDir?: string }) {
  const configManager = new ConfigManager(opts?.configDir);
  const sessionManager = new SessionManager(opts?.configDir);
  const ptyAdapter = new LocalPtyAdapter();
  const sshAdapter = new SSHAdapter();
  const connectionManager = new ConnectionManager(opts?.configDir);
  const preferencesManager = new PreferencesManager(opts?.configDir);

  const app = express();
  app.use(compression());
  app.use(express.json());
  app.use(requestLogger);

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
  app.use('/api/preferences', jwtMiddleware, createPreferencesRouter(preferencesManager));

  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist, {
    maxAge: '7d',
    immutable: true,
    etag: true,
  }));
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  return { app, configManager, sessionManager, ptyAdapter, sshAdapter, connectionManager, preferencesManager };
}

if (process.argv[1] && !process.argv[1].includes('vitest')) {
  const { app, configManager, sessionManager, ptyAdapter, sshAdapter, connectionManager, preferencesManager } = createApp();
  const server = http.createServer(app);

  setupWebSocket(server, configManager.getJwtSecret(), sessionManager, ptyAdapter, sshAdapter, connectionManager, preferencesManager);

  const port = parseInt(process.env.PORT || '8090', 10);
  const host = process.env.HOST || '0.0.0.0';

  server.listen(port, host, () => {
    logger.info({ port, host }, `web-terminal server listening on http://${host}:${port}`);
  });
}
