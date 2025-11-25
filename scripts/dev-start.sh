#!/usr/bin/env bash

# Dev convenience launcher for Impetus Lock.
# Bootstraps Dockerized Postgres, runs Alembic migrations, and starts
# FastAPI (poetry/uvicorn) plus the Vite frontend unless explicitly skipped.
# Usage: ./scripts/dev-start.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/server"
CLIENT_DIR="${ROOT_DIR}/client"

POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-impetus-lock-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"

AUTO_START_POSTGRES="${AUTO_START_POSTGRES:-1}"
AUTO_START_FRONTEND="${AUTO_START_FRONTEND:-1}"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
API_HOST="${API_HOST:-0.0.0.0}"

DATABASE_URL_DEFAULT="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_PORT}/${POSTGRES_DB}"
export DATABASE_URL="${DATABASE_URL:-$DATABASE_URL_DEFAULT}"
export LLM_ALLOW_DEBUG_PROVIDER="${LLM_ALLOW_DEBUG_PROVIDER:-1}"
export LLM_DEFAULT_PROVIDER="${LLM_DEFAULT_PROVIDER:-debug}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-debug-openai-placeholder}"

API_URL_DEFAULT="http://127.0.0.1:${BACKEND_PORT}"
export VITE_API_URL="${VITE_API_URL:-$API_URL_DEFAULT}"

BACKEND_PID_FILE="${SERVER_DIR}/.backend.pid"
FRONTEND_PID_FILE="${CLIENT_DIR}/.frontend.pid"

backend_pid=""
frontend_pid=""

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

cleanup() {
  if [[ -n "${backend_pid:-}" ]]; then
    if kill -0 "$backend_pid" 2>/dev/null; then
      warn "Stopping backend (pid=$backend_pid)"
      kill "$backend_pid" 2>/dev/null || true
      wait "$backend_pid" 2>/dev/null || true
    fi
  elif [[ -f "$BACKEND_PID_FILE" ]]; then
    local file_pid
    file_pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$file_pid" ]] && kill -0 "$file_pid" 2>/dev/null; then
      warn "Stopping backend from pid file (pid=$file_pid)"
      kill "$file_pid" 2>/dev/null || true
      wait "$file_pid" 2>/dev/null || true
    fi
  fi

  if [[ -n "${frontend_pid:-}" ]]; then
    if kill -0 "$frontend_pid" 2>/dev/null; then
      warn "Stopping frontend (pid=$frontend_pid)"
      kill "$frontend_pid" 2>/dev/null || true
      wait "$frontend_pid" 2>/dev/null || true
    fi
  elif [[ -f "$FRONTEND_PID_FILE" ]]; then
    local file_pid
    file_pid="$(cat "$FRONTEND_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$file_pid" ]] && kill -0 "$file_pid" 2>/dev/null; then
      warn "Stopping frontend from pid file (pid=$file_pid)"
      kill "$file_pid" 2>/dev/null || true
      wait "$file_pid" 2>/dev/null || true
    fi
  fi

  rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE" 2>/dev/null || true
}

trap cleanup EXIT

ensure_postgres() {
  if [[ "$AUTO_START_POSTGRES" == "0" ]]; then
    warn "AUTO_START_POSTGRES=0, skipping Dockerized Postgres startup"
    return
  fi

  require docker

  local running
  running="$(docker ps -q --filter "name=^/${POSTGRES_CONTAINER_NAME}$")"

  if [[ -z "$running" ]]; then
    local existing
    existing="$(docker ps -aq --filter "name=^/${POSTGRES_CONTAINER_NAME}$")"
    if [[ -n "$existing" ]]; then
      info "Starting existing Postgres container '${POSTGRES_CONTAINER_NAME}'"
      docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
    else
      info "Creating Postgres container '${POSTGRES_CONTAINER_NAME}'"
      docker run -d --name "$POSTGRES_CONTAINER_NAME" \
        -e POSTGRES_USER="$POSTGRES_USER" \
        -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        -e POSTGRES_DB="$POSTGRES_DB" \
        -p "${POSTGRES_PORT}:5432" \
        postgres:15-alpine >/dev/null
    fi
  else
    info "Reusing running Postgres container '${POSTGRES_CONTAINER_NAME}'"
  fi

  info "Waiting for Postgres to become ready..."
  until docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
    sleep 1
  done
  info "Postgres is ready on localhost:${POSTGRES_PORT}"
}

run_backend_setup() {
  require poetry
  pushd "$SERVER_DIR" >/dev/null
  info "Installing backend dependencies"
  poetry install --no-root >/dev/null 2>&1
  info "Running Alembic migrations"
  poetry run alembic upgrade head
  popd >/dev/null
}

start_backend() {
  pushd "$SERVER_DIR" >/dev/null
  info "Starting backend on port ${BACKEND_PORT}"
  poetry run uvicorn server.api.main:app \
    --host "$API_HOST" \
    --port "$BACKEND_PORT" \
    --reload &
  backend_pid=$!
  popd >/dev/null
  echo "$backend_pid" > "$BACKEND_PID_FILE"
  info "Backend PID: $backend_pid (recorded in $BACKEND_PID_FILE)"
}

start_frontend() {
  if [[ "$AUTO_START_FRONTEND" == "0" ]]; then
    warn "AUTO_START_FRONTEND=0, skipping Vite startup"
    return
  fi

  require npm
  pushd "$CLIENT_DIR" >/dev/null
  info "Installing frontend dependencies"
  if [[ -f package-lock.json ]]; then
    npm ci >/dev/null
  else
    npm install >/dev/null
  fi
  info "Starting Vite dev server on port ${FRONTEND_PORT}"
  VITE_API_URL="$VITE_API_URL" npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" &
  frontend_pid=$!
  popd >/dev/null
  echo "$frontend_pid" > "$FRONTEND_PID_FILE"
  info "Frontend PID: $frontend_pid (recorded in $FRONTEND_PID_FILE)"
}

wait_for_processes() {
  local pids=()
  [[ -n "${backend_pid:-}" ]] && pids+=("$backend_pid")
  [[ -n "${frontend_pid:-}" ]] && pids+=("$frontend_pid")

  if [[ ${#pids[@]} -eq 0 ]]; then
    warn "No processes were started. Exiting."
    return
  fi

  info "Services running. Press Ctrl+C to stop."
  set +e
  wait -n "${pids[@]}"
  local status=$?
  if [[ $status -ne 0 ]]; then
    warn "One process exited with status $status. Shutting down the rest."
  else
    warn "One process exited. Shutting down remaining services."
  fi
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait "${pids[@]}" 2>/dev/null || true
  exit "$status"
}

ensure_postgres

stop_port "$BACKEND_PORT"
if [[ "$AUTO_START_FRONTEND" != "0" ]]; then
  stop_port "$FRONTEND_PORT"
fi

run_backend_setup
start_backend
start_frontend

wait_for_processes
