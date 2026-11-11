# Change: Decompose the five duplicated recovery panels in App.tsx

Status: Proposed; awaiting approval. Internal refactor only — no user-visible text, role, aria-label, disabled condition or handler behavior changes.

## Why

`client/src/App.tsx` (559 lines) renders five recovery panels inline, at `:236`, `:253`, `:298`, `:356` and `:430`, closing at `:451` — 216 lines of JSX that repeat the same shell and drift apart:

1. `:236` account draft issues (`recoveryIssues.length > 0`) — `aria-label="Account draft recovery"`, `<h2>Owned draft needs recovery</h2>`, one `<p role="alert">` + export button per issue.
2. `:253` unassigned legacy draft (`auth && recovery.legacy`) — `aria-label="Unassigned draft recovery"`, title varies by `readFailed`, one alert paragraph, four actions.
3. `:298` version conflict (`conflict`) — `aria-label="Version conflict"`, title + description, three actions, one or two `<details>`/`<pre>` blocks.
4. `:356` unconfirmed creation (`creationUncertain`) — `aria-label="Unconfirmed task creation"`, title + description, optional alert, three actions, optional `role="status"` empty result and a candidate `<ul>`.
5. `:430` task error (`(taskError && !creationUncertain) || recoveryError`) — `aria-label="Draft recovery actions"`, alert only, two actions.

Every one repeats `<section className="draft-recovery" aria-label=…>` → optional `<h2>` → `<p>` → `<div className="recovery-actions">` → optional alert/details/list. Because the shell is copy-pasted, semantics are inconsistent in small ways that already matter: some panels have headings and some do not, alert placement differs (before vs. inside vs. after actions), and the fifth panel duplicates the `recoveryError ?? taskError` decision already taken at `:432` and again at `:476`. The styling contract also depends on the shape: `client/src/styles/auth-entry.css:14` targets `.authenticated-workspace > .draft-recovery` as a direct child, so any decomposition that inserts a wrapper div silently drops the layout rules.

## What Changes

- Extract one parameterized presentational component, e.g. `client/src/components/Recovery/DraftRecoveryPanel.tsx`, owning the shell only: `ariaLabel`, optional `title`, optional `description`, optional `alert` content, optional `children`/`actions` slot, and optional footer region.
- Replace the five inline shells with five call sites of that component, passing today's exact literals, handlers and conditions through unchanged. All state, effects, handlers (`importLegacy`, `recoverConflict`-style callbacks, `checkCreatedTask`, `adoptCreation`, `recovery.export*`, `retry`) and the `key={issue.key}` mapping stay in `App.tsx`.
- Preserve verbatim: the five `aria-label` values, all `<h2>`/`<p>` text including the `readFailed` branch, every button label (`Export original account draft`, `Import as a new draft`, `Retry reading unassigned draft`, `Export original draft`, `Discard unassigned draft`, `Save as a new draft`, `Use server version`, `Export local draft`, `Check for the created task` / `Checking created tasks…`, `Save as a separate new draft`, `Use created task: {title}`, `Retry draft recovery`), every `disabled` expression, the `role="alert"` vs `role="status"` distinction, and the mutual exclusion `taskError && !creationUncertain`.
- Keep the root element of the component a `<section className="draft-recovery">` so `auth-entry.css:14` continues to match and no CSS is edited.
- No prop, hook, context, service or API change; no new dependency; no state moved out of `App.tsx`.
- Not in scope: changing copy, reordering panels, changing when panels appear, restyling, extracting `App.tsx` state, or touching the `data-testid="unrecovered-account-draft"` blocked-recovery branch at `:497`.

## Impact

