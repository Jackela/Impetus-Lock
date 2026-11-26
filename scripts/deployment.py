"""Deploy and recover a digest-pinned Compose release on its target host."""

import argparse
import fcntl
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import HTTPRedirectHandler, build_opener

SERVICES = ("api", "client")
RETRIES = 30
DIGEST = re.compile(r"[a-zA-Z0-9.:-]+(?:/[a-z0-9._-]+)+@sha256:[a-f0-9]{64}")
CHECK_RETRIES = int(os.environ.get("DEPLOY_CHECK_ATTEMPTS", str(RETRIES)))


class DeploymentError(Exception):
    """The operation could not safely complete."""


@dataclass(frozen=True)
class Images:
    api: str
    client: str

    def __post_init__(self):
        if not all(isinstance(ref, str) and DIGEST.fullmatch(ref) for ref in self.refs):
            raise DeploymentError(
                "Both API_IMAGE and CLIENT_IMAGE must be registry digest references"
            )

    @property
    def refs(self):
        return self.api, self.client


@dataclass(frozen=True)
class Release:
    images: Images
    schema: str

    @classmethod
    def from_record(cls, record):
        return cls(Images(**record["images"]), record["schema"])


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def run(*args, env=None, capture=False, stdout=None, stdin=None):
    result = subprocess.run(
        args,
        env=env,
        text=True,
        stdin=stdin,
        check=True,
        stdout=subprocess.PIPE if capture else stdout,
    )
    return result.stdout.strip() if capture else None


def inspect_image(ref):
    return json.loads(run("docker", "image", "inspect", ref, capture=True))[0]


def retry(check, error):
    for attempt in range(CHECK_RETRIES):
        try:
            return check()
        except (
            DeploymentError,
            OSError,
            ValueError,
            subprocess.CalledProcessError,
        ) as exc:
            if attempt + 1 >= CHECK_RETRIES:
                raise DeploymentError(f"{error}: {exc}") from exc
            time.sleep(2)
    raise DeploymentError(error)


def check_ready(url):
    """Check process liveness and database readiness through the client proxy."""
    opener = build_opener(NoRedirect())

    def get(path):
        try:
            with opener.open(f"{url}{path}", timeout=3) as response:
                if response.status != 200:
                    raise DeploymentError(f"{path} returned HTTP {response.status}")
                return response.read(65536)
        except (HTTPError, URLError) as exc:
            raise DeploymentError(f"{path} is unavailable at {url}: {exc}") from exc

    try:
        client = get("/health").strip()
        api = json.loads(get("/api/health"))
        database = json.loads(get("/api/health/db"))
    except (HTTPError, URLError, ValueError) as exc:
        raise DeploymentError(
            f"Health endpoint unavailable or invalid at {url}: {exc}"
        ) from exc
    if client != b"healthy" or not isinstance(api, dict) or api.get("status") != "ok":
        raise DeploymentError(f"Client or API liveness check failed at {url}")
    if not isinstance(database, dict) or database.get("is_healthy") is not True:
        raise DeploymentError(f"Database readiness check failed at {url}")


