import { Router, type Request, type Response } from 'express';
import type { LoginRequest, LoginResponse, SetupRequest } from '@web-terminal/shared';
import { AuthService } from './auth-service.js';
import { RateLimiter } from './rate-limiter.js';
import { ConfigManager } from '../config/config-manager.js';

export function createAuthRouter(configManager: ConfigManager): Router {
  const router = Router();
  const authService = new AuthService(configManager.getJwtSecret());
  const rateLimiter = new RateLimiter();

  router.get('/status', (_req: Request, res: Response) => {
    res.json({
      setupRequired: configManager.isSetupRequired(),
    });
  });

  router.post('/setup', async (req: Request, res: Response) => {
    if (!configManager.isSetupRequired()) {
      res.status(409).json({ error: 'Admin account already exists' });
      return;
    }

    const { username, password } = req.body as SetupRequest;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const hash = await authService.hashPassword(password);
    configManager.setAdmin(username, hash);

    const token = authService.generateToken(username);
    const response: LoginResponse = { token, expiresIn: 7 * 24 * 60 * 60 };
    res.status(201).json(response);
  });

  router.post('/login', async (req: Request, res: Response) => {
    const clientIp = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const check = rateLimiter.check(clientIp);
    if (!check.allowed) {
      res.status(429).json({
        error: 'Too many login attempts',
        retryAfter: check.retryAfter,
      });
      return;
    }

    const { username, password } = req.body as LoginRequest;
    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const config = configManager.get();
    if (!config.admin) {
      res.status(503).json({ error: 'Admin account not set up' });
      return;
    }

    if (username !== config.admin.username) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await authService.verifyPassword(password, config.admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    rateLimiter.reset(clientIp);
    const token = authService.generateToken(username);
    const response: LoginResponse = { token, expiresIn: 7 * 24 * 60 * 60 };
    res.json(response);
  });

  return router;
}

export { AuthService };
