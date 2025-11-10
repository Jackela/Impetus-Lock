#!/usr/bin/env bash

# Run the Playwright demo showcase and export the recorded video.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT_DIR="${ROOT_DIR}/client"
OUTPUT_DIR="${ROOT_DIR}/demo-artifacts"
TEST_PATTERN="e2e/demo-showcase.spec.ts"
PROJECT="chromium"

info() { printf '\033[1;34m[demo]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[demo]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[demo]\033[0m %s\n' "$*"; }

info "Running Playwright demo showcase (${PROJECT}) - Muse provoke/rewrite + Loki delete"
(
  cd "$CLIENT_DIR"
  npx playwright test "$TEST_PATTERN" --project="$PROJECT" --reporter=line
)

LATEST_VIDEO_DIR="$(ls -td "${CLIENT_DIR}/test-results"/demo-showcase-*-"${PROJECT}" 2>/dev/null | head -n 1 || true)"

if [[ -z "$LATEST_VIDEO_DIR" ]]; then
  err "Could not locate Playwright video output."
  exit 1
fi

VIDEO_SRC="${LATEST_VIDEO_DIR}/video.webm"
mkdir -p "$OUTPUT_DIR"
VIDEO_COPY="${OUTPUT_DIR}/impetus-lock-demo.webm"

cp "$VIDEO_SRC" "$VIDEO_COPY"
info "Saved WebM recording to $VIDEO_COPY"

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -y -i "$VIDEO_COPY" -c:v libx264 -pix_fmt yuv420p "${OUTPUT_DIR}/impetus-lock-demo.mp4" >/dev/null 2>&1
  info "Converted to MP4 at ${OUTPUT_DIR}/impetus-lock-demo.mp4"
else
  warn "ffmpeg not installed; skipping MP4 conversion"
fi