class Compose:
    """Resolve and validate the Compose contract before invoking services."""

    def __init__(self, root, environment, images):
        self.images = images
        self.command = (
            "docker",
            "compose",
            "--project-directory",
            str(root),
            "-f",
            str(root / "docker-compose.prod.yml"),
            "--env-file",
            str(root / f".env.{environment}"),
        )
        for source in (self.command[5], self.command[7]):
            if not Path(source).is_file():
                raise DeploymentError(f"Missing deployment prerequisite: {source}")
        self.env = {
            **os.environ,
            "API_IMAGE": images.api,
            "CLIENT_IMAGE": images.client,
        }
        model = json.loads(self.call("config", "--format", "json", capture=True))
        self.project = model.get("name")
        if not self.project:
            raise DeploymentError("Compose must resolve a project name")
        services = model.get("services", {})
        self.database_services = (
            ("postgres", "redis") if "redis" in services else ("postgres",)
        )
        for name, ref in zip(SERVICES, images.refs):
            if services.get(name, {}).get("image") != ref or services[name].get(
                "build"
            ):
                raise DeploymentError(
                    f"Compose service {name} must resolve to its supplied digest image"
                )
            if (
                services[name].get("scale", 1) != 1
                or services[name].get("deploy", {}).get("replicas", 1) != 1
            ):
                raise DeploymentError(
                    f"Compose service {name} must have a single replica"
                )
        try:
            postgres = services["postgres"]
            api = services["api"]
            db_env = postgres["environment"]
            self.database = db_env["POSTGRES_DB"]
            self.db_user = db_env["POSTGRES_USER"]
            password = db_env["POSTGRES_PASSWORD"]
            self.database_url = api["environment"]["DATABASE_URL"]
            db_url = urlsplit(self.database_url)
            if not (
                self.database
                and self.db_user
                and password
                and db_url.scheme == "postgresql+asyncpg"
                and db_url.hostname == "postgres"
                and db_url.port in (None, 5432)
                and unquote(db_url.path[1:]) == self.database
                and unquote(db_url.username or "") == self.db_user
                and unquote(db_url.password or "") == password
                and not db_url.query
            ):
                raise DeploymentError(
                    "API and postgres must refer to the same local Compose database"
                )
            if api["environment"].get("TESTING"):
                raise DeploymentError("The deployment API must keep TESTING unset")
            if postgres.get("build") or not postgres.get("image"):
                raise DeploymentError("postgres must use a prebuilt database image")
            if (
                postgres.get("scale", 1) != 1
                or postgres.get("deploy", {}).get("replicas", 1) != 1
            ):
                raise DeploymentError("postgres must have a single replica")
            mounts = [
                mount
                for mount in postgres.get("volumes", [])
                if mount.get("target") == "/var/lib/postgresql/data"
            ]
            if (
                len(mounts) != 1
                or mounts[0].get("type") not in {"volume", "bind"}
                or not mounts[0].get("source")
            ):
                raise DeploymentError(
                    "postgres needs one persistent store at /var/lib/postgresql/data"
                )
            self.pg_mount = mounts[0]
            self.pg_volume = model.get("volumes", {}).get(self.pg_mount["source"], {})
            if self.pg_mount["type"] == "volume" and not self.pg_volume.get("name"):
                raise DeploymentError(
                    "postgres named volume must have a resolved Docker volume name"
                )
            ports = [
                port
                for port in services["client"]["ports"]
                if port["target"] == 80
                and port.get("protocol", "tcp") == "tcp"
                and port.get("host_ip") in ("127.0.0.1", "0.0.0.0", None)
                and str(port.get("published", "")).isdigit()
            ]
            if len(ports) != 1 or not 0 < int(ports[0]["published"]) <= 65535:
                raise DeploymentError(
                    "Client must publish one fixed IPv4 port for HTTP readiness"
                )
            self.client_port = str(ports[0]["published"])
            self.probe = f"http://127.0.0.1:{self.client_port}"
        except (KeyError, TypeError, ValueError) as exc:
            raise DeploymentError(
                "Compose is missing its PostgreSQL or client HTTP contract"
            ) from exc

    def call(self, *args, **kwargs):
        return run(*self.command, *args, env=self.env, **kwargs)

    def containers(self, name, *, stopped=False):
        args = ["ps", "-q"]
        if stopped:
            args.append("--all")
        ids = self.call(*args, name, capture=True).splitlines()
        if len(ids) > 1:
            raise DeploymentError(f"Expected at most one {name} container")
        return ids[0] if ids else None

    def image_ids(self, *, fetch):
        ids = []
        for ref in self.images.refs:
            if fetch:
                run("docker", "pull", ref)
            ids.append(inspect_image(ref)["Id"])
        return tuple(ids)

    def running_images(self):
        ids = tuple(self.containers(name, stopped=True) for name in SERVICES)
        if ids == (None, None):
            return None
        containers = (
            json.loads(run("docker", "inspect", identifier, capture=True))[0]
            for identifier in ids
            if identifier
        )
        details = list(containers)
        if len(details) != 2 or not all(item["State"]["Running"] for item in details):
            raise DeploymentError("Current API/client release is partial or stopped")
        return tuple(item["Image"] for item in details)

    def verify_running_configuration(self):
        services = (*SERVICES, *self.database_services)
        containers = {}
        for name in services:
            identifier = self.containers(name)
            if not identifier:
                raise DeploymentError(
                    f"Required Compose service is not running: {name}"
                )
            containers[name] = json.loads(
                run("docker", "container", "inspect", identifier, capture=True)
            )[0]
        # Use the image spelling from the running containers to support adopting
        # a legacy tagged deployment after its local image IDs were verified.
        live_refs = {
            "API_IMAGE": containers["api"]["Config"]["Image"],
            "CLIENT_IMAGE": containers["client"]["Config"]["Image"],
        }
        output = run(
            *self.command,
            "config",
            "--hash",
            "*",
            capture=True,
            env={**self.env, **live_refs},
        )
        hashes = dict(line.split() for line in output.splitlines())
        for name, container in containers.items():
            labels = container["Config"].get("Labels") or {}
            expected = hashes.get(name)
            if not expected or labels.get("com.docker.compose.config-hash") != expected:
                raise DeploymentError(
                    f"Running {name} configuration differs from the deployment files"
                )

        ports = containers["client"]["NetworkSettings"]["Ports"].get("80/tcp") or []
        if not any(
            port["HostIp"] in {"0.0.0.0", "127.0.0.1"}
            and port["HostPort"] == self.client_port
            for port in ports
        ):
            raise DeploymentError(
                "Running client does not own the configured IPv4 readiness port"
            )
        if (
            f"DATABASE_URL={self.database_url}"
            not in containers["api"]["Config"]["Env"]
        ):
            raise DeploymentError(
                "Running API and deployment configuration select different databases"
            )
        self.verify_running_storage(containers["postgres"])

    def verify_running_storage(self, container):
        for mount in container["Mounts"]:
            if (
                mount["Destination"] != self.pg_mount["target"]
                or mount["Type"] != self.pg_mount["type"]
            ):
                continue
            if mount["Type"] == "volume" and mount["Name"] == self.pg_volume["name"]:
                return
            if mount["Type"] == "bind" and mount["Source"] == self.pg_mount["source"]:
                return
        raise DeploymentError(
            "Running postgres storage differs from the configured data store"
        )

    def verify_new_postgres(self):
        if self.containers("postgres", stopped=True):
            raise DeploymentError(
                "Existing postgres container is stopped; verify its data store before restarting it"
            )
        if self.pg_mount["type"] != "volume" or self.pg_volume.get("external"):
            raise DeploymentError(
                "Initial bootstrap requires a new Compose-owned PostgreSQL volume"
            )
        project_volumes = run(
            "docker",
            "volume",
            "ls",
            "--filter",
            f"label=com.docker.compose.project={self.project}",
            "--format",
            "{{.Name}}",
            capture=True,
        )
        volume_names = run(
            "docker", "volume", "ls", "--format", "{{.Name}}", capture=True
        ).splitlines()
        if project_volumes or self.pg_volume["name"] in volume_names:
            raise DeploymentError(
                "Existing Compose project data resources require verifying and starting the existing database"
            )

    def discover_images(self, running_ids):
        refs = []
        for name, image_id in zip(SERVICES, running_ids):
            info = inspect_image(image_id)
            # A digest for this local image ID is sufficient even for deployments made using a tag.
            repository = getattr(self.images, name).split("@", 1)[0]
            matches = sorted(
                ref for ref in info["RepoDigests"] if ref.split("@", 1)[0] == repository
            )
            if not matches:
                raise DeploymentError(
                    f"Cannot establish a registry digest for the running {name} image"
                )
            refs.append(matches[0])
        return Images(*refs)

    def pg(self, *args, **kwargs):
        return self.call("exec", "-T", "postgres", *args, **kwargs)

    def pg_connect(self, command, *args, **kwargs):
        return self.pg(
            "sh",
            "-c",
            'export PGPASSWORD="$POSTGRES_PASSWORD"; exec "$@"',
            "sh",
            command,
            "-h",
            "127.0.0.1",
            "-p",
            "5432",
            "-U",
            self.db_user,
            "-d",
            self.database,
            *args,
            **kwargs,
        )

    def sql(self, query):
        return self.pg_connect(
            "psql", "-XAt", "-v", "ON_ERROR_STOP=1", "-c", query, capture=True
        )

    def database_schema(self):
        if not self.containers("postgres"):
            raise DeploymentError("The Compose postgres container is not running")
        # Read the target database using the same user/database as the application's URL.
        if self.sql("SELECT to_regclass('public.alembic_version') IS NOT NULL") == "t":
            schema = self.sql(
                "SELECT version_num FROM public.alembic_version ORDER BY version_num"
            )
            if not schema:
                raise DeploymentError("The database Alembic version table is empty")
            return schema
        count = self.sql(
            "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE c.relkind IN ('r', 'p', 'f', 'm', 'v', 'S') "
            "AND n.nspname NOT IN ('pg_catalog', 'information_schema') "
            "AND n.nspname NOT LIKE 'pg_toast%'"
        )
        if count != "0":
            raise DeploymentError("Existing database tables have no Alembic version")
        return ""

    def candidate_schema(self):
        # Read migration metadata in the exact API image without modifying the target database.
        output = self.call(
            "run",
            "--rm",
            "--no-deps",
            "-T",
            "--pull",
            "never",
            "--entrypoint",
            "alembic",
            "api",
            "heads",
            capture=True,
        )
        heads = sorted(
            line.split()[0] for line in output.splitlines() if line.endswith(" (head)")
        )
        if not heads:
            raise DeploymentError("Candidate API image did not report an Alembic head")
        return "\n".join(heads)

    def backup(self, directory):
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(dir=directory, prefix=".partial-")
        path = Path(temporary)
        try:
            with os.fdopen(descriptor, "wb") as file:
                self.pg_connect("pg_dump", "-Fc", stdout=file)
                file.flush()
                os.fsync(file.fileno())
            if path.stat().st_size == 0:
                raise DeploymentError("Database backup is empty")
            with path.open("rb") as file:
                self.pg("pg_restore", "--list", stdin=file, stdout=subprocess.DEVNULL)
            with path.open("rb") as file:
                # Decode all archived data to reject damaged archives with a readable table of contents.
                self.pg("pg_restore", "--file=/dev/null", stdin=file)
            final = (
                directory
                / f"{time.strftime('%Y%m%dT%H%M%SZ', time.gmtime())}-{path.name[9:]}.dump"
            )
            path.replace(final)
            print(f"Database backup verified: {final}", flush=True)
        finally:
            path.unlink(missing_ok=True)

    def start(self, image_ids, schema):
        self.call(
            "up",
            "-d",
            "--no-deps",
            "--no-build",
            "--pull",
            "never",
            "--force-recreate",
            *SERVICES,
        )
        retry(lambda: check_ready(self.probe), f"Readiness failed at {self.probe}")
        if self.running_images() != image_ids:
            raise DeploymentError(
                "Running API/client image IDs do not match the selected digests"
            )
        self.verify_running_configuration()
        if self.database_schema() != schema:
            raise DeploymentError(
                "Running database revision does not match the selected release"
            )


