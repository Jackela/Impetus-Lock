"""Supervise development services and stop only resources owned by this checkout."""

import argparse
import fcntl
import hashlib
import json
import os
import re
import select
import shutil
import signal
import socket
import subprocess
import sys
import time
from contextlib import contextmanager, suppress
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "tmp" / "impetus-dev"
STOP_REQUEST = STATE / "stop"
OWNER_LABEL = "io.github.jackela.impetus-lock.dev-checkout"
OWNER = hashlib.sha256(os.fsencode(ROOT)).hexdigest()
CONTAINER_ID = re.compile(r"[a-f0-9]{64}")
POLL_INTERVAL = 0.1


def info(message):
    print(f"[dev] {message}", flush=True)


@contextmanager
def lock(name):
    with (STATE / name).open("a") as handle:
        yield handle


def try_lock(handle):
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return False
    return True


def check_ports(addresses):
    probes = []
    try:
        for host, port in addresses:
            try:
                bindings = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
                for family, socktype, protocol, _, address in bindings:
                    probe = socket.socket(family, socktype, protocol)
                    probes.append(probe)
                    probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    if family == socket.AF_INET6:
                        probe.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
                    probe.bind(address)
                    probe.listen(1)
            except OSError as error:
                raise RuntimeError(f"Cannot use {host}:{port}: {error}") from error
    finally:
        for probe in probes:
            probe.close()


def docker(*args, timeout=30, check=True):
    return subprocess.run(
        ["docker", *args], check=check, timeout=timeout, capture_output=True, text=True
    )


def docker_containers():
    output = docker(
        "ps", "--all", "--no-trunc", "--format", "{{.ID}} {{.Names}}"
    ).stdout
    return dict(line.split() for line in output.splitlines())


def inspect_container(container_id):
    return json.loads(docker("inspect", "--type", "container", container_id).stdout)[0]


def container_owner(container):
    return (container["Config"]["Labels"] or {}).get(OWNER_LABEL)


def docker_engine_id():
    engine = docker("info", "--format", "{{.ID}}").stdout.strip()
    if not engine:
        raise RuntimeError("Docker did not report its engine ID")
    return engine


def record_container(container_id, engine):
    if not CONTAINER_ID.fullmatch(container_id):
        raise RuntimeError("Docker returned an invalid container ID")
    (STATE / f"postgres.{container_id}").write_text(f"{engine}\n")


def ensure_postgres(launcher, name, port, user, password, db, services):
    containers = docker_containers()
    container_id = next(
        (item for item, title in containers.items() if title == name), None
    )
    if container_id is None:
        check_ports([*services, ("127.0.0.1", port)])
        info(f"Creating PostgreSQL container {name}")
        container_id = docker(
            "create",
            "--name",
            name,
            "--label",
            f"{OWNER_LABEL}={OWNER}",
            "-e",
            f"POSTGRES_USER={user}",
            "-e",
            f"POSTGRES_PASSWORD={password}",
            "-e",
            f"POSTGRES_DB={db}",
            "-p",
            f"127.0.0.1:{port}:5432",
            "postgres:15-alpine",
            timeout=180,
        ).stdout.strip()
        running = False
    else:
        container = inspect_container(container_id)
        owner = container_owner(container)
        if owner is None:
            raise RuntimeError(
                f"PostgreSQL container {name} is unmanaged. To use that database, ensure it is running and set AUTO_START_POSTGRES=0 with DATABASE_URL. Or choose a different POSTGRES_CONTAINER_NAME and POSTGRES_PORT"
            )
        if owner != OWNER:
            raise RuntimeError(
                f"PostgreSQL container {name} belongs to another checkout. Choose a different POSTGRES_CONTAINER_NAME and POSTGRES_PORT"
            )
        bindings = (container["HostConfig"]["PortBindings"] or {}).get("5432/tcp") or []
        if not any(
            binding["HostPort"] == str(port)
            and binding["HostIp"] in ("", "0.0.0.0", "127.0.0.1")
            for binding in bindings
        ):
            raise RuntimeError(
                f"PostgreSQL container {name} does not publish port {port}. Choose another container or set AUTO_START_POSTGRES=0 with DATABASE_URL"
            )
        running = container["State"]["Running"]

    # Record the verified ID on this Docker engine before a container can start.
    record_container(container_id, docker_engine_id())
    if not running and not launcher.stopping:
        check_ports([*services, ("127.0.0.1", port)])
        info(f"Starting this checkout's PostgreSQL container {name}")
        docker("start", container_id)

    deadline = time.monotonic() + 60
    while not launcher.stopping and time.monotonic() < deadline:
        result = docker(
            "exec",
            container_id,
            "pg_isready",
            "-h",
            "127.0.0.1",
            "-U",
            user,
            "-d",
            db,
            check=False,
        )
        if result.returncode == 0:
            info(f"PostgreSQL is ready on port {port}")
            return
        time.sleep(1)
    if not launcher.stopping:
        raise RuntimeError(f"PostgreSQL container {name} did not become ready")


