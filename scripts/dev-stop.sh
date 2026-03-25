#!/usr/bin/env bash
#
# Impetus Lock - Development Environment Stop Script
# Gracefully stops all development services
#
# Usage: ./scripts/dev-stop.sh [OPTIONS]
#
# Options:
#   --clean    Also remove Docker containers and volumes
#   --help     Show this help message

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/server"
CLIENT_DIR="${ROOT_DIR}/client"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info() { printf "${BLUE}[STOP]${NC} %s\n" "$*"; }
success() { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$*"; }

CLEAN=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean)
      CLEAN=1
      shift
      ;;
    --help|-h)
      echo "Impetus Lock Development Environment Stop"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --clean    Also remove Docker containers and volumes"
      echo "  --help     Show this help message"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "${BOLD}Stopping Impetus Lock Development Environment${NC}"
echo ""

# =============================================================================
# Stop Docker Compose
# =============================================================================
if [[ -f "$ROOT_DIR/docker-compose.yml" ]]; then
  info "Stopping Docker Compose services..."
  cd "$ROOT_DIR"
  docker-compose down 2>/dev/null || true
  success "Docker Compose services stopped"
fi

# =============================================================================
# Stop Database
# =============================================================================
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-impetus-lock-postgres}"

if docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  info "Stopping PostgreSQL container..."
  docker stop "$POSTGRES_CONTAINER_NAME" >/dev/null
  success "PostgreSQL container stopped"
  
  if [[ $CLEAN -eq 1 ]]; then
    info "Removing PostgreSQL container..."
    docker rm "$POSTGRES_CONTAINER_NAME" >/dev/null
    success "PostgreSQL container removed"
  fi
fi

# =============================================================================
# Stop Backend
# =============================================================================
BACKEND_PORT="${BACKEND_PORT:-8000}"

info "Stopping backend processes..."

# Try to find and kill backend processes
if command -v lsof >/dev/null 2>&1; then
  BACKEND_PIDS=$(lsof -t -iTCP:"$BACKEND_PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$BACKEND_PIDS" ]]; then
    echo "$BACKEND_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    echo "$BACKEND_PIDS" | xargs kill -KILL 2>/dev/null || true
    success "Backend processes stopped"
  fi
fi

# Kill by PID files
for pid_file in "$SERVER_DIR/.backend.pid" "$ROOT_DIR/.backend.pid"; do
  if [[ -f "$pid_file" ]]; then
    PID=$(cat "$pid_file" 2>/dev/null || true)
    if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
      kill -TERM "$PID" 2>/dev/null || true
      sleep 1
      kill -KILL "$PID" 2>/dev/null || true
      success "Backend stopped (PID: $PID)"
    fi
    rm -f "$pid_file"
  fi
done

# Kill uvicorn processes
pgrep -f "uvicorn.*server.api.main:app" | xargs kill -TERM 2>/dev/null || true
sleep 1
pgrep -f "uvicorn.*server.api.main:app" | xargs kill -KILL 2>/dev/null || true

# =============================================================================
# Stop Frontend
# =============================================================================
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

info "Stopping frontend processes..."

# Try to find and kill frontend processes
if command -v lsof >/dev/null 2>&1; then
  FRONTEND_PIDS=$(lsof -t -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "$FRONTEND_PIDS" ]]; then
    echo "$FRONTEND_PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 1
    echo "$FRONTEND_PIDS" | xargs kill -KILL 2>/dev/null || true
    success "Frontend processes stopped"
  fi
fi

# Kill by PID files
for pid_file in "$CLIENT_DIR/.frontend.pid" "$ROOT_DIR/.frontend.pid"; do
  if [[ -f "$pid_file" ]]; then
    PID=$(cat "$pid_file" 2>/dev/null || true)
    if [[ -n "$PID" ]] && kill -0 "$PID" 2>/dev/null; then
      kill -TERM "$PID" 2>/dev/null || true
      sleep 1
      kill -KILL "$PID" 2>/dev/null || true
      success "Frontend stopped (PID: $PID)"
    fi
    rm -f "$pid_file"
  fi
done

# Kill vite processes
pgrep -f "vite" | xargs kill -TERM 2>/dev/null || true
sleep 1
pgrep -f "vite" | xargs kill -KILL 2>/dev/null || true

# =============================================================================
# Clean up
# =============================================================================
if [[ $CLEAN -eq 1 ]]; then
  info "Cleaning up resources..."
  
  # Remove orphaned containers
  docker container prune -f 2>/dev/null || true
  
  # Remove unused volumes
  docker volume prune -f 2>/dev/null || true
  
  success "Resources cleaned up"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
success "All services stopped!"

if [[ $CLEAN -eq 1 ]]; then
  info "Use './scripts/dev-setup.sh' to recreate the environment"
fi
