# Web Terminal — Testing Strategy

> **Date:** 2026-04-06
> **Approach:** Test-Driven Development (TDD) — tests written before implementation
> **Coverage Target:** 80%+ (unit + integration + E2E)

## 1. Test Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Vitest | Fast, TypeScript-native, watch mode |
| Integration | Vitest + Supertest | HTTP API endpoint testing |
| E2E | Playwright | Browser automation, full user flows |
| Coverage | Vitest (c8/istanbul) | Coverage reporting with thresholds |
| Mocking | Vitest built-in mocks | Module/function mocking |

### Why Vitest over Jest
- Native TypeScript/ESM support (no transform config)
- Compatible with Vite (same config for build and test)
- Jest-compatible API (minimal migration friction)
- Faster execution via worker threads

## 2. Test File Organization

```
packages/
├── server/
│   ├── src/
│   │   ├── auth/
│   │   │   ├── auth-service.ts
│   │   │   └── __tests__/
│   │   │       └── auth-service.test.ts
│   │   ├── sessions/
│   │   │   ├── session-manager.ts
│   │   │   ├── local-pty-adapter.ts
│   │   │   ├── ssh-adapter.ts
│   │   │   └── __tests__/
│   │   │       ├── session-manager.test.ts
│   │   │       ├── local-pty-adapter.test.ts
│   │   │       └── ssh-adapter.test.ts
│   │   ├── connections/
│   │   │   ├── ssh-config-parser.ts
│   │   │   └── __tests__/
│   │   │       └── ssh-config-parser.test.ts
│   │   └── __tests__/
│   │       └── integration/
│   │           ├── auth-flow.test.ts
│   │           ├── session-flow.test.ts
│   │           └── health.test.ts
│   └── vitest.config.ts
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Terminal.tsx
│   │   │   ├── __tests__/
│   │   │   │   ├── TabBar.test.tsx
│   │   │   │   └── TouchToolbar.test.tsx
│   │   ├── hooks/
│   │   │   └── __tests__/
│   │   │       ├── useAuth.test.ts
│   │   │       ├── useWebSocket.test.ts
│   │   │       └── usePreferences.test.ts
│   │   └── pages/
│   │       └── __tests__/
│   │           ├── LoginPage.test.tsx
│   │           └── DashboardPage.test.tsx
│   └── vitest.config.ts
└── e2e/
    ├── playwright.config.ts
    ├── auth.spec.ts
    ├── terminal.spec.ts
    ├── sessions.spec.ts
    └── mobile.spec.ts
```

## 3. Unit Tests

### 3.1 Server Unit Tests

**Auth Service** (`auth-service.test.ts`):
```typescript
import { describe, it, expect } from 'vitest';
import { AuthService } from '../auth-service';

describe('AuthService', () => {
  describe('hashPassword', () => {
    it('returns a bcrypt hash different from input', async () => {
      const hash = await AuthService.hashPassword('secret');
      expect(hash).not.toBe('secret');
      expect(hash).toMatch(/^\$2[aby]\$/);
    });
  });

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      const hash = await AuthService.hashPassword('secret');
      expect(await AuthService.verifyPassword('secret', hash)).toBe(true);
    });

    it('returns false for wrong password', async () => {
      const hash = await AuthService.hashPassword('secret');
      expect(await AuthService.verifyPassword('wrong', hash)).toBe(false);
    });
  });

  describe('generateToken / verifyToken', () => {
    it('round-trips a username through JWT', () => {
      const token = AuthService.generateToken('admin');
      const payload = AuthService.verifyToken(token);
      expect(payload.username).toBe('admin');
    });

    it('throws on expired token', () => {
      // Use a very short expiry for testing
    });

    it('throws on invalid token', () => {
      expect(() => AuthService.verifyToken('garbage')).toThrow();
    });
  });
});
```

**Rate Limiter** (`rate-limiter.test.ts`):
```typescript
describe('RateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('127.0.0.1').allowed).toBe(true);
    }
  });

  it('blocks requests over the limit', () => {
    const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) limiter.check('127.0.0.1');
    const result = limiter.check('127.0.0.1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('isolates different IPs', () => {
    const limiter = new RateLimiter({ maxAttempts: 1, windowMs: 60000 });
    limiter.check('1.1.1.1');
    expect(limiter.check('2.2.2.2').allowed).toBe(true);
  });
});
```

