## Description

Briefly describe the changes made in this pull request.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Tests (adding or updating tests)

## Related Issues

Fixes #
Related to #

## Motivation and Context

Why is this change necessary? What problem does it solve?

Include a summary of the motivation and context for this change.

## Screenshots (if applicable)

Before:
[Before screenshot]

After:
[After screenshot]

## How Has This Been Tested?

- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] E2E tests pass locally
- [ ] Manual testing completed

Please describe the tests that you ran to verify your changes.

## Test Plan

Provide instructions for how to test the changes:

1.
2.
3.

## Checklist

- [ ] My code follows the [style guidelines](../CLAUDE.md) of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published in downstream modules

## Constitutional Requirements Check

This project follows strict constitutional principles. Please confirm:

- [ ] **Article I (Simplicity)**: This is a simple, framework-native implementation
- [ ] **Article II (Vibe-First)**: P1 priority only for un-deletable constraints
- [ ] **Article III (TDD)**: Tests written first (P1 features)
- [ ] **Article IV (SOLID)**: Service layer handles business logic
- [ ] **Article V (Documentation)**: JSDoc/docstrings on public interfaces

## Quality Checks

Before submitting, please ensure:

- [ ] `cd server && poetry install && poetry run ruff check . && poetry run mypy . && poetry run pytest`
- [ ] `cd client && npm ci && npm run lint && npm run type-check && npm run test`
