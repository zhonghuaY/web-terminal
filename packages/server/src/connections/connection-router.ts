import { Router, type Request, type Response } from 'express';
import { Client as SSHClient } from 'ssh2';
import fs from 'node:fs';
import os from 'node:os';
import type { CreateConnectionRequest } from '@web-terminal/shared';
import { ConnectionManager } from './connection-manager.js';

export function createConnectionRouter(connectionManager: ConnectionManager): Router {
  const router = Router();

  router.post('/:id/test', (req: Request, res: Response) => {
    const id = req.params.id as string;
    const conn = connectionManager.get(id);
    if (!conn) {
      res.status(404).json({ error: 'Connection not found' });
      return;
    }

    const client = new SSHClient();
    const timeout = setTimeout(() => {
      client.end();
      res.json({ success: false, error: 'Connection timed out (10s)' });
    }, 10_000);

    client.on('ready', () => {
      clearTimeout(timeout);
      client.end();
      res.json({ success: true, message: `Connected to ${conn.host}:${conn.port}` });
    });

    client.on('error', (err: Error) => {
      clearTimeout(timeout);
      res.json({ success: false, error: err.message });
    });

    const connectOpts: Record<string, unknown> = {
      host: conn.host,
      port: conn.port,
      username: conn.username,
      readyTimeout: 10_000,
    };

    if (conn.authMethod === 'key') {
      const keyFile = (conn.keyPath ?? '~/.ssh/id_rsa').replace(/^~/, os.homedir());
      if (fs.existsSync(keyFile)) {
        connectOpts.privateKey = fs.readFileSync(keyFile);
      }
    } else if (conn.authMethod === 'agent') {
      connectOpts.agent = process.env.SSH_AUTH_SOCK;
    }

    try {
      client.connect(connectOpts);
    } catch (err) {
      clearTimeout(timeout);
      res.json({ success: false, error: (err as Error).message });
    }
  });

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
