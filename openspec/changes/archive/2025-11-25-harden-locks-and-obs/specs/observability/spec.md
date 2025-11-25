## ADDED Requirements
### Requirement: Metrics Endpoint Defaults to Safe Exposure
The `/metrics` endpoint SHALL be disabled by default or explicitly gated so Prometheus payloads are not exposed to unintended callers.

#### Scenario: Metrics disabled without explicit opt-in
- **GIVEN** the service starts without an explicit metrics-enable flag or token
- **WHEN** a client requests `/metrics`
- **THEN** the API SHALL return 404/403 (not the metrics payload)
- **AND** enabling metrics SHALL require an explicit env/config toggle.

### Requirement: HTTP Logging Captures Real Status Codes
Request logging middleware SHALL log the actual HTTP status (including 4xx/422) without throwing additional errors.

#### Scenario: Validation error logs correct status
- **GIVEN** a request triggers a FastAPI `HTTPException` (e.g., contract version mismatch)
- **WHEN** middleware logs the request
- **THEN** the logged status_code SHALL match the response (422) and the middleware SHALL complete without raising.

### Requirement: Tracing Error Handling Is Safe
Tracing helpers SHALL set span status using the supported OpenTelemetry API and MUST NOT raise while handling errors.

#### Scenario: Exception sets span status safely
- **GIVEN** tracing is enabled and an LLM call raises an exception inside a span
- **WHEN** the tracing helper records the error
- **THEN** it SHALL mark the span as error using the current API
- **AND** SHALL NOT raise secondary errors while doing so.
