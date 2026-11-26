#!/usr/bin/env bash
# Shared command-line entry for staging and production.
set -euo pipefail

fail() {
    printf '%s\n' "$*" >&2
    exit 1
}

deploy_remote() {
    local command="$1" initialize="$2" destination remote_dir remote_command result=0
    [[ -n "${PRODUCTION_USER:-}" ]] || fail "PRODUCTION_USER is required with PRODUCTION_HOST"
    destination="$PRODUCTION_USER@$PRODUCTION_HOST"
    remote_dir=$(ssh -- "$destination" 'mktemp -d /tmp/impetus-deploy.XXXXXXXX')
    [[ "$remote_dir" =~ ^/tmp/impetus-deploy\.[[:alnum:]]+$ ]] || fail "Invalid remote temporary directory"
    printf -v remote_command 'DEPLOY_DIR=%q API_IMAGE=%q CLIENT_IMAGE=%q RELEASE_SHA=%q python3 %q production %q %s' \
        "${PRODUCTION_DEPLOY_DIR:-/opt/impetus-lock}" "${API_IMAGE:-}" "${CLIENT_IMAGE:-}" \
        "${RELEASE_SHA:-}" "$remote_dir/deployment.py" "$command" "$initialize"
    if scp -- "$SCRIPT_DIR/deployment.py" "$destination:$remote_dir/"; then
        ssh -- "$destination" "$remote_command" || result=$?
    else
        result=$?
    fi
    ssh -- "$destination" "rm -r -- '$remote_dir'" || true
    return "$result"
}

deploy_on_host() {
    if [[ "$ENVIRONMENT" == production && -n "${PRODUCTION_HOST:-}" ]]; then
        deploy_remote "$1" "${2:-}"
    else
        local args=("$1")
        if [[ -n "${2:-}" ]]; then
            args+=("$2")
        fi
        DEPLOY_DIR="$PROJECT_ROOT" python3 "$SCRIPT_DIR/deployment.py" "$ENVIRONMENT" "${args[@]}"
    fi
}

build_release() {
    local version="$1" publish="$2" source_sha source_dir registry namespace api client
    source_sha=$(git -C "$SOURCE_ROOT" rev-parse --verify HEAD)
    version=${version:-sha-$source_sha}
    [[ "$version" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || fail "Invalid image tag"
    registry=${DOCKER_REGISTRY:-ghcr.io}
    namespace=${DOCKER_NAMESPACE:-jackela}
    api="$registry/$namespace/impetus-api:$version"
    client="$registry/$namespace/impetus-client:$version"

    if [[ "$ENVIRONMENT" == production && "$publish" == true ]]; then
        git -C "$SOURCE_ROOT" diff --quiet "$source_sha" -- ||
            fail "Production source has uncommitted changes"
        (cd "$SOURCE_ROOT/server" && poetry run pytest -xvs tests/ --tb=short)
        (cd "$SOURCE_ROOT/client" && npm run test -- --run)
        git -C "$SOURCE_ROOT" diff --quiet "$source_sha" -- ||
            fail "Production source changed during pre-deployment tests"
    fi

    source_dir=$(mktemp -d)
    # The build contexts come from the commit we just identified, including on a moving branch.
    trap 'rm -r -- "$source_dir"' EXIT
    git -C "$SOURCE_ROOT" archive "$source_sha" server client | tar -x -C "$source_dir"
    docker build --label "org.opencontainers.image.revision=$source_sha" -t "$api" \
        -f "$source_dir/server/Dockerfile.prod" "$source_dir/server"
    docker build --label "org.opencontainers.image.revision=$source_sha" \
        --build-arg "VITE_API_URL=${VITE_API_URL:-/api}" -t "$client" \
        -f "$source_dir/client/Dockerfile.prod" "$source_dir/client"
    rm -r -- "$source_dir"
    trap - EXIT
    if [[ "$publish" == true ]]; then
        export RELEASE_SHA=$source_sha
        API_IMAGE=$(push_digest "$api")
        CLIENT_IMAGE=$(push_digest "$client")
        export API_IMAGE CLIENT_IMAGE
        deploy_on_host deploy
    else
        printf 'Images built locally: %s %s\n' "$api" "$client"
    fi
}

push_digest() {
    local tag="$1" output digest
    output=$(docker push "$tag")
    printf '%s\n' "$output" >&2
    digest=$(printf '%s\n' "$output" | awk '
        $2 == "digest:" && $4 == "size:" && $3 ~ /^sha256:[0-9a-f]+$/ { print $3 }
    ')
    [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || fail "Could not determine pushed digest for $tag"
    printf '%s@%s\n' "${tag%:*}" "$digest"
}

deployment_entry() {
    ENVIRONMENT="$1"
    shift
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    PROJECT_ROOT="${DEPLOY_DIR:-$SOURCE_ROOT}"

    case "${1:-}" in
        --deploy-only)
            [[ $# -eq 1 || ( $# -eq 2 && "$2" == --initialize ) ]] ||
                fail "Usage: --deploy-only [--initialize]"
            deploy_on_host deploy "${2:-}"
            ;;
        --rollback|--status)
            [[ $# -eq 1 ]] || fail "Unexpected extra arguments"
            deploy_on_host "${1#--}"
            ;;
        --build-only)
            [[ $# -le 2 ]] || fail "Usage: --build-only [version]"
            build_release "${2:-}" false
            ;;
        --help|-h)
            cat <<EOF
Usage: deploy-$ENVIRONMENT.sh [version]
       deploy-$ENVIRONMENT.sh --deploy-only [--initialize]
       deploy-$ENVIRONMENT.sh --rollback | --status | --build-only [version]

A version tags the current Git commit. The build-and-deploy path pushes images
and deploys their digests. --deploy-only uses API_IMAGE and CLIENT_IMAGE digest
references. Set DEPLOY_DIR to the directory containing docker-compose.prod.yml
and .env.$ENVIRONMENT. Read docs/guides/deployment.md before the first deployment.
EOF
            ;;
        -*)
            fail "Unknown option $1"
            ;;
        *)
            [[ $# -le 1 ]] || fail "Unexpected extra arguments"
            if [[ "$ENVIRONMENT" == production ]]; then
                read -r -p "Deploy to production? Type yes to continue: " reply
                [[ "$reply" == yes ]] || fail "Production deployment cancelled"
            fi
            build_release "${1:-}" true
            ;;
    esac
}
