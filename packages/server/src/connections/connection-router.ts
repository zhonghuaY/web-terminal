import { Router, type Request, type Response } from 'express';
import type { CreateConnectionRequest } from '@web-terminal/shared';
import { ConnectionManager } from './connection-manager.js';

export function createConnectionRouter(connectionManager: ConnectionManager): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json(connectionManager.list());
  });

  router.post('/', (req: Request, res: Response) => {
    const body = req.body as CreateConnectionRequest;
    if (!body.name || !body.host || !body.username) {
      res.status(400).json({ error: 'name, host, and username are required' });
      return;
    }

    const conn = connectionManager.add({
      name: body.name,
      host: body.host,
      port: body.port || 22,
      username: body.username,
      authMethod: body.authMethod || 'key',
      keyPath: body.keyPath,
    });
    res.status(201).json(conn);
  });

  router.put('/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const updated = connectionManager.update(id, req.body as Partial<CreateConnectionRequest>);
    if (!updated) {
      res.status(404).json({ error: 'Connection not found or not editable (ssh-config source)' });
      return;
    }
    res.json(updated);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const deleted = connectionManager.delete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Connection not found or not deletable' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
