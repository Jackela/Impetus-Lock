# Change: Wire style history/comparison into StyleLearningPanel or retire the backend surface

Status: Proposed; awaiting approval. Proposal only — no production code, route, schema or generated type is changed by this document.

## Why

The three client surfaces that consumed style history and style comparison are gone (`StyleHistoryList`, `ComparisonView`, `StyleComparisonChart` no longer exist anywhere under `client/src`), but every layer that fed them is still installed and tested:

- Backend routes: `server/server/api/routes/style_history.py` (193 lines, prefix `/style/history` at :14) and `server/server/api/routes/style_comparison.py` (88 lines, prefix `/style/compare` at :8), both mounted at `server/server/api/main.py:157-158`.
- Persistence: `server/server/models/style_history.py` (53), `server/server/infrastructure/persistence/style_history_repository.py` (137) and migration `server/alembic/versions/c39f598d1361_add_style_history_table.py`.
- Client transport: `client/src/services/api/styleHistoryClient.ts` (65), `client/src/services/api/styleComparisonClient.ts` (175), `client/src/hooks/useStyleHistory.ts` (150), `client/src/hooks/useStyleComparison.ts` (153). Their only importers are the barrel `client/src/hooks/index.ts` and their own tests (`useStyleComparison.session.test.tsx`, `styleComparisonClient.session.test.ts`, `client/src/services/api/cookieAuthContract.test.ts:51`) — no component or page renders them.
- Generated contract types: `client/src/types/api.generated.ts:630,656,687,717,1787,2960`.
- Server tests: `server/tests/test_style_profile_ownership.py` (341) and `server/tests/unit/test_style_history_repository.py` (152).

`StyleLearningPanel` (`client/src/components/StyleLearning/StyleLearningPanel.tsx:47`, mounted at `client/src/AppLayout.tsx:608`) uses only `useStyleLearning` and renders `StyleInputForm` + `StyleAnalysisResult`; it never lists past analyses and never compares two style vectors. Roughly 1,670 lines of route/model/repository/client/test code are therefore reachable only by tests, and no `openspec/specs/**` requirement describes them. Two audits in a row have had to re-derive whether this surface is supported, half-supported or abandoned. The cost of indecision is paid again on every generated-type regeneration, cookie/auth contract sweep and route review.

## What Changes

- Record an explicit product decision before touching code: **wire** history + comparison into the existing panel, or **retire** the backend routes and their client transport.
- **Wire path**: extend `StyleLearningPanel` to render the authenticated account's analysis history (paginated, `GET /style/history/user/{user_id}`) and a comparison of two saved style vectors (`POST /style/compare`), reusing `useStyleHistory` / `useStyleComparison` and the existing panel styling; no new endpoint, no new table.
- **Retire path**: delete `style_history`/`style_comparison` routers and their `main.py` registration, the two client services plus the two hooks and their barrel exports, the generated-type entries, the style-history model/repository/migration, and the tests that only cover those paths — in one change, with the ownership test matrix (`test_style_profile_ownership.py:298-301`) removed alongside its routes so no auth-required route disappears from the matrix unverified.
- Either path keeps `StyleLearningPanel`'s current analyze → apply flow, `useStyleLearning`, and the `POST /style/analyze` (or equivalent) boundary unchanged.
- **BREAKING (retire path only)**: `/style/history` and `/style/compare` stop existing; any external caller would receive 404. No in-repo caller is affected.
- Out of scope: new styling/ML features, style-vector schema changes, changes to `useStyleLearning`, and any UI redesign of the panel beyond the two added sections.

## Impact

- Affected specs: `editor-agentic-ui` — one new bounded requirement ("Style History and Comparison Surfaces Are Wired or Retired"), appended to the existing editor requirements without modifying lock, save, hydration or recovery requirements.
- Affected code (wire path): `client/src/components/StyleLearning/StyleLearningPanel.tsx`, its CSS, possibly a new list/comparison subcomponent under `client/src/components/StyleLearning/`; no server change.
- Affected code (retire path): `server/server/api/routes/{style_history,style_comparison}.py`, `server/server/api/main.py:34-35,157-158`, `server/server/models/style_history.py`, `server/server/infrastructure/persistence/style_history_repository.py`, `server/alembic/versions/c39f598d1361_add_style_history_table.py`, `client/src/services/api/{styleHistoryClient,styleComparisonClient}.ts`, `client/src/hooks/{useStyleHistory,useStyleComparison}.ts`, `client/src/hooks/index.ts`, `client/src/types/api.generated.ts`, `server/tests/test_style_profile_ownership.py`, `server/tests/unit/test_style_history_repository.py`, `client/src/hooks/useStyleComparison.session.test.tsx`, `client/src/services/api/styleComparisonClient.session.test.ts`, and one entry in `client/src/services/api/cookieAuthContract.test.ts`.
- Risk of the retire path: a dropped table cannot be recreated from client state alone; the migration must be reversible and its downgrade must not delete a user's analysis history silently without an explicit decision.
- No auth, cookie/CSRF, LLM-provider or task/lock behavior is touched by either path.

## Tasks

- [ ] 1. Decide wire vs retire and record the decision + rationale in this proposal (Status line), plus who owns it.
- [ ] 2a. Wire: write a failing panel test for own-account history list and for a two-vector comparison, then implement rendering on top of the existing hooks.
- [ ] 2b. Wire: cover empty history, non-owner access, unauthenticated 401 and comparison failure without hiding the analyze form.
- [ ] 3a. Retire: confirm zero production consumers again, then remove routers, registration, client services, hooks, barrel exports and generated types in one commit.
- [ ] 3b. Retire: remove style-history model/repository/migration and the tests that only cover removed paths; keep the ownership matrix entry set consistent with the routes that remain.
- [ ] 4. Update or confirm the affected spec delta, then run the validation list below.

## Validation

- `openspec validate 2026-11-09-retire-or-wire-style-history-ui --strict` and `npx @fission-ai/openspec@latest validate --all --strict`.
- Wire path: `npm run -w client test` for the panel and hook suites, `npm run -w client type-check`, `npm run -w client lint`; manual browser check that the panel still analyzes and applies a style and that history/comparison only render for the signed-in account.
- Retire path: `pytest server/tests/test_style_profile_ownership.py server/tests/unit/test_style_history_repository.py` deleted-or-updated cleanly, full `pytest server/tests`, `alembic upgrade head` then `alembic downgrade -1` on a disposable database, `npm run -w client type-check` after regenerating types, and a repo-wide search for `styleHistoryClient|styleComparisonClient|useStyleHistory|useStyleComparison|StyleHistoryList|ComparisonView|StyleComparisonChart` returning only intentional remnants.
- Both paths: OpenAPI/generated-type regeneration (`client/src/types/api.generated.ts`) committed with no unrelated diff.

## Open Questions

- Is style history a product feature anyone still wants, or was it only scaffolding for the deleted components? (owner: product)
- Does any external or unpublished integration call `/style/history` or `/style/compare`? Repository search says no, but deployment logs for these paths were not inspected.
- Wire path: does the panel need pagination and per-item delete, or is a 10-item recent list enough? Comparison requires two _saved_ vectors, so a select-two UI is the minimum.
- Retire path: should the `style_history` table be dropped in the same migration or left in place and only the code removed (data-retention preference)?
- Does dropping the routes break any documented API surface in `docs/` or `.github/PR_BODY_TEMP.md` that still advertises them?
