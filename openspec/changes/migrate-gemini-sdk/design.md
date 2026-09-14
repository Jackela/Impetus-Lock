## Context

Gemini currently creates `GenerativeModel` after global SDK configuration. The provider validates JSON with `LLMInterventionDraft`, maps vendor errors, returns a `len(text) // 4` token estimate on counting failure, and exposes health and streaming methods. Its completion path has no explicit application retry loop; the shared retry mixin is not evidence that Gemini uses it.

## Decisions

Use `google.genai.Client(api_key=resolved_key)` per provider/request lifecycle. Never configure a global key or share clients across different credentials. Close transport resources at the owning lifecycle boundary without closing another request's client. Keep the existing synchronous provider contract; do not introduce an async architecture migration.

Translate generation configuration and safety enums to the supported SDK types. Preserve JSON-only output and validate it against `LLMInterventionDraft`; an SDK-parsed object does not bypass domain validation. Keep current model identifiers and prompt construction; upstream model availability is a separate compatibility check, not permission to change defaults.

Map new SDK response/error shapes to the existing public codes/statuses: invalid key 401, quota 429, timeout 504, blocked content 400, and invalid/stopped/general upstream failures 502. Test blocked/empty candidates explicitly because the new SDK may report them as response metadata rather than exceptions.

Before changing dependencies, capture effective outbound attempts for the locked legacy SDK on transient errors and invalid output. Set new SDK retry options explicitly to match this bounded behavior, with no additional application retry loop. If exact parity is impossible, bring the measured difference back for a decision before implementation proceeds. Keep token counting, estimate fallback, health result and existing streaming semantics; audit callers before any utility removal.

## Risks and migration

Credential mixing is tested with interleaved calls using distinct fake keys. SDK retry defaults and response shapes are verified with a fake transport, avoiding billable calls for the regression suite. Regenerate the Poetry lock from the selected supported dependency, remove remaining legacy imports/install commands, and test a clean Poetry environment. Rollback restores the provider and dependency/lock changes together. Revalidate vendor documentation and supported SDK/Python versions when implementation starts.
