#!/usr/bin/env python3
"""Export and check synthetic story interventions without making model calls."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from pydantic import BaseModel, ConfigDict, Field, ValidationError  # noqa: E402

# A fresh offline CLI must not initialize an outbound telemetry exporter through
# the service import. Restore the shell's configuration without changing product
# tracing or model defaults; this process only performs local service replay.
_ambient_otlp = {
    name: os.environ.pop(name)
    for name in ("OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_HEADERS")
    if name in os.environ
}
try:
    from server.application.services.intervention_service import InterventionService
finally:
    os.environ.update(_ambient_otlp)
    _ambient_otlp.clear()

from server.domain.models.intervention import (  # noqa: E402
    ClientMeta,
    InterventionRequest,
    InterventionResponse,
)
from server.domain.text_window import compute_last_sentence_anchor  # noqa: E402
from server.infrastructure.llm.base_provider import (  # noqa: E402
    BasePromptLLMProvider,
    LLMInterventionDraft,
)
from server.infrastructure.llm.prompts.prompt_registry import (  # noqa: E402
    PromptTemplate,
    get_prompt_template,
)

BASE_SHA = "cdb868dcf913326b2f1e0d663f12a277fc4c6b0a"
CORPUS = ROOT / "eval/chinese_stories/cases.json"
DIMENSIONS = ("情节与人物一致性", "突破是否具体", "中文适配", "续写空间")
CHOICES = ("A", "B", "各有优劣", "都无帮助")


class Selection(BaseModel):
    """UTF-16 offsets into the synthetic single-paragraph body (before PM +1)."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")
    from_: int = Field(alias="from", ge=0)
    to: int = Field(ge=0)


class OutputRecord(BaseModel):
    """Validate imported field types before checking the writing/action contract."""

    model_config = ConfigDict(strict=True, extra="allow")
    case_id: str
    mode: str
    kind: str
    context: str
    raw_output: str
    request: dict[str, Any] | None = None
    response: dict[str, Any] | None = None


class StoryCase(BaseModel):
    """Original synthetic writing and qualitative boundaries, without gold text."""

    model_config = ConfigDict(extra="forbid")
    id: str
    split: Literal["development", "holdout"]
    features: list[str]
    body: str
    selection: Selection
    offset_encoding: Literal["utf-16-code-units"]
    editor_representation: Literal["single-paragraph-plain-text"]
    intent: str
    must_preserve: list[str]
    allowed_reversal: list[str]
    locks: list[dict[str, Any]]
    safety_assertions: list[str]


def utf16_length(value: str) -> int:
    """Count editor positions, including surrogate pairs."""
    return len(value.encode("utf-16-le")) // 2


def load_cases(path: Path) -> list[StoryCase]:
    """Validate IDs, text offsets and literal lock fixtures in the corpus."""
    cases = [StoryCase.model_validate(item) for item in json.loads(path.read_text())["cases"]]
    if len({case.id for case in cases}) != len(cases):
        raise ValueError("duplicate_case_id")
    for case in cases:
        encoded = case.body.encode("utf-16-le")
        if not 0 <= case.selection.from_ <= case.selection.to <= len(encoded) // 2:
            raise ValueError(f"invalid_selection:{case.id}")
        # Decode each side to reject offsets inside a surrogate pair.
        for offset in (case.selection.from_, case.selection.to):
            encoded[: offset * 2].decode("utf-16-le")
        for lock in case.locks:
            if encoded[lock["from"] * 2 : lock["to"] * 2].decode("utf-16-le") != lock["text"]:
                raise ValueError(f"invalid_lock_fixture:{case.id}")
    return cases


def render_context(case: StoryCase) -> str:
    """Mirror the client literal last-three-sentence suffix ending at selection.to."""
    prefix = case.body.encode("utf-16-le")[: case.selection.to * 2].decode("utf-16-le")
    parts: list[str] = []
    previous = 0
    for match in re.finditer(r"""[。！？.!?]+[”’」』"']*""", prefix):
        fragment = prefix[previous : match.start()]
        if fragment.strip() or not parts:
            parts.append(fragment + match.group())
        else:
            parts[-1] += fragment + match.group()
        previous = match.end()
    tail = prefix[previous:]
    if tail.strip():
        parts.append(tail)
    elif parts:
        parts[-1] += tail
    return ("".join(parts[-3:]) if parts else prefix).lstrip()[-2000:]


def request_for(case: StoryCase, mode: Literal["muse", "loki"]) -> InterventionRequest:
    """Map body UTF-16 offsets to single-paragraph ProseMirror positions (+1)."""
    return InterventionRequest(
        context=render_context(case),
        mode=mode,
        client_meta=ClientMeta(
            doc_version=1,
            selection_from=case.selection.from_ + 1,
            selection_to=case.selection.to + 1,
        ),
    )


