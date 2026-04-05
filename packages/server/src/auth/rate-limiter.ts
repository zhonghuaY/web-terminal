interface RateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

interface CheckResult {
  allowed: boolean;
  retryAfter?: number;
}

const DEFAULT_OPTIONS: RateLimiterOptions = {
  maxAttempts: 5,
  windowMs: 60_000,
  lockoutMs: 300_000,
};

export class RateLimiter {
  private attempts = new Map<string, number[]>();
  private lockouts = new Map<string, number>();
  private opts: RateLimiterOptions;

  constructor(opts?: Partial<RateLimiterOptions>) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  check(key: string): CheckResult {
    const now = Date.now();

    const lockUntil = this.lockouts.get(key);
    if (lockUntil && now < lockUntil) {
      return { allowed: false, retryAfter: Math.ceil((lockUntil - now) / 1000) };
    }
    if (lockUntil && now >= lockUntil) {
      this.lockouts.delete(key);
      this.attempts.delete(key);
    }

    const timestamps = this.attempts.get(key) ?? [];
    const windowStart = now - this.opts.windowMs;
    const recent = timestamps.filter((t) => t > windowStart);

    if (recent.length >= this.opts.maxAttempts) {
      const lockUntilNew = now + this.opts.lockoutMs;
      this.lockouts.set(key, lockUntilNew);
      this.attempts.delete(key);
      return { allowed: false, retryAfter: Math.ceil(this.opts.lockoutMs / 1000) };
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return { allowed: true };
  }

  reset(key: string): void {
    this.attempts.delete(key);
    this.lockouts.delete(key);
  }
}
