# Web Terminal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a browser-based terminal app with local PTY and SSH support, persistent sessions via tmux, JWT auth, and mobile touch toolbar.

**Architecture:** Node.js TypeScript backend (express + ws + node-pty + ssh2) serving a React + xterm.js frontend. Monorepo with `packages/server`, `packages/client`, and `packages/shared`.

**Tech Stack:** Node.js, TypeScript, Express, ws, node-pty, ssh2, bcryptjs, jsonwebtoken, pino, React, Vite, xterm.js, Tailwind CSS

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (root workspace)
- Create: `tsconfig.base.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/index.html`
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/tailwind.config.ts`
- Create: `packages/client/postcss.config.js`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create root `package.json` with npm workspaces**

```json
{
  "name": "web-terminal",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev": "npm run dev --workspace=packages/server & npm run dev --workspace=packages/client",
    "build": "npm run build --workspace=packages/shared && npm run build --workspace=packages/client && npm run build --workspace=packages/server",
    "start": "npm start --workspace=packages/server",
    "test": "npm test --workspaces --if-present"
  }
}
```

**Step 2: Create base TypeScript config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

**Step 3: Create shared package with type definitions**

`packages/shared/src/types.ts`:
```typescript
export interface Session {
  id: string;
  type: 'local' | 'ssh';
  name: string;
  createdAt: string;
  lastAccessed: string;
  sshConnectionId?: string;
}

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'key' | 'password' | 'agent';
  keyPath?: string;
  source: 'ssh-config' | 'manual';
}

export interface WsClientMessage {
  type: 'input' | 'resize';
  data?: string;
  cols?: number;
  rows?: number;
}

export interface WsServerMessage {
  type: 'output' | 'status';
  data?: string;
  state?: 'connected' | 'disconnected' | 'error';
  message?: string;
}

export interface HealthResponse {
  status: 'ok';
  activeSessions: number;
  uptime: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresIn: number;
}

export interface UserPreferences {
  theme: string;
  fontSize: number;
  fontFamily: string;
}
```

**Step 4: Create server and client stubs**

Server `packages/server/src/index.ts`:
```typescript
import express from 'express';
const app = express();
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
const port = parseInt(process.env.PORT || '8090', 10);
app.listen(port, () => console.log(`web-terminal listening on :${port}`));
```

Client `packages/client/src/App.tsx`:
```tsx
export default function App() {
  return <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
    <h1 className="text-2xl">Web Terminal</h1>
  </div>;
}
```

**Step 5: Install dependencies**

```bash
# Root
cd ~/code/web_terminal

# Server dependencies
cd packages/server
npm install express ws node-pty ssh2 bcryptjs jsonwebtoken pino pino-roll uuid
npm install -D typescript @types/express @types/ws @types/bcryptjs @types/jsonwebtoken @types/ssh2 @types/uuid @types/node tsx

# Client dependencies
cd ../client
npm install react react-dom @xterm/xterm @xterm/addon-fit @xterm/addon-web-links
npm install -D typescript @types/react @types/react-dom vite @vitejs/plugin-react tailwindcss @tailwindcss/vite postcss autoprefixer

# Shared
cd ../shared
npm install -D typescript

# Root install
cd ~/code/web_terminal
npm install
```

**Step 6: Verify it compiles and runs**

```bash
cd ~/code/web_terminal
npx tsc --noEmit -p packages/shared
npx tsc --noEmit -p packages/server
npm run dev --workspace=packages/client  # Should open Vite dev server
```

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: scaffold monorepo with server, client, and shared packages"
```

---

### Task 2: Authentication Module

**Files:**
- Create: `packages/server/src/auth/auth-service.ts`
- Create: `packages/server/src/auth/auth-router.ts`
- Create: `packages/server/src/auth/rate-limiter.ts`
- Create: `packages/server/src/config/config-manager.ts`
- Create: `packages/server/src/middleware/jwt-middleware.ts`
- Test: `packages/server/src/__tests__/auth.test.ts`

