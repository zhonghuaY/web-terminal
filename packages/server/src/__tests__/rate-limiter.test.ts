import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from '../auth/rate-limiter.js';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 60_000, lockoutMs: 300_000 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('127.0.0.1').allowed).toBe(true);
    }
  });

  it('blocks requests over the limit', () => {
    const limiter = new RateLimiter({ maxAttempts: 3, windowMs: 60_000, lockoutMs: 300_000 });
    for (let i = 0; i < 3; i++) {
      limiter.check('127.0.0.1');
    }
    const result = limiter.check('127.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('isolates different keys', () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000, lockoutMs: 300_000 });
    limiter.check('1.1.1.1');
    expect(limiter.check('2.2.2.2').allowed).toBe(true);
  });

  it('unlocks after lockout period', () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000, lockoutMs: 5_000 });
    limiter.check('1.1.1.1');
    expect(limiter.check('1.1.1.1').allowed).toBe(false);

    vi.advanceTimersByTime(5_001);
    expect(limiter.check('1.1.1.1').allowed).toBe(true);
  });

  it('reset clears attempts and lockout', () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60_000, lockoutMs: 300_000 });
    limiter.check('1.1.1.1');
    expect(limiter.check('1.1.1.1').allowed).toBe(false);

    limiter.reset('1.1.1.1');
    expect(limiter.check('1.1.1.1').allowed).toBe(true);
  });

  it('slides the window — old attempts expire', () => {
    const limiter = new RateLimiter({ maxAttempts: 2, windowMs: 1_000, lockoutMs: 300_000 });
    limiter.check('x');
    vi.advanceTimersByTime(600);
    limiter.check('x');

    vi.advanceTimersByTime(500);
    expect(limiter.check('x').allowed).toBe(true);
  });
});
