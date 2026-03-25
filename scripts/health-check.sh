#!/usr/bin/env bash
#
# Impetus Lock - Health Check Script
# Verifies all development environment services are running correctly
#
# Usage: ./scripts/health-check.sh [OPTIONS]
#
# Options:
#   --verbose    Show detailed information
#   --fix        Attempt to fix common issues
#   --help       Show this help message

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

info() { printf "${BLUE}[CHECK]${NC} %s\n" "$*"; }
success() { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
error() { printf "${RED}[FAIL]${NC} %s\n" "$*"; }

VERBOSE=0
FIX=0
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-impetus-lock-postgres}"

# Track overall health
HEALTH_STATUS=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --verbose)
      VERBOSE=1
      shift
      ;;
    --fix)
      FIX=1
      shift
      ;;
    --help|-h)
      echo "Impetus Lock Health Check"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --verbose    Show detailed information"
      echo "  --fix        Attempt to fix common issues"
      echo "  --help       Show this help message"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "${BOLD}Impetus Lock Health Check${NC}"
echo ""

# =============================================================================
# Check Prerequisites
# =============================================================================
check_prerequisites() {
  info "Checking prerequisites..."
  
  local all_good=1
  
  # Check Node.js
  if command -v node >/dev/null 2>&1; then
    local version
    version=$(node --version | cut -d'v' -f2)
    success "Node.js: $version"
    [[ $VERBOSE -eq 1 ]] && info "  Path: $(which node)"
  else
    error "Node.js: Not installed"
    all_good=0
  fi
  
  # Check Python
  if command -v python3 >/dev/null 2>&1; then
    local version
    version=$(python3 --version | cut -d' ' -f2)
    success "Python: $version"
    [[ $VERBOSE -eq 1 ]] && info "  Path: $(which python3)"
  else
    error "Python: Not installed"
    all_good=0
  fi
  
  # Check Docker
  if command -v docker >/dev/null 2>&1; then
    success "Docker: Installed"
    [[ $VERBOSE -eq 1 ]] && info "  Version: $(docker --version)"
    
    # Check if Docker is running
    if docker info >/dev/null 2>&1; then
      success "Docker: Running"
    else
      error "Docker: Not running"
      if [[ $FIX -eq 1 ]]; then
        warn "Please start Docker manually"
      fi
      all_good=0
    fi
  else
    error "Docker: Not installed"
    all_good=0
  fi
  
  # Check Poetry
  if command -v poetry >/dev/null 2>&1; then
    local version
    version=$(poetry --version | cut -d' ' -f3)
    success "Poetry: $version"
    [[ $VERBOSE -eq 1 ]] && info "  Path: $(which poetry)"
  else
    error "Poetry: Not installed"
    all_good=0
  fi
  
  # Check npm
  if command -v npm >/dev/null 2>&1; then
    local version
    version=$(npm --version)
    success "npm: $version"
    [[ $VERBOSE -eq 1 ]] && info "  Path: $(which npm)"
  else
    error "npm: Not installed"
    all_good=0
  fi
  
  if [[ $all_good -eq 0 ]]; then
    HEALTH_STATUS=1
  fi
  
  echo ""
}

# =============================================================================
# Check Environment Files
# =============================================================================
check_env_files() {
  info "Checking environment files..."
  
  local all_good=1
  
  # Check server .env
  if [[ -f "$SERVER_DIR/.env" ]]; then
    success "server/.env: Exists"
    [[ $VERBOSE -eq 1 ]] && info "  Path: $SERVER_DIR/.env"
  else
    error "server/.env: Missing"
    if [[ $FIX -eq 1 ]]; then
      if [[ -f "$SERVER_DIR/.env.example" ]]; then
        cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
        success "Created server/.env from example"
      fi
    fi
    all_good=0
  fi
  
  # Check client .env
  if [[ -f "$CLIENT_DIR/.env" ]]; then
    success "client/.env: Exists"
    [[ $VERBOSE -eq 1 ]] && info "  Path: $CLIENT_DIR/.env"
  else
    error "client/.env: Missing"
    if [[ $FIX -eq 1 ]]; then
      if [[ -f "$CLIENT_DIR/.env.example" ]]; then
        cp "$CLIENT_DIR/.env.example" "$CLIENT_DIR/.env"
        success "Created client/.env from example"
      fi
    fi
    all_good=0
  fi
  
  if [[ $all_good -eq 0 ]]; then
    HEALTH_STATUS=1
  fi
  
  echo ""
}

