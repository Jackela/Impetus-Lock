# Change: Migrate Gemini to the maintained Google GenAI SDK

Status: Proposed; awaiting approval. Tier 3, audit finding A14. This package contains no implementation.

## Why

The provider still uses `google-generativeai`, including process-global `genai.configure`. Google ended support for that Python SDK on November 30, 2025 and recommends `google-genai`. This establishes a maintenance reason to migrate, not evidence that current requests fail. Sources checked September 14, 2026: [Google libraries](https://ai.google.dev/gemini-api/docs/libraries) and [legacy Python support plan](https://github.com/google-gemini/deprecated-generative-ai-python/blob/main/README.md).

## What Changes

- Replace the legacy dependency and API usage with an instance-scoped `google-genai` client behind the existing provider interface.
- Preserve structured draft validation, request-local BYOK credentials, safety settings, error/status mappings, token counting and existing callable streaming/health utilities.
- Characterize existing effective retry behavior before selecting explicit SDK retry settings; avoid silently multiplying outbound attempts.
- Keep API contracts, prompts, model selection and other providers unchanged.

## Impact

- Affected spec: `agentic-interventions`; adds migration compatibility criteria alongside existing provider override requirements.
- Affected code: `server/server/infrastructure/llm/gemini_provider.py`, provider construction/cleanup where needed, Gemini tests, `server/pyproject.toml`, `server/poetry.lock`, and legacy SDK references in CI if still present at implementation time.
- Independent of the route and client cleanup proposals; no database migration or product feature is required.
