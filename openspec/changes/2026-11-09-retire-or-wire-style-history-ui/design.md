## Context

`StyleLearningPanel` is the only style UI left in the product: mounted at `client/src/AppLayout.tsx:608`, it analyzes pasted text through `useStyleLearning` → `POST /style/analyze` and can apply the result through `POST /style/apply`. The three components that once displayed history and comparison are deleted, but the routes, persistence, client transport and tests that backed them remain. This document exists because the two options have materially different cost, risk and reversibility, and the choice should be made once, in writing.

## Goals / Non-Goals

- Goals: end the ambiguity in one bounded change; keep the analyze/apply flow untouched; leave no half-wired surface.
- Non-Goals: new style-vector fields, ML/prompt changes, redesign of `StyleLearningPanel`, any change to auth, cookies/CSRF, tasks or locks.

## Decisions

**Decision 1 — Only two end states are acceptable.** Either the panel exposes history and comparison, or the backend surface is removed. A third state ("backend stays, no UI") is what exists today and is explicitly rejected: it forces every auth-contract sweep and type regeneration to reason about routes nothing calls.

**Decision 2 — Wire cost estimate.** Reuse `useStyleHistory` (already paginated, already session-aware) and `useStyleComparison` (already handles 401 and error states). Work is one container change plus one or two child components and their tests: roughly 150–250 lines of client code, no server change, no migration. Risks: the comparison needs two _saved_ vectors, so the UI must offer selection; history exposes previously analyzed text, so it must be account-scoped and obviously so.

**Decision 3 — Retire cost estimate.** Delete two routers and their `main.py` registration, two client services, two hooks and their barrel exports, generated-type entries, model + repository + one alembic revision, and roughly 690 lines of tests (five test files). Risks: a dropped table is unrecoverable; deleting the ownership-matrix entries must happen in the same commit as the routes or the matrix starts asserting 404s as "secure"; generated types must be regenerated, not hand-edited.

**Decision 4 — Recommended: retire.** The deleted components are the only thing that ever read this data, no spec describes the behavior, no client code calls the hooks outside tests, and style history has no path to a user in the current panel. Wiring would add a feature the roadmap does not ask for; retiring removes test and review load permanently. Wire is the right choice only if product confirms history/comparison is a wanted feature — in which case wire first and delete nothing.

**Alternatives considered.** Keeping the backend and marking it internal/deprecated was rejected (no consumer, no owner, still tested); deleting only the client transport was rejected (leaves unreachable routes and an orphaned table).

## Risks / Trade-offs

- [Deleted table / lost analyses] → Prefer code-only removal with the table retained and the migration downgrade documented, or export existing rows before the drop migration is applied.
- [Ownership matrix silently weakened] → `test_style_profile_ownership.py:298-301` asserts 401/403 for `POST /style/history`, `GET /style/history/user/{user_id}`, `GET /style/history/{history_id}`, `DELETE /style/history/{history_id}`; remove those tuples with the routes and re-run the full matrix.
- [Wire path exposes another account's text] → The list must be filtered by the authenticated user id from `/auth/me`, not by a client-supplied `userId` prop default such as `"default-user"` (`AppLayout.tsx:608` currently passes exactly that fallback).
- [Half-migration] → Both paths are single-change, single-commit operations; no path stage leaves routes mounted without a caller.

## Migration Plan

1. Decision recorded in `proposal.md` Status.
2. Wire: tests first (failing), then render; no server change; rollback = revert the panel commit.
3. Retire: remove client transport first (proves nothing calls it), then routes and `main.py` registration, then types, then model/repository/migration, then the now-orphaned tests; rollback = revert commits in reverse order, and restore the table only from a verified backup if the migration drop already ran.
4. Close with `validate --all --strict` and the repo-wide search for the six removed identifiers.

## Open Questions

- Does the deployment expose `/style/history` or `/style/compare` to any caller outside this repository? No evidence in-repo; production access logs were not inspected.
- If retirement is chosen, is dropping `style_history` acceptable, or must rows be retained for later export?
- If wiring is chosen, is "recent 10 analyses, no pagination" enough, and who owns the empty/error states in the panel's visual language?
