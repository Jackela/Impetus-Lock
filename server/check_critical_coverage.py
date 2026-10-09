"""Enforce executable-line coverage for each file in coverage-critical.ini."""

import argparse
import sys
from pathlib import Path

from coverage import Coverage
from coverage.exceptions import CoverageException


def main() -> int:
    """Reject missing measurements or sub-threshold coverage in the fixed inventory."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rcfile", default="coverage-critical.ini")
    parser.add_argument("--data-file", default=".coverage")
    args = parser.parse_args()
    try:
        coverage = Coverage(config_file=args.rcfile, data_file=args.data_file)
        coverage.load()
        coverage.report()
        expected = coverage.get_option("report:include")
        threshold = coverage.get_option("report:fail_under")
        if not isinstance(expected, list) or not all(isinstance(item, str) for item in expected):
            raise ValueError("Critical coverage inventory must be a list of filenames")
        if not isinstance(threshold, (int, float)):
            raise ValueError("Critical coverage threshold must be numeric")
        measured = {Path(filename).resolve() for filename in coverage.get_data().measured_files()}
        failed = False
        for filename in expected:
            source = Path(filename).resolve()
            if source not in measured:
                sys.stderr.write(f"FAIL {filename}: no coverage measurement\n")
                failed = True
                continue
            _, statements, _, missing, _ = coverage.analysis2(str(source))
            percent = 100 * (len(statements) - len(missing)) / len(statements) if statements else 0
            if percent < threshold:
                sys.stderr.write(f"FAIL {filename}: {percent:.2f}% < {threshold:g}%\n")
                failed = True
        return 2 if failed else 0
    except (CoverageException, ValueError) as exc:
        sys.stderr.write(f"Critical coverage unavailable: {exc}\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
