## Summary

Describe the user-visible change and why it is needed.

## Type of change

- [ ] Bug fix (restores intended behavior; test written first)
- [ ] New behavior / API / schema / architecture (approved OpenSpec change linked)
- [ ] Documentation, formatting, or comments only
- [ ] Tests or CI infrastructure
- [ ] Dependency update

## Related work

Fixes #
OpenSpec change:
Related PR/issue:

## Verification

List the exact commands you ran and their result. Do not claim CI, deployment, or user acceptance from a local run.

```bash
# backend
cd server && poetry run ruff check . && poetry run mypy . && poetry run pytest tests/ -n auto
# frontend
cd client && npm run lint && npm run type-check && npm run test -- --coverage
```

- [ ] Backend gates pass
- [ ] Frontend gates pass
- [ ] E2E run (if a user flow changed)
- [ ] OpenSpec validation passes (if specs changed)
- [ ] `git diff --check` passes

### Not run / not verified

State checks you could not run and why (real browser, real provider, isolated database, CI runner, deployment).

## Risk and rollback

What could break, and how would we roll it back?

## Checklist

- [ ] I read `AGENTS.md` and followed its precedence and file boundaries.
- [ ] New behavior has an approved OpenSpec proposal (or this is a bug fix/docs/test-only change).
- [ ] I added or updated tests for the changed behavior.
- [ ] I did not disable, skip, or weaken a gate to get a green result.
- [ ] No `.env`, secrets, cookies, or local test artifacts are committed.
- [ ] Documentation links remain valid (`docs/INDEX.md` is updated when needed).
