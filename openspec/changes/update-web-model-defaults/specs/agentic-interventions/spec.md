## MODIFIED Requirements

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

#### Scenario: Model omitted or explicitly configured

- **GIVEN** the configured provider is Gemini, Anthropic, or Claude and usable credentials are available
- **WHEN** no per-request or environment model is specified
- **THEN** the backend SHALL default respectively to `gemini-3.1-flash-lite`, `claude-haiku-4-5-20251001`, or `claude-sonnet-4-6`
- **AND** explicit model settings SHALL retain their existing precedence.
