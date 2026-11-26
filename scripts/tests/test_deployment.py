"""Regression checks for the deployment entry points without a real server."""

import os
import shutil
import subprocess
import tempfile
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

SCRIPTS = Path(__file__).resolve().parents[1]


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.scripts = self.root / "scripts"
        self.scripts.mkdir()
        for script in (*SCRIPTS.glob("deploy-*.sh"), *SCRIPTS.glob("deployment.py")):
            shutil.copy(script, self.scripts)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.calls = self.root / "docker.calls"
        docker = '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DEPLOY_TEST_CALLS"\n'
        self.stub("docker", docker)
        self.stub("docker-compose", docker)
        (self.root / "docker-compose.prod.yml").touch()
        (self.root / ".env.staging").touch()

    def stub(self, name, text):
        path = self.bin / name
        path.write_text(text)
        path.chmod(0o755)

    def command(self, *command, stdin=None):
        return subprocess.run(
            command,
            env={
                **os.environ,
                "PATH": f"{self.bin}{os.pathsep}{os.environ['PATH']}",
                "DEPLOY_DIR": str(self.root),
                "DEPLOY_TEST_CALLS": str(self.calls),
            },
            cwd=self.root,
            input=stdin,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_missing_rollback_record_leaves_running_services_untouched(self):
        """A rollback without an observed previous release has no target."""
        result = self.command(
            "bash", str(self.scripts / "deploy-staging.sh"), "--rollback"
        )
        docker_calls = self.calls.read_text() if self.calls.exists() else ""
        self.assertNotIn(" down", docker_calls, result.stdout)
        self.assertNotIn(" up ", docker_calls, result.stdout)
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("No previous verified release is recorded", result.stderr)
        self.assertFalse(self.calls.exists(), docker_calls)

    def test_failed_frontend_test_stops_production_before_build(self):
        """A failed local production gate must prevent side effects."""
        for directory in ("server", "client"):
            (self.root / directory).mkdir()
        (self.root / ".env.production").write_text(
            "POSTGRES_PASSWORD=fixture\nREDIS_PASSWORD=fixture\nSECRET_KEY=fixture\n"
        )
        self.stub("poetry", "#!/bin/sh\nexit 0\n")
        self.stub("npm", "#!/bin/sh\nexit 17\n")
        self.stub(
            "git",
            """#!/bin/sh
case "$*" in
  *'branch --show-current'*) echo main ;;
  *'rev-parse'*|*'describe'*) echo 1111111111111111111111111111111111111111 ;;
  *'diff --quiet'*) exit 0 ;;
  *) printf 'unexpected git path: %s\\n' "$*" >&2; exit 91 ;;
esac
""",
        )
        result = self.command(
            "bash", str(self.scripts / "deploy-production.sh"), stdin="yes\n"
        )
        self.assertEqual(result.returncode, 17, result.stdout + result.stderr)
        self.assertFalse(
            self.calls.exists(), self.calls.read_text() if self.calls.exists() else ""
        )

    def test_database_http_200_needs_json_boolean_true(self):
        """A responding process is ready only if the database boolean is true."""
        payload = {
            "/health": b"healthy\n",
            "/api/health": b'{"status":"ok"}',
            "/api/health/db": b'{"is_healthy":false}',
        }

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(payload[self.path])

            def log_message(self, *args):
                pass

        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            thread = Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                command = (
                    "python3",
                    str(self.scripts / "deployment.py"),
                    "staging",
                    "check-ready",
                    "--url",
                    f"http://127.0.0.1:{server.server_port}",
                )
                result = self.command(*command)
                self.assertNotEqual(result.returncode, 0, result.stdout)
                self.assertIn("Database readiness check failed", result.stderr)
                payload["/api/health/db"] = b'{"is_healthy":"true"}'
                self.assertNotEqual(self.command(*command).returncode, 0)
                payload["/api/health/db"] = b'{"is_healthy":true}'
                result = self.command(*command)
                self.assertEqual(result.returncode, 0, result.stderr)
            finally:
                server.shutdown()
                thread.join()


if __name__ == "__main__":
    unittest.main()
