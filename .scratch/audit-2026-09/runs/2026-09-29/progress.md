# Audit 2026-09-29

Base: `31b0e3f011313e73cf56fc2756f3fb2be2e6b63e`. Integration branch: `codex/audit-2026-09-29`.

## Authorization

- All confirmed Tier 1/2 findings, including P2, must be remediated. Tier 3 is proposal-only.
- Main agent alone integrates and accepts; children depth=1 and may not delegate. Reviewers are read-only.
- Preserve main, prior evidence and the original untracked `.zcode/`. No remote writes or push.
- Each critical file must reach 80% executable-line coverage; no empty scope or excluded source.
- No Playwright, paid live model calls or remote CI execution.

## Waves

1. Matt configuration checked: existing init `b14fdb1` retained; local audit exception clarified.
2. COMPLETE: five read-only charters, including fresh ephemeral CLI workflow audit after built-in agent-thread limit.
3. COMPLETE: findings appended without rewriting history;21 Tier2 tickets,3 Tier1 batches,5 proposal drafts underP-01.
4. Isolated TDD remediation pending.
5. Independent review and full gates pending.

## Baseline gates (ea0ff6e)

- Backend: Ruff check/format, import-linter, declared mypy, pydocstyle PASS; specified pytest selection 649 passed, 6 skipped.
- Client: ESLint, Prettier, existing type-check PASS; Vitest 54 files, 558 passed, 4 skipped. Existing type-check is known to omit actual projects and is not accepted as source validation.
- Critical per-file gaps: ContentInjector 54.21%; base_provider 59.79%; PostgreSQLTaskRepository 51.95%. TaskService currently 96.05% but omitted from fixed critical scope.
- Logs are preserved under this run's logs directory. Test counts are selection-specific; original prompt counts are historical.

## Orchestration runtime

Built-in collaboration spawn reached its per-session agent-thread limit after the planning/audit children. Further workers use fresh `codex --no-daemon ... exec --ephemeral` contexts, explicit gpt-6 model/effort, depth1/no delegation, max3 simultaneous workers. The first read-only CLI audit completed successfully with gpt-6-sol/high; transcript retained in logs/workflow-session.log.

TDD skill public-interface seams are approved in the plan and fixed in each ready ticket. Main accepts RED before fresh implementer dispatch; no agent changes acceptance. Main commits/integrates path-scoped results.
