#!/usr/bin/env bash
# Rehearse deployment with an isolated registry and real production builds/database.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
: "${TEST_API_BASE_IMAGE:?build the production API image and set TEST_API_BASE_IMAGE}"
: "${TEST_CLIENT_BASE_IMAGE:?build the production client image and set TEST_CLIENT_BASE_IMAGE}"
temp=$(mktemp -d)
project="impetus-deploy-test-$(basename "$temp" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
registry_name="$project-registry"
occupied_name="$project-occupied"
export DEPLOY_DIR="$temp"
export DEPLOY_CHECK_ATTEMPTS=15
sha_a=1111111111111111111111111111111111111111
sha_b=2222222222222222222222222222222222222222
sha_c=3333333333333333333333333333333333333333
api_a=''
client_a=''
registry=''
compose_as() {
    local api="$1" client="$2"
    shift 2
    API_IMAGE="$api" CLIENT_IMAGE="$client" docker compose --project-directory "$temp" \
        -f "$temp/docker-compose.prod.yml" --env-file "$temp/.env.staging" "$@"
}
compose() { compose_as "$api_a" "$client_a" "$@"; }
cleanup() {
    local status=$?
    if [[ -n "$api_a" && -n "$client_a" && -f "$temp/docker-compose.prod.yml" ]]; then
        if [[ "$status" -ne 0 ]]; then
            compose logs --tail 50 api client postgres 1>&2 || true
        fi
        compose down --volumes --remove-orphans 1>&2 || true
    fi
    docker rm -f "$occupied_name" "$registry_name" >/dev/null 2>&1 || true
    if [[ -n "$registry" ]]; then
        for tag in api:a client:a api:b client:b api:migrate client:migrate client:unready; do
            docker image rm "$registry/$tag" >/dev/null 2>&1 || true
        done
    fi
    rm -r -- "$temp"
}
trap cleanup EXIT
compose_file="$temp/docker-compose.prod.yml"
cp "$root/deploy/docker-compose.prod.yml" "$compose_file"
client_port=$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')
url="http://localhost:$client_port"
cat > "$temp/.env.staging" <<EOF
DEPLOY_PROJECT=$project
POSTGRES_DB=fixture
POSTGRES_USER=fixture
POSTGRES_PASSWORD=only-for-isolated-fixture
DATABASE_URL=postgresql+asyncpg://fixture:only-for-isolated-fixture@postgres:5432/fixture
SECRET_KEY=only-for-isolated-fixture-csrf-secret
JWT_SECRET=only-for-isolated-fixture-cookie-secret
ENCRYPTION_KEY=e2NHYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTI=
CLIENT_PORT=$client_port
API_WORKERS=1
EOF
cp "$temp/.env.staging" "$temp/.env.production"
docker run -d --name "$registry_name" -p 127.0.0.1::5000 registry:3 >/dev/null
registry=$(docker port "$registry_name" 5000/tcp)

build_release_fixture() {
    local from="$1" tag="$2" revision="$3" instructions="${4:-}"
    docker build -t "$registry/$tag" -f - "$temp" >&2 <<EOF
FROM $from
LABEL org.opencontainers.image.revision=$revision
$instructions
EOF
    local output digest
    output=$(docker push "$registry/$tag")
    digest=$(awk '$2 == "digest:" && $4 == "size:" {print $3}' <<< "$output")
    [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || return 1
    printf '%s/%s@%s\n' "$registry" "${tag%:*}" "$digest"
}

api_a=$(build_release_fixture "$TEST_API_BASE_IMAGE" api:a "$sha_a")
client_a=$(build_release_fixture "$TEST_CLIENT_BASE_IMAGE" client:a "$sha_a")
api_b=$(build_release_fixture "$TEST_API_BASE_IMAGE" api:b "$sha_b")
client_b=$(build_release_fixture "$TEST_CLIENT_BASE_IMAGE" client:b "$sha_b")

# A distinct Alembic head proves that the migration check blocks an incompatible candidate.
head=$(docker run --rm --entrypoint alembic "$TEST_API_BASE_IMAGE" heads | awk '$2 == "(head)" {print $1}')
[[ "$head" =~ ^[[:alnum:]_]+$ ]]
cat > "$temp/test_migration.py" <<EOF
from alembic import op
import sqlalchemy as sa

revision = "test_deployment_new_head"
down_revision = "$head"

def upgrade():
    op.create_table("deployment_receipt_fixture", sa.Column("id", sa.Integer(), primary_key=True))

def downgrade():
    op.drop_table("deployment_receipt_fixture")
EOF
api_migration=$(build_release_fixture "$TEST_API_BASE_IMAGE" api:migrate "$sha_c" \
    "COPY test_migration.py /app/alembic/versions/test_migration.py")
unready_conf="$temp/unready.conf"
docker run --rm --entrypoint cat "$TEST_CLIENT_BASE_IMAGE" /etc/nginx/conf.d/default.conf |
    awk '/server_name localhost;/ {
        print
        print "    location = /api/health/db { default_type application/json; return 200 \"{\\\"is_healthy\\\":false}\"; }"
        next
    } { print }' > "$unready_conf"