**SSH Config Parser** (`ssh-config-parser.test.ts`):
```typescript
describe('SSHConfigParser', () => {
  it('parses a basic SSH config entry', () => {
    const config = `
Host myserver
  HostName 192.168.1.100
  Port 22
  User admin
  IdentityFile ~/.ssh/id_rsa
`;
    const connections = SSHConfigParser.parse(config);
    expect(connections).toHaveLength(1);
    expect(connections[0]).toMatchObject({
      name: 'myserver',
      host: '192.168.1.100',
      port: 22,
      username: 'admin',
      source: 'ssh-config',
    });
  });

  it('handles multiple hosts', () => { /* ... */ });
  it('uses defaults for missing fields', () => { /* ... */ });
  it('ignores wildcard entries', () => { /* ... */ });
  it('handles empty/missing config gracefully', () => { /* ... */ });
});
```

**Session Manager** (`session-manager.test.ts`):
```typescript
describe('SessionManager', () => {
  it('creates a new session with unique ID', () => { /* ... */ });
  it('lists all active sessions', () => { /* ... */ });
  it('deletes a session by ID', () => { /* ... */ });
  it('persists sessions to file on change', () => { /* ... */ });
  it('loads sessions from file on init', () => { /* ... */ });
  it('auto-generates sequential names', () => { /* ... */ });
});
```

### 3.2 Client Unit Tests

**useAuth Hook** (`useAuth.test.ts`):
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAuth } from '../useAuth';

describe('useAuth', () => {
  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets token on successful login', async () => { /* ... */ });
  it('clears token on logout', () => { /* ... */ });
  it('restores token from localStorage', () => { /* ... */ });
});
```

**useWebSocket Hook** (`useWebSocket.test.ts`):
```typescript
describe('useWebSocket', () => {
  it('connects to the correct URL with token', () => { /* ... */ });
  it('reconnects with exponential backoff on disconnect', () => { /* ... */ });
  it('caps backoff at 30 seconds', () => { /* ... */ });
  it('stops after max retries', () => { /* ... */ });
  it('sends resize messages correctly', () => { /* ... */ });
});
```

**TabBar Component** (`TabBar.test.tsx`):
```typescript
describe('TabBar', () => {
  it('renders all session tabs', () => { /* ... */ });
  it('highlights the active tab', () => { /* ... */ });
  it('calls onSelect when clicking a tab', () => { /* ... */ });
  it('calls onClose when clicking close button', () => { /* ... */ });
  it('calls onCreate when clicking the + button', () => { /* ... */ });
});
```

**TouchToolbar Component** (`TouchToolbar.test.tsx`):
```typescript
describe('TouchToolbar', () => {
  it('renders special key buttons', () => { /* ... */ });
  it('sends Ctrl sequence on Ctrl button press', () => { /* ... */ });
  it('sends Escape sequence on Esc button press', () => { /* ... */ });
  it('toggles expand/collapse', () => { /* ... */ });
  it('is hidden on non-touch devices', () => { /* ... */ });
});
```

## 4. Integration Tests

### 4.1 Auth Flow (`auth-flow.test.ts`):
```typescript
import request from 'supertest';
import { createApp } from '../../index';

