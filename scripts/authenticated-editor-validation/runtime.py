"""Private local validation settings; no user environment or paid credentials."""

import json
import os
import secrets
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[1]
HERE = ROOT / ".scratch/authenticated-editor-safety-2026-10-11/environment"
HERE.mkdir(parents=True, exist_ok=True)
CONTEXT = "colima-impetus-auth-safety"
POSTGRES = "impetus-auth-safety-postgres"
REDIS = "impetus-auth-safety-redis"
DATABASE = "impetus_auth_safety_20261011"
REGRESSION_DATABASE = "impetus_regression_safety_20261011"
API = "http://127.0.0.1:8101"
UI = "http://127.0.0.1:3101"
SECRET_FILE = HERE / ".env.runtime.json"


def private_settings():
    """Keep signing identity stable across this round's real service restarts."""
    if not SECRET_FILE.exists():
        fd = os.open(SECRET_FILE, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w") as handle:
            json.dump(
                {
                    "password": secrets.token_urlsafe(24),
                    "jwt": secrets.token_urlsafe(48),
                    "csrf": secrets.token_urlsafe(48),
                },
                handle,
            )
    return json.loads(SECRET_FILE.read_text())


def environment(regression=False):
    """Create an allowlist environment with real auth and loopback services."""
    settings = private_settings()
    env = {
        key: os.environ[key]
        for key in ("PATH", "HOME", "TMPDIR", "LANG")
        if key in os.environ
    }
    database = REGRESSION_DATABASE if regression else DATABASE
    url = f"postgresql+asyncpg://postgres:{settings['password']}@127.0.0.1:5433/{database}"
    env.update(
        {
            "DATABASE_URL": url,
            "TEST_DATABASE_URL": url,
            "REDIS_URL": f"redis://127.0.0.1:6381/{1 if regression else 0}",
            "JWT_SECRET": settings["jwt"],
            "SECRET_KEY": settings["csrf"],
            "PYTHON_DOTENV_DISABLED": "1",
            "ENV": "production",
            "ALLOWED_ORIGINS": UI,
            "LOG_LEVEL": "WARNING",
            "LLM_DEFAULT_PROVIDER": "debug",
            "LLM_ALLOW_DEBUG_PROVIDER": "1",
            "OTEL_SDK_DISABLED": "true",
            "VITE_API_URL": API,
            "TZ": "UTC",
            "PYTHONPATH": str(ROOT / "server"),
        }
    )
    return env
