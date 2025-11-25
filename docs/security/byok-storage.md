# BYOK Storage & Key Handling

Impetus Lock lets you bring your own LLM credentials without ever sending them to the backend or telemetry pipelines. The front-end `llmKeyVault` service centralizes persistence, encryption, and session hygiene so QA and security teams can reason about how API keys behave in each context.

## Storage modes at a glance

| Mode      | Where data lives                                 | What persists across reloads | Best for |
|-----------|--------------------------------------------------|------------------------------|----------|
| `local`   | `localStorage` key `impetus.llmConfig`           | Provider, model, API key     | Solo devs that trust their workstation |
| `encrypted` | `impetus.llmVault.encrypted` (AES-GCM blob) + `impetus.llmVault.salt` | Encrypted payload + salt (never the passphrase) | Shared machines where BYOK must rest at encrypt-at-rest | 
| `session` | In-memory cache only (`cache` in `llmKeyVault`)   | Nothing – data is wiped on reload/lock/visibility loss | Demos, QA runs, or highly sensitive credentials |

Additional UX controls surface the modes:
- **Storage selector** inside the LLM Settings modal (default `local`).
- **Passphrase inputs** for encrypted mode with inline validation and unlock errors.
- **Header actions** (`Lock Session`, `Forget Key`) to clear sensitive state without re-opening the modal.

## Encryption internals (`encrypted` mode)

- Passphrases derive a 256-bit AES-GCM key via Web Crypto PBKDF2 (SHA-256, 200k iterations, random 16-byte salt stored in `impetus.llmVault.salt`).
- Ciphertext and IV are base64-encoded and saved to `impetus.llmVault.encrypted` alongside the `updatedAt` timestamp.
- Unlocking happens entirely client-side; failed decrypts return "Passphrase incorrect" without leaking detail.
- Rotating a passphrase re-encrypts the in-memory config before persisting, so no plaintext ever hits storage.

## Session mode semantics

- Keys only exist inside the in-memory cache.
- Switching to `session` mode immediately purges any persisted local/encrypted payloads plus cached state.
- Activity listeners (`mousemove`, `keydown`, `mousedown`, `touchstart`) reset an idle timer (`VITE_SESSION_IDLE_MS`, default 5 minutes).
- When the page becomes hidden or the idle timer fires, the cache is wiped and subscribers are notified so the UI reverts to "LLM 设置".
- `Lock Session` immediately clears session caches, mirroring the idle timeout behavior.

## Forgetting and metadata

- `Forget Key` removes both the local and encrypted payload keys plus metadata timestamps. In encrypted mode it also invalidates the passphrase flag so the next save forces re-entry.
- Vault metadata keeps `mode`, `updatedAt`, and whether a passphrase exists. The LLM Settings modal displays the last saved time and adapts the passphrase UI based on this metadata (e.g., requiring confirmation only when needed).

## Telemetry & logging guardrails

- Telemetry remains opt-in. Even when enabled, `emitLLMSelection` only logs provider/model pairs retrieved from the vault cache; API keys never enter log payloads.
- Backend requests attach BYOK data via the `X-LLM-*` headers. These headers are generated just-in-time from the cache so no other subsystem receives raw keys.

## Testing guidance

Automated coverage:
- `client/e2e/llm-settings.spec.ts` exercises local persistence, encrypted unlock failures, and session-mode clearing.
- Vitest coverage lives in `client/src/services/__tests__/telemetry.test.ts` and `client/src/services/api/interventionClient.test.ts`, ensuring no headers leak when the vault is empty.

Manual checks (also mirrored in `MANUAL_TESTING_GUIDE.md`):
1. Save a key in each mode and verify the header pill shows `LLM: <provider>`.
2. Trigger `Lock Session` and `Forget Key` and confirm the UI reverts to "LLM 设置".
3. For encrypted mode, reload the page, enter a wrong passphrase (expect error), then the correct one (config loads).
4. For session mode, reload or blur the tab and confirm the key vanishes.

## Privacy checklist hand-off

QA sign-off requires the privacy checklist in `docs/process/qa-privacy-checklist.md` to be completed before shipping. That document enumerates the manual controls, telemetry toggles, and verification steps regulators asked for.