# =============================================================================
# Check Dependencies
# =============================================================================
check_dependencies() {
  info "Checking dependencies..."
  
  local all_good=1
  
  # Check backend dependencies
  if [[ -d "$SERVER_DIR/.venv" ]] || [[ -d "$SERVER_DIR/venv" ]]; then
    success "Backend virtual environment: Exists"
  else
    warn "Backend virtual environment: Not found (may be in Poetry's cache)"
  fi
  
  # Check frontend dependencies
  if [[ -d "$CLIENT_DIR/node_modules" ]]; then
    success "Frontend node_modules: Exists"
  else
    error "Frontend node_modules: Missing"
    if [[ $FIX -eq 1 ]]; then
      info "Installing frontend dependencies..."
      (cd "$CLIENT_DIR" && npm install)
      success "Frontend dependencies installed"
    fi
    all_good=0
  fi
  
  if [[ $all_good -eq 0 ]]; then
    HEALTH_STATUS=1
  fi
  
  echo ""
}

# =============================================================================
# Check Database
# =============================================================================
check_database() {
  info "Checking database..."
  
  if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
    error "PostgreSQL container: Not running"
    if [[ $FIX -eq 1 ]]; then
      info "Starting PostgreSQL container..."
      if docker ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
        docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
      else
        docker run -d --name "$POSTGRES_CONTAINER_NAME" \
          -e POSTGRES_USER=postgres \
          -e POSTGRES_PASSWORD=postgres \
          -e POSTGRES_DB=postgres \
          -p 5432:5432 \
          postgres:15-alpine >/dev/null
      fi
      
      until docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U postgres -d postgres >/dev/null 2>&1; do
        sleep 1
      done
      success "PostgreSQL container: Started"
    else
      HEALTH_STATUS=1
    fi
  else
    success "PostgreSQL container: Running"
    
    # Check if database is accessible
    if docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      success "PostgreSQL: Accessible"
    else
      error "PostgreSQL: Not accessible"
      HEALTH_STATUS=1
    fi
  fi
  
  echo ""
}

# =============================================================================
# Check Backend
# =============================================================================
check_backend() {
  info "Checking backend service..."
  
  if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    success "Backend: Running on port $BACKEND_PORT"
    
    # Get detailed health info if verbose
    if [[ $VERBOSE -eq 1 ]]; then
      local health_response
      health_response=$(curl -s "http://localhost:$BACKEND_PORT/health" 2>/dev/null || echo "{}")
      info "Health response: $health_response"
    fi
  else
    error "Backend: Not running on port $BACKEND_PORT"
    if [[ $FIX -eq 1 ]]; then
      warn "Run './scripts/dev-start.sh --no-frontend' to start the backend"
    fi
    HEALTH_STATUS=1
  fi
  
  echo ""
}

# =============================================================================
# Check Frontend
# =============================================================================
check_frontend() {
  info "Checking frontend service..."
  
  if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    success "Frontend: Running on port $FRONTEND_PORT"
  else
    error "Frontend: Not running on port $FRONTEND_PORT"
    if [[ $FIX -eq 1 ]]; then
      warn "Run './scripts/dev-start.sh --no-backend' to start the frontend"
    fi
    HEALTH_STATUS=1
  fi
  
  echo ""
}

# =============================================================================
# Check Ports
# =============================================================================
check_ports() {
  info "Checking port availability..."
  
  local ports=($BACKEND_PORT $FRONTEND_PORT 5432)
  local all_good=1
  
  for port in "${ports[@]}"; do
    if command -v lsof >/dev/null 2>&1; then
      local pids
      pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
      if [[ -n "$pids" ]]; then
        success "Port $port: In use"
        [[ $VERBOSE -eq 1 ]] && info "  PIDs: $pids"
      else
        warn "Port $port: Available (not in use)"
      fi
    fi
  done
  
  echo ""
}

# =============================================================================
# Summary
# =============================================================================
show_summary() {
  echo "${BOLD}Health Check Summary${NC}"
  echo ""
  
  if [[ $HEALTH_STATUS -eq 0 ]]; then
    success "All checks passed! Environment is healthy."
    echo ""
    echo "${BOLD}Services:${NC}"
    echo "  Backend:  http://localhost:$BACKEND_PORT"
    echo "  Frontend: http://localhost:$FRONTEND_PORT"
    echo ""
  else
    error "Some checks failed. Please review the issues above."
    echo ""
    echo "${BOLD}Quick fixes:${NC}"
    echo "  Run with --fix to attempt automatic fixes"
    echo "  Run './scripts/dev-setup.sh' for full setup"
    echo "  Run './scripts/dev-start.sh' to start services"
    echo ""
    exit 1
  fi
}

# =============================================================================
# Main
# =============================================================================
check_prerequisites
check_env_files
check_dependencies
check_database
check_backend
check_frontend
check_ports
show_summary
