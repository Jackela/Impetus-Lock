# Observability Guide

## Backend
- **Structured Logging**: Controlled via `LOG_LEVEL`. Requests log `request_id`, `status_code`, LLM overrides, and durations (HTTPExceptions keep their real status).
- **Prometheus Metrics**: Disabled by default; set `ENABLE_PROMETHEUS_METRICS=1` to expose `/metrics` (404 otherwise). Emits `llm_requests_total` and `llm_request_latency_seconds` when enabled.
- **OTLP Tracing**: Set `OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.example.com/v1/traces` (optional `OTEL_EXPORTER_OTLP_HEADERS=api-key=...`). Each LLM call emits a span with provider/mode attributes and safe error status handling.

## Frontend
- **Telemetry Toggle**: In-app control stores preference in `localStorage` (`impetus.telemetry.enabled`). Disabled by default unless `VITE_TELEMETRY_DEFAULT=on`.
- **Event Schema**: `Telemetry` logger emits JSON events (`llm_config_saved`, `llm_request`) without API keys.

## Sample Queries
- Grafana: `sum by (provider)(rate(llm_requests_total{status="success"}[5m]))`
- Datadog Log Filter: `service:impetus-lock @event:llm_call_failed`
