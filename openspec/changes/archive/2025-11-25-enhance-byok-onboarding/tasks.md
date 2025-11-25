## 1. UX Enhancements
- [x] 1.1 Extend the LLM Settings modal with provider metadata (docs links, pricing hints, recommended models) and inline validation for API key formats.
- [x] 1.2 Add contextual tips/tooltips that explain how headers are used and privacy expectations.

## 2. Onboarding Flow
- [x] 2.1 Build a first-run checklist or guided tour that highlights the BYOK button, prompts users to paste a key, and confirms a successful Muse/Loki run.
- [x] 2.2 Integrate telemetry hooks (opt-in) that log anonymized events for provider selection, save/clear actions, and LLM errors.

## 3. Docs & Evidence
- [x] 3.1 Update README/manual testing docs with step-by-step BYOK onboarding instructions and new screenshots/GIFs.
- [x] 3.2 Record a short demo (using `scripts/record-demo.sh`) showcasing the new onboarding flow.
- [x] 3.3 Ensure Playwright specs cover the tour/checklist states.
