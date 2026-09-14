## ADDED Requirements

### Requirement: Gemini SDK Migration Preserves Provider Compatibility
The Gemini provider SHALL use the maintained Google GenAI SDK behind the existing provider interface and preserve structured output validation, request-local credentials, error/status mapping, effective bounded retries, token utilities and callable streaming behavior.

#### Scenario: Concurrent BYOK requests remain isolated
- **WHEN** two Gemini requests use different API keys and their executions overlap
- **THEN** each outbound call SHALL use only its own resolved credential and model
- **AND** no key SHALL enter global SDK configuration, persistent storage or logs.

#### Scenario: Structured generation remains validated
- **WHEN** Gemini returns JSON, malformed JSON, empty candidates or blocked content
- **THEN** valid JSON SHALL be checked against the existing intervention draft schema
- **AND** invalid or blocked output SHALL retain the existing public error/status semantics rather than produce a successful intervention.

#### Scenario: Retry and error parity
- **WHEN** the provider encounters an invalid key, quota failure, timeout or transient upstream error
- **THEN** it SHALL retain the existing mapped codes and statuses and the characterized bounded outbound attempt behavior
- **AND** SDK retries SHALL NOT be multiplied by an added application retry loop.

#### Scenario: Token and auxiliary methods remain compatible
- **WHEN** callers count tokens, check health or stream an intervention
- **THEN** token counting SHALL return the SDK count or the existing character-based estimate on failure, health SHALL retain its boolean result, and streaming SHALL retain text chunks and mapped failure behavior.
