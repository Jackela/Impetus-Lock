## 1. Prompt Registry
- [x] 1.1 Move Muse/Loki prompt templates into versioned files under `server/prompts/` (YAML/JSON) with metadata.
- [x] 1.2 Add a generator script to compile templates into Python constants during build/test.

## 2. Golden / Lint Tests
- [x] 2.1 Write pytest cases that load prompts with fixture contexts and assert required phrases, JSON instructions, and contract references exist.
- [x] 2.2 Add a `promptlint`/regex-based sanity checker in CI (fail fast on missing tokens, stray prefixes, etc.).

## 3. Parser Fuzzing
- [x] 3.1 Implement a property-based test (Hypothesis) that feeds randomized `LLMInterventionDraft` payloads into the parser to ensure anchors/locks are validated.
- [x] 3.2 Simulate provider errors (missing content, invalid action) and assert friendly error messages.

## 4. Tooling & Docs
- [x] 4.1 Document prompt versioning workflow in `README.md` or `docs/prompts.md`.
- [x] 4.2 Optionally wire `promptfoo` (or similar) to run offline evals with deterministic mock LLM responses.
