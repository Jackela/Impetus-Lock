# RED/GREEN evidence index

This is an implementation evidence index, not final acceptance. Final status is in tickets.json and report.md. Logs preserve chronological failures and repairs; a GREEN filename alone does not mean every intermediate command passed. Read the final command results and handoff. Logs are retained locally under this managed worktree, intentionally ignored by Git.

| Ticket | Accepted defect RED / additional slices | Final package GREEN / integration evidence |
|---|---|---|
| R01 | [R01-test-writer-red.log](logs/R01-test-writer-red.log) | [R01-implementer-green.log](logs/R01-implementer-green.log) |
| R02 | [R02-test-writer-red.log](logs/R02-test-writer-red.log) | [R02-implementer-green.log](logs/R02-implementer-green.log) |
| R03 | [R03-test-writer-red.log](logs/R03-test-writer-red.log) | [R03-implementer-green.log](logs/R03-implementer-green.log) |
| R04 | [R04-test-writer-red.log](logs/R04-test-writer-red.log), [R04-boundary-red-red.log](logs/R04-boundary-red-red.log) | [R04-boundary-green-server-gates-green.log](logs/R04-boundary-green-server-gates-green.log), [R04-boundary-green-client-gates-green.log](logs/R04-boundary-green-client-gates-green.log) |
| R05 | [R05-test-writer-red.log](logs/R05-test-writer-red.log), [R05-fixture-repair-red.log](logs/R05-fixture-repair-red.log) | [R05-fixture-repair-green.log](logs/R05-fixture-repair-green.log) |
| R06 | [R06-test-writer-red.log](logs/R06-test-writer-red.log), [R06-implementer-scope-red.log](logs/R06-implementer-scope-red.log) | [R06-implementer-green.log](logs/R06-implementer-green.log) |
| R07 | [R07-test-writer-red.log](logs/R07-test-writer-red.log), [R07-postgres-red-red.log](logs/R07-postgres-red-red.log) | [R07-implementer-green.log](logs/R07-implementer-green.log), [R07-main-postgres-green.log](logs/R07-main-postgres-green.log) |
| R08 | [R08-test-writer-red.log](logs/R08-test-writer-red.log), [R08-implementer-cancellation-red.log](logs/R08-implementer-cancellation-red.log) | [R08-implementer-green.log](logs/R08-implementer-green.log) |
| R09 | [R09-test-writer-red.log](logs/R09-test-writer-red.log) | [R09-implementer-green.log](logs/R09-implementer-green.log), [main-r09-generated-client-green.log](logs/main-r09-generated-client-green.log) |
| R10 | [R10-test-writer-red.log](logs/R10-test-writer-red.log) | [R10-implementer-green.log](logs/R10-implementer-green.log) |
| R11 | [R11-test-writer-red.log](logs/R11-test-writer-red.log), [R11-schema-red-red.log](logs/R11-schema-red-red.log) | [R11-schema-green-green.log](logs/R11-schema-green-green.log) |
| R12 | [R12-test-writer-red.log](logs/R12-test-writer-red.log) | [R12-implementer-green.log](logs/R12-implementer-green.log) |
| R13 | [R13-test-writer-red.log](logs/R13-test-writer-red.log) | [R13-implementer-green.log](logs/R13-implementer-green.log) |
| R14 | [R14-test-writer-red.log](logs/R14-test-writer-red.log) | [R14-motion-type-repair-green.log](logs/R14-motion-type-repair-green.log) |
| R15 | [R15-test-writer-02-red.log](logs/R15-test-writer-02-red.log), [R15-implementer-filter-red.log](logs/R15-implementer-filter-red.log), [R15-implementer-step-positions-red.log](logs/R15-implementer-step-positions-red.log) | [R15-implementer-green.log](logs/R15-implementer-green.log) |
| R16 | [R16-test-writer-red.log](logs/R16-test-writer-red.log), [R16-logger-boundary-red-red.log](logs/R16-logger-boundary-red-red.log) | [R16-logger-boundary-repair-green.log](logs/R16-logger-boundary-repair-green.log) |
| R17 | [R17-test-writer-red.log](logs/R17-test-writer-red.log), [R17-implementer-red.log](logs/R17-implementer-red.log) | [R17-implementer-green.log](logs/R17-implementer-green.log) |
| R18 | Pending | Pending |
| R19 | [R19-test-writer-red.log](logs/R19-test-writer-red.log), [R19-implementer-red-missing.log](logs/R19-implementer-red-missing.log), [R19-implementer-red-real-coverage.log](logs/R19-implementer-red-real-coverage.log) | [R19-implementer-green.log](logs/R19-implementer-green.log) |
| R20 | [R20-test-writer-red-02.log](logs/R20-test-writer-red-02.log) | [R20-implementer-green.log](logs/R20-implementer-green.log) |
| R21 | [R21-test-writer-red.log](logs/R21-test-writer-red.log) | [R21-implementer-green.log](logs/R21-implementer-green.log) |

R15 initial cleanup/path failure is not its accepted RED. R15-implementer-undo-green.log contains an intermediate failed assertion and is not final GREEN evidence. R20 initial fixture-path error is retained separately; -red-02 is the actual policy defect. R07 connection-refused environment evidence is distinct from the successful reproduction using independent PostgreSQL sessions.

Wave5 reviews and final gate logs will be appended after they run.