def stop_postgres(clean):
    records = sorted(STATE.glob("postgres.*"))
    if not records:
        return
    engine = docker_engine_id()
    containers = docker_containers()
    failed = []
    for record in records:
        container_id = record.name.partition(".")[2]
        if not CONTAINER_ID.fullmatch(container_id):
            failed.append(f"Invalid PostgreSQL ownership record: {record.name}")
            continue
        if record.read_text().strip() != engine:
            failed.append(
                f"PostgreSQL container {container_id[:12]} was recorded on a different Docker engine"
            )
            continue
        if container_id not in containers:
            record.unlink()
            continue
        container = inspect_container(container_id)
        if container_owner(container) != OWNER:
            failed.append(
                f"PostgreSQL container {containers[container_id]} lacks this checkout's ownership label"
            )
            continue
        if container["State"]["Running"]:
            docker("stop", container_id)
        if clean:
            docker("rm", "--volumes", container_id)
            record.unlink()
    if failed:
        raise RuntimeError(". ".join(failed))


def exit_status(process):
    # Keep the group leader's PID reserved until after its group has been stopped.
    state = os.waitid(os.P_PID, process.pid, os.WEXITED | os.WNOHANG | os.WNOWAIT)
    return state.si_status if state is not None else None


def live_groups():
    output = subprocess.check_output(["ps", "-Ao", "pgid=,stat="], text=True)
    return {
        int(group)
        for group, status in (line.split() for line in output.splitlines())
        if not status.startswith("Z")
    }


def signal_group(group, signum):
    try:
        os.killpg(group, signum)
    except ProcessLookupError:
        pass
    except PermissionError:
        # macOS can return EPERM for a group containing only its unreaped leader.
        if group in live_groups():
            raise


def wait_group(group, timeout):
    deadline = time.monotonic() + timeout
    while group in live_groups():
        if time.monotonic() >= deadline:
            return False
        time.sleep(POLL_INTERVAL)
    return True


def stop_group(process):
    group = process.pid
    try:
        signal_group(group, signal.SIGTERM)
        if not wait_group(group, 5):
            signal_group(group, signal.SIGKILL)
            if not wait_group(group, 2):
                raise RuntimeError(
                    f"Service process group {group} remains active after shutdown"
                )
    finally:
        process.wait(timeout=2)


def watchdog(parent_pipe, pid_file, command):
    # EOF means the launcher exited, including when it was forcibly killed.
    if select.select([parent_pipe], [], [], 0)[0]:
        return 0
    active = STATE / f"active.{os.getpid()}"
    active.touch()
    try:
        process = subprocess.Popen(command, start_new_session=True)
    except OSError:
        active.unlink()
        raise
    try:
        active.write_text(f"{process.pid}\n")
        path = Path(pid_file) if pid_file else None
        if path is not None:
            path.write_text(f"{process.pid}\n")
        while not select.select([parent_pipe], [], [], POLL_INTERVAL)[0]:
            status = exit_status(process)
            if status is not None:
                return status
        return 0
    finally:
        stop_group(process)
        if pid_file:
            path = Path(pid_file)
            with suppress(FileNotFoundError):
                if path.read_text() == f"{process.pid}\n":
                    path.unlink()
        active.unlink()


