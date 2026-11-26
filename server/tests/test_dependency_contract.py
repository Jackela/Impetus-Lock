"""Tests for the backend's public dependency installation contract."""

import tomllib
from importlib.metadata import requires, version
from pathlib import Path
from typing import Any

import pytest
from packaging.markers import Marker
from packaging.requirements import Requirement
from packaging.tags import cpython_tags
from packaging.utils import parse_wheel_filename
from packaging.version import Version

LOCK_FILE = Path(__file__).parents[1] / "poetry.lock"


def _locked_package(name: str) -> dict[str, Any]:
    with LOCK_FILE.open("rb") as lock_file:
        packages = tomllib.load(lock_file)["package"]

    package = next((package for package in packages if package["name"] == name), None)
    assert package is not None, f"{name} must be present in the Poetry lock file"
    return package


@pytest.mark.parametrize("dependent", ["impetus-lock-server", "instructor"])
def test_installed_jiter_meets_active_requirements(dependent: str) -> None:
    """Check jiter against the requirements for the interpreter running the tests."""
    installed = Version(version("jiter"))
    for requirement in map(Requirement, requires(dependent) or []):
        marker = requirement.marker
        if requirement.name != "jiter" or (marker and not marker.evaluate()):
            continue
        assert installed in requirement.specifier, (
            f"{dependent} requires {requirement}, installed jiter {installed}"
        )


@pytest.mark.parametrize(
    ("system", "machine", "platform_prefix", "architectures"),
    [
        ("Linux", "x86_64", "manylinux", ("_x86_64",)),
        ("Linux", "aarch64", "manylinux", ("_aarch64",)),
        ("Darwin", "arm64", "macosx_", ("_arm64", "_universal2")),
    ],
    ids=["linux-x86_64", "linux-aarch64", "macos-arm64"],
)
def test_locked_jiter_has_python_315_wheels(
    system: str, machine: str, platform_prefix: str, architectures: tuple[str, ...]
) -> None:
    """The production lock selects a jiter with wheels for all supported 3.15 targets."""
    with LOCK_FILE.open("rb") as lock_file:
        packages = tomllib.load(lock_file)["package"]

    environment = {
        "implementation_name": "cpython",
        "platform_python_implementation": "CPython",
        "platform_machine": machine,
        "platform_system": system,
        "python_full_version": "3.15.0",
        "python_version": "3.15",
        "sys_platform": "linux" if system == "Linux" else "darwin",
    }
    matches = []
    for package in packages:
        if package["name"] != "jiter" or "main" not in package["groups"]:
            continue
        markers = package.get("markers")
        if isinstance(markers, dict):
            markers = markers.get("main")
        if not markers or Marker(markers).evaluate(environment):
            matches.append(package)
    assert len(matches) == 1, f"Expected one jiter entry for CPython 3.15 on {system} {machine}"

    tags = {
        tag
        for artifact in matches[0]["files"]
        if artifact["file"].endswith(".whl")
        for tag in parse_wheel_filename(artifact["file"])[3]
    }
    platforms = {
        tag.platform
        for tag in tags
        if tag.platform.startswith(platform_prefix) and tag.platform.endswith(architectures)
    }
    assert tags.intersection(cpython_tags((3, 15), abis=["cp315"], platforms=platforms)), (
        f"jiter {matches[0]['version']} has no CPython 3.15 wheel for {system} {machine}"
    )


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
    greenlet = _locked_package("greenlet")
    marker = Marker(greenlet["markers"]) if "markers" in greenlet else None

    assert marker is None or marker.evaluate(environment), (
        f"greenlet dependency marker excludes {interpreter}: {marker}"
    )


@pytest.mark.parametrize(
    ("package", "minimum"),
    [
        ("cryptography", "50.0.2"),
        ("opentelemetry-api", "1.45.2"),
        ("opentelemetry-sdk", "1.45.2"),
        ("opentelemetry-exporter-otlp-proto-http", "1.45.2"),
        ("pytest", "9.0.3"),
    ],
)
def test_lock_retains_reviewed_security_updates(package: str, minimum: str) -> None:
    """Prevent the lock from selecting a release below the reviewed security floor."""
    locked = _locked_package(package)["version"]

    assert Version(locked) >= Version(minimum), f"{package} locked at {locked}, need {minimum}+"
