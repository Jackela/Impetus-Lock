"""Run real-cookie browser checks against an isolated PostgreSQL database.

Requires DATABASE_URL for a disposable database. Migrations are applied before
starting the backend, and a real authenticated task is seeded before a backend
restart. Authentication bypasses and model credentials are removed.
"""

import http.cookiejar
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.error
import urllib.request
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
API = "http://127.0.0.1:8001"
EVIDENCE = ROOT / "client/test-results/authenticated-editor"


def run() -> None:
    """Migrate, seed, restart, and verify with normal Chromium security."""
    env = dict(os.environ)
    if not env.get("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL must identify an isolated PostgreSQL database")
    for key in list(env):
        if key in {"TESTING", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"}:
            env.pop(key)
    env["JWT_SECRET"] = uuid4().hex + uuid4().hex
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["poetry", "run", "alembic", "upgrade", "head"], cwd=ROOT / "server", env=env, check=True
    )
    log = (EVIDENCE / "backend.log").open("w")
    backend = None

    def start() -> subprocess.Popen:
        process = subprocess.Popen(
            [
                "poetry",
                "run",
                "uvicorn",
                "server.api.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8001",
            ],
            cwd=ROOT / "server",
            env=env,
            stdout=log,
            stderr=log,
        )
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError(
                    "Backend exited; see test-results/authenticated-editor/backend.log"
                )
            try:
                with urllib.request.urlopen(API + "/health", timeout=1) as response:
                    if response.status == 200:
                        return process
            except (urllib.error.URLError, TimeoutError):
                time.sleep(0.25)
        process.terminate()
        process.wait(timeout=30)
        raise RuntimeError("Backend readiness timed out")

    try:
        backend = start()
        cookies = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookies))

        def post(path: str, body: dict) -> dict:
            headers = {"Content-Type": "application/json"}
            for cookie in cookies:
                if cookie.name == "csrf_token":
                    headers["X-CSRF-Token"] = cookie.value
            request = urllib.request.Request(
                API + path, data=json.dumps(body).encode(), headers=headers, method="POST"
            )
            with opener.open(request, timeout=30) as response:
                return json.load(response)

        email = f"restart-{uuid4()}@example.com"
        post("/auth/register", {"email": email, "password": "localAuthPass!2026"})
        content = "# Persisted writing\n\nProtected browser lock <!-- lock:lock_restart -->\n"
        task = post(
            "/tasks/",
            {"content": content, "lock_ids": ["lock_restart"], "title": "Restart durability"},
        )
        (EVIDENCE / "browser-persisted-before-restart.json").write_text(
            json.dumps(
                {
                    "email": email,
                    "taskId": task["id"],
                    "content": task["content"],
                    "lockIds": task["lock_ids"],
                    "version": task["version"],
                }
            )
        )
        backend.terminate()
        backend.wait(timeout=30)
        backend = start()
        subprocess.run(["npm", "run", "test:e2e:auth"], cwd=ROOT / "client", env=env, check=True)
    finally:
        if backend is not None and backend.poll() is None:
            backend.terminate()
            backend.wait(timeout=30)
        log.close()


if __name__ == "__main__":
    run()
