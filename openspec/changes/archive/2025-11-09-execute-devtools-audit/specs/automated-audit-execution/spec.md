# Spec Delta: Automated Audit Execution

**Capability**: `automated-audit-execution`
**Type**: ADDED
**Change**: `execute-devtools-audit`

## ADDED Requirements

### Requirement: Browser Automation via Chrome DevTools MCP

The system SHALL use the Chrome DevTools MCP tool to programmatically control a browser instance for audit execution.

**Rationale**: Enables automated, reproducible audits without manual browser interaction.

#### Scenario: Launch Application in Browser

**Given** the Chrome DevTools MCP server is running and connected
**And** the application dev server is accessible at http://localhost:5173
**When** the audit execution command is invoked
**Then** the system SHALL:
- Use `list_pages` to verify browser connectivity
- Use `new_page` or `navigate_page` to load http://localhost:5173
- Wait for page load completion
- Verify application loads without critical errors

**Acceptance Criteria**:
- Browser page successfully loads application
- Page load completes within 30 seconds
- No critical JavaScript errors in console (errors with severity "error")

---

### Requirement: Performance Metrics Collection

The system SHALL capture performance metrics using Chrome DevTools MCP network and timing APIs.

**Rationale**: Provides baseline performance data comparable to Lighthouse Performance audit metrics.

#### Scenario: Capture Page Load Timing

**Given** the application is loaded in the browser
**When** performance metrics are collected
**Then** the system SHALL record:
- **Total page load time** (DOMContentLoaded to load event)
- **Resource count** (total JavaScript, CSS, image, font files loaded)
- **Total transfer size** (sum of all resource sizes in bytes)
- **Render-blocking resources** (CSS/JS loaded before first paint)

**Acceptance Criteria**:
- Metrics captured and stored in JSON format
- Timestamp included (ISO 8601 format)
- Metrics match format: `{ "pageLoadTime": 2345, "resourceCount": 23, "totalBytes": 1234567 }`

#### Scenario: Analyze Network Waterfall

**Given** the page has finished loading
**When** network requests are analyzed via `list_network_requests`
**Then** the system SHALL:
- Identify render-blocking resources (CSS, synchronous JS)
- Calculate cumulative transfer size per resource type
- Detect unoptimized resources (large images, uncompressed assets)

**Acceptance Criteria**:
- Render-blocking resources listed with file paths and sizes
- At least 90% of CSS/JS resources identified (per SC-002 from spec.md)
- Resource type breakdown provided (JS: X KB, CSS: Y KB, Images: Z KB)

---

### Requirement: Accessibility Issue Detection

The system SHALL detect accessibility violations using Chrome DevTools accessibility tree snapshot.

**Rationale**: Provides automated WCAG 2.1 violation detection comparable to Lighthouse Accessibility audit.

#### Scenario: Capture Accessibility Snapshot

**Given** the application is loaded in the browser
**When** accessibility analysis is performed
**Then** the system SHALL:
- Use `take_snapshot` to capture accessibility tree
- Parse snapshot for elements missing required attributes (alt, labels, ARIA)
- Identify contrast violations (if detectable via snapshot metadata)

**Acceptance Criteria**:
- Accessibility snapshot captured successfully
- Snapshot includes all interactive elements (buttons, inputs, links)
- Missing alt text detected on images
- Unlabeled form inputs identified

#### Scenario: Categorize Accessibility Violations by Severity

**Given** accessibility violations have been detected
**When** violations are categorized
**Then** the system SHALL assign severity levels:
- **Critical** (WCAG 2.1 Level A): Missing alt text, unlabeled inputs, insufficient contrast <3:1
- **Warning** (WCAG 2.1 Level AA): Contrast <4.5:1, missing ARIA attributes
- **Info**: Best practices (descriptive link text, heading hierarchy)

**Acceptance Criteria**:
- Each violation includes: element selector, WCAG criterion, severity, remediation guidance
- Critical violations flagged for immediate attention
- At least one example element provided per violation type

---

### Requirement: Console Error Detection

The system SHALL detect and categorize JavaScript console errors using Chrome DevTools console API.

**Rationale**: Identifies runtime errors impacting application functionality and user experience.

#### Scenario: Capture Console Messages

**Given** the application is loaded and running
**When** console messages are captured via `list_console_messages`
**Then** the system SHALL record:
- **Errors** (severity: "error")
- **Warnings** (severity: "warn")
- **Info** (severity: "info", "log")