def read_state(path):
    if not path.is_file():
        return None, None
    try:
        state = json.loads(path.read_text())
        return Release.from_record(state["current"]), (
            Release.from_record(state["previous"])
            if state["previous"] is not None
            else None
        )
    except (KeyError, ValueError, TypeError) as exc:
        raise DeploymentError(f"Invalid release state at {path}") from exc


def write_state(path, current, previous):
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix=".state-")
    try:
        with os.fdopen(descriptor, "w") as file:
            json.dump(
                {
                    "current": asdict(current),
                    "previous": asdict(previous) if previous else None,
                },
                file,
            )
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        Path(temporary).replace(path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def check_build_revision(images, expected):
    labels = [
        inspect_image(ref).get("Config", {}).get("Labels") or {} for ref in images.refs
    ]
    revisions = [label.get("org.opencontainers.image.revision") for label in labels]
    if expected and (
        not re.fullmatch(r"[0-9a-f]{40}", expected)
        or any(revision != expected for revision in revisions)
    ):
        raise DeploymentError(
            "Built API/client revisions do not match the resolved Git commit"
        )
    if all(revisions) and revisions[0] != revisions[1]:
        raise DeploymentError(
            "Built API/client revisions belong to different Git commits"
        )


def apply_release(args, root, state_path, current, previous):
    switching_back = args.command == "rollback"
    if switching_back and not previous:
        raise DeploymentError(
            "No previous verified release is recorded; current services are unchanged"
        )
    images = (
        previous.images
        if switching_back
        else Images(
            os.environ.get("API_IMAGE"),
            os.environ.get("CLIENT_IMAGE"),
        )
    )
    target = Compose(root, args.environment, images)
    target_ids = target.image_ids(fetch=True)
    if not switching_back:
        check_build_revision(images, os.environ.get("RELEASE_SHA"))
    running = target.running_images()
    if current and not running:
        raise DeploymentError(
            "Recorded current release is not running; recover it before switching"
        )
    if current:
        current_images = current.images
    elif running:
        current_images = target.discover_images(running)
    else:
        current_images = None
    old = Compose(root, args.environment, current_images) if current_images else None
    if old:
        if old.image_ids(fetch=False) != running:
            raise DeploymentError(
                "Current running images disagree with the deployment record"
            )
        old.verify_running_configuration()

    missing_services = [
        name for name in target.database_services if not target.containers(name)
    ]
    if missing_services:
        if not args.initialize or running:
            raise DeploymentError(
                f"Required Compose services are not running: {', '.join(missing_services)}"
            )
        if "postgres" in missing_services:
            target.verify_new_postgres()
    schema = target.candidate_schema()
    if missing_services:
        target.call("up", "-d", "--no-deps", "--no-build", *missing_services)
    database = target.containers("postgres")
    if not database:
        raise DeploymentError("The Compose postgres container is not running")
    target.verify_running_storage(
        json.loads(run("docker", "container", "inspect", database, capture=True))[0]
    )
    live_schema = retry(
        target.database_schema, "PostgreSQL is unavailable or has no compatible schema"
    )
    if not live_schema:
        if not args.initialize or running:
            raise DeploymentError(
                "Creating a new schema requires --initialize and an empty database"
            )
    elif live_schema != schema:
        raise DeploymentError(
            "Candidate requires a different database schema; migration must be planned separately"
        )
    if (current and current.schema != live_schema) or (
        switching_back and previous.schema != live_schema
    ):
        raise DeploymentError(
            "Live database schema differs from the recorded release schema"
        )
    if old:
        check_ready(old.probe)
        if old.candidate_schema() != live_schema:
            raise DeploymentError(
                "Running API migration head disagrees with the live database schema"
            )

    target.backup(root / "backups")
    if old and old.images == images:
        if not current:
            write_state(state_path, Release(images, schema), None)
        print("Requested release is already running and ready")
        return

    # The old services are untouched until all image, schema, health and backup checks pass.
    try:
        target.start(target_ids, schema)
        write_state(
            state_path,
            Release(images, schema),
            Release(old.images, live_schema) if old else None,
        )
    except (
        DeploymentError,
        OSError,
        ValueError,
        KeyError,
        subprocess.CalledProcessError,
        KeyboardInterrupt,
    ) as exc:
        if old:
            print(
                "Candidate failed; restoring the previous running release",
                file=sys.stderr,
                flush=True,
            )
            try:
                old.start(running, live_schema)
            except (
                DeploymentError,
                OSError,
                ValueError,
                KeyError,
                subprocess.CalledProcessError,
            ) as recovery:
                raise DeploymentError(
                    f"Release switch failed ({exc}); verification of recovery failed: {recovery}"
                ) from recovery
            print("Previous release restored and verified", file=sys.stderr, flush=True)
        else:
            target.call("rm", "-s", "-f", *SERVICES)
        raise DeploymentError(f"Release switch failed: {exc}") from exc
    print(f"Release ready: {images.api} {images.client}")


def deployment(args):
    root = Path(os.environ["DEPLOY_DIR"]).resolve()
    if not root.is_dir():
        raise DeploymentError(f"Deployment directory does not exist: {root}")
    state_path = root / f".deployment-{args.environment}.json"
    with (root / ".deployment.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise DeploymentError("Another deployment operation is running") from exc
        current, previous = read_state(state_path)
        if args.command == "status":
            if not current:
                raise DeploymentError("No verified release is recorded")
            compose = Compose(root, args.environment, current.images)
            compose.call("ps")
            if compose.running_images() != compose.image_ids(fetch=False):
                raise DeploymentError(
                    "Current running images disagree with the deployment record"
                )
            compose.verify_running_configuration()
            check_ready(compose.probe)
            if compose.database_schema() != current.schema:
                raise DeploymentError(
                    "Live database schema differs from the recorded release schema"
                )
            print(state_path.read_text().strip())
        else:
            apply_release(args, root, state_path, current, previous)


def interrupted(_signal, _frame):
    raise KeyboardInterrupt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("environment", choices=("staging", "production"))
    parser.add_argument(
        "command", choices=("deploy", "rollback", "status", "check-ready")
    )
    parser.add_argument("--initialize", action="store_true")
    parser.add_argument("--url")
    args = parser.parse_args()
    signal.signal(signal.SIGTERM, interrupted)
    try:
        if args.command == "check-ready":
            origin = urlsplit(args.url or "")
            if (
                origin.scheme not in {"http", "https"}
                or not origin.hostname
                or origin.username is not None
                or origin.path not in {"", "/"}
                or origin.query
                or origin.fragment
            ):
                raise DeploymentError("Readiness URL must be an HTTP(S) origin")
            check_ready(args.url.rstrip("/"))
        else:
            deployment(args)
    except (
        DeploymentError,
        OSError,
        ValueError,
        KeyError,
        subprocess.CalledProcessError,
        KeyboardInterrupt,
    ) as exc:
        print(f"Deployment failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
