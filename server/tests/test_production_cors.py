"""Exercise production and legacy CORS configuration at app import."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

PREFLIGHT = """
import sys
from fastapi.testclient import TestClient
from server.api.main import app

client = TestClient(app)
for origin, allowed in zip(sys.argv[1::2], sys.argv[2::2], strict=True):
    response = client.options(
        "/tasks/",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type, X-CSRF-Token",
        },
    )
    if allowed == "1":
        assert response.status_code == 200, (origin, response.status_code, response.text)
        assert response.headers["Access-Control-Allow-Origin"] == origin
        assert response.headers["Access-Control-Allow-Credentials"] == "true"
    else:
        assert response.status_code == 400, (origin, response.status_code, response.text)
        assert "Access-Control-Allow-Origin" not in response.headers
"""


@pytest.mark.parametrize(
    ("configuration", "allowed"),
    [
        (
            {
                "APP_ENV": "production",
                "CORS_ORIGINS": " https://writer.example , https://ops.example ",
            },
            ("https://writer.example", "https://ops.example"),
        ),
        (
            {"APP_ENV": "production", "ALLOWED_ORIGINS": "https://writer.example"},
            ("https://writer.example",),
        ),
        (
            {"ENV": "production", "ALLOWED_ORIGINS": "https://writer.example"},
            ("https://writer.example",),
        ),
        (
            {"APP_ENV": "production", "CORS_ORIGINS": "*, https://writer.example"},
            ("https://writer.example",),
        ),
        (
            {
                "APP_ENV": "production",
                "ENV": "development",
                "CORS_ORIGINS": "",
                "ALLOWED_ORIGINS": "https://other.example",
            },
            (),
        ),
    ],
    ids=[
        "canonical",
        "production-image-with-legacy-origins",
        "legacy",
        "ignore-wildcard",
        "canonical-precedence",
    ],
)
def test_production_cors_allows_only_configured_origins(
    configuration: dict[str, str], allowed: tuple[str, ...]
) -> None:
    """A new process loads production configuration before its first request."""
    environment = os.environ.copy()
    for variable in ("APP_ENV", "ENV", "CORS_ORIGINS", "ALLOWED_ORIGINS", "TESTING"):
        environment.pop(variable, None)
    environment.update(configuration, PYTHON_DOTENV_DISABLED="1")
    arguments = [arg for origin in allowed for arg in (origin, "1")]
    arguments += ["https://other.example", "0", "http://localhost:5173", "0"]
    result = subprocess.run(
        [sys.executable, "-c", PREFLIGHT, *arguments],
        cwd=Path(__file__).parents[1],
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
