# Wave 2 — frontend audit

Read-only audit at ea0ff6e. No code writes or remote mutations.

| ID | Severity | Location | Fact | Action | Tier |
|---|---|---|---|---|---|
| F01 | P2 | client/package.json:14 | Root tsc configuration has no source inputs;248 app diagnostics hidden | Repair diagnostics then enable effective app/node checks | 2 |
| F02 | P2 | client/src/vite.d.ts:1 | Ambient declaration replaces react-query public types | Use actual library public types | 2 |
| F03 | P2 | client/src/types/api.generated.ts:142 | Generated API types omit current fields and mark anchor optional | Regenerate from current OpenAPI and check drift | 2 |
| F04 | P1 | client/src/hooks/useTaskSync.ts:264 | Positional calls to object-parameter APIs drop content/version | Use current request object and verify actual fetch JSON | 2 |
| F05 | P2 | client/src/hooks/useCreateTask.ts:83 | Mutation wrapper discards callbacks supplied by modal | Forward public mutation callbacks and test real hook seam | 2 |
| F06 | P1 | client/src/hooks/useTaskSync.ts:290 | Switch loses pending saves; overlapping saves conflict and overwrite newer edits | Serialize task saves, preserve drafts, isolate task completions | 2 |
| F07 | P2 | client/src/hooks/useTaskSync.ts:223 | Failed old load prevents latest selected task loading | Latest request wins, ignore stale completions | 2 |
| F08 | P2 | client/src/hooks/useTaskSync.ts:248 | Root StrictMode creates two initial tasks | Make bootstrap idempotent without disabling StrictMode | 2 |
| F09 | P1 | client/src/services/api/interventionClient.ts:137 | Active clients omit required credentials/CSRF contract | Merge with B07 full authentication request repair | 2 |
| F10 | P2 | client/vitest.config.ts:20 | Aggregate coverage hides ContentInjector54.21% | Per-file80 and public ProseMirror operation tests | 2 |
| F11 | P2 | client/package.json:7 | Declared Node range includes versions excluded by jsdom/Vitest | Use supported intersection ^22.13.0 || ^24.0.0 | 2 |
| F12 | P2 | client/src/components/Task/index.ts:23 | Nonexistent exports and undeclared axios/router imports fail compilation | Remove impossible exports; reconcile used dependencies without enabling new UI | 2 |
| F13 | P2 | client/src/App.tsx:162 | React19 props/JSX/ref/nullability contracts fail strict compiler | Repair actual public component contracts and guards | 2 |
| F14 | P2 | client/src/components/Editor/EditorCore.tsx:608 | Editor/ProseMirror plugin and public type contracts fail compiler | Repair library API use while preserving transaction safety | 2 |
| F15 | P2 | client/src/types/ai-actions.ts:13 | Enums/parameter properties violate erasable syntax; BufferSource and guards fail | Preserve values and runtime behavior with correct syntax/types | 2 |
| F16 | P2 | client/src/components/Editor/TransactionFilter.test.ts:101 | 135 test diagnostics masked by transpilation | Repair test fixtures and signatures without suppressions | 2 |
| F17 | P2 | client/vite.config.ts:7 | Vite config contains invalid duplicate test property | Use existing separate test config and check tool configs | 2 |

F04 uses actual client and captured fetch bodies. F06–F08 use real React19/JSDOM hook with controlled API promises. F05 is source-confirmed pending integration RED. F10 uses main baseline558passed4skipped. Historical partial mocks/BYOK unreproduced; keep evidence status without speculative fixes. Completing authentication UI or wholesale retirement/new editor architecture requires Tier3.
