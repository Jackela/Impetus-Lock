# Dependabot — 2026-09-29 read-only snapshot

All8 open PRs are Dependabot major upgrades. None approved, merged, rebased, commented on or pushed in this run. Green remote checks do not replace local acceptance.

| PR | Status observed | Risk and recommendation | Required verification before a future approved migration |
|---|---|---|---|
| [190 Vite8](https://github.com/Jackela/Impetus-Lock/pull/190) | CLEAN/green | Medium; coordinate plugin-react6, Rolldown/Oxc/browser target changes | Node22/24 install, HMR, production preview editor/locks/save/reload/export |
| [189 Node types26](https://github.com/Jackela/Impetus-Lock/pull/189) | CLEAN/green | Low-medium; types ahead of supported runtimes | No26-only runtime APIs; explicit supported typing policy |
| [185 redis-py8](https://github.com/Jackela/Impetus-Lock/pull/185) | BEHIND/green | Medium; async connection lifecycle | Latest base, realRedis7 pubsub/rate limit/reconnect/cancel/close |
| [181 plugin-react6](https://github.com/Jackela/Impetus-Lock/pull/181) | BLOCKED/test+E2E fail | High; Vite7 lacks vite/internal export required by plugin6 | Upgrade with Vite8 then unit/build/HMR/E2E |
| [180 ESLint10](https://github.com/Jackela/Impetus-Lock/pull/180) | CLEAN/green | Medium; engine and plugin/config changes | Supported runtime plus TS/JSDoc/Hooks rules actually active |
| [177 lint-staged17](https://github.com/Jackela/Impetus-Lock/pull/177) | CLEAN/green | Medium; Node>=22.22.1, but root hook uses root lint-staged15 | Decide client copy purpose; verify real staged hook and root coordination |
| [176 Hooks7](https://github.com/Jackela/Impetus-Lock/pull/176) | BLOCKED/lint fail | High; existing preset incompatible with flat config | Correct flat preset and review new compiler rules |
| [172 pytest9](https://github.com/Jackela/Impetus-Lock/pull/172) | BEHIND/backend+matrix fail | High; removed path hook prevents collection | collection_path, Python3.11/3.12, optional/xdist/realRedis matrix |

Evidence: all PR diffs/release summaries and failed job logs read by audit_hygiene; [Vite migration](https://vite.dev/guide/migration), [ESLint10 migration](https://eslint.org/docs/latest/use/migrate-to-10.0.0), [pytest hook migration](https://docs.pytest.org/en/stable/deprecations.html#py-path-local-arguments-for-hooks-replaced-with-pathlib-path). Refresh open PR list at final handoff.
