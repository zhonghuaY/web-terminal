#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_NAME="web-terminal"
SERVER_PORT="${PORT:-8090}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[${PROJECT_NAME}]${NC} $*"; }
warn() { echo -e "${YELLOW}[${PROJECT_NAME}]${NC} $*"; }
err()  { echo -e "${RED}[${PROJECT_NAME}]${NC} $*" >&2; }

kill_previous() {
  log "Stopping previous processes..."

  local pids
  pids=$(pgrep -f "tsx.*web_terminal" 2>/dev/null || true)
  pids+=" $(pgrep -f "vite.*web_terminal" 2>/dev/null || true)"
  pids+=" $(pgrep -f "concurrently.*web_terminal" 2>/dev/null || true)"
  pids+=" $(lsof -ti:"${SERVER_PORT}" 2>/dev/null || true)"

  pids=$(echo "$pids" | tr ' ' '\n' | sort -u | grep -v '^$' || true)

  if [ -z "$pids" ]; then
    log "No previous processes found."
    return
  fi

  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null && log "  Sent SIGTERM to PID $pid" || true
    fi
  done

  sleep 2

  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null && warn "  Force killed PID $pid" || true
    fi
  done

  log "Previous processes stopped."
}

start_dev() {
  log "Starting in development mode..."
  cd "$PROJECT_DIR"
  npm run build -w packages/shared --silent 2>&1 | tail -1
  exec npm run dev
}

start_prod() {
  log "Starting in production mode..."
  cd "$PROJECT_DIR"
  npm run build
  exec npm start
}

usage() {
  cat <<EOF
Usage: $0 [dev|prod|stop]

Commands:
  dev   Kill old processes, then start dev servers (default)
  prod  Kill old processes, build, then start production server
  stop  Kill all web-terminal processes and exit
EOF
}

main() {
  local mode="${1:-dev}"

  case "$mode" in
    dev)
      kill_previous
      start_dev
      ;;
    prod)
      kill_previous
      start_prod
      ;;
    stop)
      kill_previous
      log "Done."
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      err "Unknown command: $mode"
      usage
      exit 1
      ;;
  esac
}

main "$@"
