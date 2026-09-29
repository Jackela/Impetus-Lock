# R04: Restore mounted authentication and client CSRF contract

Tier: 2. Findings: B07,F09. Specification status: ready; execution requires dependencies and accepted RED.

## Dependencies

None

## Allowed scope

server/server/auth/router.py; server/server/auth/utils.py; server/server/api/auth/middleware.py; server/server/infrastructure/security/jwt_handler.py; client/src/services/api/* request builders; client/src/contexts/AuthContext.tsx; focused auth/client tests; minimal shared request-header utility if needed

## Pre-approved test seam

Actual mounted auth router and middleware with TESTING unset, real auth service and isolated SQLAlchemy DB; client fetch request options.

## Acceptance criteria

Registration/login issue access_token plus readable random csrf_token with consistent cookie scope; logout clears both. Existing authenticated safe reads succeed; valid writes succeed; missing/wrong CSRF and invalid/expired identity reject. All active cookie-authenticated clients send credentials and CSRF on unsafe calls using one small existing-or-shared helper, preserving custom headers/BYOK. Reproduce and fix import-time vs runtime signing configuration mismatch without exposing secrets; missing/invalid token claims fail401 rather than500. Keep existing endpoints/statuses and no auth UI/router enablement. Do not change production secret policy or invent new session protocols; any such choice is Tier3.

## Global execution contract

- Read CLAUDE.md, openspec/AGENTS.md, docs/agents/domain.md and relevant current specifications before work. User authorizes this Tier2 bug/config/test repair; no Tier3 implementation, remote writes, new product behavior or unapproved scope.
- Depth1: do not spawn agents, threads or subprocess agents. Work only in the worktree assigned by main. Preserve unrelated work. Do not commit, merge, change branches, or edit ticket acceptance. Main alone integrates and accepts.
- Test-writer: write a meaningful first regression at the seam, run it and capture expected RED in the assigned central logs; no production edits. Compiler/config checks may provide RED without artificial test scaffolding.
- Implementer: only after main accepts RED, make minimal correction. Additional slices remain test-first; save further RED then GREEN. Unexpected out-of-scope failures: preserve evidence and report blocker, do not hide or weaken gates.
- Use installed Poetry Python3.12 and Node dependencies; no environment rediagnosis. Server gate: poetry run ruff check .; poetry run ruff format --check .; poetry run lint-imports; poetry run mypy . --no-site-packages --ignore-missing-imports; poetry run pydocstyle server/; poetry run pytest tests/ -n auto -k "not RedisIntegration and not redis_pubsub". Client gate: npm run lint; npm run format; npm run type-check; npm run test. Actual app/tool compiler diagnostics are known baseline until R18: report counts and new errors honestly, do not claim empty root check validates source.
- Run relevant focused checks during work and package gates once at end; preserve the logs and final result. No Playwright/browser E2E, paid model calls, remote CI, or external mutations.
- API public paths/fields/status semantics stay stable. New architecture, shared store, permission schema or major migration -> main for Tier3 proposal.

## Main-agent security boundary clarification

`docs/SECURITY_CHECKLIST.md:7`, `docs/security/SECRETS_MANAGEMENT.md:13`, `.env.example`, and the currently mounted middleware's JWTHandler require a configured secret for protected requests. Preserve that boundary: the signing-time fix must not make protected requests accept a token under the development fallback when JWT_SECRET is absent. The auth utility's historical fallback is not authorization to weaken the middleware. Test the configured-secret path for successful login/read/write; missing configuration must remain fail-closed. Document or propose unresolved secret-policy consolidation rather than silently enabling fallback authentication. Existing JWTHandler-issued token compatibility must be reviewed before changing accepted claims.