**Acceptance Criteria**:
- All console messages captured with timestamp, severity, message text, stack trace
- Errors grouped by message pattern (deduplication)
- Source file and line number included (if available)

#### Scenario: Prioritize Critical Console Errors

**Given** console errors have been detected
**When** errors are prioritized
**Then** the system SHALL flag as critical:
- Uncaught exceptions
- Network request failures (4xx, 5xx)
- Resource load failures (404 for CSS/JS)

**Acceptance Criteria**:
- Critical errors listed first in report
- Each error includes impact assessment (e.g., "Blocks feature X")
- Non-critical warnings separated into "Warnings" section

---

### Requirement: Audit Report Generation

The system SHALL generate a structured audit report in JSON format compatible with the audit-reports/ directory.

**Rationale**: Enables tracking, comparison, and historical trend analysis per FR-012.

#### Scenario: Generate JSON Audit Report

**Given** all audit metrics have been collected
**When** the audit report is generated
**Then** the system SHALL create a file:
- **Path**: `specs/007-chrome-devtools-audit/audit-reports/2025-11-09-mcp-audit.json`
- **Format**: JSON with sections for performance, accessibility, console errors, network analysis

**Acceptance Criteria**:
- Report includes metadata: timestamp, URL, tool version (MCP)
- Performance metrics section with page load time, resource counts
- Accessibility violations section with severity, selectors, WCAG criteria
- Console errors section with critical vs warning categorization
- Network analysis section with render-blocking resources
- File size <5MB (SC-008 export timing requirement)

#### Scenario: Generate Human-Readable Summary

**Given** the JSON audit report has been created
**When** a summary is generated
**Then** the system SHALL create:
- **Path**: `specs/007-chrome-devtools-audit/audit-reports/2025-11-09-mcp-audit-summary.md`
- **Content**: Markdown summary using report-template.md structure

**Acceptance Criteria**:
- Summary includes Executive Summary with 3-5 key findings
- Top 5 performance opportunities listed
- Critical accessibility violations highlighted
- Console errors grouped by severity
- Actionable next steps provided

---

### Requirement: Visual Evidence Capture

The system SHALL capture screenshots of the application and specific issues for visual documentation.

**Rationale**: Provides visual context for identified issues, aiding remediation and stakeholder communication.

#### Scenario: Capture Full Page Screenshot

**Given** the application is loaded
**When** the audit completes
**Then** the system SHALL:
- Use `take_screenshot` with `fullPage: true`
- Save screenshot to `audit-reports/2025-11-09-homepage-screenshot.png`

**Acceptance Criteria**:
- Screenshot captures entire page (not just viewport)
- Image format: PNG
- File saved successfully
- Screenshot referenced in audit report

#### Scenario: Capture Element-Specific Screenshots

**Given** accessibility violations have been detected
**When** visual evidence is needed
**Then** the system SHALL (optional, if time permits):
- Capture screenshot of specific elements with issues (e.g., button with insufficient contrast)
- Annotate screenshots with issue indicators

**Acceptance Criteria**:
- Element screenshots saved to `audit-reports/issues/` directory
- Filenames include issue type (e.g., `button-contrast-violation.png`)
- Referenced in JSON report under relevant violation

---

## Cross-References

- **Related Change**: `007-chrome-devtools-audit` (manual audit documentation)
- **Depends On**: Chrome DevTools MCP server connection
- **Enhances**: FR-002 (five audit categories - automates 2 of 5)
- **Validates**: SC-001 (complete report generation), SC-008 (export timing)

---

## Implementation Notes

**MCP Tools to Use**:
- `mcp__chrome-devtools__list_pages` - Verify browser connectivity
- `mcp__chrome-devtools__new_page` or `navigate_page` - Load application
- `mcp__chrome-devtools__take_snapshot` - Accessibility tree capture
- `mcp__chrome-devtools__list_console_messages` - Console errors
- `mcp__chrome-devtools__list_network_requests` - Performance analysis
- `mcp__chrome-devtools__take_screenshot` - Visual evidence

**Expected Execution Time**: 5-10 minutes for full audit

**Limitations**:
- Cannot calculate Lighthouse-style scores (0-100) without Lighthouse API
- No SEO audit (requires meta tag inspection beyond snapshot capabilities)
- No PWA audit (requires service worker/manifest validation)
- Network timing may not include synthetic throttling (reports actual network conditions)
