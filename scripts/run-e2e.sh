#!/usr/bin/env bash
#
# Impetus Lock - E2E Test Runner
# Runs Playwright E2E tests with proper environment setup
#
# Usage: ./scripts/run-e2e.sh [OPTIONS] [TEST_PATTERN]
#
# Options:
#   --ui              Run tests with UI mode
#   --headed          Run tests in headed mode (show browser)
#   --debug           Run tests in debug mode
#   --report          Open HTML report after tests
#   --no-start        Don't start services (assume already running)
#   --clean           Clean test results before running
#   --help            Show this help message

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="${ROOT_DIR}/client"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info() { printf "${BLUE}[E2E]${NC} %s\n" "$*"; }
success() { printf "${GREEN}[PASS]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
error() { printf "${RED}[FAIL]${NC} %s\n" "$*"; }

# Default configuration
UI_MODE=0
HEADED=0
DEBUG=0
OPEN_REPORT=0
NO_START=0
CLEAN=0
TEST_PATTERN=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --ui)
      UI_MODE=1
      shift
      ;;
    --headed)
      HEADED=1
      shift
      ;;
    --debug)
      DEBUG=1
      shift
      ;;
    --report)
      OPEN_REPORT=1
      shift
      ;;
    --no-start)
      NO_START=1
      shift
      ;;
    --clean)
      CLEAN=1
      shift
      ;;
    --help|-h)
      echo "Impetus Lock E2E Test Runner"
      echo ""
      echo "Usage: $0 [OPTIONS] [TEST_PATTERN]"
      echo ""
      echo "Options:"
      echo "  --ui              Run tests with UI mode"
      echo "  --headed          Run tests in headed mode (show browser)"
      echo "  --debug           Run tests in debug mode"
      echo "  --report          Open HTML report after tests"
      echo "  --no-start        Don't start services (assume already running)"
      echo "  --clean           Clean test results before running"
      echo "  --help, -h        Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                          Run all tests"
      echo "  $0 smoke.spec.ts            Run specific test file"
      echo "  $0 --headed                 Run tests with visible browser"
      echo "  $0 --ui                     Open Playwright UI mode"
      echo "  $0 --report                 Run tests and open report"
      exit 0
      ;;
    -*)
      error "Unknown option: $1"
      exit 1
      ;;
    *)
      TEST_PATTERN="$1"
      shift
      ;;
  esac
done

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-impetus-lock-postgres}"

# =============================================================================
# Check Prerequisites
# =============================================================================
check_prerequisites() {
  info "Checking prerequisites..."
  
  if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed"
    exit 1
  fi
  
  if ! command -v docker >/dev/null 2>&1; then
    error "Docker is not installed"
    exit 1
  fi
  
  success "Prerequisites satisfied"
}

# =============================================================================
# Clean Test Results
# =============================================================================
clean_results() {
  if [[ $CLEAN -eq 1 ]]; then
    info "Cleaning previous test results..."
    rm -rf "$CLIENT_DIR/test-results" 2>/dev/null || true
    rm -rf "$CLIENT_DIR/playwright-report" 2>/dev/null || true
    success "Test results cleaned"
  fi
}

# =============================================================================
# Start Services
# =============================================================================
start_services() {
  if [[ $NO_START -eq 1 ]]; then
    info "Skipping service startup (--no-start)"
    return
  fi
  
  info "Starting services..."
  
  # Check if services are already running
  local backend_running=0
  local frontend_running=0
  
  if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
    backend_running=1
    info "Backend is already running"
  fi
  
  if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    frontend_running=1
    info "Frontend is already running"
  fi
  
  # Start database if needed
  if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
    info "Starting PostgreSQL..."
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
    success "PostgreSQL is ready"
  fi
  
  # Start backend if needed
  if [[ $backend_running -eq 0 ]]; then
    info "Starting backend..."
    (
      cd "$ROOT_DIR"
      ./scripts/dev-start.sh --no-frontend &
    )
    
    # Wait for backend
    local max_attempts=30
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
      if curl -s "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1; then
        success "Backend is ready!"
        break
      fi
      info "Waiting for backend... ($attempt/$max_attempts)"
      sleep 2
      ((attempt++))
    done
  fi
  
  # Start frontend if needed
  if [[ $frontend_running -eq 0 ]]; then
    info "Starting frontend..."
    (
      cd "$CLIENT_DIR"
      export VITE_API_URL="http://localhost:$BACKEND_PORT"
      npm run dev -- --port "$FRONTEND_PORT" &
    )
    
    # Wait for frontend
    local max_attempts=30
    local attempt=1
    while [[ $attempt -le $max_attempts ]]; do
      if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
        success "Frontend is ready!"
        break
      fi
      info "Waiting for frontend... ($attempt/$max_attempts)"
      sleep 2
      ((attempt++))
    done
  fi
}

# =============================================================================
# Run Tests
# =============================================================================
run_tests() {
  info "Running E2E tests..."
  
  cd "$CLIENT_DIR"
  
  # Build Playwright command
  local playwright_args=()
  
  if [[ $UI_MODE -eq 1 ]]; then
    playwright_args+=("--ui")
  fi
  
  if [[ $HEADED -eq 1 ]]; then
    playwright_args+=("--headed")
  fi
  
  if [[ $DEBUG -eq 1 ]]; then
    playwright_args+=("--debug")
  fi
  
  if [[ -n "$TEST_PATTERN" ]]; then
    playwright_args+=("$TEST_PATTERN")
  fi
  
  # Set environment variables
  export CI=1
  export PLAYWRIGHT_HEADLESS=1
  export VITE_API_URL="http://localhost:$BACKEND_PORT"
  
  # Run tests
  set +e
  npx playwright test "${playwright_args[@]}"
  local exit_code=$?
  set -e
  
  return $exit_code
}

# =============================================================================
# Open Report
# =============================================================================
open_report() {
  if [[ $OPEN_REPORT -eq 1 ]]; then
    info "Opening test report..."
    
    local report_path="$CLIENT_DIR/playwright-report/index.html"
    
    if [[ -f "$report_path" ]]; then
      case "$(uname -s)" in
        Linux*)
          if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$report_path"
          fi
          ;;
        Darwin*)
          open "$report_path"
          ;;
        CYGWIN*|MINGW*|MSYS*)
          start "$report_path"
          ;;
      esac
    else
      warn "Report not found at $report_path"
    fi
  fi
}

# =============================================================================
# Cleanup
# =============================================================================
cleanup() {
  if [[ $NO_START -eq 0 ]]; then
    info "Cleaning up..."
    "$ROOT_DIR/scripts/dev-stop.sh" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

# =============================================================================
# Main
# =============================================================================
echo "${BOLD}Impetus Lock E2E Test Runner${NC}"
echo ""

check_prerequisites
clean_results
start_services

# Run tests
if run_tests; then
  success "All tests passed!"
  TEST_EXIT_CODE=0
else
  error "Some tests failed"
  TEST_EXIT_CODE=1
fi

open_report

exit $TEST_EXIT_CODE
