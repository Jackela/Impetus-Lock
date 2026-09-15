"""Tests for the backend's public dependency installation contract."""

import tomllib
from pathlib import Path

import pytest
from packaging.markers import Marker

LOCK_FILE = Path(__file__).parents[1] / "poetry.lock"


def _greenlet_marker() -> Marker | None:
    with LOCK_FILE.open("rb") as lock_file:
        packages = tomllib.load(lock_file)["package"]

    greenlet = next(
        (package for package in packages if package.get("name") == "greenlet"),
        None,
    )
    assert greenlet is not None, "greenlet must be present in the Poetry lock file"

    marker = greenlet.get("markers")
    return Marker(marker) if marker else None


@pytest.mark.parametrize(
    ("environment", "interpreter"),
    [
        (
            {
                "implementation_name": "cpython",
                "platform_machine": "arm64",
                "platform_system": "Darwin",
                "python_full_version": "3.12.0",
                "python_version": "3.12",
                "sys_platform": "darwin",
            },
            "Darwin arm64 Python 3.12",
        ),
        (
            {
                "implementation_name": "cpython",
                "platform_machine": "x86_64",
                "platform_system": "Linux",
                "python_full_version": "3.11.0",
                "python_version": "3.11",
                "sys_platform": "linux",
            },
            "Linux x86_64 Python 3.11",
        ),
    ],
)
def test_greenlet_is_installable_for_supported_interpreters(
    environment: dict[str, str], interpreter: str
) -> None:
    """The public greenlet requirement must select both supported environments."""
    marker = _greenlet_marker()

    assert marker is None or marker.evaluate(
        environment
    ), f"greenlet dependency marker excludes {interpreter}: {marker}"
