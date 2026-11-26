"""Exercise the public development entry points in isolated checkout copies."""

import contextlib
import hashlib
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parents[1]
TOOLS = """#!/usr/bin/env python3
import json
import os
from pathlib import Path
import subprocess
import sys

name = Path(sys.argv[0]).name
args = sys.argv[1:]
if name in ("docker", "docker-compose", "rsync", "pgrep"):
    with open(os.environ["TOOL_LOG"], "a") as log:
        print(name, *args, file=log)
    if name == "pgrep":
        sys.exit(1)
if name == "docker" and os.environ.get("DOCKER_FIXTURE"):
    fixture = Path(os.environ["DOCKER_FIXTURE"])
    containers = json.loads(fixture.read_text())
    if args[0] == "info":
        print("fixture-engine")
    elif args[0] == "ps":
        for container_id, container in containers.items():
            print(container_id, container["Name"])
    elif args[0] == "inspect":
        print(json.dumps([containers[args[-1]]]))
    elif args[0] == "stop":
        containers[args[-1]]["State"]["Running"] = False
        fixture.write_text(json.dumps(containers))
    elif args[0] == "rm":
        del containers[args[-1]]
        fixture.write_text(json.dumps(containers))
    sys.exit(0)
elif args[0] == "install" and os.environ.get("FAIL_INSTALL"):
    sys.exit(42)
elif args[:2] == ["run", "uvicorn"] or args[:2] == ["run", "dev"]:
    import time
    port = args[args.index("--port") + 1]
    server = subprocess.Popen([sys.executable, "-m", "http.server", port, "--bind", "127.0.0.1"])
    if name == "npm" and os.environ.get("FAIL_FRONTEND_FILE"):
        while not Path(os.environ["FAIL_FRONTEND_FILE"]).exists():
            time.sleep(0.05)
        sys.exit(42)
    sys.exit(server.wait())
"""


def available_port():
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def listening(port):
    with socket.socket() as probe:
        probe.settimeout(0.2)
        return probe.connect_ex(("127.0.0.1", port)) == 0


def wait_for(check, description):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if check():
            return
        time.sleep(0.05)
    raise AssertionError(f"Timed out waiting for {description}")


