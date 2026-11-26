#!/usr/bin/env bash
set -euo pipefail

wire_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$wire_dir/../.." && pwd)"
mode="${1:-verify}"
if [[ "$mode" != verify && "$mode" != serve ]]; then
  echo "Usage: $0 [verify|serve]" >&2
  exit 2
fi

export DATABASE_URL="${WECHAT_WIRE_DATABASE_URL:-}"
export WECHAT_WIRE_PORT="${WECHAT_WIRE_PORT:-58474}"
export PYTHON_DOTENV_DISABLED=1
if [[ ! "$DATABASE_URL" =~ ^postgresql\+asyncpg://[^/]+@127\.0\.0\.1:[0-9]+/[^/?#]+$ ]]; then
  echo "Set WECHAT_WIRE_DATABASE_URL to a dedicated loopback PostgreSQL database." >&2
  exit 2
fi
if [[ ! "$WECHAT_WIRE_PORT" =~ ^[0-9]{1,5}$ ]] || (( 10#$WECHAT_WIRE_PORT < 1024 || 10#$WECHAT_WIRE_PORT > 65535 )); then
  echo "WECHAT_WIRE_PORT must be between 1024 and 65535." >&2
  exit 2
fi

cd "$repo_dir/server"
export PYTHONPATH="$PWD"
poetry run alembic upgrade head

if [[ "$mode" == serve ]]; then
  export WECHAT_WIRE_DEVTOOLS=1
  exec poetry run python "$wire_dir/local.py"
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/impetus-wechat-wire.XXXXXX")"
echo "Local verification files and server log: $work_dir"
export WECHAT_WIRE_DEVTOOLS=0
export WECHAT_WIRE_ORIGIN="http://127.0.0.1:$WECHAT_WIRE_PORT"
(
  cd "$repo_dir/miniprogram"
  ./node_modules/.bin/tsc --target ES2018 --module commonjs --moduleResolution node \
    --lib ES2020 --strict --skipLibCheck --types miniprogram-api-typings \
    --rootDir lib --outDir "$work_dir/compiled" lib/api.ts
)

if curl --noproxy '*' --silent --max-time 1 "$WECHAT_WIRE_ORIGIN/health" >/dev/null; then
  echo "$WECHAT_WIRE_ORIGIN is already serving HTTP. Set WECHAT_WIRE_PORT to an unused port." >&2
  exit 1
fi
: >"$work_dir/server.log"
poetry run python "$wire_dir/local.py" >"$work_dir/server.log" 2>&1 &
backend_pid=$!
cleanup() {
  kill "$backend_pid" 2>/dev/null || true
  wait "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

ready_search=(rg -q)
if ! command -v rg >/dev/null; then
  ready_search=(grep -q)
fi
for attempt in {1..100}; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    cat "$work_dir/server.log" >&2
    exit 1
  fi
  if "${ready_search[@]}" 'Uvicorn running on' "$work_dir/server.log"; then
    node "$wire_dir/verify.cjs" "$work_dir/compiled/api.js"
    exit
  fi
  sleep 0.1
done
cat "$work_dir/server.log" >&2
echo "Local FastAPI server was not ready within 10 seconds." >&2
exit 1
