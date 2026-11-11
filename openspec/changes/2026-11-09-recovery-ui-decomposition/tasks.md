## 1. Contract capture

- [ ] 1.1 Record the five states and their observable contract from `client/src/App.tsx:236,253,298,356,430`: `aria-label`, heading text, paragraph text (including the `readFailed` branch), button labels and order, `role="alert"` / `role="status"` usage.
- [ ] 1.2 Record every `disabled` expression (`!remoteEnabled`, `readyIdentity !== draftIdentity`, `editorIdentity.current !== draftIdentity`, `!recovery.legacy.payload`, `recovery.legacy.readFailed`, `!conflict.server`, `creationChecking`) and the precedence rule `taskError && !creationUncertain`.

## 2. Characterization tests

- [ ] 2.1 Add a test that renders each of the five states and asserts exactly one `section.draft-recovery` with the expected `aria-label`, heading and button order.
- [ ] 2.2 Add a test asserting the fifth panel is suppressed while `creationUncertain` is true, and that the per-issue alert in panel 1 still renders once per issue.
- [ ] 2.3 Confirm the new tests fail against a deliberately reworded literal (proves they actually pin the copy), then restore.

## 3. Extraction

- [ ] 3.1 Create `client/src/components/Recovery/DraftRecoveryPanel.tsx` with a `<section className="draft-recovery">` root and slots for aria-label, title, description, alert, actions and footer; no state, hooks or handlers inside.
- [ ] 3.2 Convert `:236` (account draft issues) and `:430` (task error) first, run the recovery suites.
- [ ] 3.3 Convert `:253` (legacy draft) and `:298` (conflict), run the recovery suites.
- [ ] 3.4 Convert `:356` (unconfirmed creation) including the `role="status"` empty result and candidate list, run the recovery suites.

## 4. Verification

- [ ] 4.1 Run `App.recovery-actions.test.tsx`, `App.task-cancel-recovery.test.tsx`, `App.creation-flow.test.tsx`, `EditorCore.recovery.test.tsx` unmodified, then the full client suite.
- [ ] 4.2 Diff quoted literals in `App.tsx:236-451` before/after and confirm zero copy, order or condition changes.
- [ ] 4.3 Confirm `client/src/styles/auth-entry.css:14` still matches `.authenticated-workspace > .draft-recovery` with no CSS edit; check no other `.draft-recovery` selector relies on removed intermediate structure.
- [ ] 4.4 Run client type-check, lint, build and `npx @fission-ai/openspec@latest validate --all --strict`.
- [ ] 4.5 Manual five-state browser pass at desktop and 320 CSS px: layout, focus order, keyboard operation and announced regions unchanged.
