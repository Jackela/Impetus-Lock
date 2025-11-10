# Chrome DevTools Lighthouse Audit Checklist

**Purpose**: Quarterly audit workflow for tracking Impetus Lock performance, accessibility, and best practices over time.

**Frequency**: Every 3 months (Q1, Q2, Q3, Q4)

**Estimated Time**: 30-45 minutes per quarter

---

## Pre-Audit Setup (5 minutes)

### Environment Validation
- [ ] Chrome browser version 90+ installed
- [ ] Dev server running: `cd client && npm run dev`
- [ ] Server accessible at http://localhost:5173
- [ ] No other tabs/extensions running (use Incognito mode)
- [ ] System idle (no downloads, updates, or CPU-intensive tasks)

### Directory Preparation
- [ ] Create quarterly folder: `audit-reports/YYYY-QX/` (e.g., `2025-Q1/`)
- [ ] Copy `report-template.md` to new folder
- [ ] Note current date and time in template

---

## Audit Execution Workflow (20 minutes)

### 1. Performance Audit (5 minutes)
**Chrome DevTools → Lighthouse**

Configuration:
- [ ] Device: Mobile
- [ ] Categories: ✅ Performance only
- [ ] Throttling: Simulated throttling (default)

Run & Export:
- [ ] Click "Analyze page load"
- [ ] Wait for completion (~30 seconds)
- [ ] Export JSON: `performance-YYYY-MM-DD.json`
- [ ] Export HTML: `performance-YYYY-MM-DD.html`

Record Scores:
- [ ] Overall Performance score: ___/100
- [ ] Core Web Vitals:
  - [ ] LCP (Largest Contentful Paint): ___ ms
  - [ ] TBT (Total Blocking Time): ___ ms
  - [ ] CLS (Cumulative Layout Shift): ___

Top Opportunities:
- [ ] 1. _________________________ (Impact: ___ ms)
- [ ] 2. _________________________ (Impact: ___ ms)
- [ ] 3. _________________________ (Impact: ___ ms)

---

### 2. Accessibility Audit (5 minutes)
**Chrome DevTools → Lighthouse**

Configuration:
- [ ] Device: Desktop
- [ ] Categories: ✅ Accessibility only
- [ ] Throttling: No throttling

Run & Export:
- [ ] Click "Analyze page load"
- [ ] Export JSON: `accessibility-YYYY-MM-DD.json`
- [ ] Export HTML: `accessibility-YYYY-MM-DD.html`

Record Scores:
- [ ] Overall Accessibility score: ___/100
- [ ] WCAG 2.1 AA compliance: ___% (target: 100%)

Failed Audits (Manual Review Required):
- [ ] 1. _________________________
- [ ] 2. _________________________
- [ ] 3. _________________________

---

### 3. Best Practices Audit (3 minutes)
**Chrome DevTools → Lighthouse**

Configuration:
- [ ] Device: Desktop
- [ ] Categories: ✅ Best Practices only
- [ ] Throttling: No throttling

Run & Export:
- [ ] Click "Analyze page load"
- [ ] Export JSON: `best-practices-YYYY-MM-DD.json`
- [ ] Export HTML: `best-practices-YYYY-MM-DD.html`

Record Scores:
- [ ] Overall Best Practices score: ___/100

Security Issues:
- [ ] No browser errors logged: ✅ / ❌
- [ ] HTTPS used: ✅ / ❌ (N/A for local dev)
- [ ] Secure content-type headers: ✅ / ❌

---

### 4. SEO Audit (3 minutes)
**Chrome DevTools → Lighthouse**

Configuration:
- [ ] Device: Mobile
- [ ] Categories: ✅ SEO only
- [ ] Throttling: No throttling

Run & Export:
- [ ] Click "Analyze page load"
- [ ] Export JSON: `seo-YYYY-MM-DD.json`
- [ ] Export HTML: `seo-YYYY-MM-DD.html`

Record Scores:
- [ ] Overall SEO score: ___/100

Key SEO Elements:
- [ ] Meta description present: ✅ / ❌
- [ ] Viewport meta tag configured: ✅ / ❌
- [ ] Document has title: ✅ / ❌

---

### 5. PWA Audit (Optional - 2 minutes)
**Chrome DevTools → Lighthouse**

Configuration:
- [ ] Device: Mobile
- [ ] Categories: ✅ PWA only
- [ ] Throttling: No throttling