**Step 1: Write config manager**

Manages `~/.web-terminal/config.json`. Handles first-run detection (no config file = setup needed).

**Step 2: Write auth service**

- `hashPassword(password)` → bcrypt hash (cost 12)
- `verifyPassword(password, hash)` → boolean
- `generateToken(username)` → JWT (7-day expiry, HS256)
- `verifyToken(token)` → decoded payload or throws
- `isSetupRequired()` → checks if admin account exists
- `setupAdmin(username, password)` → creates admin account

**Step 3: Write rate limiter**

In-memory sliding window: 5 attempts per minute per IP. Returns `{ allowed: boolean, retryAfter?: number }`.

**Step 4: Write auth router**

- `POST /api/auth/login` → validate credentials → return JWT
- `POST /api/auth/setup` → first-run admin creation (only works if no admin exists)
- `GET /api/auth/status` → returns `{ setupRequired: boolean, authenticated: boolean }`

**Step 5: Write JWT middleware**

Express middleware that validates JWT from `Authorization: Bearer <token>` header. Attaches user to `req.user`.

**Step 6: Write tests**

Test: password hashing, token generation/verification, rate limiter, login flow, setup flow.

**Step 7: Commit**

```bash
git add -A && git commit -m "feat: add authentication module with JWT, bcrypt, and rate limiting"
```

---

### Task 3: Session Manager + Local PTY

**Files:**
- Create: `packages/server/src/sessions/session-manager.ts`
- Create: `packages/server/src/sessions/local-pty-adapter.ts`
- Create: `packages/server/src/sessions/session-router.ts`
- Create: `packages/server/src/ws/ws-handler.ts`
- Test: `packages/server/src/__tests__/sessions.test.ts`

**Step 1: Write session manager**

- Manages session lifecycle (create, list, get, delete)
- Persists metadata to `~/.web-terminal/sessions.json`
- tmux session naming: `wt-{sessionId}`
- Auto-generates session names: "Terminal 1", "Terminal 2", etc.

**Step 2: Write local PTY adapter**

- `createSession(sessionId)` → spawns `tmux new-session -d -s wt-{id}` → attaches node-pty
- `attachSession(sessionId)` → attaches to existing tmux session
- `resizeSession(sessionId, cols, rows)` → resizes tmux pane
- `destroySession(sessionId)` → kills tmux session
- Input/output as EventEmitter (`data`, `exit`)

**Step 3: Write WebSocket handler**

- Upgrades HTTP to WS, validates JWT from query param
- Routes messages to/from the appropriate session adapter
- Handles `input`, `resize` client messages
- Sends `output`, `status` server messages

**Step 4: Write session REST router**

- `GET /api/sessions` — list sessions
- `POST /api/sessions` — create session
- `DELETE /api/sessions/:id` — delete session

**Step 5: Integration test**

