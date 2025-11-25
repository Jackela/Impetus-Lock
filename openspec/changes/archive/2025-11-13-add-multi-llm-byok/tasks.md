## 1. Spec & Planning
- [x] 1.1 Validate this proposal with `openspec validate add-multi-llm-byok --strict`
- [x] 1.2 Review existing `agentic-interventions` and `editor-agentic-ui` specs to align terminology

## 2. Backend Provider Registry
- [x] 2.1 Define `ProviderConfig` + header parser (provider, model, apiKey) with allowlist validation
- [x] 2.2 Implement provider registry/factory supporting OpenAI, Anthropic, Gemini; add SDK deps in `server/pyproject.toml`
- [x] 2.3 Update `InterventionService` + FastAPI route to pick provider per request and redact logs
- [x] 2.4 Add pytest coverage for env default, header override, invalid provider, quota errors

## 3. Frontend BYOK UI & Wiring
- [x] 3.1 Create "LLM Settings" UI (modal + launcher) allowing provider/model selection and key input; persist to `localStorage`
- [x] 3.2 Update `interventionClient` to inject headers + improve ConfigError messaging
- [x] 3.3 Add Vitest coverage for settings hook/store + API client header injection
- [x] 3.4 Update Playwright helpers/tests to populate BYOK config and assert Muse/Loki flows succeed

## 4. Developer Experience & CI
- [x] 4.1 Document BYOK workflow in README + troubleshooting guide
- [x] 4.2 Re-run `npm test`, `poetry run pytest`, and `act -j e2e -W .github/workflows/e2e.yml --artifact-server-path /tmp/act-artifacts`
- [x] 4.3 Capture updated manual testing evidence (DevTools session or screenshots) showing multiple providers working
