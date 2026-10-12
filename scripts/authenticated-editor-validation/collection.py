"""Record collected, deselected, ignored, skipped and failed backend tests."""

import importlib.util
import json
import sys
from collections import Counter

import pytest
from runtime import HERE


class CollectionAudit:
    """Capture actual pytest hooks; missing optional SDKs are explicit evidence."""

    def __init__(self):
        self.collected = []
        self.deselected = []
        self.ignored = []
        self.reports = []

    @pytest.hookimpl(hookwrapper=True)
    def pytest_ignore_collect(self, collection_path, config):
        """Observe ignore decisions from both default and repository hooks."""
        outcome = yield
        if outcome.get_result():
            self.ignored.append(str(collection_path))

    def pytest_deselected(self, items):
        """Record exclusions rather than silently losing them from the count."""
        self.deselected.extend(item.nodeid for item in items)

    def pytest_collection_finish(self, session):
        """Record the final executable inventory and declared skip markers."""
        self.collected = [
            {
                "nodeid": item.nodeid,
                "markers": [mark.name for mark in item.iter_markers()],
                "skip_markers": [
                    {
                        "name": mark.name,
                        "args": [str(arg) for arg in mark.args],
                        "reason": mark.kwargs.get("reason"),
                    }
                    for mark in item.iter_markers()
                    if mark.name in {"skip", "skipif"}
                ],
            }
            for item in session.items
        ]

    def pytest_runtest_logreport(self, report):
        """Keep runtime skips and errors, including setup failures."""
        if report.when == "call" or report.outcome in {"failed", "skipped"}:
            self.reports.append(
                {
                    "nodeid": report.nodeid,
                    "phase": report.when,
                    "outcome": report.outcome,
                    "reason": str(report.longrepr)
                    if report.outcome != "passed"
                    else None,
                }
            )

    def pytest_sessionfinish(self, session, exitstatus):
        """Save counts and evidence even when collection or tests fail."""
        optional = {}
        for name in ("openai", "anthropic", "google.genai", "hypothesis"):
            try:
                optional[name] = importlib.util.find_spec(name) is not None
            except ImportError:
                optional[name] = False
        (HERE / "backend-collection.json").write_text(
            json.dumps(
                {
                    "exitstatus": int(exitstatus),
                    "collected_count": len(self.collected),
                    "deselected_count": len(self.deselected),
                    "optional_dependencies": optional,
                    "outcomes": dict(Counter(row["outcome"] for row in self.reports)),
                    "collected": self.collected,
                    "deselected": self.deselected,
                    "ignored_paths": self.ignored,
                    "reports": self.reports,
                },
                indent=2,
            )
        )


raise SystemExit(pytest.main(sys.argv[1:], plugins=[CollectionAudit()]))
