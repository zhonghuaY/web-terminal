import express from 'express';
import type { HealthResponse } from '@web-terminal/shared';
import { ConfigManager } from './config/config-manager.js';
import { createAuthRouter } from './auth/auth-router.js';
import { createJwtMiddleware } from './middleware/jwt-middleware.js';

const configManager = new ConfigManager();
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
    activeSessions: 0,
    uptime: `${hours}h ${minutes}m ${seconds}s`,
    version: '0.1.0',
  };
  res.json(response);
});

app.use('/api/auth', createAuthRouter(configManager));

const jwtMiddleware = createJwtMiddleware(configManager.getJwtSecret());
app.use('/api/sessions', jwtMiddleware);
app.use('/api/connections', jwtMiddleware);

const port = parseInt(process.env.PORT || '8090', 10);
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`web-terminal server listening on http://${host}:${port}`);
});

export { app, configManager };
