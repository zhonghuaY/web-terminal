import { describe, it, expect } from 'vitest';
import { AuthService } from '../auth/auth-service.js';

const SECRET = 'test-secret-key-for-unit-tests';

describe('AuthService', () => {
  const svc = new AuthService(SECRET);

  describe('hashPassword / verifyPassword', () => {
    it('hashes a password and verifies it', async () => {
      const hash = await svc.hashPassword('my-secret');
      expect(hash).not.toBe('my-secret');
      expect(hash).toMatch(/^\$2[aby]\$/);
      expect(await svc.verifyPassword('my-secret', hash)).toBe(true);
    });

    it('rejects wrong password', async () => {
      const hash = await svc.hashPassword('correct');
      expect(await svc.verifyPassword('wrong', hash)).toBe(false);
    });
  });

  describe('generateToken / verifyToken', () => {
    it('round-trips a username', () => {
      const token = svc.generateToken('admin');
      const payload = svc.verifyToken(token);
      expect(payload.username).toBe('admin');
      expect(payload.exp).toBeGreaterThan(payload.iat);
    });

    it('throws on invalid token', () => {
      expect(() => svc.verifyToken('not-a-token')).toThrow();
    });

    it('throws on token signed with different secret', () => {
      const other = new AuthService('different-secret');
      const token = other.generateToken('admin');
      expect(() => svc.verifyToken(token)).toThrow();
    });
  });
});
