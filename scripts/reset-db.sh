#!/usr/bin/env bash
#
# Impetus Lock - Database Reset Script
# Resets the database to a clean state
#
# Usage: ./scripts/reset-db.sh [OPTIONS]
#
# Options:
#   --force      Skip confirmation prompt
#   --seed       Run seed data after reset
#   --backup     Create backup before reset
#   --help       Show this help message

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="${ROOT_DIR}/server"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info() { printf "${BLUE}[DB]${NC} %s\n" "$*"; }
success() { printf "${GREEN}[OK]${NC} %s\n" "$*"; }
warn() { printf "${YELLOW}[WARN]${NC} %s\n" "$*"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$*"; }

FORCE=0
SEED=0
BACKUP=0

POSTGRES_CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-impetus-lock-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --force)
      FORCE=1
      shift
      ;;
    --seed)
      SEED=1
      shift
      ;;
    --backup)
      BACKUP=1
      shift
      ;;
    --help|-h)
      echo "Impetus Lock Database Reset"
      echo ""
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --force      Skip confirmation prompt"
      echo "  --seed       Run seed data after reset"
      echo "  --backup     Create backup before reset"
      echo "  --help       Show this help message"
      echo ""
      echo "Warning: This will delete all data in the database!"
      exit 0
      ;;
    *)
      error "Unknown option: $1"
      exit 1
      ;;
  esac
done

echo "${BOLD}${RED}WARNING: Database Reset${NC}"
echo ""
echo "This will delete ALL data in the PostgreSQL database."
echo "Database: $POSTGRES_DB"
echo "Container: $POSTGRES_CONTAINER_NAME"
echo ""

# Confirmation
if [[ $FORCE -eq 0 ]]; then
  read -p "Are you sure you want to continue? (yes/no): " confirm
  if [[ "$confirm" != "yes" ]]; then
    info "Aborted by user"
    exit 0
  fi
fi

# =============================================================================
# Create Backup
# =============================================================================
if [[ $BACKUP -eq 1 ]]; then
  info "Creating backup..."
  
  if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
    error "PostgreSQL container is not running"
    exit 1
  fi
  
  BACKUP_FILE="${ROOT_DIR}/db-backup-$(date +%Y%m%d-%H%M%S).sql"
  docker exec "$POSTGRES_CONTAINER_NAME" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" > "$BACKUP_FILE"
  success "Backup created: $BACKUP_FILE"
  echo ""
fi

# =============================================================================
# Stop Services
# =============================================================================
info "Stopping services..."

# Stop backend
"$ROOT_DIR/scripts/dev-stop.sh" >/dev/null 2>&1 || true

success "Services stopped"
echo ""

# =============================================================================
# Reset Database
# =============================================================================
info "Resetting database..."

# Ensure PostgreSQL is running
if ! docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
  info "Starting PostgreSQL container..."
  
  if docker ps -a --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER_NAME}$"; then
    docker start "$POSTGRES_CONTAINER_NAME" >/dev/null
  else
    docker run -d --name "$POSTGRES_CONTAINER_NAME" \
      -e POSTGRES_USER="$POSTGRES_USER" \
      -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
      -e POSTGRES_DB="$POSTGRES_DB" \
      -p 5432:5432 \
      postgres:15-alpine >/dev/null
  fi
  
  until docker exec "$POSTGRES_CONTAINER_NAME" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
    sleep 1
  done
fi

# Drop and recreate database
info "Dropping database..."
docker exec "$POSTGRES_CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" >/dev/null 2>&1 || true

info "Creating database..."
docker exec "$POSTGRES_CONTAINER_NAME" psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE $POSTGRES_DB;" >/dev/null

success "Database reset complete"
echo ""

# =============================================================================
# Run Migrations
# =============================================================================
step() { printf "${CYAN}→${NC} %s\n" "$*"; }

step "Running migrations..."

(
  cd "$SERVER_DIR"
  export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
  poetry run alembic upgrade head
)

success "Migrations completed"
echo ""

# =============================================================================
# Seed Data (optional)
# =============================================================================
if [[ $SEED -eq 1 ]]; then
  step "Seeding database..."
  
  # Check if there's a seed script
  if [[ -f "$SERVER_DIR/scripts/seed.py" ]]; then
    (
      cd "$SERVER_DIR"
      export DATABASE_URL="postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
      poetry run python scripts/seed.py
    )
    success "Database seeded"
  else
    warn "No seed script found at server/scripts/seed.py"
  fi
  
  echo ""
fi

# =============================================================================
# Restart Services
# =============================================================================
step "Restarting services..."

"$ROOT_DIR/scripts/dev-start.sh" &
echo ""

# =============================================================================
# Completion
# =============================================================================
success "Database reset complete!"
echo ""
echo "${BOLD}Summary:${NC}"
echo "  Database: $POSTGRES_DB (reset)"
echo "  Migrations: Applied"
[[ $SEED -eq 1 ]] && echo "  Seed data: Applied"
[[ $BACKUP -eq 1 ]] && echo "  Backup: $BACKUP_FILE"
echo ""
echo "Services are starting in the background..."
echo "Run ${CYAN}./scripts/health-check.sh${NC} to verify everything is working"
