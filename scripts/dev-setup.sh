#!/usr/bin/env bash
#
# Impetus Lock - Development Environment Setup Script
# One-time setup for new developers
#
# Usage: ./scripts/dev-setup.sh [--force]
#   --force    Force reinstallation even if already set up

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
NC='\033[0m' # No Color

info() { printf "${BLUE}[SETUP]${NC} %s\n" "$*"; }
success() { printf "${GREEN}[SUCCESS]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$*"; }
step() { printf "${CYAN}${BOLD}→${NC} %s\n" "$*"; }

FORCE=0
if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

info "Setting up Impetus Lock development environment..."
echo ""

# =============================================================================
# Prerequisites Check
# =============================================================================
step "Checking prerequisites..."

check_prerequisite() {
  local cmd="$1"
  local name="$2"
  local version_cmd="${3:-$1 --version}"
  local min_version="${4:-}"
  
  if ! command -v "$cmd" >/dev/null 2>&1; then
    error "$name is not installed"
    return 1
  fi
  
  if [[ -n "$min_version" ]]; then
    local version
    version=$($version_cmd 2>&1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
    info "$name version: $version (required: $min_version+)"
  else
    local version
    version=$($version_cmd 2>&1 | head -1 || echo "unknown")
    info "$name: $version"
  fi
  return 0
}

ALL_GOOD=1

# Check Node.js (20+)
if ! check_prerequisite "node" "Node.js" "node --version" "20"; then
  error "Please install Node.js 20+ from https://nodejs.org/"
  ALL_GOOD=0
fi

# Check Python (3.12+)
if ! check_prerequisite "python3" "Python" "python3 --version" "3.12"; then
  error "Please install Python 3.12+ from https://python.org/"
  ALL_GOOD=0
fi

# Check Docker
if ! check_prerequisite "docker" "Docker" "docker --version"; then
  error "Please install Docker from https://docker.com/"
  ALL_GOOD=0
fi

# Check Poetry
if ! check_prerequisite "poetry" "Poetry" "poetry --version"; then
  error "Please install Poetry: curl -sSL https://install.python-poetry.org | python3 -"
  ALL_GOOD=0
fi

if [[ $ALL_GOOD -eq 0 ]]; then
  error "Some prerequisites are missing. Please install them and try again."
  exit 1
fi

success "All prerequisites satisfied!"
echo ""

# =============================================================================
# Environment Files Setup
# =============================================================================
step "Setting up environment files..."

setup_env_file() {
  local source="$1"
  local target="$2"
  local name="$3"
  
  if [[ -f "$target" && $FORCE -eq 0 ]]; then
    warn "$name already exists (use --force to overwrite)"
  else
    cp "$source" "$target"
    success "Created $name"
    info "Please review and customize: $target"
  fi
}

setup_env_file "$SERVER_DIR/.env.example" "$SERVER_DIR/.env" "server/.env"
setup_env_file "$CLIENT_DIR/.env.example" "$CLIENT_DIR/.env" "client/.env"
echo ""

# =============================================================================
# Backend Dependencies
# =============================================================================
step "Installing backend dependencies..."

(
  cd "$SERVER_DIR"
  poetry install --no-root
  success "Backend dependencies installed"
)
echo ""

# =============================================================================
# Frontend Dependencies
# =============================================================================
step "Installing frontend dependencies..."

(
  cd "$CLIENT_DIR"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  success "Frontend dependencies installed"
)
echo ""

# =============================================================================
# Playwright Browsers
# =============================================================================
step "Installing Playwright browsers..."

(
  cd "$CLIENT_DIR"
  npx playwright install chromium
  success "Playwright browsers installed"
)
echo ""

# =============================================================================
# Pre-commit Hooks
# =============================================================================
step "Setting up pre-commit hooks..."

if [[ -d "$ROOT_DIR/.husky" ]]; then
  (
    cd "$CLIENT_DIR"
    if npm run prepare 2>/dev/null; then
      success "Pre-commit hooks installed"
    else
      warn "Could not install pre-commit hooks"
    fi
  )
else
  warn "No .husky directory found, skipping pre-commit hooks"
fi
echo ""

# =============================================================================
# Database Setup
# =============================================================================
step "Setting up database..."

POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-impetus-lock-postgres}"

if ! docker ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  info "Creating PostgreSQL container..."
  docker run -d --name "$POSTGRES_CONTAINER_NAME" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=postgres \
    -p 5432:5432 \
    postgres:15-alpine >/dev/null
  success "PostgreSQL container created"
else
  info "PostgreSQL container already exists"
fi

# Start if not running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  info "Starting PostgreSQL container..."
  docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
fi

# Wait for PostgreSQL
info "Waiting for PostgreSQL to be ready..."
until docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U postgres -d postgres >/dev/null 2>&1; do
  sleep 1
done
success "PostgreSQL is ready"
echo ""

# Run migrations
step "Running database migrations..."
(
  cd "$SERVER_DIR"
  poetry run alembic upgrade head
  success "Database migrations completed"
)
echo ""

# =============================================================================
# Completion
# =============================================================================
success "Development environment setup complete!"
echo ""
echo "${BOLD}Next steps:${NC}"
echo "  1. Edit ${CYAN}server/.env${NC} and add your API keys"
echo "  2. Run ${CYAN}./scripts/dev-start.sh${NC} to start the development server"
echo "  3. Open ${CYAN}http://localhost:5173${NC} in your browser"
echo ""
echo "${BOLD}Useful commands:${NC}"
echo "  ${CYAN}./scripts/dev-start.sh${NC}      Start all services"
echo "  ${CYAN}./scripts/dev-stop.sh${NC}       Stop all services"
echo "  ${CYAN}./scripts/health-check.sh${NC}    Check service health"
echo "  ${CYAN}./scripts/run-e2e.sh${NC}          Run E2E tests"
echo ""
