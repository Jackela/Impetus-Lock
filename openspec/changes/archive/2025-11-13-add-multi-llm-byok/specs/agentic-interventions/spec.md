# agentic-interventions Specification Delta

## ADDED Requirements

### Requirement: Backend Accepts Per-Request LLM Provider Overrides
The intervention API SHALL accept optional BYOK overrides (provider, model, API key) via HTTP headers and route each request to the requested vendor when valid.

#### Scenario: User supplies Anthropic key at runtime
- **GIVEN** the client sends `X-LLM-Provider: anthropic`, `X-LLM-Model: claude-3-5-haiku-latest`, and `X-LLM-Api-Key: sk-ant-...`
- **WHEN** `/impetus/generate-intervention` executes
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
