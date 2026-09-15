"""Exercise the critical coverage gate through coverage.py's public reporter."""

import subprocess
import sys
from pathlib import Path

import pytest
from coverage import CoverageData


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
