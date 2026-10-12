"""Manage this round's containers/processes without touching existing services."""

import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request

from runtime import (
    API,
    CONTEXT,
    DATABASE,
    HERE,
    POSTGRES,
    REDIS,
    REGRESSION_DATABASE,
    ROOT,
    SECRET_FILE,
    SOURCE,
    UI,
    environment,
    private_settings,
)

PYTHON = str(ROOT / "server/.venv/bin/python")


def docker(*args, capture=False, **kwargs):
    """Address only the task-owned Docker context."""
    return subprocess.run(
        ["docker", "--context", CONTEXT, *args],
        check=True,
        text=True,
        capture_output=capture,
        **kwargs,
    )


def port_open(port):
    """Report whether loopback currently accepts connections."""
    with socket.socket() as client:
        client.settimeout(0.25)
        return client.connect_ex(("127.0.0.1", port)) == 0


def up():
    """Start two owned containers, preserving their volumes between runs."""
    names = docker(
        "ps", "-a", "--format", "{{.Names}}", capture=True
    ).stdout.splitlines()
    if not SECRET_FILE.exists() and (POSTGRES in names or REDIS in names):
        raise RuntimeError(
            "Owned containers already exist but private settings are missing; retain the original checkpoint before resuming"
        )
    settings = private_settings()
    definitions = [
        (
            POSTGRES,
            5433,
            [
                "-e",
                "POSTGRES_USER=postgres",
                "-e",
                f"POSTGRES_PASSWORD={settings['password']}",
                "-e",
                f"POSTGRES_DB={DATABASE}",
                "-v",
                "impetus-auth-safety-postgres:/var/lib/postgresql/data",
                "postgres:16",
            ],
        ),
        (
            REDIS,
            6381,
            [
                "-v",
                "impetus-auth-safety-redis:/data",
                "redis:7-alpine",
                "redis-server",
                "--appendonly",
                "yes",
            ],
        ),
    ]
    for name, port, rest in definitions:
        if name in names:
            label = docker(
                "inspect",
                "--format",
                '{{index .Config.Labels "codex.task"}}',
                name,
                capture=True,
            ).stdout.strip()
            if label != "authenticated-editor-safety-2026-10-11":
                raise RuntimeError(
                    f"Container {name} is not owned by this validation round"
                )
            docker("start", name, capture=True)
        else:
            if port_open(port):
                raise RuntimeError(
                    f"Port {port} is occupied; refusing to reuse existing service"
                )
            internal = 5432 if port == 5433 else 6379
            docker(
                "run",
                "-d",
                "--name",
                name,
                "--label",
                "codex.task=authenticated-editor-safety-2026-10-11",
                "-p",
                f"127.0.0.1:{port}:{internal}",
                *rest,
                capture=True,
            )
    for attempt in range(60):
        check = subprocess.run(
            [
                "docker",
                "--context",
                CONTEXT,
                "exec",
                POSTGRES,
                "pg_isready",
                "-U",
                "postgres",
            ],
            capture_output=True,
            check=False,
        )
        if check.returncode == 0 and port_open(5433) and port_open(6381):
            break
        time.sleep(0.5)
    else:
        raise RuntimeError("Owned database/cache failed readiness")
    exists = docker(
        "exec",
        POSTGRES,
        "psql",
        "-U",
        "postgres",
        "-At",
        "-c",
        f"SELECT 1 FROM pg_database WHERE datname='{REGRESSION_DATABASE}'",
        capture=True,
    ).stdout
    if exists.strip() != "1":
        docker(
            "exec",
            POSTGRES,
            "createdb",
            "-U",
            "postgres",
            REGRESSION_DATABASE,
            capture=True,
        )
    subprocess.run([PYTHON, str(SOURCE / "database.py"), "init"], check=True)
    docker("exec", REDIS, "redis-cli", "ping")
    metadata = {
        "created_for": "authenticated-editor-safety-2026-10-11",
        "worktree": str(ROOT),
        "docker_context": CONTEXT,
        "postgres_port": 5433,
        "redis_port": 6381,
        "database": DATABASE,
        "regression_database": REGRESSION_DATABASE,
        "backend": API,
        "frontend": UI,
        "testing": "unset",
        "dotenv": "disabled",
        "paid_model_network": "blocked",
        "browser_security": "default",
        "cookie_environment": "development",
        "transport": "loopback HTTP",
        "jwt_signing": "private stable local file",
    }
    (HERE / "metadata.json").write_text(json.dumps(metadata, indent=2))
    print(json.dumps(metadata, indent=2))


