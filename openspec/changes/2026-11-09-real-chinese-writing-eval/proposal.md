# Change: Produce a real Chinese-writing evaluation with human blind ratings

Status: Proposed; awaiting approval and a separate spend authorization. Proposal only — no model call is made, no key is read, no default configuration changes, and `real-plan.json` stays `enabled: false` until the approval recorded here exists.

## Why

`eval/chinese_stories/` currently proves only that context assembly, structured output and action contracts can be checked. It cannot say whether the feature helps anyone write:

- `real-plan.json` has `enabled: false`, `approval: null`, `provider: null`, `model: null`, `parameters: "unknown"`, `cost_cap: null`, `implementation_status: "generation_not_implemented"`, `real_model_status: "unassessed"`.
- `anonymous_development/ratings.csv` is a header plus 40 empty rows (`pair-001`…`pair-040`); no score, no reviewer, no reason has ever been recorded.
- Every record in the corpus is `simulated` (deterministic replay through `BasePromptLLMProvider` / `InterventionService`) or `negative` (deliberately wrong); there is no record with `kind: "real"`, so the checker's contract pass says nothing about creative quality and the README is careful to say so.
- `cases.json` holds 24 stable cases (`zh-story-001`…`zh-story-024`; 20 `development`, 4 `holdout`) covering dialogue, action, interior monologue, suspense, transitions, unfinished sentences, short openings, selections, locks, emoji and over-limit bodies. The material exists; the experiment does not.
- `real-plan.schema.json` pins `calls: 1`, `repeats: 1`, `max_retries: 0`, `case_id: "zh-story-001"`, `mode: "muse"`, `template_variant: "candidate"`. A real A/B comparison therefore cannot be expressed as one plan under the current schema — a batch plan shape (or per-call plans) is missing.

Without a real run, every downstream claim about "AI helps Chinese story writing" is unmeasured. This change defines the experiment so it can be approved and executed once, with cost, privacy and acceptance criteria fixed in advance. It is deliberately not a feature change.

## What Changes

- Define the sample: all 20 `development` cases × 2 modes (muse, loki) × 2 template arms (baseline vs candidate) = 80 calls; the 4 `holdout` cases are generated only after the protocol is frozen, and never used to tune prompts.
- Define A/B mechanics: one identical, frozen request input per pair; only the template differs; A/B presentation order comes from the existing fixed hash in `anonymous_development/` so it is reproducible and not reviewer-chosen.
- Define the rating instrument already implemented in `ratings.csv`: four dimensions (`情节与人物一致性`, `突破是否具体`, `中文适配`, `续写空间`) scored 1–5 or `无法判断` per arm, each reason citing specific text, plus one overall choice from `A`, `B`, `各有优劣`, `都无帮助`.
- Define the acceptance bar: at least one imported record with `kind: "real"` that passes `story_eval.py check` with exit code 0, plus a completed blind rating sheet whose coverage and reviewer count are stated; `real_model_status` may then move off `unassessed`, and only for the cases actually rated.
- Define cost control: a batch plan with an explicit `cost_cap`, `currency`, provider, model and effective parameters, worst-case arithmetic at the provider's published prices, and a hard stop when the cap is reached — no retries, no silent re-runs.
- Define privacy and consent: only the original synthetic cases may be used (never user task content or manuscripts); reviewer identity stays in `identity_key.json` and is not opened by raters; `ratings.csv` carries a pseudonymous reviewer id and no personal data.
- **Explicitly out of scope, and forbidden as a substitute**: using an LLM as judge to replace human blind rating. Machine checks may report contract compliance only; they SHALL NOT produce or impute quality scores, and no averaged model judgment may be reported as human preference.
- Extending the plan schema from a one-call plan to a batch plan is part of this change (schema + validation only, still `enabled: false` by default).

## Impact

