# Web Terminal

Browser-based terminal application with local PTY and SSH remote connections. Access your terminals from any device including iPad.

## Features

- **Local terminal** via tmux with persistent sessions
- **SSH connections** with key/password/agent auth and `~/.ssh/config` parsing
- **Tab-based UI** for managing multiple sessions
- **Mobile touch toolbar** with Ctrl, Esc, arrow keys
- **8 color themes** (Tokyo Night, Dracula, One Dark, Monokai, Nord, etc.)
- **Auto-reconnect** with exponential backoff and session recovery
- **JWT authentication** with bcrypt password hashing
- **Structured logging** with file rotation

## Quick Start

```bash
# Install dependencies
npm install

# Build shared types
npm run build -w packages/shared

# Development (server + client)
npm run dev

# Production build
npm run build
npm start
```

Server listens on `http://0.0.0.0:8090` by default.

## Configuration

All config is stored in `~/.web-terminal/`:

| File | Purpose |
|------|---------|
| `config.json` | Admin credentials, JWT secret |
| `sessions.json` | Active session metadata |
| `connections.json` | Manual SSH connections |
| `logs/` | Structured JSON logs (10MB rotation, 5 files) |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8090` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## Deployment

Designed for: **HTTP locally** + **Nginx reverse proxy with HTTPS** via frp tunnel.

```
Browser → https://your.domain → Nginx (TLS) → frps → frpc (WSL) → web-terminal (:8090)
```

### Nginx Config Example

```nginx
location / {
    proxy_pass http://127.0.0.1:<frp-local-port>;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

## Tech Stack

- **Backend:** Node.js, TypeScript, Express, ws, node-pty, ssh2
- **Frontend:** React, Vite, xterm.js, Tailwind CSS
- **Auth:** bcryptjs, jsonwebtoken
- **Logging:** pino with pino-roll rotation

## Development

```bash
# Run tests
npm test

# Type check
npx tsc --noEmit -p packages/server
npx tsc --noEmit -p packages/client

# Server only
npm run dev -w packages/server

# Client only (Vite dev server on :5174)
npm run dev -w packages/client
```

## License

MIT