describe('Auth Integration', () => {
  it('POST /api/auth/setup creates admin account on first run', async () => {
    const app = createApp({ configDir: tmpDir });
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin', password: 'test1234' });
    expect(res.status).toBe(201);
  });

  it('POST /api/auth/setup rejects if admin already exists', async () => {
    // Setup admin first, then try again
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ username: 'admin2', password: 'test' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/login returns JWT for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('POST /api/auth/login rejects invalid password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('rate-limits login after 5 failures', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
    }
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(429);
  });
});
```

### 4.2 Session Flow (`session-flow.test.ts`):
```typescript
describe('Session Integration', () => {
  let token: string;

  beforeAll(async () => {
    // Login and get token
  });

  it('GET /api/sessions returns empty list initially', async () => {
    const res = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/sessions creates a local session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'local', name: 'dev' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.type).toBe('local');
  });

  it('DELETE /api/sessions/:id removes the session', async () => { /* ... */ });
  it('rejects unauthenticated requests with 401', async () => { /* ... */ });
});
```

### 4.3 Health Check (`health.test.ts`):
```typescript
describe('Health Check', () => {
  it('GET /health returns ok status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.activeSessions).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });
});
```

## 5. E2E Tests (Playwright)

### 5.1 Auth E2E (`auth.spec.ts`):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('first-run setup flow', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Setup');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'testpass123');
    await page.fill('input[name="confirmPassword"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'testpass123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'wrongpass');
    await page.click('button[type="submit"]');
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });
});
```

### 5.2 Terminal E2E (`terminal.spec.ts`):
```typescript
test.describe('Terminal', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
  });

  test('creates a new local terminal session', async ({ page }) => {
    await page.click('button:has-text("New Terminal")');
    await expect(page.locator('.xterm')).toBeVisible();
  });

  test('can type and see output', async ({ page }) => {
    await page.click('button:has-text("New Terminal")');
    await page.locator('.xterm').click();
    await page.keyboard.type('echo hello-test\n');
    await expect(page.locator('.xterm')).toContainText('hello-test');
  });

  test('tab switching preserves terminal state', async ({ page }) => {
    // Create two terminals, type in each, switch back and verify
  });

  test('terminal survives page reload (persistent session)', async ({ page }) => {
    // Create terminal, type something, reload page, verify state restored
  });
});
```

### 5.3 Mobile E2E (`mobile.spec.ts`):
```typescript
test.describe('Mobile', () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  test('touch toolbar is visible on mobile', async ({ page }) => {
    // Login, create terminal
    await expect(page.locator('[data-testid="touch-toolbar"]')).toBeVisible();
  });

  test('Ctrl button sends control sequence', async ({ page }) => {
    // Click Ctrl + C in toolbar, verify terminal receives ^C
  });

  test('toolbar can be collapsed', async ({ page }) => {
    await page.click('[data-testid="toolbar-toggle"]');
    await expect(page.locator('[data-testid="touch-toolbar-keys"]')).not.toBeVisible();
  });
});
```

## 6. Mocking Strategy

### External Dependencies to Mock

| Dependency | Mock Strategy | When |
|-----------|--------------|------|
| `node-pty` | Mock spawn/write/resize | Unit tests |
| `ssh2` | Mock Client connect/shell | Unit tests |
| `tmux` commands | Mock child_process.exec | Unit tests |
| `~/.ssh/config` | Mock fs.readFileSync | Unit tests |
| `bcryptjs` | Use real (fast enough) | All tests |
| WebSocket | Mock ws or use ws server | Integration |
| localStorage | jsdom built-in | Client unit |

### Mock Pattern
```typescript
import { vi } from 'vitest';

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  })),
}));
```

## 7. Coverage Configuration

### Vitest Config (server)
```typescript
// packages/server/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      exclude: ['**/__tests__/**', '**/node_modules/**'],
    },
  },
});
```

### Vitest Config (client)
```typescript
// packages/client/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
```

## 8. CI Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test:coverage && npm run test:e2e"
  }
}
```

## 9. TDD Workflow Per Task

For every implementation task in the implementation plan:

1. **Write failing test** → describes expected behavior
2. **Run test** → confirm it fails with expected error
3. **Write minimal implementation** → make test pass
4. **Run test** → confirm it passes
5. **Refactor** → clean up while keeping tests green
6. **Check coverage** → ensure 80%+ maintained
7. **Commit** → small, focused commit

## 10. Test Data Fixtures

Create reusable fixtures in `packages/server/src/__tests__/fixtures/`:

```typescript
// fixtures/ssh-configs.ts
export const BASIC_SSH_CONFIG = `
Host myserver
  HostName 192.168.1.100
  User admin
  Port 22
`;

export const MULTI_HOST_SSH_CONFIG = `
Host server1
  HostName 10.0.0.1
  User root

Host server2
  HostName 10.0.0.2
  User deploy
  Port 2222
  IdentityFile ~/.ssh/deploy_key
`;

// fixtures/sessions.ts
export const MOCK_SESSION = {
  id: 'test-123',
  type: 'local' as const,
  name: 'Terminal 1',
  createdAt: '2026-04-06T00:00:00Z',
  lastAccessed: '2026-04-06T01:00:00Z',
};
```
