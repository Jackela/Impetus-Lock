"""Offline synthetic stories exercise contracts, not creative gold answers."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from story_eval import check_record, export_inputs, load_cases, render_context  # noqa: E402


@pytest.fixture
def shallow_story_checkout(tmp_path: Path) -> Path:
    """Exercise the current CLI with tracked files but no original Git history."""
    checkout = tmp_path / "shallow"
    subprocess.run(
        ["git", "clone", "--depth=1", "--no-local", ROOT.as_uri(), str(checkout)],
        check=True,
        capture_output=True,
    )
    missing = subprocess.run(
        [
            "git",
            "-C",
            str(checkout),
            "cat-file",
            "-e",
            "cdb868dcf913326b2f1e0d663f12a277fc4c6b0a^{commit}",
        ],
        capture_output=True,
    )
    assert missing.returncode != 0
    # Include the candidate script while preserving the actual shallow repository.
    shutil.copyfile(ROOT / "scripts/story_eval.py", checkout / "scripts/story_eval.py")
    return checkout


def test_export_preserves_pinned_baseline_in_shallow_checkout(
    shallow_story_checkout: Path, tmp_path: Path
) -> None:
    """A CI-style checkout can export without substituting current prompts."""
    target = tmp_path / "export.json"
    outcome = subprocess.run(
        [
            sys.executable,
            str(shallow_story_checkout / "scripts/story_eval.py"),
            "export",
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
    )
    assert outcome.returncode == 0, outcome.stdout + outcome.stderr
    exported = json.loads(target.read_text())
    assert len(exported["inputs"]) == 80
    baseline = [row for row in exported["inputs"] if row["template_variant"] == "baseline"]
    assert {row["template_source_sha"] for row in baseline} == {
        "cdb868dcf913326b2f1e0d663f12a277fc4c6b0a"
    }
    assert {row["mode"]: row["template_digest"] for row in baseline} == {
        "muse": "e81eb925331e8f315201e45b592330bb7e3a6922c2975e600a1360a81521c2c3",
        "loki": "0ce7066693828e877a4c4946dd22c1963167ab9629555dd8e7cb190f3fc1cbc7",
    }
    assert exported["baseline_verification"] == {
        "muse": "pinned_snapshot_digest",
        "loki": "pinned_snapshot_digest",
    }


def test_shallow_comparison_keeps_outputs_empty_and_baseline_pinned(
    shallow_story_checkout: Path, tmp_path: Path
) -> None:
    """Anonymous review materials remain usable and unassessed in shallow CI."""
    target = tmp_path / "comparison"
    outcome = subprocess.run(
        [
            sys.executable,
            str(shallow_story_checkout / "scripts/story_eval.py"),
            "compare",
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
    )
    assert outcome.returncode == 0, outcome.stdout + outcome.stderr
    cards = json.loads((target / "review_cards.json").read_text())["cards"]
    assert len(cards) == 40
    assert all(card["A"] is None and card["B"] is None for card in cards)
    exported = json.loads((target / "identity_key.json").read_text())["export"]
    assert exported["baseline_verification"] == {
        "muse": "pinned_snapshot_digest",
        "loki": "pinned_snapshot_digest",
    }
    assert exported["real_model_status"] == "unassessed"


@pytest.mark.parametrize("mode", ["muse", "loki"])
@pytest.mark.parametrize("command", ["export", "compare"])
def test_modified_baseline_snapshot_is_rejected_without_history(
    shallow_story_checkout: Path, tmp_path: Path, mode: str, command: str
) -> None:
    """Missing history never legitimizes an edited baseline snapshot."""
    snapshot = shallow_story_checkout / f"eval/chinese_stories/baseline/{mode}.toml"
    snapshot.write_bytes(snapshot.read_bytes() + b"\n# changed snapshot\n")
    target = tmp_path / "result"
    outcome = subprocess.run(
        [
            sys.executable,
            str(shallow_story_checkout / "scripts/story_eval.py"),
            command,
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
    )
    assert outcome.returncode == 2, outcome.stdout + outcome.stderr
    report = json.loads((target / "error.json" if command == "compare" else target).read_text())
    assert report["exit_state"] == "input_error"
    assert report["errors"] == [f"baseline_template_changed:{mode}"]


@pytest.mark.parametrize(
    ("failure", "error"),
    [
        ("check", "baseline_history_check_failed:muse"),
        ("read", "baseline_history_read_failed:muse"),
        ("mismatch", "baseline_template_changed:muse"),
    ],
)
def test_baseline_git_failures_are_structured_not_snapshot_fallback(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, failure: str, error: str
) -> None:
    """Only absent history permits fallback; available history must match bytes."""
    from typing import Any

    import story_eval

    run = subprocess.run

    def git_result(command: list[str], **kwargs: Any) -> Any:
        if command[0] == "git" and "--quiet" in command:
            return subprocess.CompletedProcess(command, 128 if failure == "check" else 0)
        if command[0] == "git" and command[3] == "show":
            return subprocess.CompletedProcess(
                command, 128 if failure == "read" else 0, stdout=b"different Git blob"
            )
        return run(command, **kwargs)

    monkeypatch.setattr(subprocess, "run", git_result)
    target = tmp_path / "error.json"
    assert story_eval.main(["export", "--out", str(target)]) == 2
    report = json.loads(target.read_text())
    assert report["exit_state"] == "input_error"
    assert report["errors"] == [error]


def test_offline_cli_does_not_initialize_ambient_otlp_exporter(tmp_path: Path) -> None:
    """A fresh CLI process stays offline even when the shell enables tracing."""
    import subprocess

    code = """