Run & Export:
- [ ] Click "Analyze page load"
- [ ] Export JSON: `pwa-YYYY-MM-DD.json`
- [ ] Export HTML: `pwa-YYYY-MM-DD.html`

Record Scores:
- [ ] Overall PWA score: ___/100 (target: N/A - not a PWA yet)

Installability Status:
- [ ] Fast and reliable: ✅ / ❌
- [ ] Installable: ✅ / ❌ (expected: ❌ until PWA feature)

---

## Post-Audit Analysis (10 minutes)

### Trend Comparison
- [ ] Compare current scores to previous quarter
- [ ] Identify score improvements: +___% (Performance), +___% (Accessibility)
- [ ] Identify score regressions: -___% (category)

### Prioritization Matrix

High Impact / Low Effort (Do First):
- [ ] 1. _________________________
- [ ] 2. _________________________

High Impact / High Effort (Plan):
- [ ] 1. _________________________
- [ ] 2. _________________________

Low Impact (Defer):
- [ ] 1. _________________________

### Documentation Update
- [ ] Fill in `report-template.md` with all scores and findings
- [ ] Update UX_IMPROVEMENT_PLAN.md with prioritized items
- [ ] Create GitHub issues for high-priority items (optional)

---

## Quarterly Audit Schedule

### Q1 (January - March)
- [ ] Audit Date: _________________________
- [ ] Overall Status: ⬆️ Improved / ➡️ Stable / ⬇️ Regressed
- [ ] Action Items: _________________________

### Q2 (April - June)
- [ ] Audit Date: _________________________
- [ ] Overall Status: ⬆️ Improved / ➡️ Stable / ⬇️ Regressed
- [ ] Action Items: _________________________

### Q3 (July - September)
- [ ] Audit Date: _________________________
- [ ] Overall Status: ⬆️ Improved / ➡️ Stable / ⬇️ Regressed
- [ ] Action Items: _________________________

### Q4 (October - December)
- [ ] Audit Date: _________________________
- [ ] Overall Status: ⬆️ Improved / ➡️ Stable / ⬇️ Regressed
- [ ] Action Items: _________________________

---

## Troubleshooting

### Issue: Lighthouse Fails to Run
**Symptoms**: "Lighthouse error" or timeout
**Solutions**:
- [ ] Close all other tabs and restart Chrome
- [ ] Disable browser extensions (use Incognito mode)
- [ ] Check dev server is running: `curl http://localhost:5173`
- [ ] Increase timeout: DevTools → Settings → Lighthouse → Timeout (60s)

### Issue: Inconsistent Scores Between Runs
**Symptoms**: Score varies ±10 points
**Solutions**:
- [ ] Run audit 3 times, use median score
- [ ] Ensure no background tasks (downloads, updates)
- [ ] Use "Simulated throttling" for consistency
- [ ] Close other applications consuming CPU/network

### Issue: Cannot Export Reports
**Symptoms**: Export buttons grayed out
**Solutions**:
- [ ] Wait for audit to fully complete (check for "View Treemap" link)
- [ ] Use "Save as..." on report page (Ctrl+S)
- [ ] Copy report URL from DevTools → Network tab

---

## Best Practices

### Do's ✅
- Run audits in Incognito mode (clean slate)
- Use consistent device mode (Mobile for Performance, Desktop for Accessibility)
- Export both JSON (for trends) and HTML (for details)
- Compare scores quarter-over-quarter (not week-over-week)
- Focus on high-impact opportunities first

### Don'ts ❌
- Don't run audits while building/compiling code
- Don't compare scores from different Lighthouse versions
- Don't obsess over minor score fluctuations (±5 points is normal)
- Don't skip WCAG 2.1 manual checks (Lighthouse doesn't catch everything)
- Don't ignore warnings about third-party scripts

---

## Reference Documentation

- **Execution Guide**: `../EXECUTION_GUIDE.md` (step-by-step audit instructions)
- **Configuration**: `../CONFIGURATION.md` (Lighthouse settings)
- **Prerequisites**: `../PREREQUISITES.md` (environment setup)
- **Report Template**: `./report-template.md` (standardized reporting format)
- **UX Plan**: `../UX_IMPROVEMENT_PLAN.md` (implementation roadmap)

---

**Last Updated**: 2025-11-10
**Version**: 1.0.0
**Maintained By**: Impetus Lock Team
