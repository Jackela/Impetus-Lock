"""Exercise the critical coverage gate through the public guard and coverage.py reporter."""

import subprocess
import sys
from pathlib import Path

import pytest
from coverage import CoverageData

# R19's fixed inventory is independent of the reporter config so a removed
# entry cannot silently reduce the fixture's expected critical scope.
CRITICAL_FILES = (
    "server/application/services/intervention_service.py",
    "server/domain/models/intervention.py",
    "server/domain/models/anchor.py",
    "server/domain/text_window.py",
    "server/infrastructure/llm/base_provider.py",
    "server/infrastructure/llm/debug_provider.py",
    "server/api/routes/intervention.py",
    "server/infrastructure/cache/idempotency_cache.py",
    "server/domain/entities/task.py",
    "server/domain/entities/intervention_action.py",
    "server/infrastructure/persistence/postgresql_task_repository.py",
    "server/infrastructure/persistence/in_memory_task_repository.py",
    "server/infrastructure/persistence/models.py",
    "server/models/task.py",
    "server/api/routes/tasks.py",
    "server/application/services/task_service.py",
)


def test_critical_coverage_gate_rejects_low_file_despite_passing_aggregate(tmp_path: Path) -> None:
    """Reject a 50% critical file even when fully covered peers lift the total above 80%."""
    low_file = "server/infrastructure/llm/base_provider.py"
    data_file = tmp_path / ".coverage"
    data = CoverageData(basename=str(data_file))
    for relative_path in CRITICAL_FILES:
        source = tmp_path / relative_path
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text("first = 1\nsecond = 2\n", encoding="utf-8")
        data.add_lines({str(source): [1] if relative_path == low_file else [1, 2]})
    data.write()

    config = Path(__file__).resolve().parents[1] / "coverage-critical.ini"
    command = [
        sys.executable,
        str(config.parent / "check_critical_coverage.py"),
        f"--rcfile={config}",
        f"--data-file={data_file}",
    ]
    report = subprocess.run(
        command,
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    output = report.stdout + report.stderr
    rows = {line.split()[0]: line.split() for line in report.stdout.splitlines() if line.strip()}
    assert float(rows[low_file][-2].rstrip("%")) == 50, output
    assert float(rows["server/domain/text_window.py"][-1].rstrip("%")) == 100, output
    assert float(rows["TOTAL"][-1].rstrip("%")) >= 80, output
    fixture_coverage = "\n".join(
        f"{path}: {50 if path == low_file else 100}%" for path in CRITICAL_FILES
    )
    assert report.returncode != 0, (
        "The critical coverage CLI must reject base_provider.py at 50% even when TOTAL >= 80%.\n"
        f"CLI command: {command}\nCLI working directory: {tmp_path}\n"
        f"Fixture CoverageData input (not product coverage):\n{fixture_coverage}\n"
        f"Actual CLI exit: {report.returncode}\n{output}"
    )


@pytest.mark.parametrize(
    ("covered_lines", "expected_percent", "expected_exit"),
    [([1], 50, 2), ([1, 2], 100, 0)],
    ids=["reject-half-covered-critical-code", "accept-fully-covered-critical-code"],
)
def test_critical_coverage_report_enforces_threshold(
    tmp_path: Path,
    covered_lines: list[int],
    expected_percent: int,
    expected_exit: int,
) -> None:
    """Reject low line coverage and accept complete coverage of critical code."""
    source = tmp_path / "server/domain/text_window.py"
    source.parent.mkdir(parents=True)
    source.write_text("first = 1\nsecond = 2\n", encoding="utf-8")
    data_file = tmp_path / ".coverage"
    data = CoverageData(basename=str(data_file))
    data.add_lines({str(source): covered_lines})
    data.write()

    server_root = Path(__file__).resolve().parents[1]
    config = server_root / "coverage-critical.ini"
    if not config.exists():
        # The baseline gate is the effective fallback if the critical gate is absent.
        config = server_root / "pyproject.toml"
    report = subprocess.run(
        [
            sys.executable,
            "-m",
            "coverage",
            "report",
            f"--rcfile={config}",
            f"--data-file={data_file}",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    output = report.stdout + report.stderr
    assert "text_window.py" in output, output
    total = next(line for line in report.stdout.splitlines() if line.startswith("TOTAL"))
    assert float(total.split()[-1].rstrip("%")) == expected_percent, output
    assert report.returncode == expected_exit, (
        f"Critical coverage must reject 50% and accept 100%; using {config.name}:\n{output}"
    )


@pytest.mark.parametrize("state", ["absent-source", "unmeasured-source", "unexecuted"])
def test_critical_coverage_gate_rejects_missing_expected_file(tmp_path: Path, state: str) -> None:
    """Fully covered peers cannot hide an absent or unexecuted expected file."""
    missing_file = "server/application/services/task_service.py"
    data_file = tmp_path / ".coverage"
    data = CoverageData(basename=str(data_file))
    for relative_path in CRITICAL_FILES:
        source = tmp_path / relative_path
        if relative_path == missing_file and state == "absent-source":
            continue
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text("first = 1\nsecond = 2\n", encoding="utf-8")
        if relative_path != missing_file:
            data.add_lines({str(source): [1, 2]})
        elif state == "unexecuted":
            data.add_lines({str(source): []})
    data.write()
    config = Path(__file__).resolve().parents[1] / "coverage-critical.ini"
    report = subprocess.run(
        [
            sys.executable,
            str(config.parent / "check_critical_coverage.py"),
            f"--rcfile={config}",
            f"--data-file={data_file}",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    output = report.stdout + report.stderr
    assert report.returncode != 0, output
    assert missing_file in output, output


@pytest.mark.parametrize("covered_lines", [[1, 2, 3, 4], [1, 2, 3, 4, 5]], ids=["80", "100"])
def test_critical_coverage_gate_accepts_complete_inventory(
    tmp_path: Path, covered_lines: list[int]
) -> None:
    """Every expected file is reported and passes at or above 80% executable lines."""
    data_file = tmp_path / ".coverage"
    data = CoverageData(basename=str(data_file))
    for relative_path in CRITICAL_FILES:
        source = tmp_path / relative_path
        source.parent.mkdir(parents=True, exist_ok=True)
        source.write_text("a = 1\nb = 2\nc = 3\nd = 4\ne = 5\n", encoding="utf-8")
        data.add_lines({str(source): covered_lines})
    data.write()
    config = Path(__file__).resolve().parents[1] / "coverage-critical.ini"
    report = subprocess.run(
        [
            sys.executable,
            str(config.parent / "check_critical_coverage.py"),
            f"--rcfile={config}",
            f"--data-file={data_file}",
        ],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        check=False,
        timeout=30,
    )
    output = report.stdout + report.stderr
    assert report.returncode == 0, output
    rows = {line.split()[0] for line in report.stdout.splitlines() if line.startswith("server/")}
    assert rows == set(CRITICAL_FILES), output
