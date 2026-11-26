#!/usr/bin/env bash
# Run the production images with a disposable database and real browser.
set -euo pipefail

: "${TEST_API_BASE_IMAGE:?Set TEST_API_BASE_IMAGE to the production backend image}"
: "${TEST_CLIENT_BASE_IMAGE:?Set TEST_CLIENT_BASE_IMAGE to the production client image}"
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
name="impetus-smoke-$$"
database="$name-postgres"
api="$name-api"
client="$name-client"

cleanup() {
    local result=$?
    if (( result != 0 )); then
        for container in "$database" "$api" "$client"; do
            docker logs "$container" 2>&1 || true
        done
    fi
    docker rm -fv "$client" "$api" "$database" >/dev/null 2>&1 || true
    docker network rm "$name" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$name" >/dev/null
docker run -d --name "$database" --network "$name" --network-alias postgres \
    -e POSTGRES_PASSWORD=smoke-fixture-password -e POSTGRES_DB=smoke postgres:16-alpine >/dev/null
for ((attempt = 0; attempt < 60; attempt++)); do
    if docker exec "$database" pg_isready -h 127.0.0.1 -U postgres -d smoke >/dev/null 2>&1; then
        break
    fi
    sleep 1
done
docker exec "$database" pg_isready -h 127.0.0.1 -U postgres -d smoke

docker run -d --name "$api" --network "$name" --network-alias backend \
    -p 127.0.0.1::8000 \
    -e DATABASE_URL=postgresql+asyncpg://postgres:smoke-fixture-password@postgres:5432/smoke \
    -e JWT_SECRET=synthetic-production-smoke-secret-ephemeral \
    -e API_WORKERS=1 -e CORS_ORIGINS=https://writer.example \
    "$TEST_API_BASE_IMAGE" >/dev/null
docker run -d --name "$client" --network "$name" -p 127.0.0.1::80 \
    "$TEST_CLIENT_BASE_IMAGE" >/dev/null

api_address=$(docker port "$api" 8000/tcp)
client_address=$(docker port "$client" 80/tcp)
export PRODUCTION_SMOKE_URL="http://localhost:${client_address##*:}"
export PRODUCTION_SMOKE_API_URL="http://localhost:${api_address##*:}"

ready() {
    curl -fsS --max-time 3 "$PRODUCTION_SMOKE_URL/api/health/db" | jq -e '.is_healthy == true'
}
for ((attempt = 0; attempt < 60; attempt++)); do
    if ready >/dev/null 2>&1; then
        break
    fi
    if [[ $(docker inspect --format '{{.State.Running}}' "$api") != true ||
          $(docker inspect --format '{{.State.Running}}' "$client") != true ]]; then
        echo "A production container exited before becoming ready" >&2
        exit 1
    fi
    sleep 1
done
ready

cd "$root/client"
npx --no-install playwright test -c playwright.production.config.ts
