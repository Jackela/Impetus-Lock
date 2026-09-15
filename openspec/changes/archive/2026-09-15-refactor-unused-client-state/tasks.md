## 1. Consumer verification
- [x] 1.1 Recheck approval and audit all imports, barrel exports, dynamic references, tests and documentation for both hook names; confirm no production consumer.
- [x] 1.2 Verify active useTaskSync version/conflict and editor lock/hydration tests; add a failing regression first only if an uncovered active behavior needs protection.

## 2. Removal
- [x] 2.1 Delete the two unused hook implementations and lock-hook barrel export only after the audit confirms the deletion is safe.
- [x] 2.2 Remove cloud-hook-only tests and stale hook documentation/examples; retain tests of production save and lock behavior.

## 3. Verification
- [x] 3.1 Search for dangling imports and run client type-check, lint, build and relevant Vitest tests.
- [x] 3.2 Run existing editor save/reload/version-conflict and locked-span delete/undo regression flows; confirm no active path was rerouted.
- [x] 3.3 Run strict OpenSpec validation and review the diff for unrelated state, dependency or API changes.
