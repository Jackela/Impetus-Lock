## 1. Protocol freeze (no model calls)

- [ ] 1.1 Freeze the sample: 20 `development` cases × 2 modes × 2 arms; holdout `zh-story-021`…`024` reserved and untouched until the protocol is frozen.
- [ ] 1.2 Freeze the A/B rule: one identical request input per pair, only the template differs, presentation order from the existing fixed hash; record how pairs are formed per case/mode.
- [ ] 1.3 Freeze the rubric and reporting: four dimensions at 1–5 or `无法判断` with text-cited reasons, overall choice from `A`/`B`/`各有优劣`/`都无帮助`, ≥2 reviewers per pair, Muse/Loki and development/holdout reported separately.
- [ ] 1.4 State explicitly in `design.md` and `README.md` that no LLM judge may substitute for human blind rating, and that contract checks are not quality scores.

## 2. Plan schema and cost gate

- [ ] 2.1 Extend `real-plan.schema.json` to a batch plan (arms × cases × modes, aggregate `cost_cap`, `currency`, per-call `parameters`) while keeping `enabled: false` by default and `calls`/`repeats`/`max_retries` explicit.
- [ ] 2.2 Add schema tests: default disabled plan validates; enabled plan without approval object, provider, model, positive `cost_cap` or `currency` fails.
- [ ] 2.3 Compute worst-case cost from published prices × 80 calls and record the arithmetic in the approval; implement a hard stop at `cost_cap` with no retries.

## 3. Real generation (spend gated)

- [ ] 3.1 Obtain the approval object (`approved`, `approved_by`, `approved_at`, `plan_digest`) and set `enabled: true` with provider/model/currency/cost cap; nothing runs before this exists.
- [ ] 3.2 Implement or authorize a real-run entry point that writes `record.schema.json` records with `kind: "real"`, raw output, request, tokens, cost and latency, without reading local secrets or changing default configuration.
- [ ] 3.3 Import the records and run `story_eval.py check` to exit 0 including at least one `kind: "real"` record; keep one deliberately broken record as a checker regression.

## 4. Blind rating

- [ ] 4.1 Populate `review_cards.json` with the real A/B outputs in the fixed hashed order; keep `identity_key.json` out of the reviewer's view.
- [ ] 4.2 Collect ratings into `ratings.csv` (pseudonymous reviewer id, no personal data) with no empty cells for rated pairs.
- [ ] 4.3 Verify coverage: pairs rated, reviewers per pair, abstentions, and that every reason cites text.

## 5. Reporting and verification

- [ ] 5.1 Write the report with contract results, cost totals, abstentions and ratings separated; no aggregated claim mixing simulated and real records.
- [ ] 5.2 Update `real_model_status` only for the cases actually evaluated; leave the rest `unassessed`.
- [ ] 5.3 Privacy audit: no user manuscript content in cases or records, no keys/accounts in committed artifacts, cost ≤ cap.
- [ ] 5.4 Run `npx @fission-ai/openspec@latest validate --all --strict` and confirm `real-plan.json` state matches the approval actually obtained.
