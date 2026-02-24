# Proposal: Multi-Provider Bring-Your-Own-Key

## Summary
Let writers pick their preferred LLM vendor (OpenAI, Anthropic Claude, Google Gemini) and supply their own API key directly inside the editor. The backend must route each intervention request to the selected provider without logging or persisting the secret, so Muse/Loki continue working even when the shared OpenAI quota is exhausted.

## Problem Statement
Current behaviour hard-codes a single OpenAI Instructor client that pulls `OPENAI_API_KEY` from `server/.env`. When quota is exceeded or the key is missing, every Muse/Loki trigger fails with HTTP 500. The UI then displays a generic "LLM API 未配置" message and the product becomes unusable. Power users asked to plug in their own Anthropic or Gemini keys, but there is no UI nor backend pathway to honor that request.

**Pain Points**
- ❌ Backend rejects requests unless `OPENAI_API_KEY` exists and has quota.
- ❌ Frontend cannot select vendors nor inject per-user keys.
- ❌ Playwright/CI cannot exercise multiple providers or cover the new configuration flow.
- ❌ Logs expose only a generic error, offering no remediation guidance.

## Proposed Solution
1. **Provider registry** (backend): introduce a `ProviderConfig` DTO + registry that can instantiate OpenAI, Anthropic, or Gemini clients on demand. Default to env config, but allow overrides via `X-LLM-Provider`, `X-LLM-Model`, `X-LLM-Api-Key` headers supplied by the frontend. Secrets stay in-memory per request.
2. **Client-side BYOK UI**: add an "LLM Settings" modal that lets writers pick a vendor, recommended economical model (e.g., `gpt-4o-mini`, `claude-3-5-haiku-latest`, `gemini-2.0-flash-lite`), and paste their API key. Persist selection in `localStorage` and attach it to every intervention call.
3. **Error transparency**: surface granular backend errors (quota exceeded, invalid key, unsupported provider) instead of the generic "未配置" banner.
4. **Tests & CI**: extend Vitest to cover config persistence + header injection, add backend unit tests for all provider branches, and update Playwright smoke flow to exercise the modal. Run `act -j e2e ... --artifact-server-path /tmp/act-artifacts` to keep CI green.

## Scope
**In scope**
- Provider registry + pluggable clients (OpenAI Instructor, Anthropic SDK, Google GenAI SDK).
- Request headers for BYOK overrides + validation/sanitization.
- Frontend settings UI, persistence, and request wiring.
- Updated logging/error messaging.
- Unit + e2e coverage and CI runbook updates.

**Out of scope**
- Long-term secure storage of user keys (they remain in browser memory/storage only).
- Rate limiting or usage tracking per provider.
- Offline/local LLM execution.

## Success Criteria
- [ ] Muse/Loki succeed locally by supplying any of the three vendors via the new UI.
- [ ] Backend rejects unsupported providers with HTTP 422 and descriptive JSON.
- [ ] No API key ever appears in logs or persistence layers.
- [ ] Vitest + backend pytest suites cover provider selection + error paths.
- [ ] Playwright e2e exercises the modal and both Muse/Loki flows while CI (via `act --artifact-server-path`) reports green.

## Dependencies
- Python SDKs: `openai>=1.56`, `anthropic>=0.37`, `google-genai>=0.6` (or latest stable) for provider clients.
- Existing intervention schema/specs in `agentic-interventions` and `editor-agentic-ui`.

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| User pastes invalid key and blames app | Medium | Validate response codes, show actionable error strings, keep server logs redacted |
| Secret leakage via logs | High | Never log header values, gate debug logging behind redaction helper |
| SDK bloat increases cold start time | Low | Lazy-import provider clients only when requested |
| Playwright tests become flaky due to modal | Medium | Provide deterministic helper to seed BYOK config (localStorage) before tests |

## Estimate
5-6 developer days including SDK wiring, UI work, test updates, and CI verification.

## References
- OpenAI API doc: https://api.openai.com/docs/api-reference/chat
- Anthropic Messages API: https://docs.anthropic.com/en/api/messages
- Google Gemini API: https://ai.google.dev/gemini-api/docs/model-catalog
