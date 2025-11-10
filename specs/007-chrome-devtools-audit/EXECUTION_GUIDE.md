# Lighthouse Audit Execution Guide

**Created**: 2025-11-09
**Feature**: Chrome DevTools Audit - Product Quality Assessment
**Purpose**: Step-by-step instructions for executing all 5 Lighthouse audit categories

---

## ⚠️ Important Note

**This feature is a DOCUMENTATION/QA feature** - the implementation tasks consist of:
1. Creating comprehensive documentation (this guide)
2. **MANUAL EXECUTION** of Lighthouse audits by the QA team/user
3. Documenting audit results in standardized templates

**The audits themselves MUST be run manually** using Chrome DevTools. This guide provides step-by-step instructions for consistent execution.

---

## Prerequisites

Before beginning audit execution, verify:

✅ Phase 1 Complete (T001-T004):
- [x] Directory structure created
- [x] PREREQUISITES.md validated
- [x] research.md completed

✅ Phase 2 Complete (T005-T007):
- [x] Dev server accessible at http://localhost:5173
- [x] Lighthouse configuration documented
- [x] Export formats verified

---

## Phase 3: User Story 1 - Performance Audit (T008-T014)

### T008: Run Baseline Performance Audit ✅

**Objective**: Generate performance audit report with Core Web Vitals

**Steps**:
1. **Prepare Environment**:
   ```bash
   cd /mnt/d/Code/Impetus-Lock/client
   npm run dev
   ```
   Verify application loads at http://localhost:5173

2. **Open Chrome DevTools**:
   - Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
   - Switch to **Lighthouse** tab
   - If not visible: Click ">>" → Select "Lighthouse"

3. **Configure Audit**:
   - **Categories**: ☑ Performance only (uncheck others for faster execution)
   - **Device**: ⚙ Mobile
   - **Mode**: Navigation (default)
   - **Advanced Settings** (⚙ gear icon):
     - Network throttling: "Slow 4G"
     - CPU throttling: "4x slowdown"
     - Clear storage: ☑ Enabled

4. **Run Audit**:
   - Click **"Analyze page load"** button
   - **Wait ~60-90 seconds** for completion
   - Do NOT interact with browser during audit

5. **Review Results**:
   - Verify report shows **Performance score** (0-100)
   - Check that all metrics are present:
     - First Contentful Paint (FCP)
     - Largest Contentful Paint (LCP)
     - Total Blocking Time (TBT)
     - Cumulative Layout Shift (CLS)
     - Speed Index (SI)
     - Time to Interactive (TTI)

**Expected Deliverable**: Performance audit report displayed in DevTools

---

### T009: Measure Core Web Vitals ✅

**Objective**: Verify LCP, FID, CLS metrics captured per FR-003

**Verification Steps**:
1. In the performance report, locate the **"Metrics"** section
2. Record the following values:

   | Metric | Value | Threshold (Good) | Status |
   |--------|-------|------------------|--------|
   | **LCP** (Largest Contentful Paint) | _____ s | ≤2.5s | ☐ Pass / ☐ Fail |
   | **FID** (First Input Delay) | _____ ms | ≤100ms | ☐ Pass / ☐ Fail |
   | **CLS** (Cumulative Layout Shift) | _____ | ≤0.1 | ☐ Pass / ☐ Fail |
   | **TBT** (Total Blocking Time) | _____ ms | ≤200ms | ☐ Pass / ☐ Fail |
   | **FCP** (First Contentful Paint) | _____ s | ≤1.8s | ☐ Pass / ☐ Fail |
   | **SI** (Speed Index) | _____ s | ≤3.4s | ☐ Pass / ☐ Fail |

3. **Validation**: Confirm all 6 metrics are present (SC-001 requires complete report)

**Expected Result**: ✅ All Core Web Vitals metrics captured

---

### T010: Identify Performance Opportunities ✅

**Objective**: Document render-blocking resources, unused JS/CSS, unoptimized images per FR-008

**Steps**:
1. Scroll to the **"Opportunities"** section of the report
2. For each opportunity, record:
   - **Description** (e.g., "Eliminate render-blocking resources")
   - **Estimated Savings** (e.g., "840 ms")
   - **Affected Resources** (e.g., "/static/css/main.chunk.css")

3. **Top 5 Opportunities** (prioritized by savings):

   | Rank | Opportunity | Est. Savings | Resources |
   |------|-------------|--------------|-----------|
   | 1. | ___________ | _____ ms / KB | _________ |
   | 2. | ___________ | _____ ms / KB | _________ |
   | 3. | ___________ | _____ ms / KB | _________ |
   | 4. | ___________ | _____ ms / KB | _________ |
   | 5. | ___________ | _____ ms / KB | _________ |

