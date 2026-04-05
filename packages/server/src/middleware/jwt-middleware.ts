import type { Request, Response, NextFunction } from 'express';
import { AuthService, type TokenPayload } from '../auth/auth-service.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function createJwtMiddleware(jwtSecret: string) {
  const authService = new AuthService(jwtSecret);

  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      req.user = authService.verifyToken(token);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}
