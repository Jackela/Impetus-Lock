# Change Proposal: add-llm-observability

## Why
- We currently log only coarse-grained info (`provider`, `code`) when LLM calls fail. There is no structured tracing for latency, retry counts, or request volumes per provider/model, so it is hard to set SLOs or diagnose slowdowns.
- With BYOK, we must ensure metrics stay anonymized while still surfacing provider-level health; lacking telemetry makes it risky to onboard more users or vendors.

## What Changes
- Introduce structured logging middleware (e.g., `structlog` or Python `logging` JSON formatter) for FastAPI that records correlation IDs, provider/model, latency buckets, and error codes for every intervention request (without capturing `api_key` or raw prompts).
- Add optional OpenTelemetry instrumentation hooks that can export traces to stdout or OTLP endpoints (configurable via env vars) so staging/prod can forward data to Loki/Datadog.
- Expose lightweight `/metrics` (Prometheus) or log-based counters for: request count by provider/mode, success/error rates, P95 latency of `generate_intervention`, and backend retries.
- Extend frontend logging (`client/src/utils/logger.ts`) to include anonymized BYOK events (provider selected, error surfaced) gated behind a telemetry opt-in flag.

## Impact
- Product and infra teams gain visibility into LLM reliability, enabling alerting and capacity planning.
- Helps correlate frontend UX issues with backend provider errors, especially when multiple vendors are in play.
- Provides a foundation for future rate-limiting or quota dashboards.
