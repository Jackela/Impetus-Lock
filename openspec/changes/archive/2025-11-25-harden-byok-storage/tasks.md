## 1. Storage Modes
- [x] 1.1 Design an abstraction (e.g., `LLMKeyVault`) that supports `localStorage`, `encryptedLocalStorage`, and `inMemory` strategies.
- [x] 1.2 Implement Web Crypto encryption (AES-GCM) using a passphrase-derived key with PBKDF2; store IV + ciphertext only.
- [x] 1.3 Add session-only mode that wipes data when the tab loses visibility or after configurable idle timeout.

## 2. UX & Controls
- [x] 2.1 Update the LLM Settings modal to let users choose storage mode, set/reset passphrase, and view key age/last-used metadata.
- [x] 2.2 Provide explicit "Forget key" / "Lock session" actions accessible from the main UI.
- [x] 2.3 Add e2e tests ensuring encrypted/session modes work across reloads and fail closed when passphrase is wrong.

## 3. Docs & Threat Model
- [x] 3.1 Document storage modes, encryption details, and limitations in `README.md` and a new `docs/security/byok-storage.md`.
- [x] 3.2 Capture security considerations (e.g., clipboard use, shared machines) and recommended practices.
- [x] 3.3 Coordinate with QA to run a privacy checklist before release.
