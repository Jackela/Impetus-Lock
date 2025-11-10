# Proposal: Update Editor Agentic UI

## Why
- The frontend currently relies on textual prefixes ("> [AI施压 - ...]") to render Muse/Loki interventions, which clashes with the new prefix-free backend contract.
- Rewrite/delete actions need atomic execution with inline locking; current blockquote-only flow cannot lock partial sentences or apply bespoke Vibe cues.
- Loki/Muse Vibe should be conveyed through color/iconography instead of text hacks, and we must capture this behavior via automated UI/E2E tests.
- TDD coverage for rewrite/delete rendering, lock enforcement, and Playwright demos is required before we can safely ship the new backend protocol.

## What Changes
1. Update TypeScript API types + `interventionClient` to consume the richer response (`action`, `source`, anchors, lock ids) and surface them to editor components.
2. Refactor `ContentInjector`, `LockManager`, `TransactionFilter`, and decorations to:
   - Support inline locks for rewrite ranges
   - Execute delete/rewrite actions via range-based transactions
   - Tag inserted nodes/spans with `data-source` for Muse/Loki Vibe styling
3. Refresh Sensory/Vibe UI:
   - New CSS classes (e.g., `.locked-content.source-muse`, `.source-loki`) with color/icon cues
   - Optional iconography component rendered alongside locked blocks
4. Update editor logic (`EditorCore`, `useWritingState`, `useLokiTimer`) to set sensory feedback states correctly for provoke/rewrite/delete and to reject undo attempts on locked spans.
5. Extend Vitest + Playwright coverage (including `scripts/record-demo.sh`) to verify rewrite/delete flows, lock enforcement, and Vibe styling.

## Impact
- Frontend components that display locked content must adopt the new styling classes.
- Playwright recording script will change output (new look & behavior) and should be re-run for docs.
- Users will experience stronger, mode-specific Vibe with true agentic rewrites.
