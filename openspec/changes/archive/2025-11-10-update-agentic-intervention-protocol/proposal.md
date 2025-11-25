# Proposal: Update Agentic Intervention Protocol

## Why
- Current LLM contract only supports `provoke`/`delete` with hard-coded text prefixes, which prevents true agentic rewrite behaviors and forces UI hacks.
- Muse/Loki modes must decide among provoke, rewrite, or delete with strong safety guards (e.g., short context fallback, Muse never deletes) to fulfill the agent design brief.
- Prompts still instruct the LLM to emit textual labels; we need clean JSON payloads plus a way to signal the intervention source so the frontend can render vibe-driven UI.
- TDD coverage must expand to include rewrite handling and Muse/Loki safety invariants so future refactors remain safe.

## What Changes
1. Extend the Intervention API contract (OpenAPI + Pydantic + TS types) with:
   - `action` ∈ {`provoke`,`rewrite`,`delete`}
   - `source` metadata (Muse vs Loki)
   - Anchor expectations for rewrite/delete, fallback defaults if LLM omits them
   - Backend-generated `lock_id` for provoke and rewrite
2. Rewrite Muse/Loki prompts to focus on JSON-only outputs without textual prefixes; encode decision rules for each mode (Muse biased toward provoke/rewrite, Loki chaotic mix plus safety guard hints).
3. Update `InstructorLLMProvider` to parse the new minimal JSON, synthesize canonical responses (lock ids, anchors, issued_at) and expose mode/source metadata.
4. Enhance `InterventionService` safety logic:
   - Muse mode auto-converts delete → rewrite/provoke as needed
   - Short-context Loki decisions auto-fallback to provoke
   - Rewrite anchors validated & clamped
5. Add regression tests covering the new behaviors (API contract tests, service unit tests, Loki random logic tests) using TDD.

## Impact
- Requires frontend consumers to handle the richer response (covered by separate proposal).
- Demands new environment variable validation (OpenAI key) but still backward-compatible once frontend updates land.
- Provides groundwork for future multi-agent actions.