class DevHelpersTest(unittest.TestCase):
    def setUp(self):
        self.work = Path(self.enterContext(tempfile.TemporaryDirectory())).resolve()
        self.tools = self.work / "bin"
        self.tools.mkdir()
        self.log = self.work / "tools.log"
        self.log.touch()
        for name in ("docker", "docker-compose", "rsync", "pgrep", "poetry", "npm"):
            tool = self.tools / name
            tool.write_text(TOOLS)
            tool.chmod(0o755)
        self.project = self.checkout("project")

    def checkout(self, name):
        path = self.work / name
        (path / "scripts").mkdir(parents=True)
        for script in SCRIPTS.glob("dev-*"):
            if script.is_file():
                shutil.copy2(script, path / "scripts" / script.name)
        shutil.copy2(SCRIPTS / "act-sync.sh", path / "scripts" / "act-sync.sh")
        (path / "server").mkdir()
        (path / "client").mkdir()
        return path

    def env(self, backend, frontend=None, **override):
        env = dict(
            os.environ,
            PATH=f"{self.tools}{os.pathsep}{os.environ['PATH']}",
            TOOL_LOG=str(self.log),
            AUTO_START_POSTGRES="0",
            AUTO_START_FRONTEND="1" if frontend else "0",
            API_HOST="127.0.0.1",
            BACKEND_PORT=str(backend),
            FRONTEND_HOST="127.0.0.1",
            FRONTEND_PORT=str(frontend or available_port()),
        )
        env.update(override)
        return env

    def script(self, project, script, env, *args, direct=False):
        command = [f"./scripts/{script}", *args]
        return subprocess.run(
            command if direct else ["bash", *command],
            cwd=project,
            env=env,
            text=True,
            capture_output=True,
            timeout=20,
            check=False,
        )

    @contextlib.contextmanager
    def process(self, command, cwd, env=None):
        with tempfile.TemporaryFile(mode="w+") as log:
            process = subprocess.Popen(
                command,
                cwd=cwd,
                env=env,
                stdout=log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            try:
                yield process
            except Exception:
                log.seek(0)
                print(log.read(), file=sys.stderr)
                raise
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=8)
                    except subprocess.TimeoutExpired:
                        process.kill()
                process.wait(timeout=5)

    def listener(self, port):
        command = [
            sys.executable,
            "-m",
            "http.server",
            str(port),
            "--bind",
            "127.0.0.1",
        ]
        process = self.enterContext(self.process(command, self.work))
        wait_for(lambda: listening(port), f"unrelated listener on {port}")
        return process

    def docker_fixture(self, *containers):
        fixture = self.work / "docker-fixture.json"
        fixture.write_text(json.dumps(dict(containers)))
        return fixture

    def container(self, name, port, labels=None):
        return {
            "Name": name,
            "Config": {"Labels": labels},
            "HostConfig": {
                "PortBindings": {
                    "5432/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}]
                }
            },
            "State": {"Running": True},
        }

    def test_occupied_port_fails_without_killing_listener(self):
        port = available_port()
        self.listener(port)
        result = self.script(
            self.project, "dev-start.sh", self.env(port, FAIL_INSTALL="1")
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertTrue(listening(port), result.stdout + result.stderr)
        self.assertIn(str(port), result.stderr)

    def test_stop_ignores_unverified_pid_and_does_not_prune(self):
        port = available_port()
        listener = self.listener(port)
        (self.project / "server" / ".backend.pid").write_text(f"{listener.pid}\n")
        (self.project / "docker-compose.yml").touch()
        result = self.script(self.project, "dev-stop.sh", self.env(port), "--clean")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertTrue(listening(port), result.stdout + result.stderr)
        self.assertEqual(self.log.read_text(), "")

    def test_start_requires_explicit_opt_in_to_unmanaged_postgres(self):
        port, postgres_port = available_port(), available_port()
        fixture = self.docker_fixture(
            ("a" * 64, self.container("legacy", postgres_port))
        )
        result = self.script(
            self.project,
            "dev-start.sh",
            self.env(
                port,
                AUTO_START_POSTGRES="1",
                POSTGRES_PORT=str(postgres_port),
                POSTGRES_CONTAINER_NAME="legacy",
                DOCKER_FIXTURE=str(fixture),
                FAIL_INSTALL="1",
            ),
            direct=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("AUTO_START_POSTGRES=0", result.stderr)
        self.assertNotIn("docker exec", self.log.read_text())

    def test_clean_checks_docker_labels_and_only_removes_recorded_container(self):
        port = available_port()
        owned_id, another_id = "a" * 64, "b" * 64
        owner = hashlib.sha256(os.fsencode(self.project)).hexdigest()
        label = "io.github.jackela.impetus-lock.dev-checkout"
        fixture = self.docker_fixture(
            (owned_id, self.container("owned", port, {label: owner})),
            (another_id, self.container("external", port)),
        )
        state = self.project / "tmp" / "impetus-dev"
        state.mkdir(parents=True)
        for key in (owned_id, another_id):
            (state / f"postgres.{key}").write_text("fixture-engine\n")
        result = self.script(
            self.project,
            "dev-stop.sh",
            self.env(port, DOCKER_FIXTURE=str(fixture)),
            "--clean",
            direct=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("lacks this checkout's ownership label", result.stderr)
        self.assertFalse((state / f"postgres.{owned_id}").exists())
        self.assertTrue(json.loads(fixture.read_text())[another_id]["State"]["Running"])
        mutations = [
            line
            for line in self.log.read_text().splitlines()
            if line.startswith(("docker stop ", "docker rm "))
        ]
        self.assertEqual(
            mutations, [f"docker stop {owned_id}", f"docker rm --volumes {owned_id}"]
        )

    def test_checkout_stop_leaves_other_checkout_and_listener(self):
        other = self.checkout("other checkout")
        backend, frontend, other_port, unused_listener = (
            available_port() for _ in range(4)
        )
        self.listener(unused_listener)
        env = self.env(backend, frontend)
        other_env = self.env(other_port)
        start = ["./scripts/dev-start.sh"]
        with self.process(start, other, other_env) as other_process:
            wait_for(lambda: listening(other_port), "second checkout")
            with self.process(start, self.project, env) as project_process:
                wait_for(
                    lambda: listening(backend) and listening(frontend), "both services"
                )
                for pid_file in ("server/.backend.pid", "client/.frontend.pid"):
                    self.assertGreater(int((self.project / pid_file).read_text()), 1)
                duplicate = self.script(self.project, "dev-start.sh", env, direct=True)
                self.assertNotEqual(duplicate.returncode, 0)
                result = self.script(self.project, "dev-stop.sh", env, direct=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(project_process.wait(timeout=10), 0)
                self.assertFalse(listening(backend))
                self.assertFalse(listening(frontend))
                self.assertTrue(listening(other_port))
                self.assertTrue(listening(unused_listener))
            result = self.script(other, "dev-stop.sh", other_env, direct=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertEqual(other_process.wait(timeout=10), 0)

    def test_service_exit_cleans_up_both_process_groups(self):
        backend, frontend = available_port(), available_port()
        fail = self.work / "fail-frontend"
        env = self.env(backend, frontend, FAIL_FRONTEND_FILE=str(fail))
        with self.process(
            ["./scripts/dev-start.sh"], self.project, env
        ) as project_process:
            wait_for(
                lambda: listening(backend) and listening(frontend), "both services"
            )
            fail.touch()
            self.assertNotEqual(project_process.wait(timeout=10), 0)
            self.assertFalse(listening(backend))
            self.assertFalse(listening(frontend))
            self.assertFalse((self.project / "server" / ".backend.pid").exists())
            self.assertFalse((self.project / "client" / ".frontend.pid").exists())

    def test_launcher_sigkill_releases_its_services(self):
        port = available_port()
        env = self.env(port)
        with self.process(
            ["./scripts/dev-start.sh"], self.project, env
        ) as project_process:
            wait_for(lambda: listening(port), "backend")
            owner_pid = int((self.project / "server" / ".backend.pid").read_text())
            try:
                project_process.kill()
                project_process.wait(timeout=5)
                result = self.script(self.project, "dev-stop.sh", env, direct=True)
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertFalse(listening(port))
            finally:
                if listening(port):
                    os.killpg(owner_pid, signal.SIGKILL)

    def test_act_sync_does_not_manage_postgres(self):
        env = self.env(
            available_port(),
            ACT_WORKSPACE=str(self.work / "act"),
            ACT_CACHE_DIR=str(self.work / "act-cache"),
            ACT_LOG_PATH=str(self.work / "act.log"),
        )
        result = self.script(self.project, "act-sync.sh", env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("docker", self.log.read_text())

    def test_documented_scripts_are_executable(self):
        for script in ("dev-start.sh", "dev-stop.sh", "act-sync.sh"):
            with self.subTest(script=script):
                self.assertTrue(os.access(self.project / "scripts" / script, os.X_OK))


if __name__ == "__main__":
    unittest.main()