def start_backend():
    """Start one owned backend without reload, then require actual database health."""
    if port_open(8101):
        raise RuntimeError("8101 occupied; refusing existing backend")
    with (HERE / "backend.log").open("a") as log:
        child = subprocess.Popen(
            [PYTHON, str(SOURCE / "backend.py")],
            stdout=log,
            stderr=log,
            cwd=ROOT / "server",
            start_new_session=True,
        )
    (HERE / "backend.pid").write_text(str(child.pid))
    for attempt in range(60):
        if child.poll() is not None:
            raise RuntimeError("Backend exited; inspect backend.log")
        try:
            with urllib.request.urlopen(API + "/health/db", timeout=1) as response:
                data = json.load(response)
            (HERE / "backend-health.json").write_text(json.dumps(data, indent=2))
            if response.status == 200:
                print(json.dumps({"backend_pid": child.pid, "health": data}))
                return
        except OSError:
            pass
        time.sleep(0.5)
    raise RuntimeError("Backend database health failed")


def stop_backend():
    """Terminate only a PID previously created by this manager, preserving data."""
    pid_file = HERE / "backend.pid"
    if pid_file.exists():
        pid = int(pid_file.read_text())
        command = subprocess.run(
            ["ps", "-p", str(pid), "-o", "command="],
            capture_output=True,
            text=True,
            check=False,
        ).stdout
        if str(SOURCE / "backend.py") in command:
            os.kill(pid, signal.SIGTERM)
            for attempt in range(60):
                if not port_open(8101):
                    break
                time.sleep(0.5)
            else:
                raise RuntimeError("Owned backend did not terminate")
        elif port_open(8101):
            raise RuntimeError("Recorded PID is no longer owned; refusing termination")
        pid_file.unlink()
    assert not port_open(8101)
    (HERE / "shutdown.json").write_text(
        json.dumps({"time": time.time(), "backend_listening": False})
    )
    print("Owned backend stopped; listening ended")


if __name__ == "__main__":
    command = sys.argv[1]
    if command == "up":
        up()
    elif command == "backend-up":
        start_backend()
    elif command == "backend-stop":
        stop_backend()
    elif command == "restart":
        subprocess.run(
            [PYTHON, str(SOURCE / "database.py"), "before-restart"], check=True
        )
        stop_backend()
        start_backend()
        subprocess.run(
            [PYTHON, str(SOURCE / "database.py"), "after-restart"], check=True
        )
    elif command == "regression":
        raise SystemExit(
            subprocess.run(
                sys.argv[2:], cwd=ROOT / "server", env=environment(True), check=False
            ).returncode
        )
    elif command == "regression-reset":
        label = docker(
            "inspect",
            "--format",
            '{{index .Config.Labels "codex.task"}}',
            POSTGRES,
            capture=True,
        ).stdout.strip()
        assert label == "authenticated-editor-safety-2026-10-11"
        # This one named database is disposable regression data; browser recovery
        # data and every other database/container remain untouched.
        docker(
            "exec",
            POSTGRES,
            "dropdb",
            "-U",
            "postgres",
            "--if-exists",
            REGRESSION_DATABASE,
        )
        docker("exec", POSTGRES, "createdb", "-U", "postgres", REGRESSION_DATABASE)
        print(f"Fresh disposable regression database: {REGRESSION_DATABASE}")
    elif command == "exec":
        raise SystemExit(
            subprocess.run(sys.argv[2:], env=environment(), check=False).returncode
        )
    elif command == "down":
        stop_backend()
        docker("stop", POSTGRES, REDIS)
    else:
        raise SystemExit(
            "Use up, backend-up, backend-stop, restart, regression, exec, down"
        )