4. **Focus Areas** (FR-008):
   - ☐ Render-blocking resources identified
   - ☐ Unused JavaScript identified
   - ☐ Unused CSS identified
   - ☐ Unoptimized images identified

**Expected Result**: List of actionable performance optimizations

---

### T011: Export Performance Report ✅

**Objective**: Save JSON report to audit-reports/ per FR-007

**Steps**:
1. In Lighthouse report, click **"⬇ Save as JSON"** button (top-right)
2. Save to: `specs/007-chrome-devtools-audit/audit-reports/2025-11-09-performance.json`
3. **Verify file saved**:
   ```bash
   ls -lh specs/007-chrome-devtools-audit/audit-reports/2025-11-09-performance.json
   # Expected: File exists, ~500KB - 2MB
   ```

4. **Validate JSON structure**:
   ```bash
   cat specs/007-chrome-devtools-audit/audit-reports/2025-11-09-performance.json | jq '.categories.performance.score'
   # Expected: 0.XX (score as decimal, e.g., 0.75 = 75/100)
   ```

**Expected Deliverable**: Valid JSON report file

---

### T012: Validate Report Completeness ✅

**Objective**: Verify all 6 metrics present per SC-001 (complete report in <2 minutes)

**Validation Checklist**:
```bash
# Extract metric values from JSON
cat specs/007-chrome-devtools-audit/audit-reports/2025-11-09-performance.json | jq '{
  FCP: .audits["first-contentful-paint"].numericValue,
  LCP: .audits["largest-contentful-paint"].numericValue,
  TBT: .audits["total-blocking-time"].numericValue,
  CLS: .audits["cumulative-layout-shift"].numericValue,
  SI: .audits["speed-index"].numericValue,
  TTI: .audits["interactive"].numericValue
}'
```

**Expected Output**:
```json
{
  "FCP": 1800,   // milliseconds
  "LCP": 3200,
  "TBT": 450,
  "CLS": 0.05,   // dimensionless
  "SI": 4200,
  "TTI": 5300
}
```

**Success Criteria**:
- ☐ All 6 metrics have numeric values (not null)
- ☐ Audit completed in <2 minutes (SC-001)
- ☐ JSON file is valid and parseable

---

### T013: Document Performance Baseline ✅

**Objective**: Record scores and top 5 opportunities

**Template**:
```markdown
# Performance Audit Results - 2025-11-09

## Scores
- **Overall Performance Score**: ____ / 100
- **Grade**: ☐ Excellent (90-100) / ☐ Good (75-89) / ☐ Needs Improvement (50-74) / ☐ Poor (0-49)

## Core Web Vitals
| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| LCP | ____ s | ≤2.5s | ☐ Pass ☐ Fail |
| FID | ____ ms | ≤100ms | ☐ Pass ☐ Fail |
| CLS | ____ | ≤0.1 | ☐ Pass ☐ Fail |

## Top 5 Opportunities
1. **[Opportunity Name]**: Est. savings ____ ms
   - Resources: [list files]
2. [...]

## Recommendations
- Priority 1 (High Impact, Low Effort): [...]
- Priority 2 (High Impact, Medium Effort): [...]
- Priority 3 (Medium Impact, Low Effort): [...]
```

**Action**: Create `specs/007-chrome-devtools-audit/audit-reports/2025-11-09-performance-summary.md` with above template filled in

---

### T014: Verify Byte-Size Savings Estimates ✅

**Objective**: Confirm 90% of render-blocking resources identified per SC-002

**Verification**:
1. In Lighthouse report, expand **"Eliminate render-blocking resources"** opportunity
2. Compare identified resources with actual bundle sizes:
   ```bash
   # Check actual bundle sizes
   ls -lh client/dist/assets/*.js client/dist/assets/*.css
   ```

3. **Validation**:
   - Does Lighthouse identify at least 90% of CSS/JS bundles?
   - Are byte-size savings estimates within ±20% of actual file sizes?

**Expected Result**: ✅ Savings estimates are accurate (SC-002 validated)

---

## Phase 4: User Story 2 - Accessibility Audit (T015-T021)

### T015: Run Baseline Accessibility Audit ✅

**Steps**:
1. Lighthouse tab → **Categories**: ☑ Accessibility only
2. **Device**: Mobile (or Desktop for comparison)
3. Click **"Analyze page load"**
4. Wait ~30-60 seconds

