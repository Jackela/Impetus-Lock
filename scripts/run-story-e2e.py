"""Run Chinese Muse/Loki browser checks with real cookie authentication.

DATABASE_URL must identify disposable PostgreSQL data. Every model request is
held or fulfilled at the browser HTTP boundary; no model credentials are loaded.
"""

import os
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "client/test-results/story"


def run() -> None:
    """Migrate isolated data, start owned backend, run normal Chromium and stop it."""
    env = dict(os.environ)
    if not env.get("DATABASE_URL"):
        raise RuntimeError("DATABASE_URL must identify a disposable PostgreSQL database")
    for key in list(env):
        if key == "TESTING" or key.endswith("API_KEY") or key == "LLM_ALLOW_DEBUG_PROVIDER":
            env.pop(key)
    env.update(
        JWT_SECRET=uuid4().hex + uuid4().hex,
        APP_ENV="development",
        ENV="development",
        PYTHON_DOTENV_DISABLED="1",
    )
    # Refuse to mistake another worktree's running backend for this candidate.
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", 8001)) == 0:
            raise RuntimeError("Port 8001 is occupied; stop its owner before running this suite")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    python = str(ROOT / "server/.venv/bin/python")
    subprocess.run(
        [python, "-m", "alembic", "upgrade", "head"],
        cwd=ROOT / "server",
        env=env,
        check=True,
    )
    with (EVIDENCE / "backend.log").open("w") as log:
        backend = subprocess.Popen(
            [
                python,
                "-m",
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
        try:
            deadline = time.monotonic() + 30
            while True:
                if backend.poll() is not None:
                    raise RuntimeError("Backend exited; see client/test-results/story/backend.log")
                try:
                    with urllib.request.urlopen(
                        "http://127.0.0.1:8001/health", timeout=1
                    ) as response:
                        if response.status == 200:
                            break
                except (urllib.error.URLError, TimeoutError):
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Backend readiness timed out") from None
                    time.sleep(0.25)
            subprocess.run(
                ["npx", "playwright", "test", "-c", "playwright.story.config.ts"],
                cwd=ROOT / "client",
                env=env,
                check=True,
            )
        finally:
            if backend.poll() is None:
                backend.terminate()
                try:
                    backend.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    backend.kill()
                    backend.wait(timeout=5)


if __name__ == "__main__":
    run()
