# QA Privacy Checklist

Use this list whenever BYOK changes ship or when running privacy-sensitive demos. Capture evidence (screenshots/logs) for each item and attach it to the release ticket.

1. **Telemetry defaults**
   - [ ] Confirm the Telemetry toggle is *off* for new browser profiles (`localStorage['impetus.telemetry.enabled']` is `null`).
   - [ ] Enable telemetry, trigger Muse/Loki twice, and verify console logs contain provider/model only—no API keys or prompt text.

2. **Persistence hygiene**
   - [ ] In `local` mode, click `Forget Key` and ensure `localStorage['impetus.llmConfig']` is removed.
   - [ ] In `encrypted` mode, click `Forget Key` and ensure both `impetus.llmVault.encrypted` and `impetus.llmVault.salt` are cleared.
   - [ ] Switch from `local`/`encrypted` to `session` and confirm both payload keys are removed immediately.
   - [ ] In `session` mode, trigger `Lock Session` and verify the header button reverts to `LLM 设置`.

3. **Encrypted unlock flow**
   - [ ] Save a key with encrypted storage, reload, enter a wrong passphrase, and see the inline `Passphrase incorrect` error.
   - [ ] Enter the correct passphrase and confirm the API key + provider repopulate the modal.
   - [ ] Rotate the passphrase (fill both fields, Save) and ensure the new passphrase is required on the next reload.

4. **Session expiry**
   - [ ] Save a key in session mode, wait for the idle timeout (or set `document.visibilityState = 'hidden'`) and confirm the cache clears.
   - [ ] Reload the tab and ensure no BYOK headers are sent until the modal is re-saved.

5. **Documentation & hand-off**
   - [ ] Review `docs/security/byok-storage.md` for accuracy.
   - [ ] Update `MANUAL_TESTING_GUIDE.md` with any newly discovered manual steps.
   - [ ] Record test artifacts in `/demo-artifacts` if marketing/QA needs refreshed footage.

Sign off with initials + date once all boxes are checked.
