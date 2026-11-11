## Context

`eval/chinese_stories/` has the apparatus of an experiment and none of the experiment. 24 synthetic cases (`zh-story-001`…`024`; 20 development, 4 holdout) with selections, locks, `must_preserve`, `allowed_reversal` and intent annotations; four JSON schemas (`record`, `draft`, `request-response`, `real-plan`); a checker CLI (`scripts/story_eval.py check`) covering JSON/schema, context truncation, selection offsets, Muse no-delete, Loki short-context provoke, style prefixes, lock annotations, anchors and surrogate pairs; a 40-pair blind review sheet (`anonymous_development/review_cards.json` = 20 development cases × 2 modes) with an empty `ratings.csv` and a withheld `identity_key.json`. What is missing is a single real model call: `real-plan.json` is disabled, `calls: 1`, `repeats: 1`, `implementation_status: "generation_not_implemented"`, `real_model_status: "unassessed"`.

Constraints carried by the README that this design must respect: all bodies are original synthetic text (no user manuscripts); holdout was fixed before any output; do not tune prompts after seeing holdout output; do not read local secrets or change default configuration to "fill in" the unassessed status; simulated and negative records must never be presented as model quality.

## Goals / Non-Goals

- Goals: a real, costed, blinded, human-rated evaluation of the current candidate prompt against the baseline prompt for Chinese story continuation; at least one `kind: "real"` record that passes the contract checker; an honest status line afterwards.
- Non-Goals: prompt tuning inside this change; UI or product changes; replacing human rating with any automatic quality metric; adding user content to the corpus; changing default provider/model settings.

## Decisions

**Decision 1 — Sample and arms.** All 20 development cases × 2 modes (`muse`, `loki`) × 2 arms (baseline `cdb868d`, verified by pinned digest, vs current `candidate`) = 80 calls. The 4 holdout cases (×2 modes ×2 arms = 16 calls) are generated only after the protocol is frozen and are not inspected while tuning. Rationale: the existing sheets already assume 40 pairs = 20 cases × 2 modes, so 80 calls is exactly what `review_cards.json` needs.

**Decision 2 — A/B ordering.** Presentation order per pair comes from the same fixed hash already used to build `anonymous_development/`, and the mapping lives only in `identity_key.json`. Raters never see the file, never score the same pair twice, and never see which arm is "candidate". Rationale: reproducible order, no reviewer-side selection effects.

**Decision 3 — Four-dimension rubric plus a free-standing overall choice.** Per arm: `情节与人物一致性`, `突破是否具体`, `中文适配`, `续写空间`, each 1–5 or `无法判断`, each with a reason quoting specific text. Overall: `A`, `B`, `各有优劣`, `都无帮助`. No composite score is invented; dimensions are reported separately because the product cares about different failure modes (blandness vs. incoherence vs. un-idiomatic Chinese vs. dead-end continuation). Abstentions are reported, never imputed from other dimensions.

**Decision 4 — No LLM judge.** A model scoring these outputs SHALL NOT be used, and SHALL NOT be reported alongside human ratings as if equivalent. Rationale: the question is whether the output helps a human Chinese writer continue; a model judge shares the generator's biases, cannot apply the lock/`must_preserve` narrative judgement the README explicitly leaves to humans, and would make the number unfalsifiable. The checker may only report contract compliance.

**Decision 5 — Cost cap is a hard gate.** The current plan schema is a one-call plan (`calls` const 1, `case_id` const `zh-story-001`, `split`/`mode`/`template_variant` const), which cannot express 80 calls. The schema is therefore extended to a batch plan carrying arms, case list, modes, aggregate `cost_cap` and `currency`, while remaining disabled by default. Worst case is computed before approval as Σ(calls × (input_tokens × price_in + max_output_tokens × price_out)) at the provider's published prices, with `parameters` recorded as an object (today `"unknown"`). Execution stops at the cap; retries stay 0.

**Decision 6 — Approval and provenance.** `enabled: true` requires the existing `approval` object (`approved`, `approved_by`, `approved_at`, `plan_digest`), a named `provider` and `model`, positive `cost_cap`, and `currency`. `plan_digest` covers the frozen plan, so a run whose digest differs from the approved one is rejected. Every real record carries provider/model, effective parameters, template version+digest, `source_sha`, request, raw output, tokens, cost, latency and review state.

## Risks / Trade-offs

- [Cost overrun] → Hard `cost_cap` stop, `max_retries: 0`, per-call accounting before the next call, and a batch plan digest that pins the call count.
- [Contaminated holdout] → Holdout generation is a separate approval; outputs are not inspected before the protocol is frozen; report development and holdout separately.
- [Simulated results misread as quality] → `kind` remains mandatory and explicit; the report must refuse any aggregate that mixes `simulated`, `replayed` and `real`.
- [Single reviewer / non-blind drift] → ≥2 reviewers per pair, hashed A/B order, `identity_key.json` withheld, and abstentions preserved rather than filled.
- [Privacy] → Only synthetic cases; no user task content may be added; reviewer ids pseudonymous; no keys or account identifiers in committed artifacts; if raw real outputs plus costs should not be committed, commit digests and attach the run record.
- [Reviewer fatigue / small n] → 40 pairs × 2 arms × 4 dimensions is a real workload; decide up front whether to rate all 40 pairs or a pre-declared subset, and report the subset — do not quietly reduce coverage.

## Migration Plan

1. Protocol frozen in this document and `README.md` (sample, order, rubric, reviewers, acceptance).
2. `real-plan.schema.json` extended to the batch shape with tests; `real-plan.json` still disabled.
3. Approval obtained (spend authorization) → `enabled: true`, digest pinned.
4. Real generation → `kind: "real"` records → `story_eval.py check` exit 0 with ≥1 real record.
5. `review_cards.json` populated → blind ratings → report → status update.
   Rollback: any step can stop; the plan is reverted to `enabled: false` with the approval retained as history; no product code is touched at any point.

## Open Questions

- Which provider/model and who signs the spend approval? (`provider`/`model`/`cost_cap` are `null` today.)
- Is the budget for 80 calls plus 16 holdout calls approved together or in two decisions?
- Do real run records get committed, or only digests plus an attached artifact?
- Reviewer count and identity: are 2 qualified Chinese readers available per pair, and is that enough to claim a preference?
- Should the overall choice be independent of the four dimension scores (as `ratings.csv` implies) or derived from them?
- Is a single real case passing the checker the intended minimum for leaving `unassessed`, or must every rated case be real before any quality statement is published?
