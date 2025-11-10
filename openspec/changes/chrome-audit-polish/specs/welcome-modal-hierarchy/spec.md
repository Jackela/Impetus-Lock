# welcome-modal-hierarchy Specification

## Purpose
Emphasize Muse mode as the recommended entry point for new users by adding visual hierarchy to the welcome modal.

## ADDED Requirements

### Requirement: Muse Mode Recommended Badge

The welcome modal SHALL display a "RECOMMENDED" badge on the Muse Mode section to guide new users toward the primary use case.

**Rationale**: New user audit shows all 3 modes have equal visual weight. Muse mode is the primary workflow (60s STUCK detection), so it should be visually prioritized for new users.

#### Scenario: Muse Mode Has Recommended Badge

**Given** the welcome modal is open (first visit or "?" keyboard shortcut)
**When** the user views the mode explanations section
**Then** the Muse Mode section SHALL display a badge labeled "RECOMMENDED"
**And** the badge SHALL be visually distinct (e.g., purple background, white text)

**Acceptance Criteria**:
- [ ] Badge appears above or adjacent to "Muse Mode" heading
- [ ] Badge styling: background #7c3aed (purple), text #ffffff (white), border-radius 4px, padding 4px 8px
- [ ] Badge font size: 0.75rem (smaller than heading)
- [ ] E2E test validates badge presence via `page.locator('.recommended-badge')`
- [ ] Badge does not appear on Loki or Lock Concept sections

---

### Requirement: Font Size Hierarchy

The welcome modal SHALL use font size hierarchy to emphasize Muse Mode over Loki Mode and Lock Concept.

**Rationale**: Subtle visual hierarchy guides user attention without requiring explicit badges. Muse mode is the primary workflow, so it should have slightly larger text.

#### Scenario: Muse Mode Has Larger Font Size

**Given** the welcome modal is open
**When** the user views the mode explanation headings
**Then** font sizes SHALL be:
- **Muse Mode heading**: 1.0em (base size)
- **Loki Mode heading**: 1.0em (equal to Muse, both are AI modes)
- **Lock Concept heading**: 0.9em (technical detail, de-emphasized)

**Acceptance Criteria**:
- [ ] Muse Mode heading font-size: 1.0em
- [ ] Loki Mode heading font-size: 1.0em
- [ ] Lock Concept heading font-size: 0.9em
- [ ] E2E test validates computed font sizes via `page.evaluate()`
- [ ] Visual hierarchy is subtle (not jarring)

---

### Requirement: Modal Content Order Unchanged

The welcome modal SHALL maintain the current order (Muse → Loki → Lock Concept).

**Rationale**: Current order is logical (primary workflow first, chaos mode second, technical detail last). Only visual emphasis changes, not content order.

#### Scenario: Mode Sections Remain in Logical Order

**Given** the welcome modal is open
**When** the user reads the mode explanations
**Then** sections SHALL appear in order:
1. Muse Mode (with "RECOMMENDED" badge)
2. Loki Mode
3. Lock Concept

**Acceptance Criteria**:
- [ ] Order validated via E2E test (check DOM order of `.welcome-mode` elements)
- [ ] No content reordering (only visual styling changes)

---
