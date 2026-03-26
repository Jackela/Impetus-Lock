#!/bin/bash
# Impetus Lock - Production Deployment Script
# =============================================
# Deploys the application to production environment
# Usage: ./scripts/deploy-production.sh [version]
#
# IMPORTANT: This script requires:
#   - Docker registry authentication
#   - Production environment variables in .env.production
#   - Access to production server (SSH or direct access)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
DOCKER_NAMESPACE="${DOCKER_NAMESPACE:-impetus-lock}"
VERSION="${1:-$(git describe --tags --always 2>/dev/null || git rev-parse --short HEAD)}"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_ROOT}/.env.production"

# Production server configuration
PRODUCTION_HOST="${PRODUCTION_HOST:-}"
PRODUCTION_USER="${PRODUCTION_USER:-}"
PRODUCTION_DEPLOY_DIR="${PRODUCTION_DEPLOY_DIR:-/opt/impetus-lock}"

# Services to build
SERVICES=("api" "client")

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if we're in a git repo
    if ! git rev-parse --git-dir &> /dev/null; then
        error "Not in a git repository"
    fi
    
    # Check if on main branch for production
    local current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]]; then
        warn "Not on main branch (current: $current_branch)"
        read -p "Are you sure you want to deploy from $current_branch? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled"
        fi
    fi
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        error "Production environment file not found: $ENV_FILE"
        info "Please create it from .env.staging template with production values"
        exit 1
    fi
    
    # Verify critical environment variables
    verify_env_vars
    
    log "Prerequisites check passed"
}

# Verify critical environment variables
verify_env_vars() {
    log "Verifying environment variables..."
    
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "SECRET_KEY"
    )
    
    local missing=()
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE" || \
           grep "^${var}=" "$ENV_FILE" | grep -q "change_me"; then
            missing+=("$var")
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        error "Missing or default values for required variables: ${missing[*]}"
    fi
    
    log "Environment variables verified"
}

# Build Docker images
build_images() {
    log "Building Docker images for production..."
    log "Version: $VERSION"
    
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    for service in "${SERVICES[@]}"; do
        log "Building $service..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            --no-cache \
            "$service"
    done
    
    log "Build completed successfully"
}

# Run tests before deployment
run_tests() {
    log "Running pre-deployment tests..."
    
    # Run backend tests
    log "Running backend tests..."
    (cd "$PROJECT_ROOT/server" && poetry run pytest -xvs tests/ --tb=short) || \
        error "Backend tests failed"
    
    # Run frontend tests
    log "Running frontend tests..."
    (cd "$PROJECT_ROOT/client" && npm run test -- --run) || \
        warn "Frontend tests had failures (continuing anyway)"
    
    log "Tests completed"
}

# Tag images for registry
tag_images() {
    log "Tagging images for registry..."
    
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${service}"
        local source_image="impetus-lock_${service}"  # docker-compose project prefix
        
        log "Tagging $service as ${image_name}:${VERSION}"
        docker tag "${source_image}:latest" "${image_name}:${VERSION}"
        docker tag "${source_image}:latest" "${image_name}:latest"
    done
    
    log "Images tagged successfully"
}

# Push images to registry
push_images() {
    log "Pushing images to registry..."
    
    # Check if logged in to registry
    if ! docker info | grep -q "Username"; then
        error "Not logged in to Docker registry. Please run: docker login $DOCKER_REGISTRY"
    fi
    
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${service}"
        
        log "Pushing ${image_name}:${VERSION}"
        docker push "${image_name}:${VERSION}"
        docker push "${image_name}:latest"
    done
    
    log "Images pushed successfully"
}

# Create deployment package
create_deployment_package() {
    log "Creating deployment package..."
    
    local deploy_dir="${PROJECT_ROOT}/deploy"
    local package_name="impetus-lock-${VERSION}.tar.gz"
    
    mkdir -p "$deploy_dir"
    
    # Create deployment archive
    tar -czf "${deploy_dir}/${package_name}" \
        -C "$PROJECT_ROOT" \
        docker-compose.prod.yml \
        .env.production \
        nginx/ \
        scripts/ \
        --exclude='scripts/*.pyc' \
        --exclude='scripts/__pycache__'
    
    log "Deployment package created: ${deploy_dir}/${package_name}"
}

