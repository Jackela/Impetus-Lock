## Summary

Describe the user-visible change and why it is needed.

## Type of change

- [ ] Bug fix (restores intended behavior, with a regression test)
- [ ] New behavior / API / schema / architecture (link the approved OpenSpec change)
- [ ] Documentation, formatting, or comments only
- [ ] Tests or CI infrastructure
- [ ] Dependency update

## Related work

Link the issue, OpenSpec change and related PRs. Include the base and tested head SHA.

## Verification

Use [the workflow table and local commands](../AGENTS.md#quality-gates) and
[testing setup](../TESTING.md). For example, run these focused checks from the
repository root in separate subshells.

```bash
(cd server && poetry run ruff check . && poetry run mypy .)
(cd client && npm run lint && npm run type-check)
(cd miniprogram && npm test && npm run test:contract)
```

List the exact commands you ran and their results, including critical coverage
when measured. Attach CI run links for the tested SHA.

- [ ] Backend gates
- [ ] Frontend gates and coverage contract
- [ ] Main browser suite and Muse/Loki story tests when relevant
- [ ] Authenticated editor suite when authentication, account isolation or durability changed
- [ ] WeChat Mini Program checks, FastAPI contract and build when relevant
- [ ] Production image smoke/recovery when build or deployment changed
- [ ] OpenSpec validation when proposals or specifications changed
- [ ] `git diff --check`

### Not run / not verified

Record checks that could not run, their blockers and any unverified
environment (browser, provider, isolated database, CI runner or deployment).

## Risk and rollback

What could break, and how would we roll it back?

## Checklist

- [ ] I read [AGENTS.md](../AGENTS.md) and followed its precedence and file boundaries.
- [ ] An approved OpenSpec proposal is linked when required.
- [ ] I added or updated tests for the changed behavior.
- [ ] All applicable gates ran with their existing checks and thresholds.
- [ ] The commit excludes environment files, secrets, cookies and local evidence.
- [ ] Documentation links remain valid and the docs index reflects any new reference.