- Affected specs: `agentic-interventions` — one new requirement ("Real-Model Chinese Story Evaluation Uses Human Blind Rating") appended to the existing prompt-contract requirements; no existing requirement changes.
- Affected code/data: `eval/chinese_stories/real-plan.json`, `real-plan.schema.json` (batch shape), `scripts/story_eval.py` (batch plan validation and real-record import), `eval/chinese_stories/anonymous_development/{review_cards.json,ratings.csv,identity_key.json}`, new run records under `eval/chinese_stories/` (real records), and `eval/chinese_stories/README.md` (status wording).
- Not affected: `server/**` product code, default provider/model configuration, prompt templates themselves (they are frozen and digested, not edited), `client/**`.
- Cost: the only change in this batch that can spend money; gated behind an explicit approval object and a positive `cost_cap`.
- Risk: a real run mixed with simulated records could be misreported as measured quality; the README and checker must keep `kind` explicit and refuse aggregated claims that ignore it.

## Tasks

- [ ] 1. Freeze the protocol: sample (20 dev cases × 2 modes × 2 arms), A/B order rule, rubric, reviewer count (≥2 per pair), acceptance bar, and record it in `design.md`.
- [ ] 2. Extend `real-plan.schema.json` to a batch plan (multiple arms/cases/modes, aggregate `cost_cap`, per-call parameters) while keeping `enabled: false` and `calls`/`repeats`/`max_retries` explicit; add schema tests.
- [ ] 3. Write the worst-case cost calculation at published provider prices and obtain an approval object with `approved`, `approved_by`, `approved_at`, `plan_digest`, a positive `cost_cap` and `currency`.
- [ ] 4. Implement or authorize a real-run entry point that emits `record.schema.json` records with `kind: "real"` and per-call token/cost/latency, without reading local secrets or changing default configuration.
- [ ] 5. Import the real records and pass `story_eval.py check` with exit 0 for at least one `kind: "real"` record.
- [ ] 6. Populate `review_cards.json` from real outputs, keep `identity_key.json` withheld from raters, and collect blind ratings into `ratings.csv` for the frozen sample.
- [ ] 7. Report Muse/Loki and development/holdout separately; state reviewer count, pair coverage, contract failures and abstentions (`无法判断`) without averaging them away.

## Validation

- `npx @fission-ai/openspec@latest validate --all --strict` (this change included).
- Schema: `real-plan.json` still validates and still has `enabled: false` before approval; after approval it validates with the batch shape and a positive `cost_cap`; a run whose plan digest does not match the approved digest must be rejected.
- Checker: `server/.venv/bin/python scripts/story_eval.py check --records <new real records> --out …` exits 0 with at least one `kind: "real"` record, and exits 1 for a deliberately broken record (regression on the checker, not on the model).
- Ratings: `ratings.csv` has no empty cell for any rated pair; every score is 1–5 or `无法判断`; every non-abstaining score has a reason quoting text; every pair has an overall choice from the four allowed values; pair count and reviewer count are reported.
- Reproducibility: re-running `story_eval.py export` on the same commit reproduces the same request inputs and template digests; A/B order matches the fixed hash.
- Privacy: `grep` of case bodies and run records for user-authored content returns nothing; no secret, key or account identifier appears in any committed eval artifact; cost accounting totals are ≤ `cost_cap`.
- Claim audit: README/report wording contains no statement of measured writing quality that is based on simulated records, contract checks or an LLM judge.

## Open Questions

- Who is authorized to approve spend, and which provider/model is in scope? `provider`/`model` are `null` today and must be named explicitly.
- Is the reviewer pool ≥2 people per pair and qualified Chinese readers? Blind rating with one reviewer cannot support a preference claim.
- Budget: what is the acceptable worst-case amount for 80 calls (plus 16 holdout calls later)? Unknown until provider prices are fixed in the approval.
- Where do real run records live — committed under `eval/chinese_stories/` or kept as an attached artifact with only digests committed? Committing raw model output plus costs may not be desired.
- Does `holdout` generation require a second approval, and who verifies that holdout outputs were not used to tune prompts?
- Should the four dimensions be weighted for the overall choice, or is the overall choice intentionally free-standing (current CSV implies free-standing)?