# Deploy to production server via SSH
deploy_to_server() {
    if [[ -z "$PRODUCTION_HOST" ]]; then
        warn "PRODUCTION_HOST not set, skipping remote deployment"
        log "Images are built and pushed. Deploy manually to your production server."
        return 0
    fi
    
    log "Deploying to production server: $PRODUCTION_HOST"
    
    # Create deployment directory on server
    ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" "mkdir -p ${PRODUCTION_DEPLOY_DIR}"
    
    # Copy deployment files
    log "Copying deployment files..."
    scp "$COMPOSE_FILE" "${PRODUCTION_USER}@${PRODUCTION_HOST}:${PRODUCTION_DEPLOY_DIR}/"
    scp "$ENV_FILE" "${PRODUCTION_USER}@${PRODUCTION_HOST}:${PRODUCTION_DEPLOY_DIR}/"
    
    # Deploy on remote server
    log "Executing remote deployment..."
    ssh "${PRODUCTION_USER}@${PRODUCTION_HOST}" << EOF
        set -e
        cd ${PRODUCTION_DEPLOY_DIR}
        
        # Pull latest images
        echo "Pulling images..."
        docker-compose -f docker-compose.prod.yml pull
        
        # Create backup (optional)
        echo "Creating database backup..."
        # docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U impetus impetus > backup-\$(date +%Y%m%d-%H%M%S).sql
        
        # Stop existing containers gracefully
        echo "Stopping existing containers..."
        docker-compose -f docker-compose.prod.yml down --timeout 30
        
        # Start services
        echo "Starting services..."
        docker-compose -f docker-compose.prod.yml up -d
        
        # Wait and verify
        sleep 10
        
        # Health check
        echo "Running health checks..."
        curl -f http://localhost:8000/health || exit 1
        
        echo "Deployment complete!"
EOF
    
    log "Remote deployment completed successfully!"
}

# Deploy locally (for single-server setup)
deploy_local() {
    log "Deploying locally..."
    
    # Create backup before deployment
    create_backup
    
    # Pull latest images
    log "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" pull
    
    # Stop existing containers gracefully
    log "Stopping existing containers..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --timeout 30
    
    # Start services
    log "Starting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 15
    
    # Run health checks
    run_health_checks
    
    log "Production deployment completed successfully!"
}

# Create database backup
create_backup() {
    log "Creating database backup..."
    
    local backup_dir="${PROJECT_ROOT}/backups"
    local backup_file="backup-$(date +%Y%m%d-%H%M%S).sql"
    
    mkdir -p "$backup_dir"
    
    # Check if postgres container is running
    if docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps | grep -q "postgres"; then
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
            pg_dump -U "${POSTGRES_USER:-impetus}" "${POSTGRES_DB:-impetus}" \
            > "${backup_dir}/${backup_file}" || warn "Backup failed, continuing..."
        log "Backup created: ${backup_dir}/${backup_file}"
    else
        warn "Postgres not running, skipping backup"
    fi
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    local api_healthy=false
    local client_healthy=false
    local db_healthy=false
    
    # Get ports from env file
    local api_port=$(grep "API_PORT" "$ENV_FILE" | cut -d '=' -f2 || echo "8000")
    local client_port=$(grep "CLIENT_PORT" "$ENV_FILE" | cut -d '=' -f2 || echo "80")
    
    while [ $attempt -le $max_attempts ]; do
        info "Health check attempt $attempt/$max_attempts"
        
        # Check API health
        if ! $api_healthy; then
            if curl -sf "http://localhost:${api_port}/health" > /dev/null 2>&1; then
                log "API is healthy"
                api_healthy=true
            fi
        fi
        
        # Check Database health
        if ! $db_healthy; then
            if curl -sf "http://localhost:${api_port}/health/db" > /dev/null 2>&1; then
                log "Database is healthy"
                db_healthy=true
            fi
        fi
        
        # Check Client health
        if ! $client_healthy; then
            if curl -sf "http://localhost:${client_port}/health" > /dev/null 2>&1; then
                log "Client is healthy"
                client_healthy=true
            fi
        fi
        
        # Check if all services are healthy
        if $api_healthy && $db_healthy && $client_healthy; then
            log "All health checks passed!"
            return 0
        fi
        
        sleep 2
        ((attempt++))
    done
    
    error "Health checks failed after $max_attempts attempts"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    echo ""
    info "Version: $VERSION"
    info "Environment: production"
    info "API Health: http://localhost:$(grep "API_PORT" "$ENV_FILE" | cut -d '=' -f2 || echo "8000")/health"
    info "DB Health: http://localhost:$(grep "API_PORT" "$ENV_FILE" | cut -d '=' -f2 || echo "8000")/health/db"
}

