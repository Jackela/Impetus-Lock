## 1. Decision

- [ ] 1.1 Re-run the consumer audit (`rg "useStyleHistory|useStyleComparison|styleHistoryClient|styleComparisonClient|StyleHistoryList|ComparisonView|StyleComparisonChart"` across `client/`, `server/`, `docs/`, `eval/`) and record the result in the proposal Status line.
- [ ] 1.2 Record the wire/retire decision, its owner and the date; do not start either implementation branch before that record exists.

## 2. Wire path (only if approved)

- [ ] 2.1 Write a failing `StyleLearningPanel` test that asserts the signed-in account's history renders and that another account's history does not, then implement the list on top of `useStyleHistory`.
- [ ] 2.2 Write a failing test for selecting two saved vectors, calling `useStyleComparison`, and rendering metrics/insights; then implement it without changing the analyze/apply flow.
- [ ] 2.3 Cover empty history, list failure, comparison failure and 401 without hiding the existing analyze form; keep current panel styling and keyboard operation.

## 3. Retire path (only if approved)

- [ ] 3.1 Confirm zero production consumers again; then remove the two routers, their `main.py` import and `include_router` lines, and the two client services plus hooks and barrel exports.
- [ ] 3.2 Regenerate `client/src/types/api.generated.ts` and commit only the removed paths.
- [ ] 3.3 Remove `server/server/models/style_history.py`, the repository and the alembic revision, with a reversible downgrade decision recorded (drop table vs keep data).
- [ ] 3.4 Delete tests that only cover the removed paths and keep `test_style_profile_ownership.py`'s auth-required matrix consistent with the routes that remain.

## 4. Verification

- [ ] 4.1 Run strict OpenSpec validation for this change and `validate --all --strict`.
- [ ] 4.2 Run client type-check, lint, build and the panel/hook Vitest suites (both paths), plus the full server pytest suite (retire path).
- [ ] 4.3 Rehearse `alembic upgrade head` / `alembic downgrade -1` on a disposable database (retire path) and confirm no unrelated migration diff.
- [ ] 4.4 Search for dangling imports/exports and confirm no route, table or hook disappears from a test matrix without the corresponding assertion being removed.
