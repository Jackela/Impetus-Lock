# agentic-interventions Specification

## Purpose
TBD - created by archiving change update-agentic-intervention-protocol. Update Purpose after archive.
## Requirements
### Requirement: Agent Actions Support Rewrite Decisions
The intervention API MUST support `provoke`, `rewrite`, and `delete` actions with structured anchors and lock metadata so the frontend can execute atomically.

#### Scenario: Muse rewrites stalled sentence
- **GIVEN** the client submits a Muse-mode request with cursor at position `c`
- **WHEN** the LLM chooses `action: "rewrite"`
- **THEN** the backend MUST respond with `anchor.type = "range"` spanning the targeted sentence
- **AND** include `content` (replacement text), `lock_id`, `action_id`, `issued_at`, and `source = "muse"`
- **AND** Muse mode MUST NOT return `delete` actions.

#### Scenario: Loki chaos mix
- **GIVEN** the client submits a Loki-mode request with sufficient context (≥50 chars)
- **WHEN** the LLM chooses any action
- **THEN** the backend MUST return structured data for provoke/delete/rewrite as described above, including `source = "loki"`, with delete anchors validated against the provided context.

### Requirement: Short Context Safety Guard
Loki mode MUST prevent destructive delete/rewrite operations when the available context is insufficient.

#### Scenario: Short context forces provoke
- **GIVEN** a Loki-mode request whose context length is <50 characters
- **WHEN** the LLM output proposes `delete` or `rewrite`
- **THEN** the backend MUST override the action to `provoke` and synthesize safe content plus lock metadata.

### Requirement: Prompt Output Is Prefix-Free JSON
Muse/Loki prompts MUST instruct the LLM to emit JSON-only payloads without `[debug:*]` prefixes or inline lock comments so the UI can own the vibe styling.

#### Scenario: Debug-free payload
- **GIVEN** a Muse or Loki request (including the debug provider)
- **WHEN** a completion is generated
- **THEN** the payload content SHALL omit debug prefixes/suffixes and HTML comments, returning only human-readable text plus structured fields (action, lock_id, anchor, source).

### Requirement: Backend Accepts Per-Request LLM Provider Overrides
The intervention API SHALL accept optional BYOK overrides (provider, model, API key) via HTTP headers and route each request to the requested vendor when valid.

#### Scenario: User supplies Anthropic key at runtime
- **GIVEN** the client sends `X-LLM-Provider: anthropic`, `X-LLM-Model: claude-3-5-haiku-latest`, and `X-LLM-Api-Key: sk-ant-...`
- **WHEN** `/api/v1/impetus/generate-intervention` executes
- **THEN** the backend SHALL instantiate an Anthropic client using the supplied key
- **AND** forward the Muse/Loki prompt to that client while keeping the key in-memory only for that request
- **AND** respond 200 with the structured intervention payload if the provider call succeeds.

#### Scenario: Unsupported provider is rejected
- **GIVEN** the client sends `X-LLM-Provider: totally-made-up`
- **WHEN** the API receives the request
- **THEN** it SHALL respond with HTTP 422 + JSON `{ "code": "unsupported_provider" }`
- **AND** MUST NOT attempt an outbound LLM call nor log the provided API key.

### Requirement: Provider Registry Redacts Secrets and Surfaces Actionable Errors
The service layer SHALL centralize provider construction, enforce allowlisted models per vendor, and map upstream errors (quota exceeded, invalid key, network) to descriptive API responses without exposing secrets.

#### Scenario: Quota exceeded bubbles up with guidance
- **GIVEN** OpenAI returns HTTP 429 insufficient_quota
- **WHEN** the provider registry handles the exception
- **THEN** the API SHALL respond 402 with `{ "code": "quota_exceeded", "provider": "openai" }`
- **AND** logs SHALL contain a redacted entry (e.g., `provider=openai error=quota_exceeded request_id=...`) without the API key.

#### Scenario: Missing default key triggers configuration error
- **GIVEN** no override headers are provided and `OPENAI_API_KEY` is absent from the server environment
- **WHEN** the intervention route runs
- **THEN** it SHALL respond 503 with `{ "code": "llm_not_configured" }`
- **AND** advise the client to prompt the user for BYOK.

### Requirement: Intervention Lock IDs Are Unique Per Response
Intervention responses MUST issue unique lock IDs per action to avoid reusing the same lock identifier across multiple triggers.

#### Scenario: Distinct lock ids per trigger
- **WHEN** consecutive Muse or Loki interventions are generated (including via debug provider)
- **THEN** each response SHALL carry a distinct `lock_id`
- **AND** the `lock_id` SHALL be suitable for persistence and client-side enforcement without collisions.

