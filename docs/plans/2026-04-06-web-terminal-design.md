# Web Terminal — Design Document

> **Date:** 2026-04-06
> **Status:** Approved (brainstorming complete)

## 1. Project Overview

**Goal:** A browser-based terminal application that supports both local PTY connections and SSH remote connections, accessible from any device including iPad.

**Use Cases:**
- Remote server management via SSH through the browser
- Accessing a local WSL terminal from any device (e.g., iPad over the network)

## 2. Technical Stack

### Backend
- **Runtime:** Node.js + TypeScript
- **PTY:** `node-pty` — local terminal process management
- **SSH:** `ssh2` — SSH client for remote connections
- **HTTP:** `express` — REST API and static file serving
- **WebSocket:** `ws` — real-time terminal I/O
- **Auth:** `bcryptjs` (password hashing) + `jsonwebtoken` (JWT sessions)
- **Logging:** `pino` with file rotation (max 10MB/file, 5 files retained)

### Frontend
- **Framework:** React + TypeScript
- **Build:** Vite
- **Terminal:** `xterm` + `xterm-addon-fit` + `xterm-addon-web-links`
- **Styling:** Tailwind CSS

### Project Structure
- Monorepo: `packages/client` + `packages/server`
- Shared types in `packages/shared`

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (React)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Login    │  │ Session  │  │ xterm.js │  │ Settings    │  │
│  │ Page     │  │ Manager  │  │ Terminal │  │ Panel       │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │
│                       │ WebSocket                             │
└───────────────────────┼──────────────────────────────────────┘
                        │
┌───────────────────────┼──────────────────────────────────────┐
│                   Server (Node.js)                            │
│  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auth     │  │ WebSocket    │  │ Session Manager      │   │
│  │ Module   │  │ Handler      │  │  ┌────────┐ ┌──────┐ │   │
│  │ (JWT +   │  │ (route to    │  │  │ Local  │ │ SSH  │ │   │
│  │  bcrypt) │  │  session)    │  │  │ PTY    │ │Proxy │ │   │
│  └──────────┘  └──────────────┘  │  │(tmux)  │ │(ssh2)│ │   │
│                                   │  └────────┘ └──────┘ │   │
│  ┌──────────┐  ┌──────────────┐  └──────────────────────┘   │
│  │ Config   │  │ Health       │                              │
│  │ Manager  │  │ /health      │                              │
│  └──────────┘  └──────────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Login:** POST `/api/auth/login` → verify bcrypt hash → return JWT (7-day expiry)
2. **New local terminal:** WS connect + JWT → create/attach tmux session → node-pty bridge → bidirectional stream
3. **New SSH connection:** WS connect + JWT → ssh2 connect to remote → shell channel → bidirectional stream
4. **Reconnect:** WS reconnect + JWT → reattach tmux session → restore terminal state

## 4. Module Designs

### 4.1 Authentication

- **First-run setup wizard:** Prompts for admin username + password on first launch
- **Storage:** bcrypt-hashed password in `~/.web-terminal/config.json`
- **Login endpoint:** `POST /api/auth/login` → validates credentials → returns JWT
- **WebSocket auth:** JWT passed as query parameter on WS upgrade
- **Rate limiting:** 5 failed attempts/minute → 5-minute lockout
- **JWT expiry:** 7 days, renewable on activity

### 4.2 Session Manager

Each terminal session maps to a tmux session (naming: `wt-{sessionId}`).

**REST API:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List all active sessions |
| POST | `/api/sessions` | Create new session (type: `local` or `ssh`) |
| DELETE | `/api/sessions/:id` | Close and remove session |

**Session metadata** persisted to `~/.web-terminal/sessions.json`:
```json
{
  "sessions": [
    {
      "id": "abc123",
      "type": "local",
      "name": "dev",
      "createdAt": "2026-04-06T00:00:00Z",
      "lastAccessed": "2026-04-06T01:00:00Z"
    }
  ]
}
```

### 4.3 Local PTY Adapter

- Creates tmux session → attaches via node-pty
- Bridges stdin/stdout over WebSocket
- Handles resize events → `tmux resize-pane`
- Shell: user's default shell (`$SHELL` or `/bin/bash`)

### 4.4 SSH Adapter

**Connection sources (merged):**
1. `~/.ssh/config` — parsed and imported automatically
2. `~/.web-terminal/connections.json` — manually added via UI

