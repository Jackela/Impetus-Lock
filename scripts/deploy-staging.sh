#!/bin/bash
# Impetus Lock - Staging Deployment Script
# ==========================================
# Deploys the application to staging environment
# Usage: ./scripts/deploy-staging.sh [version]

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
VERSION="${1:-staging-$(git rev-parse --short HEAD)}"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.prod.yml"
ENV_FILE="${PROJECT_ROOT}/.env.staging"

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
    
    # Check if environment file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        warn "Environment file not found: $ENV_FILE"
        warn "Creating from template..."
        create_env_template
    fi
    
    log "Prerequisites check passed"
}

# Create environment file template
create_env_template() {
    cat > "$ENV_FILE" << 'EOF'
# Staging Environment Configuration
# ==================================

# Database
POSTGRES_DB=impetus_staging
POSTGRES_USER=impetus
POSTGRES_PASSWORD=change_me_in_staging
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=change_me_in_staging
REDIS_PORT=6379

# API Configuration
API_PORT=8000
API_WORKERS=2
LOG_LEVEL=INFO
SHUTDOWN_TIMEOUT=30

# Security
SECRET_KEY=change_me_in_staging_use_32_char_minimum
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Client
CLIENT_PORT=80
VITE_API_URL=/api

# LLM Configuration
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
DEFAULT_LLM_PROVIDER=anthropic

# CORS
CORS_ORIGINS=http://localhost,http://staging.impetus-lock.example.com

# Nginx (optional)
NGINX_HTTP_PORT=80
NGINX_HTTPS_PORT=443
EOF
    log "Created environment template: $ENV_FILE"
    warn "Please edit $ENV_FILE with your actual values before deploying"
}

# Build Docker images
build_images() {
    log "Building Docker images for staging..."
    
    export DOCKER_BUILDKIT=1
    export COMPOSE_DOCKER_CLI_BUILD=1
    
    for service in "${SERVICES[@]}"; do
        log "Building $service..."
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build \
            --build-arg BUILDKIT_INLINE_CACHE=1 \
            "$service"
    done
    
    log "Build completed successfully"
}

# Tag images for registry
tag_images() {
    log "Tagging images for registry..."
    
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${service}"
        local source_image="impetus-lock_${service}"  # docker-compose project prefix
        
        log "Tagging $service as ${image_name}:${VERSION}"
        docker tag "${source_image}:latest" "${image_name}:${VERSION}"
        docker tag "${source_image}:latest" "${image_name}:staging"
    done
    
    log "Images tagged successfully"
}

# Push images to registry
push_images() {
    log "Pushing images to registry..."
    
    # Check if logged in to registry
    if ! docker info | grep -q "Username"; then
        warn "Not logged in to Docker registry"
        info "Please run: docker login $DOCKER_REGISTRY"
        read -p "Press Enter to continue after logging in..."
    fi
    
    for service in "${SERVICES[@]}"; do
        local image_name="${DOCKER_REGISTRY}/${DOCKER_NAMESPACE}/${service}"
        
        log "Pushing ${image_name}:${VERSION}"
        docker push "${image_name}:${VERSION}"
        docker push "${image_name}:staging"
    done
    
    log "Images pushed successfully"
}

# Deploy to staging
deploy_staging() {
    log "Deploying to staging environment..."
    
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
    sleep 10
    
    # Run health checks
    run_health_checks
    
    log "Staging deployment completed successfully!"
}

# Run health checks
run_health_checks() {
    log "Running health checks..."
    
    local max_attempts=30
    local attempt=1
    local api_healthy=false
    local client_healthy=false
    
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
        
        # Check Client health
        if ! $client_healthy; then
            if curl -sf "http://localhost:${client_port}/health" > /dev/null 2>&1; then
                log "Client is healthy"
                client_healthy=true
            fi
        fi
        
        # Check if all services are healthy
        if $api_healthy && $client_healthy; then
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
    info "Environment: staging"
    info "API URL: http://localhost:$(grep "API_PORT" "$ENV_FILE" | cut -d '=' -f2 || echo "8000")"
    info "Client URL: http://localhost:$(grep "CLIENT_PORT" "$ENV_FILE" | cut -d '=' -f2 || echo "80")"
}

# Rollback deployment
rollback() {
    warn "Rolling back to previous version..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
    # TODO: Implement proper rollback with previous image tags
    log "Rollback completed"
}

# Cleanup old images
cleanup() {
    log "Cleaning up old images..."
    docker image prune -f --filter "until=168h"
    log "Cleanup completed"
}

# Main deployment flow
main() {
    log "Starting staging deployment..."
    log "Version: $VERSION"
    
    check_prerequisites
    build_images
    tag_images
    
    # Ask before pushing (optional for local staging)
    read -p "Push images to registry? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        push_images
    fi
    
    deploy_staging
    show_status
    
    log "Staging deployment complete!"
    info "Use 'docker-compose -f docker-compose.prod.yml logs -f' to view logs"
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
    --help|-h)
        echo "Usage: $0 [version|options]"
        echo ""
        echo "Options:"
        echo "  version         Deploy specific version (default: staging-<git-sha>)"
        echo "  --status        Show deployment status"
        echo "  --rollback      Rollback to previous deployment"
        echo "  --cleanup       Clean up old Docker images"
        echo "  --help, -h      Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                    # Deploy current commit as staging"
        echo "  $0 v1.2.3            # Deploy specific version"
        echo "  $0 --status          # Check deployment status"
        exit 0
        ;;
esac

# Run main deployment
main
