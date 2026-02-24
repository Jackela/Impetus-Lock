#!/usr/bin/env bash

# Dev convenience launcher for Impetus Lock.
# Starts FastAPI backend (poetry/uvicorn) and Vite frontend.
# Now runs interactively via tmux when available; otherwise runs both
# in the foreground and fails fast if either exits.
# Usage: ./scripts/dev-start.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/server"
CLIENT_DIR="${ROOT_DIR}/client"

BACKEND_PORT="${BACKEND_PORT:-8081}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
API_HOST="${API_HOST:-0.0.0.0}"
API_URL_DEFAULT="http://127.0.0.1:${BACKEND_PORT}"
VITE_API_URL="${VITE_API_URL:-$API_URL_DEFAULT}"

# legacy artifacts (unused in interactive mode; kept for compatibility)
BACKEND_LOG="${SERVER_DIR}/server_dev.log"
FRONTEND_LOG="${CLIENT_DIR}/devserver.log"
BACKEND_PID_FILE="${SERVER_DIR}/.backend.pid"
FRONTEND_PID_FILE="${CLIENT_DIR}/.frontend.pid"

info() { printf '\033[1;34m[dev-start]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[dev-start]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[dev-start]\033[0m %s\n' "$*"; }

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Missing required command: $1"
    exit 1
  fi
}

stop_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      warn "Port $port in use by: $pids (terminating)"
      kill $pids 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}"/tcp 2>/dev/null || true
  fi
}

require poetry
require npm

export VITE_API_URL

# Free ports to avoid bind errors
stop_port "$BACKEND_PORT"
stop_port "$FRONTEND_PORT"

backend_cmd=(
  bash -lc "cd '$SERVER_DIR' && poetry install --no-root >/dev/null 2>&1 || true && \
  exec poetry run uvicorn server.api.main:app --host '$API_HOST' --port '$BACKEND_PORT' --reload"
)

frontend_cmd=(
  bash -lc "cd '$CLIENT_DIR' && \
  ([ -f package-lock.json ] && npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1) && \
  export VITE_API_URL='$VITE_API_URL' && \
  exec npm run dev -- --host '$FRONTEND_HOST' --port '$FRONTEND_PORT'"
)

if command -v tmux >/dev/null 2>&1; then
  info "Launching services in tmux session: impetus-lock"
  if tmux has-session -t impetus-lock 2>/dev/null; then
    warn "Existing tmux session 'impetus-lock' found; killing it"
    tmux kill-session -t impetus-lock || true
  fi

  tmux new-session -d -s impetus-lock -n backend "${backend_cmd[@]}"
  tmux new-window  -t impetus-lock -n frontend "${frontend_cmd[@]}"
  tmux select-window -t impetus-lock:backend
  info "Attaching. Detach with Ctrl-b d."
  exec tmux attach -t impetus-lock
else
  warn "tmux not found. Running both services in this terminal (fail-fast)."
  set +e
  eval "${backend_cmd[@]}" &
  pid_backend=$!
  eval "${frontend_cmd[@]}" &
  pid_frontend=$!
  first_status=0
  # Exit when any process exits; kill the other
  wait -n "$pid_backend" "$pid_frontend" || first_status=$?
  warn "One process exited (status=$first_status). Terminating the other..."
  kill "$pid_backend" "$pid_frontend" 2>/dev/null || true
  wait || true
  exit "$first_status"
fi
