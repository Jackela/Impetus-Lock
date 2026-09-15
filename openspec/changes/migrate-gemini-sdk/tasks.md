## 1. Characterization before implementation
- [x] 1.1 Recheck approval, current provider callers, locked SDK behavior and primary migration documentation; choose a compatible google-genai version.
- [x] 1.2 Add failing adapter tests with separate assertions for response-shape failures (empty candidates, missing content parts or text → `invalid_response`/502) and extracted-text JSON/schema validation failures (Pydantic `ValidationError` propagated to `intervention.py`'s `ValidationError`/422 path), alongside interleaved BYOK keys, blocked output, mapped errors, effective retry limits, token count/fallback, health and streaming.

## 2. Migration
- [x] 2.1 Replace dependency and regenerate Poetry lock; update remaining legacy SDK CI installation references if present.
- [x] 2.2 Implement instance-scoped client configuration and cleanup, response/error adaptation and explicit characterized retry settings behind the existing interface.

## 3. Verification
- [x] 3.1 Run focused Gemini/provider registry tests and backend Ruff, mypy and pytest checks; verify clean Poetry imports with no legacy SDK requirement.
- [x] 3.2 Verify unchanged intervention contract/version and other-provider regressions; document any live smoke result separately from deterministic tests.
- [x] 3.3 Review dependency/provider rollback as one change and run strict OpenSpec validation before handoff.
