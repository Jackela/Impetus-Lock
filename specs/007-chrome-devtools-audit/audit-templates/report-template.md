# Audit Report Template

**Date**: [YYYY-MM-DD]
**Auditor**: [Name]
**Application Version**: [Git commit hash or version number]
**Audit Tool**: Chrome DevTools Lighthouse [Version]

---

## Executive Summary

**Overall Assessment**: [Excellent / Good / Needs Improvement / Poor]

**Key Findings**:
- [3-5 bullet points highlighting critical findings or achievements]
-
-
-

**Priority Actions**:
1. [High-impact, urgent fix]
2. [...]
3. [...]

---

## Audit Metadata

| Field | Value |
|-------|-------|
| **Audit Date** | [YYYY-MM-DD] |
| **Application URL** | [http://localhost:5173 or production URL] |
| **Lighthouse Version** | [e.g., 11.3.0] |
| **Device Mode** | [ ] Mobile / [ ] Desktop |
| **Network Throttling** | [Slow 4G / Fast 3G / 4G / None] |
| **CPU Throttling** | [4x slowdown / No throttling] |
| **Run Count** | [1 / 3 (median)] |
| **Audit Duration** | [~XX seconds] |

---

## Scores Summary

| Category | Score | Change from Previous | Status |
|----------|-------|---------------------|--------|
| **Performance** | ____ / 100 | [+X / -X / →] | [🟢 / 🟡 / 🔴] |
| **Accessibility** | ____ / 100 | [+X / -X / →] | [🟢 / 🟡 / 🔴] |
| **Best Practices** | ____ / 100 | [+X / -X / →] | [🟢 / 🟡 / 🔴] |
| **SEO** | ____ / 100 | [+X / -X / →] | [🟢 / 🟡 / 🔴] |
| **PWA** | ____ / 100 | [+X / -X / →] | [🟢 / 🟡 / 🔴] |

**Legend**:
- 🟢 Green (90-100): Excellent
- 🟡 Orange (50-89): Needs Improvement
- 🔴 Red (0-49): Poor

**Score Trends** (vs. [Previous Audit Date]):
- Improved: [List categories with positive Δ]
- Declined: [List categories with negative Δ]
- Stable: [List categories with ~0 Δ]

---

## 1. Performance (Score: ____ / 100)

### Core Web Vitals

| Metric | Value | Threshold (Good) | Status | Change |
|--------|-------|------------------|--------|--------|
| **LCP** (Largest Contentful Paint) | ____ s | ≤2.5s | [ ] Pass / [ ] Fail | [+/- ____ s] |
| **FID** (First Input Delay) | ____ ms | ≤100ms | [ ] Pass / [ ] Fail | [+/- ____ ms] |
| **CLS** (Cumulative Layout Shift) | ____ | ≤0.1 | [ ] Pass / [ ] Fail | [+/- ____] |
| **TBT** (Total Blocking Time) | ____ ms | ≤200ms | [ ] Pass / [ ] Fail | [+/- ____ ms] |
| **FCP** (First Contentful Paint) | ____ s | ≤1.8s | [ ] Pass / [ ] Fail | [+/- ____ s] |
| **SI** (Speed Index) | ____ s | ≤3.4s | [ ] Pass / [ ] Fail | [+/- ____ s] |

### Top Opportunities (Prioritized by Estimated Savings)

#### 1. [Opportunity Name]
- **Estimated Savings**: ____ ms / ____ KB
- **Description**: [Brief explanation]
- **Affected Resources**:
  - `/path/to/file1.js` (____ KB)
  - `/path/to/file2.css` (____ KB)
- **Remediation Steps**:
  1. [Action 1]
  2. [Action 2]
- **Priority**: [ ] High / [ ] Medium / [ ] Low
- **Effort**: [ ] Low (< 1 day) / [ ] Medium (1-3 days) / [ ] High (> 3 days)

#### 2. [Opportunity Name]
[Repeat structure]

#### 3. [Opportunity Name]
[...]

#### 4-5. [Additional Opportunities]
[...]

### Diagnostics

**Passed Audits** (Good practices detected):
- [List passed audits, e.g., "Uses efficient cache policy", "Avoids enormous network payloads"]

**Manual Review Required**:
- [Items that require human judgment, e.g., "User Timing marks and measures"]

---

## 2. Accessibility (Score: ____ / 100)

### WCAG 2.1 Compliance Summary

| WCAG Level | Passed | Failed | Not Applicable |
|------------|--------|--------|----------------|
| **Level A** | ____ | ____ | ____ |
| **Level AA** | ____ | ____ | ____ |

### Critical Violations (WCAG Level A)

#### 1. [Violation Type - e.g., Missing Alt Text]
- **WCAG Criterion**: [e.g., 1.1.1 Non-text Content]
- **Severity**: [ ] Error / [ ] Warning
- **Elements Affected**:
  - `img[src="/path/to/image.png"]`
  - [CSS selector for element]
- **Impact**: [How this affects users with disabilities]
- **Remediation**: [How to fix, e.g., "Add alt='descriptive text' to all images"]
- **Priority**: High

#### 2. [Next Violation]
[...]

### Serious Violations (WCAG Level AA)

#### 1. [Violation Type - e.g., Insufficient Color Contrast]
- **WCAG Criterion**: [e.g., 1.4.3 Contrast (Minimum)]
- **Severity**: [ ] Error / [ ] Warning
- **Elements Affected**:
  - `.button-primary` (Contrast ratio: 3.2:1, requires 4.5:1)
- **Impact**: Text difficult to read for users with low vision
- **Remediation**: Darken button text color or lighten background
- **Priority**: Medium

### Warnings & Best Practices

- [List non-critical issues, e.g., "Consider using more descriptive link text"]

### Manual Testing Required

**Items NOT covered by automated checks**:
- [ ] Keyboard navigation (Tab, Enter, Arrow keys)
- [ ] Screen reader compatibility (NVDA, JAWS, VoiceOver)
- [ ] Focus management (modals, dynamic content)
- [ ] Dynamic content announcements (aria-live regions)

---

## 3. Best Practices (Score: ____ / 100)

### Security

| Check | Status | Details |
|-------|--------|---------|
| Uses HTTPS | [ ] Pass / [ ] Fail | [Details if failed] |
| No mixed content | [ ] Pass / [ ] Fail | [HTTP resources on HTTPS page] |
| Content Security Policy | [ ] Pass / [ ] Fail | [CSP header present/missing] |

### Browser Compatibility

| Check | Status | Issues |
|-------|--------|--------|
| No console errors | [ ] Pass / [ ] Fail | [Error messages if failed] |
| No deprecated APIs | [ ] Pass / [ ] Fail | [Deprecated features used] |
| Proper image aspect ratios | [ ] Pass / [ ] Fail | [Images with incorrect aspect ratios] |

### Issues Detected

1. **[Issue Type]**
   - **Description**: [...]
   - **Impact**: [Security risk / Compatibility / Performance]
   - **Remediation**: [...]

---

## 4. SEO (Score: ____ / 100)

### Technical SEO Checklist

| Check | Status | Details |
|-------|--------|---------|
| Meta description present | [ ] Pass / [ ] Fail | [Content: "..."] |
| Meta description <160 chars | [ ] Pass / [ ] Fail | [Current length: XXX] |
| Viewport tag present | [ ] Pass / [ ] Fail | [Content: "..."] |
| Title tag present & unique | [ ] Pass / [ ] Fail | [Title: "..."] |
| robots.txt valid | [ ] Pass / [ ] Fail | [Details] |
| Heading hierarchy correct | [ ] Pass / [ ] Fail | [Issues: "Skipped heading levels"] |
| Descriptive link text | [ ] Pass / [ ] Fail | [Links with "click here", "read more"] |

### Content Quality (Manual Review)

- [ ] Unique, descriptive title tags per page
- [ ] Meta descriptions accurately summarize page content
- [ ] Open Graph tags for social sharing (og:title, og:description, og:image)
- [ ] Structured data (JSON-LD) for rich results

### Recommendations

1. [SEO improvement suggestion]
2. [...]

---

## 5. Progressive Web App (Score: ____ / 100)

### PWA Installability Checklist

| Requirement | Status | Details |
|-------------|--------|---------|
| Served over HTTPS | [ ] Pass / [ ] Fail | [URL: ...] |
| Service worker registered | [ ] Pass / [ ] Fail | [Path: /sw.js or N/A] |
| Web app manifest valid | [ ] Pass / [ ] Fail | [Path: /manifest.json or N/A] |
| Manifest has icons (192x192, 512x512) | [ ] Pass / [ ] Fail | [Icons present: ...] |
| Manifest has name & short_name | [ ] Pass / [ ] Fail | [Names: ...] |
| Manifest display: standalone | [ ] Pass / [ ] Fail | [Display mode: ...] |
| Responds with 200 when offline | [ ] Pass / [ ] Fail | [Offline page: ...] |

### Current PWA Status

**Overall Assessment**: [ ] Fully Installable / [ ] Partially Compliant / [ ] Not a PWA

**Missing Requirements** (if not installable):
1. [e.g., "No service worker registered"]
2. [e.g., "Web app manifest missing"]
3. [...]

**Next Steps for PWA Compliance**:
- [ ] [Step 1]
- [ ] [Step 2]
- [ ] [Step 3]

---

## Recommendations Summary

### High Priority (Critical - Fix Immediately)

| Issue | Category | Impact | Effort | Timeline |
|-------|----------|--------|--------|----------|
| [Issue 1] | Performance/Accessibility/etc | [Impact description] | [Low/Med/High] | [Date] |
| [...] | [...] | [...] | [...] | [...] |

### Medium Priority (Important - Fix Next Sprint)

| Issue | Category | Impact | Effort | Timeline |
|-------|----------|--------|--------|----------|
| [...] | [...] | [...] | [...] | [...] |

### Low Priority (Nice-to-Have - Backlog)

| Issue | Category | Impact | Effort | Timeline |
|-------|----------|--------|--------|----------|
| [...] | [...] | [...] | [...] | [...] |

---

## Next Steps

1. **Immediate Actions** (This Week):
   - [ ] [Action 1]
   - [ ] [Action 2]

2. **Short-Term Actions** (Next Sprint):
   - [ ] [Action 1]
   - [ ] [Action 2]

3. **Long-Term Actions** (Backlog):
   - [ ] [Action 1]
   - [ ] [Action 2]

4. **Follow-Up Audit**: Scheduled for [YYYY-MM-DD] (3 months from now - quarterly cadence)

---

## Appendix

### Audit Configuration Details

```json
{
  "formFactor": "mobile",
  "throttling": {
    "rttMs": 150,
    "throughputKbps": 1638.4,
    "cpuSlowdownMultiplier": 4
  },
  "screenEmulation": {
    "mobile": true,
    "width": 412,
    "height": 915,
    "deviceScaleFactor": 2.625
  }
}
```

### Export Files

- **JSON Report**: `specs/007-chrome-devtools-audit/audit-reports/[YYYY-MM-DD]-performance.json`
- **HTML Report**: `specs/007-chrome-devtools-audit/audit-reports/[YYYY-MM-DD]-full-audit.html`

### References

- [Lighthouse Documentation](https://developers.google.com/web/tools/lighthouse)
- [Web.dev Metrics](https://web.dev/metrics/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Report Prepared By**: [Auditor Name]
**Review Date**: [YYYY-MM-DD]
**Next Audit Date**: [YYYY-MM-DD]
