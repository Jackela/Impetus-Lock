#!/bin/bash
# Local validation script - run before pushing to ensure CI will pass
#
# Usage:
#   ./scripts/validate.sh           # Full validation (backend + frontend)
#   ./scripts/validate.sh backend   # Backend only
#   ./scripts/validate.sh frontend  # Frontend only
#
# This script clears lint caches to ensure fresh results match CI.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

validate_backend() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║         Backend Validation             ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    cd "$PROJECT_ROOT/server"

    echo "→ Clearing Ruff cache..."
    rm -rf .ruff_cache

    echo "→ Running Ruff check..."
    poetry run ruff check .

    echo "→ Running Ruff format check..."
    poetry run ruff format --check

    echo "→ Running mypy..."
    poetry run mypy .

    echo "→ Running pytest..."
    poetry run pytest tests/ -v --ignore=tests/e2e

    echo ""
    echo "✅ Backend validation passed!"
}

validate_frontend() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║        Frontend Validation             ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    cd "$PROJECT_ROOT/client"

    echo "→ Clearing ESLint cache..."
    rm -rf node_modules/.cache

    echo "→ Running ESLint..."
    npm run lint -- --max-warnings=0

    echo "→ Running TypeScript check..."
    npm run type-check

    echo "→ Running Vitest..."
    npm run test -- --run

    echo ""
    echo "✅ Frontend validation passed!"
}

case "${1:-all}" in
    backend)
        validate_backend
        ;;
    frontend)
        validate_frontend
        ;;
    all)
        validate_backend
        validate_frontend
        echo ""
        echo "╔════════════════════════════════════════╗"
        echo "║     All validations passed! 🎉         ║"
        echo "║         Safe to push.                  ║"
        echo "╚════════════════════════════════════════╝"
        ;;
    *)
        echo "Usage: $0 [backend|frontend|all]"
        exit 1
        ;;
esac