client_unready=$(build_release_fixture "$TEST_CLIENT_BASE_IMAGE" client:unready "$sha_b" \
    "COPY unready.conf /etc/nginx/conf.d/default.conf")

stage() { bash "$root/scripts/deploy-staging.sh" "$@"; }
production() { bash "$root/scripts/deploy-production.sh" "$@"; }

# Exercise the production SSH command and temporary helper upload against the local test stack.
mkdir "$temp/ssh-fixture"
cat > "$temp/ssh-fixture/ssh" <<'EOF'
#!/usr/bin/env bash
set -eu
[[ "$1" == -- && "$2" == fixture@fixture.invalid && $# -eq 3 ]]
exec bash -c "$3"
EOF
cat > "$temp/ssh-fixture/scp" <<'EOF'
#!/usr/bin/env bash
set -eu
[[ "$1" == -- && "$2" == */deployment.py && "$3" == fixture@fixture.invalid:/tmp/impetus-deploy.*/ ]]
exec cp "$2" "${3#fixture@fixture.invalid:}"
EOF
chmod +x "$temp/ssh-fixture/ssh" "$temp/ssh-fixture/scp"
production_remote() {
    PATH="$temp/ssh-fixture:$PATH" PRODUCTION_USER=fixture PRODUCTION_HOST=fixture.invalid \
        PRODUCTION_DEPLOY_DIR="$temp" production "$@"
}
expect_failure() {
    local message="$1"
    shift
    if "$@" >"$temp/failure.log" 2>&1; then
        printf 'Unexpectedly succeeded: %s\n' "$*" >&2
        return 1
    fi
    if ! grep -F "$message" "$temp/failure.log"; then
        cat "$temp/failure.log" >&2
        return 1
    fi
}

# An untracked deployment must not replace stopped PostgreSQL or attach a new empty store.
compose up -d --no-deps postgres
for attempt in $(seq 1 15); do
    if compose exec -T postgres pg_isready -h 127.0.0.1 -U fixture -d fixture >/dev/null; then
        break
    fi
    [[ "$attempt" -lt 15 ]]
    sleep 1
done
compose exec -T postgres psql -U fixture -d fixture -v ON_ERROR_STOP=1 \
    -c "CREATE TABLE retained_draft (body text); INSERT INTO retained_draft VALUES ('kept')"
initial_pg=$(compose ps -q postgres)
initial_volume=$(docker inspect "$initial_pg" --format '{{ (index .Mounts 0).Name }}')
compose stop postgres
cp "$compose_file" "$temp/compose.good"
python3 - "$compose_file" <<'PY_FIXTURE'
from pathlib import Path
import sys
path = Path(sys.argv[1])
path.write_text(path.read_text().replace("postgres-data", "other-fixture-data"))
PY_FIXTURE
API_IMAGE="$api_a" CLIENT_IMAGE="$client_a" RELEASE_SHA="$sha_a" \
    expect_failure "Existing postgres container is stopped" stage --deploy-only --initialize
[[ "$(compose ps --all -q postgres)" == "$initial_pg" ]]
[[ "$(docker inspect "$initial_pg" --format '{{ .State.Running }}')" == false ]]
[[ "$(docker inspect "$initial_pg" --format '{{ (index .Mounts 0).Name }}')" == "$initial_volume" ]]
cp "$temp/compose.good" "$compose_file"
compose start postgres
for attempt in $(seq 1 15); do
    if compose exec -T postgres pg_isready -h 127.0.0.1 -U fixture -d fixture >/dev/null; then
        break
    fi
    [[ "$attempt" -lt 15 ]]
    sleep 1
done
[[ "$(compose exec -T postgres psql -U fixture -d fixture -At -c 'SELECT body FROM retained_draft')" == kept ]]
compose rm -f -s postgres
API_IMAGE="$api_a" CLIENT_IMAGE="$client_a" RELEASE_SHA="$sha_a" \
    expect_failure "Existing Compose project data resources" stage --deploy-only --initialize
docker volume inspect "$initial_volume" >/dev/null
[[ -z "$(compose ps --all -q postgres)" ]]
compose down --volumes

API_IMAGE="$api_a" CLIENT_IMAGE="$client_a" RELEASE_SHA="$sha_a" stage --deploy-only --initialize
ids_before=$(compose ps -q api client)
postgres_before=$(compose ps -q postgres)
stage --status
expect_failure "No previous verified release is recorded" stage --rollback
[[ "$(compose ps -q api client)" == "$ids_before" ]]

# Write a real task through the production proxy with the server-issued cookies and CSRF token.
json_field() {
    python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"
}
cookie_jar="$temp/cookies"
account=$(curl -fsS -c "$cookie_jar" -H 'Content-Type: application/json' \
    --data '{"email":"deploy-check@example.com","password":"IsolatedFixturePassword42"}' \
    "$url/api/auth/register" | python3 -c 'import json,sys; print(json.load(sys.stdin)["user"]["id"])')
csrf=$(awk '$6 == "csrf_token" { print $7 }' "$cookie_jar")
[[ -n "$account" && -n "$csrf" ]]
draft='First line in the isolated rehearsal'
lock='lock-deploy-fixture'
task_json=$(printf '{"content":"%s","lock_ids":["%s"]}' "$draft" "$lock")
task_id=$(curl -fsS -b "$cookie_jar" -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $csrf" -H "X-Expected-User-ID: $account" --data "$task_json" \
    "$url/api/tasks/" | json_field id)

check_task() {
    curl -fsS -b "$cookie_jar" -H "X-Expected-User-ID: $account" "$url/api/tasks/$task_id" |
        python3 -c 'import json,sys; task=json.load(sys.stdin); assert task["content"]==sys.argv[1] and task["lock_ids"]==[sys.argv[2]], task' "$1" "$lock"
}
check_task "$draft"

# Even a healthy listener on a new port belongs to another container.
docker run -d --name "$occupied_name" -p 127.0.0.1::8000 --entrypoint python \
    "$TEST_API_BASE_IMAGE" -c '
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        payload = {
            "/health": b"healthy",
            "/api/health": b"""{"status":"ok"}""",
            "/api/health/db": b"""{"is_healthy":true}""",
        }.get(self.path)
        self.send_response(200 if payload else 404)
        self.end_headers()
        self.wfile.write(payload or b"")

HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
' >/dev/null
occupied_url="http://$(docker port "$occupied_name" 8000)"
for attempt in $(seq 1 15); do
    if python3 "$root/scripts/deployment.py" staging check-ready --url "$occupied_url"; then
        break
    fi
    [[ "$attempt" -lt 15 ]]
    sleep 1
done
cp "$temp/.env.staging" "$temp/env.good"
printf '\nCLIENT_PORT=%s\n' "${occupied_url##*:}" >> "$temp/.env.staging"
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" \
    expect_failure "Running client configuration differs" stage --deploy-only
cp "$temp/env.good" "$temp/.env.staging"
[[ "$(compose ps -q api client)" == "$ids_before" ]]
check_task "$draft"
python3 "$root/scripts/deployment.py" staging check-ready --url "$occupied_url"

printf '\nJWT_SECRET=isolated-fixture-drift-jwt-value\n' >> "$temp/.env.staging"
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" \
    expect_failure "Running api configuration differs" stage --deploy-only
cp "$temp/env.good" "$temp/.env.staging"
cat >> "$temp/.env.staging" <<'EOF'
POSTGRES_DB=wrong_fixture
DATABASE_URL=postgresql+asyncpg://fixture:only-for-isolated-fixture@postgres:5432/wrong_fixture
EOF
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" \
    expect_failure "Running api configuration differs" stage --deploy-only
cp "$temp/env.good" "$temp/.env.staging"
cp "$compose_file" "$temp/compose.good"
python3 - "$compose_file" <<'PY_FIXTURE'
from pathlib import Path
import sys
path = Path(sys.argv[1])
path.write_text(path.read_text().replace("postgres-data", "other-fixture-data"))
PY_FIXTURE
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" \
    expect_failure "Running postgres configuration differs" stage --deploy-only
cp "$temp/compose.good" "$compose_file"
[[ "$(compose ps -q api client)" == "$ids_before" ]]
[[ "$(compose ps -q postgres)" == "$postgres_before" ]]
check_task "$draft"

# A Compose manifest that discards the supplied digest must fail before touching containers.
cp "$compose_file" "$temp/compose.good"
python3 - "$compose_file" "$api_a" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
path.write_text(path.read_text().replace('${API_IMAGE:?supply the immutable API_IMAGE digest}', sys.argv[2]))
PY
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" expect_failure "must resolve to its supplied digest" stage --deploy-only
cp "$temp/compose.good" "$compose_file"
[[ "$(compose ps -q api client)" == "$ids_before" ]]
API_IMAGE="${api_b%@*}@sha256:0000000000000000000000000000000000000000000000000000000000000000" \
    CLIENT_IMAGE="$client_b" expect_failure "returned non-zero exit status 1" stage --deploy-only
[[ "$(compose ps -q api client)" == "$ids_before" ]]
API_IMAGE="$api_migration" CLIENT_IMAGE="$client_b" \
    expect_failure "Built API/client revisions belong to different Git commits" stage --deploy-only
API_IMAGE="$api_migration" CLIENT_IMAGE="$client_b" RELEASE_SHA="$sha_b" \
    expect_failure "Built API/client revisions do not match" stage --deploy-only
# Pair the new API revision with a corresponding client digest.
client_migration=$(build_release_fixture "$TEST_CLIENT_BASE_IMAGE" client:migrate "$sha_c")
API_IMAGE="$api_migration" CLIENT_IMAGE="$client_migration" RELEASE_SHA="$sha_c" \
    expect_failure "Candidate requires a different database schema" stage --deploy-only
[[ "$(compose ps -q api client)" == "$ids_before" ]]

backup_count_before=$(find "$temp/backups" -name '*.dump' | wc -l)
compose exec -T -u root postgres sh -s <<'SH_PG'
set -eu
pg_dump_path=$(command -v pg_dump)
mv "$pg_dump_path" "$pg_dump_path.test-real"
printf '#!/bin/sh\nexit 7\n' > "$pg_dump_path"
chmod +x "$pg_dump_path"
SH_PG
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" RELEASE_SHA="$sha_b" \
    expect_failure "returned non-zero exit status 7" production --deploy-only
compose exec -T -u root postgres sh -s <<'SH_PG'
printf '#!/bin/sh\nexit 0\n' > "$(command -v pg_dump)"
SH_PG
API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" RELEASE_SHA="$sha_b" \
    expect_failure "Database backup is empty" production_remote --deploy-only
compose exec -T -u root postgres sh -s <<'SH_PG'
path=$(command -v pg_dump)
mv "$path.test-real" "$path"
SH_PG
[[ "$(find "$temp/backups" -name '*.dump' | wc -l)" == "$backup_count_before" ]]
[[ "$(compose ps -q api client)" == "$ids_before" ]]

API_IMAGE="$api_b" CLIENT_IMAGE="$client_b" RELEASE_SHA="$sha_b" stage --deploy-only
check_task "$draft"
state_before=$(cat "$temp/.deployment-staging.json")
API_IMAGE="$api_b" CLIENT_IMAGE="$client_unready" RELEASE_SHA="$sha_b" \
    expect_failure "Previous release restored and verified" stage --deploy-only
grep -F "Database readiness check failed" "$temp/failure.log"
stage --status
[[ "$(cat "$temp/.deployment-staging.json")" == "$state_before" ]]
check_task "$draft"
stage --rollback
check_task "$draft"
[[ "$(docker inspect "$(compose ps -q api)" -f '{{.Config.Image}}')" == "$api_a" ]]
[[ "$(docker inspect "$(compose ps -q client)" -f '{{.Config.Image}}')" == "$client_a" ]]
[[ "$(compose ps -q postgres)" == "$postgres_before" ]]
API_IMAGE="$api_a" CLIENT_IMAGE="$client_a" RELEASE_SHA="$sha_a" production_remote --deploy-only
production_remote --status

# Exercise a write after rollback and verify the dump restores the prior body and lock.
new_draft='Still writable after rollback'
version=$(curl -fsS -b "$cookie_jar" -H "X-Expected-User-ID: $account" "$url/api/tasks/$task_id" | json_field version)
update_json=$(printf '{"content":"%s","lock_ids":["%s"],"version":%s}' "$new_draft" "$lock" "$version")
curl -fsS -X PUT -b "$cookie_jar" -H 'Content-Type: application/json' \
    -H "X-CSRF-Token: $csrf" -H "X-Expected-User-ID: $account" --data "$update_json" \
    "$url/api/tasks/$task_id" >/dev/null
check_task "$new_draft"

backup=$(find "$temp/backups" -name '*.dump' -type f -print | sort | tail -1)
test -s "$backup"
compose exec -T postgres createdb -U fixture recovery
compose exec -T postgres pg_restore -U fixture -d recovery --exit-on-error < "$backup"
restored=$(compose exec -T postgres psql -U fixture -d recovery -At -v ON_ERROR_STOP=1 \
    -c "SELECT content || '|' || (lock_ids->>0) FROM tasks WHERE id='$task_id'")
[[ "$restored" == "$draft|$lock" ]]

compose stop postgres
[[ "$(curl -fsS "$url/api/health" | json_field status)" == ok ]]
expect_failure "Deployment failed" python3 "$root/scripts/deployment.py" staging check-ready --url "$url"
compose start postgres
wait_ready() {
    for attempt in $(seq 1 15); do
        if python3 "$root/scripts/deployment.py" staging check-ready --url "$url"; then
            return
        fi
        [[ "$attempt" -lt 15 ]]
        sleep 2
    done
}
wait_ready

# A separately controlled schema migration can be reversed by the candidate image.
compose stop client api
compose_as "$api_migration" "$client_migration" run --rm --no-deps --pull never -T \
    --entrypoint alembic api upgrade head
[[ "$(compose exec -T postgres psql -U fixture -d fixture -At -c 'SELECT version_num FROM alembic_version')" == test_deployment_new_head ]]
compose_as "$api_migration" "$client_migration" run --rm --no-deps --pull never -T \
    --entrypoint alembic api downgrade "$head"
compose up -d --no-deps --no-build --pull never --force-recreate api client
wait_ready
stage --status
check_task "$new_draft"

# Once a schema upgrade has been accepted, adopt it as the new current release.
compose stop client api
compose_as "$api_migration" "$client_migration" run --rm --no-deps --pull never -T \
    --entrypoint alembic api upgrade head
compose_as "$api_migration" "$client_migration" up -d --no-deps --no-build --pull never \
    --force-recreate api client
wait_ready
mv "$temp/.deployment-staging.json" "$temp/prior-release.json"
API_IMAGE="$api_migration" CLIENT_IMAGE="$client_migration" RELEASE_SHA="$sha_c" stage --deploy-only
check_task "$new_draft"
expect_failure "No previous verified release is recorded" stage --rollback
printf 'Deployment rehearsal passed: digest selection, preflight, database readiness, failed cutover recovery, rollback, draft/lock backup restore, and manual migration recovery.\n'