def verify_services_stopped():
    pending = sorted(STATE.glob("active.*"))
    if pending:
        raise RuntimeError(
            f"Service cleanup could not be confirmed. Check the checkout's service processes "
            f"before removing the outstanding record at {pending[0]}"
        )


class Launcher:
    def __init__(self, services_lock):
        self.services_lock = services_lock
        self.pipe_read, self.pipe_write = os.pipe()
        self.processes = []
        self.interrupted = False

    def interrupt(self, _signum, _frame):
        self.interrupted = True

    @property
    def stopping(self):
        return self.interrupted or STOP_REQUEST.exists()

    def launch(self, command, cwd, pid_file=""):
        # Each watchdog also holds the checkout lock until its own process group exits.
        process = subprocess.Popen(
            [
                sys.executable,
                __file__,
                "_watch",
                str(self.pipe_read),
                pid_file,
                *command,
            ],
            cwd=cwd,
            pass_fds=(self.pipe_read, self.services_lock),
            start_new_session=True,
        )
        self.processes.append(process)
        return process

    def setup(self, command, cwd):
        if self.stopping:
            return
        process = self.launch(command, cwd)
        status = exit_status(process)
        while not self.stopping and status is None:
            time.sleep(POLL_INTERVAL)
            status = exit_status(process)
        if not self.stopping:
            if status:
                raise subprocess.CalledProcessError(status, command)
            self.processes.remove(process)
            process.wait()

    def serve(self, command, cwd, pid_file):
        if not self.stopping:
            self.launch(command, cwd, pid_file)

    def wait(self):
        while not self.stopping:
            for process in self.processes:
                if exit_status(process) is not None:
                    raise RuntimeError(
                        f"Service exited: {process.args[5]}. Check its startup log above."
                    )
            time.sleep(POLL_INTERVAL)

    def close(self):
        os.close(self.pipe_write)
        os.close(self.pipe_read)
        for process in self.processes:
            process.wait(timeout=10)
        verify_services_stopped()


def start_services(launcher):
    server = ROOT / "server"
    client = ROOT / "client"
    env = os.environ
    backend = (env.get("API_HOST") or "0.0.0.0", int(env.get("BACKEND_PORT") or "8000"))
    start_frontend = env.get("AUTO_START_FRONTEND") != "0"
    start_postgres = env.get("AUTO_START_POSTGRES") != "0"
    name = env.get("POSTGRES_CONTAINER_NAME") or "impetus-lock-postgres"
    port = int(env.get("POSTGRES_PORT") or "5432")
    user = env.get("POSTGRES_USER") or "postgres"
    password = env.get("POSTGRES_PASSWORD") or "postgres"
    db = env.get("POSTGRES_DB") or "postgres"
    defaults = {
        "DATABASE_URL": f"postgresql+asyncpg://{user}:{password}@127.0.0.1:{port}/{db}",
        "LLM_ALLOW_DEBUG_PROVIDER": "1",
        "LLM_DEFAULT_PROVIDER": "debug",
        "OPENAI_API_KEY": "debug-openai-placeholder",
        "VITE_API_URL": f"http://127.0.0.1:{backend[1]}",
    }
    for variable, default in defaults.items():
        if not env.get(variable):
            env[variable] = default

    addresses = [backend]
    if start_frontend:
        addresses.append(
            (
                env.get("FRONTEND_HOST") or "0.0.0.0",
                int(env.get("FRONTEND_PORT") or "5173"),
            )
        )
    if any(not 1 <= value <= 65535 for _, value in addresses) or not 1 <= port <= 65535:
        raise RuntimeError("Development ports must be between 1 and 65535")
    check_ports(addresses)
    for required, enabled in (
        ("poetry", True),
        ("npm", start_frontend),
        ("docker", start_postgres),
    ):
        if enabled and shutil.which(required) is None:
            raise RuntimeError(f"Missing required command: {required}")

    if start_postgres:
        ensure_postgres(launcher, name, port, user, password, db, addresses)
    info("Installing backend dependencies and running Alembic migrations")
    launcher.setup(["poetry", "install"], server)
    launcher.setup(["poetry", "run", "alembic", "upgrade", "head"], server)
    if start_frontend:
        info("Installing frontend dependencies")
        launcher.setup(
            ["npm", "ci" if (client / "package-lock.json").exists() else "install"],
            client,
        )
    if launcher.stopping:
        return
    check_ports(addresses)
    info(f"Starting backend on port {backend[1]}")
    launcher.serve(
        [
            "poetry",
            "run",
            "uvicorn",
            "server.api.main:app",
            "--host",
            backend[0],
            "--port",
            str(backend[1]),
            "--reload",
        ],
        server,
        ".backend.pid",
    )
    if start_frontend:
        frontend = addresses[1]
        info(f"Starting Vite on port {frontend[1]}")
        launcher.serve(
            [
                "npm",
                "run",
                "dev",
                "--",
                "--host",
                frontend[0],
                "--port",
                str(frontend[1]),
                "--strictPort",
            ],
            client,
            ".frontend.pid",
        )
    launcher.wait()