Test session creation, data flow through PTY, session cleanup.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add session manager with local PTY adapter and WebSocket handler"
```

---

### Task 4: SSH Adapter

**Files:**
- Create: `packages/server/src/sessions/ssh-adapter.ts`
- Create: `packages/server/src/connections/ssh-config-parser.ts`
- Create: `packages/server/src/connections/connection-manager.ts`
- Create: `packages/server/src/connections/connection-router.ts`
- Test: `packages/server/src/__tests__/ssh.test.ts`

**Step 1: Write SSH config parser**

Parses `~/.ssh/config` into structured `SSHConnection[]`. Handles: Host, HostName, Port, User, IdentityFile.

**Step 2: Write connection manager**

- Merges SSH config connections with manually added ones (`~/.web-terminal/connections.json`)
- CRUD for manual connections
- Returns merged list with `source` field

**Step 3: Write SSH adapter**

- `createSession(sessionId, connection)` → ssh2 connect → shell channel → EventEmitter
- Supports key auth (reads key file), password auth (from connect request), agent forwarding
- Handles resize via channel `setWindow()`
- Emits `data`, `close`, `error`

**Step 4: Write connection REST router**

- `GET /api/connections` — list all SSH connections
- `POST /api/connections` — add manual connection
- `PUT /api/connections/:id` — update connection
- `DELETE /api/connections/:id` — delete manual connection

**Step 5: Update WebSocket handler to support SSH sessions**

Add routing logic: if session type is `ssh`, use SSH adapter instead of local PTY.

**Step 6: Tests and commit**

```bash
git add -A && git commit -m "feat: add SSH adapter with config parser and connection manager"
```

---

### Task 5: Frontend — Login & Setup Pages

**Files:**
- Create: `packages/client/src/pages/LoginPage.tsx`
- Create: `packages/client/src/pages/SetupPage.tsx`
- Create: `packages/client/src/hooks/useAuth.ts`
- Create: `packages/client/src/api/client.ts`
- Modify: `packages/client/src/App.tsx`

**Step 1: Create API client**

Wrapper around fetch with JWT header injection and base URL config.

**Step 2: Create auth hook**

`useAuth()` — manages JWT state, login/logout, checks setup status. Stores token in localStorage.

**Step 3: Create Setup page**

First-run page: username + password + confirm password form. Calls `POST /api/auth/setup`.

**Step 4: Create Login page**

Username + password form with error display, rate-limit warning, loading state.

**Step 5: Wire up routing in App.tsx**

Conditional rendering: setup required → SetupPage, not authenticated → LoginPage, authenticated → Dashboard.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add login and setup pages with auth flow"
```

---

### Task 6: Frontend — Dashboard & Session Management

**Files:**
- Create: `packages/client/src/pages/DashboardPage.tsx`
- Create: `packages/client/src/components/SessionList.tsx`
- Create: `packages/client/src/components/ConnectionList.tsx`
- Create: `packages/client/src/components/NewSessionDialog.tsx`
- Create: `packages/client/src/components/NewConnectionDialog.tsx`

**Step 1: Create Dashboard page**

Two-panel layout: Local Sessions (left) + SSH Connections (right). Each panel has a list and a "+" create button.

**Step 2: Create SessionList component**

Lists active sessions with name, type badge, last accessed time, resume and delete buttons.

**Step 3: Create ConnectionList component**

Lists SSH connections with host, username, source badge (ssh-config / manual), connect and edit buttons.

**Step 4: Create NewSessionDialog**

Modal: session name input, "Create" button. Calls `POST /api/sessions` with type `local`.

**Step 5: Create NewConnectionDialog**

Modal: host, port, username, auth method selection, key path input. Calls `POST /api/connections`.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add dashboard with session and connection management"
```

---

### Task 7: Frontend — Terminal View with Tabs

**Files:**
- Create: `packages/client/src/pages/TerminalPage.tsx`
- Create: `packages/client/src/components/Terminal.tsx`
- Create: `packages/client/src/components/TabBar.tsx`
- Create: `packages/client/src/hooks/useWebSocket.ts`
- Create: `packages/client/src/hooks/useTerminal.ts`

**Step 1: Create WebSocket hook**

`useWebSocket(sessionId, token)` — manages WS connection lifecycle, auto-reconnect with exponential backoff, message send/receive.

**Step 2: Create Terminal component**

Wraps xterm.js instance with fit addon, web-links addon. Receives data from WS hook, sends input to WS. Handles resize.

**Step 3: Create TabBar component**

Horizontal tab bar: session tabs + "+" button. Active tab highlighted. Close button on hover.

**Step 4: Create TerminalPage**

Combines TabBar + Terminal. Manages multiple terminal instances (one xterm per tab, only active one visible).

**Step 5: Create useTerminal hook**

Manages xterm instance lifecycle — create, attach to DOM, dispose. Handles resize observer.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add terminal view with tab bar and WebSocket integration"
```

---

### Task 8: Mobile Touch Toolbar

