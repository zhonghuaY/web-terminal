import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAuthRouter } from '../auth/auth-router.js';
import { ConfigManager } from '../config/config-manager.js';

function setupApp() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-test-'));
  const configManager = new ConfigManager(tmpDir);
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAuthRouter(configManager));
  return { app, tmpDir, configManager };
}

describe('Auth Router', () => {
  let tmpDir: string;

  afterAll(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('GET /api/auth/status', () => {
    it('returns setupRequired true when no admin exists', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      const res = await request(app).get('/api/auth/status');
      expect(res.status).toBe(200);
      expect(res.body.setupRequired).toBe(true);
    });
  });

  describe('POST /api/auth/setup', () => {
    it('creates admin and returns token', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      const res = await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: 'test1234' });
      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.expiresIn).toBe(604800);
    });

    it('rejects if admin already exists', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: 'test1234' });

      const res = await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin2', password: 'test1234' });
      expect(res.status).toBe(409);
    });

    it('rejects short password', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      const res = await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: '123' });
      expect(res.status).toBe(400);
    });

    it('rejects missing fields', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      const res = await request(app)
        .post('/api/auth/setup')
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns token for valid credentials', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: 'test1234' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test1234' });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('rejects wrong password', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: 'test1234' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('rejects wrong username', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      await request(app)
        .post('/api/auth/setup')
        .send({ username: 'admin', password: 'test1234' });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'notadmin', password: 'test1234' });
      expect(res.status).toBe(401);
    });

    it('returns 503 if no admin set up', async () => {
      const { app, tmpDir: td } = setupApp();
      tmpDir = td;
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'test' });
      expect(res.status).toBe(503);
    });
  });
});