def start():
    with lock("services.lock") as services:
        with lock("commands.lock") as commands:
            if not try_lock(commands) or not try_lock(services):
                raise RuntimeError(
                    "A developer command is active for this checkout. Use ./scripts/dev-stop.sh to stop it"
                )
            verify_services_stopped()
            STOP_REQUEST.unlink(missing_ok=True)
        launcher = Launcher(services.fileno())
        for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
            signal.signal(signum, launcher.interrupt)
        try:
            start_services(launcher)
        finally:
            launcher.close()


def stop(clean):
    with lock("commands.lock") as commands, lock("services.lock") as services:
        fcntl.flock(commands, fcntl.LOCK_EX)
        if not try_lock(services):
            STOP_REQUEST.touch()
            deadline = time.monotonic() + 20
            while not try_lock(services):
                if time.monotonic() >= deadline:
                    raise RuntimeError(
                        "The development launcher has not finished stopping. Check its terminal and retry."
                    )
                time.sleep(POLL_INTERVAL)
        STOP_REQUEST.unlink(missing_ok=True)
        stop_postgres(clean)
        verify_services_stopped()
    info("Checkout services stopped")


def main():
    if sys.argv[1:2] == ["_watch"]:
        return watchdog(int(sys.argv[2]), sys.argv[3], sys.argv[4:])
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("start", help="Start this checkout's development services")
    stop_command = commands.add_parser(
        "stop", help="Stop this checkout's development services"
    )
    stop_command.add_argument(
        "--clean",
        action="store_true",
        help="Remove this checkout's managed PostgreSQL containers and their anonymous volumes",
    )
    args = parser.parse_args()
    try:
        STATE.mkdir(exist_ok=True, parents=True, mode=0o700)
        if args.command == "start":
            start()
        else:
            stop(args.clean)
    except subprocess.CalledProcessError as error:
        # Docker's invocation can contain a password, so report its operation and stderr.
        detail = f": {error.stderr.strip()}" if error.stderr else ""
        print(
            f"[dev] {error.cmd[0]} {error.cmd[1]} exited with status {error.returncode}{detail}",
            file=sys.stderr,
        )
        return max(1, error.returncode)
    except subprocess.TimeoutExpired as error:
        print(f"[dev] {error.cmd[0]} {error.cmd[1]} timed out", file=sys.stderr)
        return 1
    except (OSError, OverflowError, RuntimeError, ValueError) as error:
        print(f"[dev] {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
