# Deployment Guide

A managed release consists of an API image digest, a client image digest, and the PostgreSQL revision both releases can use. The staging and production entry points share [the deployment implementation](../../scripts/deployment.py). The [Compose example](../../deploy/docker-compose.prod.yml) provides the server contract. The [staging workflow](../../.github/workflows/deploy-staging.yml) records the source commit and both built image digests.

## Server setup

Use Bash, Python 3.9 or later, Docker Engine and Docker Compose v2 on the host. The deployment account needs Docker access, pull access to both registry packages, and write access to its deployment directory. Keep a separate directory and Compose project name for each environment. Copy the Compose example and [environment template](../../deploy/deployment.env.example) there.

```text
/opt/impetus-lock/
├── docker-compose.prod.yml
└── .env.staging
```

Use `.env.production` for production. Set permissions to `0600` on the environment file. Configure independent secrets for each environment. Set `DATABASE_URL` using `postgresql+asyncpg://` and the same user, password and database configured for the `postgres` service. URL-encode the password in the DSN as needed. Set `SECRET_KEY`, `JWT_SECRET` and `ENCRYPTION_KEY`. The encryption key must be a Fernet key. Leave `TESTING` unset. Optional WeChat configuration lives in the API service environment. See the [development guide](../../DEVELOPMENT.md) for the variable names and service requirements.

| Component  | Server contract                                                                                                                                                                                                                        |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api`      | One replica from `${API_IMAGE}`, with a network alias of `backend` for the client's Nginx. The image contains the Alembic CLI and uses port 8000 inside Compose.                                                                       |
| `client`   | One replica from `${CLIENT_IMAGE}` on the same network. Publish its port 80 on one fixed IPv4 host port.                                                                                                                               |
| `postgres` | One PostgreSQL 16 service, with persistent storage at `/var/lib/postgresql/data`. Its `POSTGRES_DB` and `POSTGRES_USER` are the source for the verified dump. The script checks that the API refers to this database before switching. |
| `redis`    | The sample includes Redis on the private Compose network for rate limiting. Initial setup starts it alongside PostgreSQL. A previously configured Redis service must be running for later releases.                                    |

The default client API base is `/api`. The client proxies Web calls to FastAPI after stripping that prefix and preserves the full `/api/wechat/` prefix for WeChat. Expose the client through the host TLS reverse proxy at the HTTPS origin used by browsers and WeChat. Production browser cookies are secure. Use `CORS_ORIGINS` with explicit origins only when building the client against a separate API origin. Move any legacy `ALLOWED_ORIGINS` setting to that Compose variable when adopting the example. Keep the credentialed Web editor behind the same browser origin so it can read its CSRF cookie. The reverse proxy must allow the public health routes if you enable the GitHub origin check.

## Apply a release

Run from a checkout containing the deployment scripts. Use the full image references reported by the image build or workflow summary.

```bash
export DEPLOY_DIR=/opt/impetus-lock
export API_IMAGE='ghcr.io/jackela/impetus-api@sha256:<api-digest>'
export CLIENT_IMAGE='ghcr.io/jackela/impetus-client@sha256:<client-digest>'

# Initial setup on an empty database
bash scripts/deploy-staging.sh --deploy-only --initialize

# Deploy to the ready host
bash scripts/deploy-staging.sh --deploy-only
bash scripts/deploy-staging.sh --status
```

Use `scripts/deploy-production.sh` with the same flags for production. To administer that host over SSH, export `PRODUCTION_HOST`, `PRODUCTION_USER`, and, when needed, `PRODUCTION_DEPLOY_DIR` (default `/opt/impetus-lock`). The SSH path runs the same deployment implementation with the host's existing Compose and environment files. Configure registry access and SSH host identity on the host or operator account as appropriate. When using `--deploy-only`, use builds whose applicable gates have passed. Set `RELEASE_SHA` to additionally verify the source commit label on both images.

The scripts also support `--build-only [tag]` for local artifacts and `[tag]` to build, push and apply. An omitted tag is derived from the full Git commit SHA. The build contexts come from that exact commit. Configure the registry namespace with `DOCKER_REGISTRY` and `DOCKER_NAMESPACE` when publishing outside GitHub; their defaults are `ghcr.io` and `jackela`. The production build-and-apply path requires confirmation and successful backend and frontend pre-deployment tests.

The deployer resolves the Compose model and verifies both images and the live database before replacing either app service. It recognizes an existing deployment on the first managed update if it can verify the running image digests, readiness and database schema. It then writes a verified, nonempty PostgreSQL custom-format dump under `backups/`. Protect the directory as database data. Check backup retention and off-host copies as part of your host procedures.

The candidate image must contain the live Alembic revision as its current head. Use `--initialize` for a verified empty database. The script can start PostgreSQL with a new Compose-owned volume. If it finds a stopped PostgreSQL container or an existing project volume, verify that resource and start the intended database separately before deploying. For a release that changes the revision, the deployment scripts stop with the current services in place.

### Release with a schema change

1. In a maintenance window, suspend automatic deployments and quiesce application and administrative writes. Record both pairs of image digests, the live revision and the new revision. Pull all four digests and check the resolved Compose images. Restore-test the release's backup procedure and rehearse upgrade and downgrade with the exact candidate image against a copy of the database.
2. With ingress still paused, stop the `client` and `api` services and keep `postgres` running. Take a fresh custom-format `pg_dump` of the live database using the Compose DB user and name. Verify the dump file is nonempty and readable by `pg_restore`. Keep that file and the current release record available for recovery.
3. Set `API_IMAGE` and `CLIENT_IMAGE` to the new digests. Run the following from the deployment directory, using the matching environment file. Verify the new revision, client/API/database readiness and a protected application read before accepting the release.

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.staging run \
     --rm --no-deps --pull never -T --entrypoint alembic api upgrade head
   docker compose -f docker-compose.prod.yml --env-file .env.staging up -d \
     --no-deps --no-build --pull never --force-recreate api client
   ```

