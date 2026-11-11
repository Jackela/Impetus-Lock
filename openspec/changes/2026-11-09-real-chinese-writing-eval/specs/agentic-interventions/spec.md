## ADDED Requirements

### Requirement: Real-Model Chinese Story Evaluation Uses Human Blind Rating

The Chinese story evaluation SHALL distinguish contract compliance from writing effect, and SHALL NOT report measured writing quality on the basis of simulated records, contract checks, or an automatic model judge. A real-model evaluation SHALL run only from an approved plan with a named provider and model and a positive cost cap, SHALL produce at least one record with `kind: "real"`, and SHALL be scored by human raters who do not know which arm produced which output.

#### Scenario: Approved real run produces a real record

- **WHEN** an operator enables a real evaluation plan after an approval object, provider, model, currency and positive cost cap have been recorded and the plan digest pinned
- **THEN** the run SHALL emit records with `kind: "real"` carrying provider, model, effective parameters, template version and digest, source SHA, request, raw output, tokens, cost and latency
- **AND** at least one such record SHALL pass the contract checker with exit code 0
- **AND** execution SHALL stop at the declared cost cap with no automatic retries, and a run whose plan digest differs from the approved digest SHALL be rejected.

#### Scenario: Human blind rating is the only quality measure

- **WHEN** real outputs are prepared for review
- **THEN** each pair SHALL be presented in the reproducible hashed A/B order with arm identity withheld, and the identity mapping SHALL NOT be opened by raters
- **AND** each arm SHALL be scored 1–5 or `无法判断` on all four dimensions (情节与人物一致性, 突破是否具体, 中文适配, 续写空间) with a reason citing specific text, plus one overall choice from `A`, `B`, `各有优劣`, `都无帮助`
- **AND** abstentions and reviewer count SHALL be reported rather than imputed, and no LLM-generated score SHALL be substituted for, averaged with, or presented beside the human ratings as equivalent.

#### Scenario: Evaluation stays unassessed without a real run

- **WHEN** no approved real run has been executed
- **THEN** the real-model status SHALL remain `unassessed` and the plan SHALL remain disabled
- **AND** simulated, replayed or negative records SHALL NOT be counted as real records, aggregated with them, or used to claim writing effect
- **AND** the holdout split SHALL NOT be generated or inspected before the protocol is frozen.