**Files:**
- Create: `packages/client/src/components/TouchToolbar.tsx`
- Create: `packages/client/src/hooks/useIsMobile.ts`
- Modify: `packages/client/src/pages/TerminalPage.tsx`

**Step 1: Create useIsMobile hook**

Detects touch device via `navigator.maxTouchPoints > 0` or viewport width < 768px.

**Step 2: Create TouchToolbar component**

Floating bar above keyboard (bottom of screen) with special keys:
- Row 1: `Esc`, `Tab`, `Ctrl`, `Alt`, `↑`, `↓`, `←`, `→`
- Row 2: `Home`, `End`, `PgUp`, `PgDn`, `|`, `/`, `~`
- Toggle expand/collapse button
- Each button sends appropriate escape sequence to xterm

**Step 3: Integrate into TerminalPage**

Show TouchToolbar on mobile devices, hide on desktop. Position above virtual keyboard.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add mobile touch toolbar with special keys"
```

---

### Task 9: Theme System & Settings

**Files:**
- Create: `packages/client/src/themes/index.ts`
- Create: `packages/client/src/pages/SettingsPage.tsx`
- Create: `packages/client/src/hooks/usePreferences.ts`
- Modify: `packages/client/src/components/Terminal.tsx`

**Step 1: Define theme presets**

8 themes (Dracula, One Dark, Monokai, Solarized Dark/Light, Nord, Tokyo Night, Catppuccin Mocha) as xterm `ITheme` objects.

**Step 2: Create preferences hook**

`usePreferences()` — reads/writes theme, fontSize, fontFamily to localStorage. Syncs to server on change.

**Step 3: Create Settings page**

- Theme dropdown with live preview
- Font size slider (10–24px)
- Font family dropdown (monospace fonts)
- Password change form

**Step 4: Apply theme to Terminal component**

Terminal reads current theme from preferences and applies on mount and on change.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add theme system and settings page"
```

---

### Task 10: Logging, Health Check & Production Polish

**Files:**
- Create: `packages/server/src/logger.ts`
- Modify: `packages/server/src/index.ts` (add logging, health endpoint, static serving)
- Create: `packages/server/src/middleware/request-logger.ts`
- Create: `Dockerfile`
- Create: `README.md`

**Step 1: Set up pino logger with rotation**

Configure pino with `pino-roll` transport: 10MB max file size, 5 files retained, output to `~/.web-terminal/logs/`.

**Step 2: Add request logging middleware**

Log all HTTP requests (method, path, status, duration) and WS connections.

**Step 3: Enhance health endpoint**

`GET /health` returns `{ status, activeSessions, activeConnections, uptime, version }`.

**Step 4: Serve built frontend in production**

Express serves `packages/client/dist/` as static files. Vite proxy in development.

**Step 5: Write README**

Installation, configuration, development, deployment instructions.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add logging, health check, and production build setup"
```

---

### Task 11: Auto-Reconnect & Resilience

**Files:**
- Modify: `packages/client/src/hooks/useWebSocket.ts`
- Create: `packages/client/src/components/ReconnectBanner.tsx`
- Modify: `packages/client/src/pages/TerminalPage.tsx`

**Step 1: Implement exponential backoff in useWebSocket**

1s → 2s → 4s → 8s → 16s → 30s (cap). Max 20 retries. On reconnect, send reattach message to resume tmux session.

**Step 2: Create ReconnectBanner**

Yellow bar at top: "Reconnecting..." with attempt count. Red bar after max retries: "Disconnected" + manual reconnect button.

**Step 3: Server-side session recovery**

On WS connect, if session exists in tmux, reattach and replay scrollback buffer.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add auto-reconnect with exponential backoff and session recovery"
```

---

## Execution Order

Tasks 1–4 are backend-focused, Tasks 5–9 are frontend-focused, Tasks 10–11 are cross-cutting. Recommended order: **1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11**.

Each task is independently testable. Commit after each task.
