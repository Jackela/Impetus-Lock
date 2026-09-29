## ADDED Requirements

### Requirement: Committed Writing Activity Has Durable User-Scoped Identity
The system SHALL persist narrowly scoped, dated activity evidence for successful task creation, content editing, task-associated intervention issuance, first persisted task locks and measured writing intervals. Activity, cumulative projection and milestone writes SHALL become visible only after the corresponding business transaction commits. Authenticated ownership and durable operation identity SHALL prevent cross-account attribution and duplicate counting after retries, cache expiry or restart. This proposed requirement SHALL NOT treat the current literal-zero period response as correct statistics.

#### Scenario: Successful task creation and failed commit
- **WHEN** an authenticated owner creates a task successfully, and a separate task creation fails to commit
- **THEN** stats SHALL include only the committed creation
- **AND** the failed transaction SHALL leave no activity, aggregate increment, new award or published successful response.

#### Scenario: Persisted request replay
- **WHEN** the same account retries a committed creation or task-associated intervention with the same durable operation key after cache expiry or process restart
- **THEN** the system SHALL reuse the committed task identity or intervention result without counting another activity or generating another provider result
- **AND** replay SHALL still check current authorization; a deleted task creation identity SHALL not create a replacement task.

#### Scenario: Repeated lock persistence
- **WHEN** an owner saves the same lock_id repeatedly within one task, including intervention response replay
- **THEN** locks_created SHALL count the first successful persistence once
- **AND** an issued lock suggestion that was never saved into the task SHALL not count as a persisted lock.

#### Scenario: Other account submits evidence
- **WHEN** another account submits the owner's task, writing session or operation identity
- **THEN** the system SHALL reject unauthorized evidence and SHALL not disclose or change the owner's statistics.

### Requirement: Statistics Use Explicit Calendar Windows and Covered Day Denominators
Under the proposed activity-v2 contract, day/week/month SHALL use UTC calendar windows with inclusive start and exclusive end. Weeks SHALL start on Monday; months SHALL start on their first day. Responses SHALL identify timezone, bounds and a fixed as_of, aggregating only committed facts through that snapshot. Average tasks per day SHALL divide created tasks by covered calendar days, including zero-activity days, and SHALL be unavailable when numerator or coverage is incomplete.

#### Scenario: Week and month boundary
- **WHEN** creations occur at 2026-09-27T23:59:59Z, 2026-09-28T00:00:00Z and 2026-10-01T00:00:00Z
- **THEN** the week starting September 28 SHALL exclude the September 27 creation and include the September 28 creation
- **AND** the September calendar month SHALL exclude the October 1 creation.

#### Scenario: Average includes inactive days
- **WHEN** a complete seven-calendar-day statistics window contains three committed task creations
- **THEN** average_tasks_per_day SHALL equal 3 divided by 7, approximately 0.43 for two-decimal display
- **AND** the denominator SHALL not be restricted to days with task creation.

### Requirement: Writing Duration Uses Measured Intervals and Explicit Coverage
Writing duration SHALL derive only from authenticated, validated foreground content-input intervals, independently of Muse/Loki/off mode. Idle, hidden, unfocused and unauthenticated time SHALL not count. The system SHALL retain seconds, combine overlapping intervals across the account, split intervals at period boundaries and convert the aggregate seconds to whole minutes. Missing historical or unreported measurement SHALL remain unknown; task timestamps, word counts and provider latency SHALL not substitute for duration evidence. Candidate measurement limits and protocol in the design SHALL require approval before implementation.

#### Scenario: Subminute intervals retain seconds
- **WHEN** two accepted nonoverlapping intervals contain 35 and 40 seconds
- **THEN** measured duration SHALL total 75 seconds and writing_minutes SHALL be 1 after final conversion.

#### Scenario: Concurrent tabs overlap
- **WHEN** two accepted intervals from the same account completely overlap for 30 seconds
- **THEN** measured duration SHALL total 30 seconds rather than 60
- **AND** replaying either interval identity SHALL not change that duration.

#### Scenario: Interval crosses midnight
- **WHEN** one accepted interval spans 23:59:30Z to 00:00:30Z across a UTC day boundary
- **THEN** each day's duration evidence SHALL include 30 seconds
- **AND** the combined duration SHALL retain 60 seconds before conversion.

#### Scenario: Historical timing unavailable
- **WHEN** historical tasks exist without measured writing intervals or a writing session has incomplete reporting coverage
- **THEN** the corresponding writing_minutes SHALL be null with unavailable or partial evidence under activity-v2
- **AND** the system SHALL not fabricate zero minutes or reconstruct duration from created_at/updated_at.

### Requirement: Public Statistics Distinguish Complete Zero From Unavailable Evidence
The proposed explicit activity-v2 contract on existing stats endpoints SHALL preserve metric names while permitting null for partial/unavailable metrics and adding per-metric evidence status, covered range and observed values. Complete evidence with no activity SHALL return numeric zero; evidence gaps SHALL return null with partial/unavailable status, and database failure SHALL return an error. Clients and exports SHALL preserve these distinctions. Existing integer consumers SHALL require an approved compatibility migration; unsupported legacy requests SHALL not continue receiving fabricated successful zeros.

#### Scenario: Fully covered empty window
- **WHEN** a new account requests a complete covered window with no recorded or unmeasured writing activity
- **THEN** counts and writing_minutes SHALL be zero with complete evidence and last_activity_at SHALL be null.

#### Scenario: Partial historical counts
- **WHEN** an older account has two provable retained tasks but an unknown deleted-task history
- **THEN** lifetime total_tasks SHALL be null with partial status and observed_value=2
- **AND** observed_value SHALL not be displayed or exported as an accurate lifetime total.

#### Scenario: Unavailable database or legacy schema
- **WHEN** the database is unavailable, or an integer-contract request cannot express incomplete evidence
- **THEN** activity-v2 SHALL return the proposed 503 for database unavailability, and the legacy request SHALL receive the proposed 409 stats_contract_upgrade_required until migrated
- **AND** invalid day/week/month input SHALL retain 400, rather than becoming an empty successful period.

### Requirement: Deletion and Correction Preserve Proven History Without Invented Backfill
Ordinary task deletion SHALL preserve committed creation/intervention/lock activity counts and durable retry identity without retaining deleted writing content in activity records. Authorized correction SHALL identify the original fact, apply at most once and rebuild consistent aggregates. Migration SHALL preserve existing business data and distinguish partial retained-record reconstruction from complete history; unsupported timing, lock dates and deleted records SHALL not be fabricated.

#### Scenario: Task removed after a milestone
- **WHEN** an owner deletes a previously counted task and its original intervention history cascades away
- **THEN** dated activity counts SHALL remain attributable to the original authenticated owner
- **AND** the same old creation key SHALL not create another task or count another creation.

#### Scenario: Correction repeated
- **WHEN** the same authorized correction invalidates an erroneous activity twice
- **THEN** aggregate and period queries SHALL reflect that correction only once and SHALL agree on the remaining valid facts.

#### Scenario: Migration or rollback creates incomplete coverage
- **WHEN** retained task/action records are imported twice, or collection is disabled during rollback
- **THEN** duplicate imports SHALL not increase observed counts and coverage gaps SHALL remain partial/unavailable
- **AND** rollback SHALL preserve existing and newly recorded data instead of dropping shared or original sprint3 tables.