4. If validation fails before reopening ingress, stop the candidate app services. Use the **candidate** API digest and change the Alembic command above to `downgrade <old-revision>` if the downgrade was validated and the current database state is covered by that rehearsal. Otherwise restore the verified backup to a separate database for recovery. After checking the old revision and data, set the old image digests and run the `up` command above. Use the matching deployment script with `--status` before reopening ingress.
5. If validation passes, archive the old `.deployment-<environment>.json` file under a protected, revision-specific name. Run `--deploy-only` against the ready candidate to adopt it as the current managed release and capture its backup. Reopen ingress after the adoption passes. Automatic rollback becomes available once a subsequent release at the same revision has been verified.

## Readiness and recovery

The host readiness check uses the published client port. It probes `/health` for the client and proxies `/api/health` and `/api/health/db` to FastAPI. API process health is independent of PostgreSQL. The database endpoint may return HTTP 200 with `"is_healthy": false`, which fails readiness.

Use the matching script with `--rollback` to restore the previous verified pair. The script checks the target images, running release, database revision and backup before replacing the app containers. It returns success only when both containers match the selected images and pass readiness. If a candidate fails after replacing services, the deployer attempts to restore and verify the previously running image pair and reports failure for the candidate. Compose keeps the PostgreSQL container and its data volume in place throughout these app switches.

Keep the server's Compose and environment files stable during an image switch. The script compares the already-running Compose configuration, local client port and PostgreSQL data mount with the deployment files before recreating a service. Apply configuration changes in a separate maintenance window and save the prior files for recovery. The host records verified current and previous digests in `.deployment-staging.json` or `.deployment-production.json` in the deployment directory. After an interruption that leaves live containers different from the recorded release, inspect container logs and the database first. If the database revision still matches the recorded current revision, export that record's exact `API_IMAGE` and `CLIENT_IMAGE` digests, select the environment file and run the following from the deployment directory.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.staging config --images
docker compose -f docker-compose.prod.yml --env-file .env.staging pull api client
docker compose -f docker-compose.prod.yml --env-file .env.staging up -d \
  --no-deps --no-build --pull never --force-recreate api client
```

Run the matching deployment script with `--status` after restoring the recorded pair. If data must be recovered, restore the selected `.dump` with `pg_restore --exit-on-error` into a separate PostgreSQL database first. Verify the schema, sample data and account ownership before redirecting application traffic.

## GitHub Staging workflow

On push to `main`, the workflow builds from the event commit. For a manual run it resolves the requested branch or commit once. Both images and the deployed implementation use that full SHA. With no `STAGING_HOST` configured, the workflow publishes images and reports images-only status. To enable deployment, configure `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY` and optionally `STAGING_DEPLOY_DIR`. Prepare and initialize the host before using automatic staging releases.

Set the staging variable `STAGING_PUBLIC_URL` to enable the optional runner-side check of the public origin. The deployment job verifies host readiness before recording success. The separate public check detects reachability or reverse proxy failures seen from the runner. The workflow summary shows both results.

The [deployment rehearsal](../../scripts/test-deployment-recovery.sh) uses the production builds in a disposable registry and Compose project. Supply image tags as `TEST_API_BASE_IMAGE` and `TEST_CLIENT_BASE_IMAGE`. It checks digest selection, blocked configuration drift, preservation of stopped PostgreSQL and its existing volume, readiness, rollback and restoration of a task with its lock. It also rehearses migration and downgrade before adoption of a new schema revision. Deployment through a particular external host, its TLS entry and its database backup retention are established by that host's own evidence.