import os
import sys
from unittest.mock import patch
os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://127.0.0.1:9/offline-test'
os.environ['OTEL_EXPORTER_OTLP_HEADERS'] = 'synthetic-test=unused'
sys.path.insert(0, sys.argv[1])
with patch('opentelemetry.exporter.otlp.proto.http.trace_exporter.OTLPSpanExporter') as exporter:
    import story_eval
    assert story_eval.main(['check', '--records', sys.argv[2], '--out', sys.argv[3]]) == 0
    assert exporter.call_count == 0, 'offline CLI constructed an outbound exporter'
assert os.environ['OTEL_EXPORTER_OTLP_ENDPOINT'] == 'http://127.0.0.1:9/offline-test'
assert os.environ['OTEL_EXPORTER_OTLP_HEADERS'] == 'synthetic-test=unused'
"""
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            code,
            str(ROOT / "scripts"),
            str(ROOT / "eval/chinese_stories/simulated.json"),
            str(tmp_path / "offline-check.json"),
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_corpus_is_24_original_cases_with_fixed_holdout_and_boundaries() -> None:
    cases = load_cases(ROOT / "eval/chinese_stories/cases.json")
    assert len(cases) == len({case.id for case in cases}) == 24
    assert [case.id for case in cases if case.split == "holdout"] == [
        "zh-story-021",
        "zh-story-022",
        "zh-story-023",
        "zh-story-024",
    ]
    assert any(case.locks for case in cases)
    assert any(len(case.body) > 2000 for case in cases)
    for case in cases:
        context = render_context(case)
        assert context
        assert len(context) <= 2000


def record() -> dict[str, object]:
    case = load_cases(ROOT / "eval/chinese_stories/cases.json")[0]
    return {
        "case_id": case.id,
        "mode": "muse",
        "kind": "replayed",
        "context": render_context(case),
        "raw_output": json.dumps({"action": "provoke", "content": "账本的空白页渗出旧墨。"}),
    }


@pytest.mark.parametrize(
    "bad_output",
    ["{", "```json {} ```", '{"action":"unknown"}', '{"action":"rewrite"}', '{"action":"delete"}'],
)
def test_checker_reports_raw_errors_and_muse_delete(bad_output: str) -> None:
    candidate = record()
    candidate["raw_output"] = bad_output
    result = check_record(candidate, load_cases(ROOT / "eval/chinese_stories/cases.json"))
    assert result["verdict"] == "fail"
    assert result["errors"]
    assert result["input_record"] == candidate


def test_checker_rejects_wrong_cursor_context() -> None:
    candidate = record()
    candidate["context"] = "另一段没有提交的正文。"
    result = check_record(candidate, load_cases(ROOT / "eval/chinese_stories/cases.json"))
    assert "cursor_context_mismatch" in result["errors"]


def test_checker_accepts_schema_and_keeps_creative_review_unknown() -> None:
    result = check_record(record(), load_cases(ROOT / "eval/chinese_stories/cases.json"))
    assert result["verdict"] == "pass"
    assert result["writing_effect"] == "unassessed"
    assert result["review_state"] == "unreviewed"


def test_export_separates_original_and_current_without_model_calls() -> None:
    exported = export_inputs(ROOT, "development")
    assert len(exported["inputs"]) == 80  # 20 cases x two modes x before/after
    before = next(
        row
        for row in exported["inputs"]
        if row["mode"] == "muse" and row["template_variant"] == "baseline"
    )
    after = next(
        row
        for row in exported["inputs"]
        if row["mode"] == "muse" and row["template_variant"] == "candidate"
    )
    assert before["template_digest"] != after["template_digest"]
    assert before["render_input"] == after["render_input"]
    assert before["template_source_sha"] == "cdb868dcf913326b2f1e0d663f12a277fc4c6b0a"
    assert exported["real_model_status"] == "unassessed"
    history = subprocess.run(
        [
            "git",
            "-C",
            str(ROOT),
            "rev-parse",
            "--verify",
            "--quiet",
            "cdb868dcf913326b2f1e0d663f12a277fc4c6b0a^{commit}",
        ],
        capture_output=True,
    )
    verification = "git_commit_and_digest" if history.returncode == 0 else "pinned_snapshot_digest"
    assert exported["baseline_verification"] == {"muse": verification, "loki": verification}


def test_response_anchor_and_cursor_are_checked() -> None:
    candidate = record()
    candidate["request"] = {
        "context": candidate["context"],
        "mode": "muse",
        "client_meta": {"doc_version": 1, "selection_from": 1, "selection_to": 1},
    }
    result = check_record(candidate, load_cases(ROOT / "eval/chinese_stories/cases.json"))
    assert "cursor_metadata_mismatch" in result["errors"]


@pytest.mark.parametrize("action", ["delete", "rewrite"])
def test_loki_short_context_guard_is_required(action: str) -> None:
    case = load_cases(ROOT / "eval/chinese_stories/cases.json")[11]
    candidate = record()
    candidate.update(
        case_id=case.id,
        mode="loki",
        context=render_context(case),
        raw_output=json.dumps(
            {"action": action, **({"content": "她关上门。"} if action == "rewrite" else {})}
        ),
    )
    result = check_record(candidate, [case])
    assert result["verdict"] == "pass"
    assert result["guard_applied"] is True
    assert result["service_replay"]["action"] == "provoke"
    candidate["response"] = {
        "action": action,
        "content": "门又打开。" if action == "rewrite" else None,
        "lock_id": "lock_test" if action == "rewrite" else None,
        "anchor": {"type": "range", "from": 1, "to": 10},
        "source": "loki",
        "action_id": "act_test",
        "issued_at": "2026-10-12T00:00:00Z",
    }
    assert "short_context_requires_provoke" in check_record(candidate, [case])["errors"]


def test_cli_writes_failures_and_exits_nonzero(tmp_path: Path) -> None:
    import subprocess

    source = tmp_path / "outputs.json"
    target = tmp_path / "report.json"
    source.write_text(json.dumps({"records": [record(), {**record(), "context": "错误"}]}))
    outcome = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/story_eval.py"),
            "check",
            "--records",
            str(source),
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert outcome.returncode == 1
    report = json.loads(target.read_text())
    assert report["exit_state"] == "contract_failures"
    assert len(report["results"]) == 2
    assert report["results"][1]["input_record"]["context"] == "错误"


def test_context_preserves_selection_end_quotes_unfinished_and_spacing() -> None:
    from story_eval import StoryCase

    case = StoryCase.model_validate(
        {
            "id": "test",
            "split": "development",
            "features": [],
            "body": "前句。  “真的？！”\n她还没说完🛶后文",
            "selection": {"from": 4, "to": 19},
            "offset_encoding": "utf-16-code-units",
            "editor_representation": "single-paragraph-plain-text",
            "intent": "测试",
            "must_preserve": [],
            "allowed_reversal": [],
            "locks": [],
            "safety_assertions": [],
        }
    )
    assert render_context(case) == "前句。  “真的？！”\n她还没说完🛶"


@pytest.mark.parametrize("action", ["rewrite", "delete"])
def test_final_response_range_must_target_submitted_tail(action: str) -> None:
    candidate = record()
    if action == "delete":
        candidate["mode"] = "loki"
    # Schema-valid but points into earlier text instead of the current sentence.
    candidate["response"] = {
        "action": action,
        "content": "她把账页翻过来。" if action == "rewrite" else None,
        "lock_id": "lock_test" if action == "rewrite" else None,
        "anchor": {"type": "range", "from": 1, "to": 2},
        "source": candidate["mode"],
        "action_id": "act_test",
        "issued_at": "2026-10-12T00:00:00Z",
    }
    result = check_record(candidate, load_cases(ROOT / "eval/chinese_stories/cases.json"))
    assert "anchor_outside_submitted_context" in result["errors"]
    assert "sentence_anchor_mismatch" in result["errors"]


@pytest.mark.parametrize(
    "mutation",
    [
        "context",
        "cursor",
        "anchor",
        "muse_delete",
        "short_guard",
        "malformed_output",
        "invalid_response",
    ],
)
def test_each_cli_contract_failure_has_nonzero_exit(mutation: str, tmp_path: Path) -> None:
    import subprocess

    candidate = record()
    if mutation == "context":
        candidate["context"] = "未提交正文"
    elif mutation == "cursor":
        candidate["request"] = {
            "context": candidate["context"],
            "mode": "muse",
            "client_meta": {"doc_version": 1, "selection_from": 3, "selection_to": 3},
        }
    elif mutation == "muse_delete":
        candidate["raw_output"] = '{"action":"delete"}'
    elif mutation == "malformed_output":
        candidate["raw_output"] = "{"
    elif mutation == "short_guard":
        case = load_cases(ROOT / "eval/chinese_stories/cases.json")[11]
        candidate.update(
            case_id=case.id,
            mode="loki",
            context=render_context(case),
            raw_output='{"action":"rewrite","content":"门又打开。"}',
            response={
                "action": "rewrite",
                "content": "门又打开。",
                "lock_id": "lock_test",
                "anchor": {"type": "range", "from": 1, "to": 10},
                "source": "loki",
                "action_id": "act_test",
                "issued_at": "2026-10-12T00:00:00Z",
            },
        )
    elif mutation == "invalid_response":
        candidate["response"] = {"action": "provoke"}
    elif mutation == "anchor":
        candidate["response"] = {
            "action": "provoke",
            "content": "她把账页翻过来。",
            "lock_id": "lock_test",
            "anchor": {"type": "pos", "from": 2},
            "source": "muse",
            "action_id": "act_test",
            "issued_at": "2026-10-12T00:00:00Z",
        }
    source = tmp_path / "records.json"
    report = tmp_path / "report.json"
    source.write_text(json.dumps({"records": [candidate]}))
    outcome = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/story_eval.py"),
            "check",
            "--records",
            str(source),
            "--out",
            str(report),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert outcome.returncode == 1
    result = json.loads(report.read_text())["results"][0]
    assert result["verdict"] == "fail"
    assert result["input_record"] == candidate


def test_malformed_record_file_is_preserved_and_exits_two(tmp_path: Path) -> None:
    import subprocess

    source = tmp_path / "malformed.json"
    target = tmp_path / "report.json"
    source.write_text("{bad file")
    outcome = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/story_eval.py"),
            "check",
            "--records",
            str(source),
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert outcome.returncode == 2
    assert json.loads(target.read_text())["raw_source"] == "{bad file"


def test_anonymous_package_has_empty_ratings_and_separate_identity_key(tmp_path: Path) -> None:
    from story_eval import write_comparison

    write_comparison(export_inputs(ROOT, "development"), tmp_path)
    cards = json.loads((tmp_path / "review_cards.json").read_text())
    assert len(cards["cards"]) == 40
    assert all(card["A"] is None and card["B"] is None for card in cards["cards"])
    assert "template_variant" not in json.dumps(cards)
    assert cards["choices"] == ["A", "B", "各有优劣", "都无帮助"]
    assert (
        "A_情节与人物一致性,A_突破是否具体,A_中文适配,A_续写空间"
        in (tmp_path / "ratings.csv").read_text()
    )
    assert (tmp_path / "identity_key.json").is_file()


def test_unhashable_case_id_has_structured_input_error(tmp_path: Path) -> None:
    import subprocess

    candidate = record()
    candidate["case_id"] = []
    source = tmp_path / "malformed-record.json"
    target = tmp_path / "report.json"
    source.write_text(json.dumps({"records": [candidate]}))
    outcome = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/story_eval.py"),
            "check",
            "--records",
            str(source),
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert outcome.returncode == 2
    report = json.loads(target.read_text())
    assert report["exit_state"] == "input_error"
    assert json.loads(report["raw_source"])["records"][0]["case_id"] == []
    assert "Traceback" not in outcome.stderr


def test_final_response_cannot_silently_change_recorded_action() -> None:
    from story_eval import request_for

    from server.domain.text_window import compute_last_sentence_anchor

    case = load_cases(ROOT / "eval/chinese_stories/cases.json")[0]
    request = request_for(case, "muse")
    start, end = compute_last_sentence_anchor(request.client_meta.selection_to, request.context)
    candidate = record()
    candidate["response"] = {
        "action": "rewrite",
        "content": "账本的空白页渗出旧墨。",
        "lock_id": "lock_test",
        "anchor": {"type": "range", "from": start, "to": end},
        "source": "muse",
        "action_id": "act_test",
        "issued_at": "2026-10-12T00:00:00Z",
    }
    result = check_record(candidate, [case])
    assert "response_action_mismatch" in result["errors"]


@pytest.mark.parametrize("bad_from", ["102", True])
def test_illegal_json_anchor_type_fails_cli(bad_from: object, tmp_path: Path) -> None:
    import subprocess

    candidate = record()
    # True would become 1; numeric strings would become the valid cursor without strict JSON.
    candidate["response"] = {
        "action": "provoke",
        "content": "账本的空白页渗出旧墨。",
        "lock_id": "lock_test",
        "anchor": {"type": "pos", "from": bad_from},
        "source": "muse",
        "action_id": "act_test",
        "issued_at": "2026-10-12T00:00:00Z",
    }
    source = tmp_path / "records.json"
    target = tmp_path / "report.json"
    source.write_text(json.dumps({"records": [candidate]}))
    outcome = subprocess.run(
        [
            sys.executable,
            str(ROOT / "scripts/story_eval.py"),
            "check",
            "--records",
            str(source),
            "--out",
            str(target),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert outcome.returncode == 1
    errors = json.loads(target.read_text())["results"][0]["errors"]
    assert any(error.startswith("response_schema:") for error in errors)