- Affected specs: `editor-agentic-ui` — one new requirement that the recovery markup may be shared but its observable behavior must not change; existing recovery/creation requirements are untouched.
- Affected code: `client/src/App.tsx:236-451` (five call sites), new `client/src/components/Recovery/DraftRecoveryPanel.tsx` (+ optional CSS-free markup only), optionally `client/src/components/Recovery/index.ts`.
- Affected tests: `client/src/App.recovery-actions.test.tsx` (3 cases — unassigned-source read failure with disabled incomplete export; explicit unconfirmed-creation check and choosing a matching server task; creation form preserved across re-check), `client/src/App.task-cancel-recovery.test.tsx` (3 cases — resume A autosave after cancelled B; delayed B editor save; legacy import after delayed clean B), `client/src/App.creation-flow.test.tsx`, and `client/src/components/Editor/EditorCore.recovery.test.tsx`. All must pass **unmodified**; if one needs a change, the refactor changed behavior and must be reverted or the delta widened explicitly.
- Size expectation: `App.tsx` should drop roughly 100–130 lines while total markup meaning stays identical; the new component is expected to be ~40–70 lines.
- Risk: low blast radius (one file + one new component), but high subtlety — the panels encode data-safety behavior (blocked recovery, conflict resolution, unconfirmed creation) whose regressions look like "nothing happened" rather than a crash.

## Tasks

- [ ] 1. Capture the current observable contract: the five `aria-label` values, all heading/paragraph/button strings, `role="alert"`/`role="status"` placement, button order and every `disabled` expression; record it in `design.md` (or keep it as the test baseline).
- [ ] 2. Write a characterization test that renders each of the five states and asserts one `section.draft-recovery` with the expected `aria-label`, heading and button order, plus that `taskError` is suppressed while `creationUncertain` is true.
- [ ] 3. Add `DraftRecoveryPanel` with a `<section className="draft-recovery">` root and slots for title, description, alert, actions and footer; no logic inside.
- [ ] 4. Convert the five call sites one at a time, running the recovery suites after each conversion, without editing any string literal or condition.
- [ ] 5. Confirm the CSS contract (`client/src/styles/auth-entry.css:14`) still matches as a direct child and that no `.draft-recovery` rule needs an edit.
- [ ] 6. Verify the diff contains no copy change, no reordering, and no handler/state movement; then run the full client suite.

## Validation

- `npx @fission-ai/openspec@latest validate --all --strict`.
- Run, unmodified: `client/src/App.recovery-actions.test.tsx`, `client/src/App.task-cancel-recovery.test.tsx`, `client/src/App.creation-flow.test.tsx`, `client/src/components/Editor/EditorCore.recovery.test.tsx`; then the full client Vitest suite.
- `npm run -w client type-check`, `npm run -w client lint`, `npm run -w client build`.
- String-diff audit: extract every quoted literal from `App.tsx:236-451` before and after and diff them; the only permitted differences are none. Same for the five `aria-label` values and button order.
- Manual pass in the browser over the five states (account issues, legacy draft, conflict, unconfirmed creation, task error) confirming identical layout, focus order and keyboard operation; visually compare the `draft-recovery` block before/after at desktop and 320 CSS px.
- Accessibility spot check: each panel is still a labelled region, alerts still announce, and heading levels are unchanged (no `<h2>` promoted or demoted).

## Open Questions

- Should the `role="alert"` inside panel 1's per-issue loop stay a `<p>` per issue (current) or become a single aggregated alert? Changing it is out of scope here — confirm it stays per issue.
- Is a characterization test on the five states acceptable as the regression baseline, given the repository has no snapshot convention in the recovery suites?
- Should the fifth panel (`taskError`) keep having no heading while the other four have `<h2>`? Uniformity would change the DOM/announced structure, so this proposal keeps the asymmetry unless explicitly approved.
- Where should the component live — `client/src/components/Recovery/` (new directory) or alongside existing recovery-adjacent UI? No existing directory owns this markup today.
- Do we also want to decompose `:497` (`hasBlockedRecovery` / `data-testid="unrecovered-account-draft"`)? It shares the visual language but is not one of the five panels and is left untouched.
