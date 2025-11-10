#!/usr/bin/env bash

# Dev convenience launcher for Impetus Lock.
# Starts FastAPI backend (poetry/uvicorn) and Vite frontend inside WSL/Linux.
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

stop_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      warn "Stopping existing process (pid=$pid from ${pid_file})"
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
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

info "Preparing backend (port ${BACKEND_PORT})"
stop_pid_file "$BACKEND_PID_FILE"
stop_port "$BACKEND_PORT"

info "Starting FastAPI backend..."
(
  cd "$SERVER_DIR"
  nohup poetry run uvicorn server.api.main:app \
    --host "$API_HOST" \
    --port "$BACKEND_PORT" \
    --reload \
    >"$BACKEND_LOG" 2>&1 &
  echo $! >"$BACKEND_PID_FILE"
) || {
  error "Failed to start backend"
  exit 1
}

sleep 1
info "Backend log => $BACKEND_LOG"

info "Preparing frontend (port ${FRONTEND_PORT}, VITE_API_URL=${VITE_API_URL})"
stop_pid_file "$FRONTEND_PID_FILE"
stop_port "$FRONTEND_PORT"

info "Starting Vite frontend..."
(
  cd "$CLIENT_DIR"
  nohup npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" \
    >"$FRONTEND_LOG" 2>&1 &
  echo $! >"$FRONTEND_PID_FILE"
) || {
  error "Failed to start frontend"
  exit 1
}

sleep 1
info "Frontend log => $FRONTEND_LOG"

cat <<EOT

✅ Dev servers are up!
  Backend: http://127.0.0.1:${BACKEND_PORT} (FastAPI docs at /docs)
  Frontend: http://localhost:${FRONTEND_PORT}

🔧 Environment overrides:
  BACKEND_PORT, FRONTEND_PORT, FRONTEND_HOST, API_HOST, VITE_API_URL

🛑 To stop:
  kill \$(cat ${BACKEND_PID_FILE} 2>/dev/null) 2>/dev/null || true
  kill \$(cat ${FRONTEND_PID_FILE} 2>/dev/null) 2>/dev/null || true
EOT