**Authentication priority:**
1. SSH key (`~/.ssh/id_rsa`, `~/.ssh/id_ed25519`, etc.)
2. SSH Agent forwarding
3. Password (prompted in browser if needed)

**API:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/connections` | List all SSH connections (merged) |
| POST | `/api/connections` | Add new SSH connection |
| PUT | `/api/connections/:id` | Update connection |
| DELETE | `/api/connections/:id` | Remove connection |

### 4.5 WebSocket Protocol

**Client → Server messages:**
```json
{ "type": "input", "data": "<keystroke data>" }
{ "type": "resize", "cols": 120, "rows": 40 }
```

**Server → Client messages:**
```json
{ "type": "output", "data": "<terminal output>" }
{ "type": "status", "state": "connected" | "disconnected" | "error", "message": "..." }
```

### 4.6 Auto-Reconnect

- **Strategy:** Exponential backoff: 1s → 2s → 4s → 8s → ... → 30s (max)
- **Max retries:** 20 (then show manual reconnect button)
- **On reconnect:** Reattach to existing tmux session → restore full terminal state
- **UI indicator:** Yellow top bar "Reconnecting..." during retries

## 5. Frontend Design

### 5.1 Pages

1. **Login Page** — Username + password form, error display, rate-limit warning
2. **Dashboard** — Session list + SSH connection list, create/resume/delete
3. **Terminal View** — Tab bar + xterm.js terminal + touch toolbar (mobile)
4. **Settings** — Theme selection, font size/family, password change

### 5.2 Tab Bar

- Horizontal tabs at the top of the terminal view
- Each tab: session name + close button
- "+" button to create new session
- Drag-to-reorder (optional, v2)
- Active tab visually highlighted

### 5.3 Touch Toolbar

- Displayed on mobile/tablet devices (detected via `navigator.maxTouchPoints`)
- Collapsible/expandable
- Keys: `Esc`, `Tab`, `Ctrl`, `Alt`, `↑`, `↓`, `←`, `→`, `Home`, `End`, `PgUp`, `PgDn`
- Each button sends the corresponding control sequence to xterm

### 5.4 Theme System

Pre-built themes:
1. Dracula
2. One Dark
3. Monokai
4. Solarized Dark
5. Solarized Light
6. Nord
7. Tokyo Night
8. Catppuccin Mocha

Settings stored in `localStorage` and synced to `~/.web-terminal/preferences.json`.

## 6. Deployment

**Architecture:**
```
iPad → https://aiflourish.myaddr.io → Nginx (TLS) → frps → frpc (WSL) → web-terminal (HTTP)
```

- Application listens on HTTP only (e.g., `0.0.0.0:8090`)
- frpc tunnels the port to public server at `36.151.150.54`
- Nginx handles TLS termination with existing certificates
- Domain: `aiflourish.myaddr.io`

**Startup:**
```bash
# Development
npm run dev

# Production
npm run build && npm start -- --port 8090 --host 0.0.0.0
```

## 7. Logging

- **Format:** JSON (structured, via pino)
- **Events logged:** connections, disconnections, auth attempts (success/fail), errors, session create/destroy
- **Rotation:** Max 10MB per file, 5 files retained (50MB total cap)
- **Output:** File (`~/.web-terminal/logs/`) + stdout
- **Health endpoint:** `GET /health` → `{ "status": "ok", "activeSessions": N, "uptime": "..." }`

## 8. Security Considerations

1. Passwords bcrypt-hashed (cost factor 12)
2. JWT with HMAC-SHA256, stored in httpOnly cookie for API, query param for WS
3. Rate limiting on login endpoint
4. CORS restricted to configured origins
5. Helmet middleware for HTTP security headers
6. SSH credentials never stored in plaintext (key paths only, passwords not saved)
7. Defense-in-depth: recommend Nginx `auth_basic` or IP whitelist as additional layer

## 9. Out of Scope (v1)

- File transfer (upload/download)
- Split-pane / tmux-style tiling
- Multi-user support
- OAuth / SSO
- Terminal recording / playback
- Built-in HTTPS / TLS termination

## 10. Future Enhancements (v2+)

- Split-pane mode within tabs
- File transfer via drag-and-drop
- Terminal session recording and replay
- SFTP file browser panel
- Collaborative terminal sharing
