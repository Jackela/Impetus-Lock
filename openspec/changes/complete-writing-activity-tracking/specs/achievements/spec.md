## ADDED Requirements

### Requirement: Proven Milestones Receive One Durable Award Per User and Type
The system SHALL evaluate existing first_task, ten_tasks, hundred_tasks, first_muse and first_loki definitions against proven committed activity. Each authenticated user and achievement_type pair SHALL have at most one effective award enforced by database uniqueness. New awards SHALL commit atomically with the qualifying activity; earned_at SHALL identify the first evidenced qualification transaction, remaining unchanged on retry or later threshold crossings. Listing achievements SHALL not implicitly create awards. Structural route extraction SHALL not approve or replace this missing behavior.

#### Scenario: Concurrent threshold crossings
- **WHEN** an owner with 99 proven creations commits two concurrent independent creations
- **THEN** stats SHALL reflect 101 creations and exactly one hundred_tasks award SHALL be visible to that owner
- **AND** cache-expired or restarted retries SHALL preserve its identity and earned_at.

#### Scenario: First task and first intervention
- **WHEN** an owner commits their first creation and first persisted task-associated Muse intervention
- **THEN** first_task and first_muse SHALL each be awarded once
- **AND** an uncommitted generation or unsaved suggestion SHALL not qualify as a successful persisted intervention.

#### Scenario: Qualification transaction fails
- **WHEN** a milestone's activity, aggregate or award transaction fails to commit
- **THEN** no new achievement SHALL be returned for that failed transaction
- **AND** a later successful retry SHALL qualify once without a previously published success.

#### Scenario: Account isolation and passive reads
- **WHEN** another account requests achievements or repeats reads of its own list
- **THEN** the system SHALL return only that account's earned records and SHALL create no award merely from reading.

### Requirement: Streak Awards Require Verified Existing Eligibility
The existing streak_3, streak_7 and streak_30 types SHALL be awarded only from verified qualification under the existing approved consecutive-writing and grace/recovery rules. The current later-date increment stub and incomplete historical aggregate rows SHALL not prove eligibility. Until the separate streak behavior dependency is approved and verified, these awards SHALL be explicitly unevaluable rather than silently treated as correctly supported. This delta SHALL not redefine the current streak policy or invent new Special achievements.

#### Scenario: Nonconsecutive dates do not prove a streak
- **WHEN** an old streak aggregate reports three days but the underlying dates and applicable grace behavior cannot be verified
- **THEN** the system SHALL not award streak_3 from that aggregate
- **AND** the missing qualification evidence SHALL remain explicit.

#### Scenario: Verified streak qualification
- **WHEN** the approved streak policy produces a verified committed seven-day qualification
- **THEN** each qualifying existing streak type SHALL have at most one award under the same per-user/type identity
- **AND** repeated qualification SHALL not rewrite prior earned_at timestamps.

### Requirement: Award Migration and Deletion Preserve Historical Evidence
Existing achievement data SHALL be preserved during migration and rollback. Duplicate legacy user/type awards SHALL require an approved recoverable reconciliation before uniqueness is installed. Historical reconstruction SHALL not invent qualification timestamps or writing duration; approved retrospective awards SHALL identify evaluation time and retained-source evidence. Ordinary task deletion or activity correction SHALL not automatically revoke or reissue an existing award; disputed erroneous awards SHALL await an explicit owner decision.

#### Scenario: Existing duplicate awards block automatic migration
- **WHEN** migration detects two records with the same user_id and achievement_type
- **THEN** the system SHALL retain recoverable copies and require the approved reconciliation policy before adding uniqueness
- **AND** it SHALL not silently delete either original record or change its earned_at.

#### Scenario: Historical threshold is provable but date is not
- **WHEN** approved reconstruction proves a task milestone but not its original threshold-crossing date
- **THEN** a retrospective award SHALL use the approved evaluation timestamp and identify historical evidence
- **AND** no guessed historical earned_at or timing-based award SHALL be generated.

#### Scenario: Deleted or corrected source
- **WHEN** a qualifying task is ordinarily deleted, or an activity correction makes a previous award disputed
- **THEN** ordinary deletion SHALL preserve the original award, and disputed correction SHALL retain its record pending an explicit revocation decision
- **AND** neither action SHALL create a duplicate award when the threshold is reached again.
