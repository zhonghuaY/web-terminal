import { Router, type Request, type Response } from 'express';
import type { CreateSessionRequest } from '@web-terminal/shared';
import { SessionManager } from './session-manager.js';
import { LocalPtyAdapter } from './local-pty-adapter.js';

export function createSessionRouter(
  sessionManager: SessionManager,
  ptyAdapter: LocalPtyAdapter,
): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(sessionManager.list());
  });

  router.post('/', (req: Request, res: Response) => {
    const { type, name, sshConnectionId } = req.body as CreateSessionRequest;

    if (!type || !['local', 'ssh'].includes(type)) {
      res.status(400).json({ error: 'Invalid session type' });
      return;
    }

    const session = sessionManager.create(type, name, sshConnectionId);

    if (type === 'local') {
      try {
        ptyAdapter.createSession(session.id);
      } catch (err) {
        sessionManager.delete(session.id);
        res.status(500).json({ error: 'Failed to create PTY session' });
        return;
      }
    }

    res.status(201).json(session);
  });

  router.patch('/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const updated = sessionManager.rename(id, name.trim());
    if (!updated) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(updated);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const session = sessionManager.get(id);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.type === 'local') {
      ptyAdapter.destroy(id);
    }

    sessionManager.delete(id);
    res.status(204).end();
  });

  return router;
}
