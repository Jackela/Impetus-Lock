#!/usr/bin/env bash

set -euo pipefail

SRC_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="${ACT_WORKSPACE:-$HOME/impetus-lock-act}"
CACHE_DIR="${ACT_CACHE_DIR:-$HOME/.cache/act}"
LOG_PATH="${ACT_LOG_PATH:-/tmp/act-e2e.log}"

mkdir -p "$TARGET_DIR" "$CACHE_DIR"

RSYNC_EXCLUDES=(
  --exclude '.venv*'
  --exclude 'test-results/act-e2e.log'
)

echo "[act-sync] Syncing repo to $TARGET_DIR"
rsync -a --delete "${RSYNC_EXCLUDES[@]}" "$SRC_ROOT/" "$TARGET_DIR/"

echo "[act-sync] Ensuring conflicting containers are stopped"
if docker ps -q --filter name=impetus-lock-postgres >/dev/null; then
  docker stop impetus-lock-postgres >/dev/null || true
fi

export ACT_WORKSPACE_BASE="$TARGET_DIR"
export ACT_CACHE_DIR="$CACHE_DIR"
export ACT=true

echo "[act-sync] Workspace prepared."

if [[ $# -gt 0 ]]; then
  (cd "$TARGET_DIR" && "$@" | tee "$LOG_PATH")
  echo "[act-sync] Log captured at $LOG_PATH"
else
  printf "ACT environment prepared. Run commands inside %s as needed.\n" "$TARGET_DIR"
fi