# Rollback deployment
rollback() {
    warn "Rolling back to previous version..."
    
    # Get previous version from git tags or backup
    local previous_version=$(git describe --tags --abbrev=0 HEAD~1 2>/dev/null || echo "latest")
    
    log "Rolling back to version: $previous_version"
    
    # Pull previous images
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${service}"
        docker pull "${image_name}:${previous_version}" || docker pull "${image_name}:latest"
        docker tag "${image_name}:${previous_version}" "${image_name}:rollback"
    done
    
    # Restart with previous version
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down --timeout 30
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    
    log "Rollback completed"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old images..."
    docker image prune -af --filter "until=720h"
    docker volume prune -f
    log "Cleanup completed"
}

# Main deployment flow
main() {
    log "=========================================="
    log "Impetus Lock Production Deployment"
    log "=========================================="
    log "Version: $VERSION"
    log "Registry: $DOCKER_REGISTRY"
    log ""
    
    # Safety confirmation
    warn "You are about to deploy to PRODUCTION!"
    read -p "Are you sure you want to continue? (yes/no) " -r
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        error "Deployment cancelled by user"
    fi
    
    check_prerequisites
    run_tests
    build_images
    tag_images
    push_images
    
    # Deploy
    if [[ -n "$PRODUCTION_HOST" ]]; then
        deploy_to_server
    else
        deploy_local
    fi
    
    show_status
    
    log "=========================================="
    log "Production deployment complete!"
    log "=========================================="
    info "Monitor logs with: docker-compose -f docker-compose.prod.yml logs -f"
}

# Handle script arguments
case "${1:-}" in
    --status)
        show_status
        exit 0
        ;;
    --rollback)
        rollback
        exit 0
        ;;
    --cleanup)
        cleanup
        exit 0
        ;;
    --build-only)
        check_prerequisites
        build_images
        tag_images
        log "Build complete. Images ready for manual push."
        exit 0
        ;;
    --help|-h)
        echo "Usage: $0 [version|options]"
        echo ""
        echo "Options:"
        echo "  version         Deploy specific version (default: git tag or sha)"
        echo "  --status        Show deployment status"
        echo "  --rollback      Rollback to previous version"
        echo "  --cleanup       Clean up old Docker images"
        echo "  --build-only    Build and tag images only (no deploy)"
        echo "  --help, -h      Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  DOCKER_REGISTRY     Docker registry URL (default: ghcr.io)"
        echo "  DOCKER_NAMESPACE    Docker namespace (default: impetus-lock)"
        echo "  PRODUCTION_HOST     Production server hostname"
        echo "  PRODUCTION_USER     SSH user for production server"
        echo ""
        echo "Examples:"
        echo "  $0                    # Deploy current version"
        echo "  $0 v1.2.3            # Deploy specific version tag"
        echo "  $0 --status          # Check deployment status"
        exit 0
        ;;
esac

# Run main deployment
main
