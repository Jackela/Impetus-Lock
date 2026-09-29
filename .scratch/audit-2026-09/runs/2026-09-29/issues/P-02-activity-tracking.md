# P-02: Draft missing writing statistics and achievement tracking

Tier3 drafting only. Ready. Main verified during P-01 review: stats period endpoint always returns literal zeros (`server/server/api/routes/stats.py:76-94`); production code references UserStats only in model and read routes, with no writer; Achievement has model/read routes/definitions but no award write path. Existing `openspec/specs/stats/spec.md` and `achievements/spec.md` require tracking/period aggregation/milestone awards. The specs do not define period boundaries/timezone, writing-duration evidence, historical reconstruction or exactly-once milestone policy. Fulfilling all metrics requires a persistence/behavior decision, not a guessed Tier2 implementation.

## Allowed files

New openspec/changes/complete-writing-activity-tracking/{proposal.md,design.md,tasks.md,specs/**/spec.md}; append P-02 section to the current run proposal-index.md. No code, dependency, existing current spec or archived spec changes. Read existing proposals to avoid conflicts.

## Required result

Ground missing paths in actual code. Recommend the smallest framework-native persisted activity/aggregate approach justified by real metrics; compare deriving task/intervention counts from existing records plus explicitly unavailable writing time against a minimal dated activity record / daily aggregate. Do not invent product event bus or generic gamification framework. Explain timezone/day-week-month boundaries, writing duration measurement, delete/correction handling, concurrency/idempotency, account ownership, unique award identity and migration/backfill limitations as proposed choices. Existing task/AI writes must only contribute after successful commit; retries cannot double count. Missing historical timing is unknown, not a fabricated zero or invented backfill. Define behavior for no activity vs unavailable evidence with an explicitly proposed public schema/compatibility choice if needed; do not implement it.

Use existing stats and achievements capabilities; add narrowly scoped requirements/scenarios without canonizing current literal-zero stubs. Clarify relationship to refactor-remaining-route-service-boundaries: structural extraction does not approve missing behavior or weaken current specs. Keep all tasks unchecked. Include recommended path, meaningful alternative (including withdrawing unsupported UI/API only if owner chooses), concrete acceptance examples, migration/rollback preserving existing data and open approval decisions. Strictly validate with fixed @fission-ai/openspec@0.23.0. Format pass is not approval. No real provider/browser/remote mutations.

Depth1, no delegation, only assigned worktree + central evidence logs. Main alone commits/integrates. Return evidence and exact paths.
