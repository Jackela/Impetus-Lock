## 1. Backend Instrumentation
- [x] 1.1 Evaluate `structlog` vs. standard logging JSON formatter; implement a `logging_config.py` that emits correlation IDs and structured fields.
- [x] 1.2 Wrap provider invocations with a `timed_llm_call` helper that records provider/model/mode, latency, and error code (with redaction safeguards).
- [x] 1.3 Add optional OTLP exporter plumbing (env-gated) so traces/metrics can be shipped to external APMs.
- [x] 1.4 Expose Prometheus counters/histograms via `/metrics` (e.g., using `prometheus_client`) covering success/error counts and latency buckets.

## 2. Frontend Telemetry
- [x] 2.1 Extend `client/src/utils/logger.ts` to support JSON events and correlate interventions with provider selection (without storing API keys).
- [x] 2.2 Gate telemetry behind a feature flag (localStorage/env) and document how to disable it for privacy-sensitive users.

## 3. Docs & Validation
- [x] 3.1 Update `README.md` / `ARCHITECTURE_GUARDS.md` with the new observability stack, redaction rules, and how to configure exporters.
- [x] 3.2 Add pytest/Vitest coverage ensuring redaction helpers never leak secrets.
- [x] 3.3 Provide sample Grafana/Datadog queries or JSON log snippets in `docs/observability.md` to illustrate usage.