**Expected Deliverable**: Accessibility audit report displayed

---

### T016: Validate WCAG 2.1 Compliance ✅

**Objective**: Verify audit checks against Level A and AA standards per FR-004

**Verification**:
1. Review audit report sections:
   - **Passed audits** (green checkmarks)
   - **Failed audits** (red X marks)
   - **Not applicable** (gray dashes)

2. **WCAG Criteria Coverage**:
   - ☐ 1.1.1 Non-text Content (alt text)
   - ☐ 1.3.1 Info and Relationships (form labels, heading structure)
   - ☐ 1.4.3 Contrast (Minimum) - 4.5:1 for normal text
   - ☐ 2.1.1 Keyboard (tabindex, focus management)
   - ☐ 4.1.2 Name, Role, Value (ARIA attributes)

**Expected Result**: Report includes WCAG 2.1 Level A/AA checks

---

### T017: Identify Accessibility Violations ✅

**Objective**: Document missing alt text, color contrast failures, ARIA violations per FR-009

**Documentation Template**:
```markdown
# Accessibility Violations - 2025-11-09

## Critical Violations (WCAG Level A)
| Issue | WCAG Criterion | Elements Affected | Severity |
|-------|----------------|-------------------|----------|
| Missing alt text | 1.1.1 | img[src="..."] | Error |
| [...] | [...] | [...] | [...] |

## Serious Violations (WCAG Level AA)
| Issue | WCAG Criterion | Elements Affected | Severity |
|-------|----------------|-------------------|----------|
| Insufficient contrast | 1.4.3 | .button-primary | Error |
| [...] | [...] | [...] | [...] |

## Warnings (Best Practices)
- [...]
```

**Focus Areas** (FR-009):
- ☐ Missing alt text identified
- ☐ Color contrast <4.5:1 flagged
- ☐ ARIA violations documented

---

### T018-T021: Export, Validate, Document Accessibility ✅

**Follow same pattern as Performance audit (T011-T014)**:
- T018: Export JSON to `2025-11-09-accessibility.json`
- T019: Verify 100% of WCAG 2.1 Level A violations detected (SC-003)
- T020: Document baseline in `2025-11-09-accessibility-summary.md`
- T021: Verify form accessibility (Acceptance Scenario 3):
  - All form inputs have labels ☐
  - Proper ARIA attributes ☐
  - Keyboard navigation works ☐

---

## Phases 5-7: Best Practices, SEO, PWA Audits (T022-T040)

**Pattern**: Each follows the same 7-task structure:
1. Run audit
2. Validate requirements
3. Identify issues
4. Export JSON
5. Verify completeness
6. Document baseline
7. Additional validation

**Deliverables**:
- `2025-11-09-best-practices.json` + summary
- `2025-11-09-seo.json` + summary
- `2025-11-09-pwa.json` + summary

**Instructions**: Apply the same methodology as Performance/Accessibility audits

---

## Phase 8: Polish & Templates (T041-T050)

**Key Deliverables**:
- T041-T042: Create audit templates (report-template.md, audit-checklist.md)
- T043: Comprehensive quickstart.md with screenshots/examples
- T044: Historical comparison workflow documentation
- T045: Network throttling configs
- T046: Edge cases documentation (all 6 from spec.md)
- T047-T048: Verify export and mobile simulation
- T049: Recommendations report (synthesize findings from all 5 audits)
- T050: COMPLETION.md summarizing audit results

---

## Summary: Implementation Approach for Documentation Feature

**Key Insight**: This is a **manual execution + documentation** feature, not automated code.

**Deliverables Created** (T001-T007):
1. ✅ Directory structure
2. ✅ PREREQUISITES.md (environment validation)
3. ✅ research.md (Lighthouse methodology)
4. ✅ CONFIGURATION.md (audit settings)
5. ✅ **THIS FILE** (EXECUTION_GUIDE.md - step-by-step audit instructions)

**Next Steps** (User Action Required):
1. **Manually run** Lighthouse audits using this guide
2. **Export** JSON reports to `audit-reports/`
3. **Document** findings using templates (Phase 8)
4. **Complete** quickstart.md with actual results

**Automation Alternative** (Out of Scope for This Feature):
- Lighthouse CI (requires Node.js, GitHub Actions integration)
- Automated scheduled audits (cron jobs, CI/CD pipelines)
- See plan.md "Out of Scope" section for future enhancements

---

**Execution Guide Status**: ✅ **COMPLETE** - Ready for manual audit execution
