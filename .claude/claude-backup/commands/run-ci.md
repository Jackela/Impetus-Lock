Run the full CI pipeline locally to validate before pushing.

Execute these checks in order, stopping on first failure:

## 1. Backend Lint
```bash
cd server && poetry run ruff check . && poetry run ruff format --check
```

## 2. Frontend Lint
```bash
cd client && npm run lint && npm run format
```

## 3. Backend Type Check
```bash
cd server && poetry run mypy .
```

## 4. Frontend Type Check
```bash
cd client && npm run type-check
```

## 5. Backend Tests
```bash
cd server && poetry run pytest -v
```

## 6. Frontend Tests
```bash
cd client && npm run test -- --run
```

## Output Format

Report results as a summary table:

| Job | Status |
|-----|--------|
| Backend Lint | PASS/FAIL |
| Frontend Lint | PASS/FAIL |
| Backend Type Check | PASS/FAIL |
| Frontend Type Check | PASS/FAIL |
| Backend Tests | PASS/FAIL (X passed) |
| Frontend Tests | PASS/FAIL (X passed, Y skipped) |

If any job fails, stop immediately and report the error with actionable fix suggestions.
