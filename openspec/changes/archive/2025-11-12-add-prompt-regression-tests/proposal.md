# Change Proposal: add-prompt-regression-tests

## Why
- Muse/Loki prompts live in Python strings with no automated guardrails; subtle edits can break JSON output or violate spec requirements without detection.
- LLM providers may return malformed payloads; we currently rely on integration tests to catch this, which is slow and flaky.

## What Changes
- Create a prompt registry (YAML/JSON) with versioned templates so diffs are reviewable.
- Add golden tests that render prompts with sample contexts and assert key instructions are present (no prefix text, correct action descriptions).
- Build a fuzzing harness that feeds randomized but schema-valid drafts into `BasePromptLLMProvider` to ensure parser robustness.
- Optionally integrate `promptfoo` or similar tooling to run lightweight offline evals.

## Impact
- Provides fast feedback when modifying prompts or schema fields.
- Reduces risk of regressions that would only appear in costly LLM calls.
- Establishes a structured workflow for future prompt variants (e.g., locales, experimental modes).