def _git(root: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def export_inputs(root: Path, split: str) -> dict[str, Any]:
    """Render both TOML variants on identical candidate inputs; never generate text."""
    corpus = root / "eval/chinese_stories/cases.json"
    cases = load_cases(corpus)
    rows: list[dict[str, Any]] = []
    head = _git(root, "rev-parse", "HEAD")
    for case in cases:
        if split != "all" and case.split != split:
            continue
        for mode in ("muse", "loki"):
            request = request_for(case, mode)
            for variant in ("baseline", "candidate"):
                path = (
                    root / "eval/chinese_stories/baseline" / f"{mode}.toml"
                    if variant == "baseline"
                    else root / "server/server/prompts" / f"{mode}.toml"
                )
                raw = path.read_bytes()
                if variant == "baseline":
                    original = subprocess.check_output(
                        [
                            "git",
                            "-C",
                            str(root),
                            "show",
                            f"{BASE_SHA}:server/server/prompts/{mode}.toml",
                        ]
                    )
                    if raw != original:
                        raise ValueError(f"baseline_template_changed:{mode}")
                data = tomllib.loads(raw.decode())
                template = (
                    PromptTemplate(
                        mode,
                        data["version"],
                        data["system"].strip("\n"),
                        data["user_template"].strip("\n"),
                    )
                    if variant == "baseline"
                    else get_prompt_template(mode)
                )
                rows.append(
                    {
                        "case_id": case.id,
                        "split": case.split,
                        "mode": mode,
                        "template_variant": variant,
                        "template_version": template.version,
                        "template_digest": hashlib.sha256(raw).hexdigest(),
                        "template_source_sha": BASE_SHA if variant == "baseline" else head,
                        "source_sha": head,
                        "source_state": "worktree_digest_manifest",
                        "template_path": str(path.relative_to(root)),
                        "template_dirty": variant == "candidate"
                        and bool(_git(root, "status", "--porcelain", "--", str(path))),
                        "render_input": request.model_dump(by_alias=True),
                        "system_prompt": template.system_prompt,
                        "user_prompt": template.render_user_prompt(request.context),
                        "provider": "unknown",
                        "model": "unknown",
                        "parameters": "unknown",
                        "cost": "unknown",
                        "tokens": "unknown",
                        "method": "offline_export",
                        "review_state": "unreviewed",
                        "writing_effect": "unassessed",
                    }
                )
    return {
        "format_version": 1,
        "base_sha": BASE_SHA,
        "head_sha": head,
        "head_tree_sha": _git(root, "rev-parse", "HEAD^{tree}"),
        "source_file_digests": {
            str(path.relative_to(root)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in [
                root / "scripts/story_eval.py",
                root / "scripts/prompt_eval.py",
                root / "server/server/application/services/intervention_service.py",
                root / "server/server/domain/text_window.py",
                root / "server/server/domain/models/intervention.py",
                root / "server/server/domain/models/anchor.py",
                root / "server/server/infrastructure/llm/base_provider.py",
                root / "server/server/infrastructure/llm/prompts/prompt_registry.py",
                root / "client/src/components/Editor/EditorCore.tsx",
                root / "client/src/utils/contextExtractor.ts",
                root / "client/src/services/ContentInjector.ts",
                root / "client/src/utils/textRange.ts",
                root / "client/src/services/api/interventionClient.ts",
            ]
        },
        "worktree_status": _git(root, "status", "--porcelain"),
        "corpus_digest": hashlib.sha256(corpus.read_bytes()).hexdigest(),
        "comparison": "prompt_only_on_identical_candidate_input",
        "real_model_status": "unassessed",
        "inputs": rows,
    }


class ReplayProvider(BasePromptLLMProvider):
    """Feed recorded JSON through the existing provider and service interfaces."""

    provider_name = "offline_replay"

    def __init__(self, raw_output: str) -> None:
        """Store one recorded completion without constructing any vendor client."""
        super().__init__(model="offline")
        self.raw_output = raw_output

    def _complete(self, system_prompt: str, user_message: str) -> LLMInterventionDraft:
        return LLMInterventionDraft.model_validate_json(self.raw_output)


def _response_errors(raw: Any, request: InterventionRequest, case: StoryCase) -> list[str]:
    errors: list[str] = []
    if not isinstance(raw, dict):
        return ["response_not_object"]
    if "issued_at" not in raw:
        errors.append("response_missing_issued_at")
    try:
        response = InterventionResponse.model_validate_json(json.dumps(raw), strict=True)
    except ValidationError as exc:
        return errors + [f"response_schema:{exc}"]
    if response.source != request.mode:
        errors.append("response_source_mismatch")
    if request.mode == "muse" and response.action == "delete":
        errors.append("muse_delete_forbidden")
    if request.mode == "loki" and len(request.context) < 50 and response.action != "provoke":
        errors.append("short_context_requires_provoke")
    cursor = request.client_meta.selection_to
    anchor = response.anchor
    if anchor.type == "range":
        if not max(1, cursor - utf16_length(request.context)) <= anchor.from_ < anchor.to <= cursor:
            errors.append("anchor_outside_submitted_context")
        if response.action in ("rewrite", "delete") and (anchor.from_, anchor.to) != (
            compute_last_sentence_anchor(cursor, request.context)
        ):
            errors.append("sentence_anchor_mismatch")
        encoded = case.body.encode("utf-16-le")
        try:
            encoded[: (anchor.from_ - 1) * 2].decode("utf-16-le")
            encoded[: (anchor.to - 1) * 2].decode("utf-16-le")
        except UnicodeDecodeError:
            errors.append("anchor_splits_surrogate")
    elif anchor.type != "pos" or anchor.from_ not in (request.client_meta.selection_from, cursor):
        errors.append("unexpected_anchor")
    if response.action == "provoke" and anchor.type != "pos":
        errors.append("provoke_requires_pos_anchor")
    if response.content and (
        response.content.lstrip().startswith((">", "[debug:", "[AI施压]"))
        or "<!--" in response.content
    ):
        errors.append("response_has_forbidden_prefix_or_comment")
    if response.action == "delete" and (raw.get("content") or raw.get("lock_id")):
        errors.append("delete_has_mutation_content")
    return errors


def check_record(record: dict[str, Any], cases: list[StoryCase]) -> dict[str, Any]:
    """Check raw draft and optional final response without claiming creative success."""
    errors: list[str] = []
    try:
        OutputRecord.model_validate(record)
    except ValidationError as exc:
        return {
            "case_id": record.get("case_id"),
            "verdict": "fail",
            "errors": [f"input_record_schema:{exc}"],
            "input_record": record,
            "service_replay": None,
            "guard_applied": False,
            "writing_effect": "unassessed",
            "review_state": "unreviewed",
            "qualitative_boundaries": "human_review_required",
        }
    normalized: dict[str, Any] | None = None
    guard_applied = False
    by_id = {case.id: case for case in cases}
    case = by_id.get(record.get("case_id", ""))
    mode = record.get("mode")
    if case is None:
        errors.append("unknown_case_id")
    if mode not in ("muse", "loki"):
        errors.append("unknown_mode")
    if record.get("kind") not in ("simulated", "replayed", "real"):
        errors.append("unknown_output_kind")
    if case is not None and mode in ("muse", "loki"):
        request = request_for(case, mode)
        if record.get("context") != request.context:
            errors.append("cursor_context_mismatch")
        if "request" in record:
            try:
                submitted = InterventionRequest.model_validate(record["request"])
                if submitted.client_meta != request.client_meta:
                    errors.append("cursor_metadata_mismatch")
                if submitted.context != request.context or submitted.mode != request.mode:
                    errors.append("request_context_or_mode_mismatch")
            except ValidationError as exc:
                errors.append(f"request_schema:{exc}")
        raw = record.get("raw_output")
        try:
            if not isinstance(raw, str):
                raise ValueError("raw_output must be the original JSON string")
            parsed = json.loads(raw)
            if not isinstance(parsed, dict) or set(parsed) - {"action", "content"}:
                raise ValueError("draft must contain only action/content fields")
            draft = LLMInterventionDraft.model_validate(parsed)
            if draft.action in ("provoke", "rewrite") and (
                not draft.content or not draft.content.strip()
            ):
                errors.append("mutation_missing_content")
            if draft.action == "delete" and draft.content:
                errors.append("delete_has_content")
            if draft.content and (
                draft.content.lstrip().startswith((">", "[debug:", "[AI施压]"))
                or "<!--" in draft.content
            ):
                errors.append("text_has_forbidden_prefix_or_comment")
            if mode == "muse" and draft.action == "delete":
                errors.append("muse_delete_forbidden")
            guard_applied = (
                mode == "loki" and len(request.context) < 50 and draft.action != "provoke"
            )
            # Replay demonstrates service normalization, but does not erase draft failures.
            if not any(error.startswith("mutation_missing") for error in errors):
                normalized = (
                    InterventionService(ReplayProvider(raw))
                    .generate_intervention(request)
                    .model_dump(mode="json", by_alias=True)
                )
        except (ValueError, ValidationError) as exc:
            errors.append(f"draft_schema:{exc}")
        if normalized is not None:
            errors.extend(_response_errors(normalized, request, case))
        if "response" in record:
            errors.extend(_response_errors(record["response"], request, case))
            if normalized is not None and isinstance(record["response"], dict):
                if record["response"].get("action") != normalized["action"]:
                    errors.append("response_action_mismatch")
                if record["response"].get("content") != normalized["content"]:
                    errors.append("response_content_mismatch")
    return {
        "case_id": record.get("case_id"),
        "verdict": "fail" if errors else "pass",
        "errors": errors,
        "input_record": record,
        "service_replay": normalized,
        "guard_applied": guard_applied,
        "writing_effect": "unassessed",
        "review_state": "unreviewed",
        "qualitative_boundaries": "human_review_required",
        "provenance": {
            key: record.get(key, "unknown")
            for key in (
                "provider",
                "model",
                "parameters",
                "cost",
                "tokens",
                "template_digest",
                "template_version",
                "template_source_sha",
                "source_sha",
                "method",
            )
        },
    }


def write_comparison(exported: dict[str, Any], directory: Path) -> None:
    """Create anonymous empty A/B sheets and a separate identity key."""
    directory.mkdir(parents=True, exist_ok=True)
    cases = {case.id: case for case in load_cases(CORPUS)}
    keys: list[dict[str, Any]] = []
    cards: list[dict[str, Any]] = []
    pairs = {(row["case_id"], row["mode"]) for row in exported["inputs"]}
    ratings: list[dict[str, Any]] = []
    for index, (case_id, mode) in enumerate(sorted(pairs), 1):
        pair_id = f"pair-{index:03}"
        variants = ["baseline", "candidate"]
        if hashlib.sha256(f"story-ab-v1:{case_id}:{mode}".encode()).digest()[0] % 2:
            variants.reverse()
        case = cases[case_id]
        keys.append(
            {
                "pair_id": pair_id,
                "case_id": case_id,
                "mode": mode,
                "A": variants[0],
                "B": variants[1],
            }
        )
        cards.append(
            {
                "pair_id": pair_id,
                "mode": mode,
                "body": case.body,
                "selection": case.selection.model_dump(by_alias=True),
                "submitted_context": render_context(case),
                "intent": case.intent,
                "must_preserve": case.must_preserve,
                "allowed_reversal": case.allowed_reversal,
                "A": None,
                "B": None,
                "output_status": "not_generated",
            }
        )
        ratings.append(
            {
                "pair_id": pair_id,
                **{f"{label}_{dimension}": "" for label in ("A", "B") for dimension in DIMENSIONS},
                "总体选择": "",
                "理由及文本证据": "",
                "reviewer": "",
            }
        )
    _write_json(directory / "review_cards.json", {"cards": cards, "choices": CHOICES})
    _write_json(directory / "identity_key.json", {"pairs": keys, "export": exported})
    with (directory / "ratings.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(ratings[0]))
        writer.writeheader()
        writer.writerows(ratings)


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    """Exit 0 on valid offline work, 1 on output failures, 2 on invalid input files."""
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    export = commands.add_parser("export")
    export.add_argument("--split", choices=("development", "holdout", "all"), default="development")
    export.add_argument("--out", type=Path, required=True)
    check = commands.add_parser("check")
    check.add_argument("--records", type=Path, required=True)
    check.add_argument("--out", type=Path, required=True)
    compare = commands.add_parser("compare")
    compare.add_argument("--split", choices=("development", "holdout"), default="development")
    compare.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "export":
            _write_json(args.out, export_inputs(ROOT, args.split))
        elif args.command == "compare":
            write_comparison(export_inputs(ROOT, args.split), args.out)
        else:
            data = json.loads(args.records.read_text())
            if not isinstance(data, dict) or not isinstance(data.get("records"), list):
                raise ValueError("records must be an array in a JSON object")
            results = []
            for item in data["records"]:
                if not isinstance(item, dict):
                    raise ValueError("each record must be an object")
                OutputRecord.model_validate(item)
                results.append(check_record(item, load_cases(CORPUS)))
            failed = not results or any(result["verdict"] == "fail" for result in results)
            _write_json(
                args.out,
                {
                    "exit_state": "contract_failures" if failed else "pass",
                    "results": results,
                    "real_model_status": "unassessed",
                },
            )
            return 1 if failed else 0
    except (OSError, ValueError, KeyError) as exc:
        raw_source = (
            args.records.read_bytes().decode("utf-8", errors="replace")
            if args.command == "check" and args.records.is_file()
            else None
        )
        _write_json(
            args.out if args.command != "compare" else args.out / "error.json",
            {"exit_state": "input_error", "errors": [str(exc)], "raw_source": raw_source},
        )
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
