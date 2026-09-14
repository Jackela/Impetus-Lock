# Change: Remove unused cloud-sync and lock hook entry points

Status: Proposed; awaiting approval. Tier 3, audit finding A17. Production code remains unchanged in this proposal.

## Why

`useTaskSyncCloud` drops server versions and sends `version: 0` on updates. `useLockEnforcement` maintains a local count without subscribing to external LockManager mutations. The September 14, 2026 caller audit found no production consumers: cloud-hook references are its own tests; lock-hook references are its barrel export and documentation. `App.tsx` uses `useTaskSync`, and `EditorCore.tsx` obtains its manager from context.

## What Changes

- After a fresh caller audit, delete the two unused hook implementations, the lock-hook barrel export and stale documentation/examples; remove tests specific only to the deleted cloud hook.
- Retain active `useTaskSync`, task API/version handling, LockManager context, transaction filter and editor integration.
- If a production caller appears before implementation, stop that deletion and reassess the narrow caller migration explicitly; do not invent a shared state architecture or activate cloud synchronization.

## Impact

- Affected spec: `editor-agentic-ui`, adding a bounded retirement requirement while preserving existing editor save/hydration and atomic-action requirements.
- Affected code: `client/src/hooks/useTaskSyncCloud.ts`, its test file, `useLockEnforcement.ts`, `index.ts`, and hook documentation references only.
- Internal exported APIs are removed after consumer verification. No production UX change, dependency removal, new state store or backend change is proposed.
