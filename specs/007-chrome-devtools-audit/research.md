# Research: Lighthouse Audit Methodology

**Created**: 2025-11-09
**Feature**: Chrome DevTools Audit - Product Quality Assessment
**Purpose**: Document Lighthouse methodology, benchmarks, and best practices for consistent audit interpretation

---

## 1. Lighthouse Audit Methodology

### Score Calculation (0-100 Scale)

Lighthouse generates scores from 0-100 for each audit category based on weighted metrics:

**Score Ranges**:
- **90-100 (Green)**: Excellent - Meets or exceeds best practice thresholds
- **50-89 (Orange)**: Needs Improvement - Some optimizations required
- **0-49 (Red)**: Poor - Critical issues requiring immediate attention

**Key Characteristics**:
- Scores are **logarithmic**, not linear (improving from 50→75 is easier than 90→95)
- Each category has different metric weightings
- Scores can vary ±5 points between runs due to network/CPU variability
- **Recommendation**: Run audits 3 times, take median score for baseline

### Audit Categories & Weighting

#### Performance (Weighted Composite)
| Metric | Weight | Description |
|--------|--------|-------------|
| **First Contentful Paint (FCP)** | 10% | Time until first text/image renders |
| **Largest Contentful Paint (LCP)** | 25% | Time until largest content element renders |
| **Total Blocking Time (TBT)** | 30% | Total time main thread is blocked (interaction delay) |
| **Cumulative Layout Shift (CLS)** | 25% | Visual stability (unexpected layout shifts) |
| **Speed Index (SI)** | 10% | How quickly content is visually populated |

**Note**: Time to Interactive (TTI) is reported but not weighted in score calculation (deprecated in favor of TBT).

#### Accessibility (Binary Checks)
- **Weighting**: Each check is pass/fail, score = (passed checks / total checks) × 100
- **Categories**: Color contrast, ARIA usage, keyboard navigation, screen reader support, form labels
- **Important**: Lighthouse only detects ~30% of accessibility issues. Manual testing required for complete WCAG 2.1 compliance.

#### Best Practices (Binary & Heuristic)
- **Weighting**: Mix of binary checks (HTTPS, no console errors) and heuristic rules
- **Focus**: Security (mixed content, CSP headers), browser compatibility, deprecated APIs, image optimization

#### SEO (Binary Checks)
- **Weighting**: Pass/fail for technical SEO requirements
- **Coverage**: Meta tags, structured data, mobile-friendliness, crawlability
- **Limitation**: Does not assess content quality or keyword optimization (only technical SEO)

#### Progressive Web App (PWA - Checklist)
- **Weighting**: Binary checklist for PWA installability requirements
- **Requirements**: Service worker, web app manifest, HTTPS, offline functionality, icons
- **Note**: Scoring is strict - missing any requirement results in low score

---

## 2. Core Web Vitals Benchmarks

**Source**: [web.dev/vitals](https://web.dev/vitals) (Google's official thresholds, May 2023)

### LCP (Largest Contentful Paint)
- **Good**: ≤2.5 seconds
- **Needs Improvement**: 2.5s - 4.0s
- **Poor**: >4.0 seconds

**What it measures**: Loading performance (when main content becomes visible)

**Common Causes of Poor LCP**:
- Large images without optimization (wrong format, no compression)
- Render-blocking JavaScript/CSS
- Slow server response time (TTFB >600ms)
- Client-side rendering without SSR/SSG

---

### FID (First Input Delay) / INP (Interaction to Next Paint)
**Note**: FID is being replaced by INP (Interaction to Next Paint) as of March 2024, but Lighthouse still reports FID.

**FID Thresholds**:
- **Good**: ≤100 milliseconds
- **Needs Improvement**: 100ms - 300ms
- **Poor**: >300ms

**INP Thresholds** (future metric):
- **Good**: ≤200 milliseconds
- **Needs Improvement**: 200ms - 500ms
- **Poor**: >500ms

**What it measures**: Interactivity (responsiveness to user input)

**Common Causes of Poor FID/INP**:
- Long-running JavaScript tasks blocking main thread
- Large JavaScript bundles (>300KB)
- Heavy third-party scripts (analytics, ads)
- Unoptimized event handlers

---

### CLS (Cumulative Layout Shift)
- **Good**: ≤0.1
- **Needs Improvement**: 0.1 - 0.25
- **Poor**: >0.25

**What it measures**: Visual stability (unexpected content shifts)

**Common Causes of Poor CLS**:
- Images/iframes without width/height attributes
- Ads/embeds/iframes injected without reserved space
- Web fonts causing FOIT (Flash of Invisible Text) or FOUT (Flash of Unstyled Text)
- Dynamically injected content above existing content

---

### TBT (Total Blocking Time)
- **Good**: ≤200 milliseconds
- **Needs Improvement**: 200ms - 600ms
- **Poor**: >600ms

**What it measures**: Total time main thread is blocked by long tasks (>50ms)

**Relationship to FID**: TBT is a lab metric (synthetic) that correlates with FID (field metric)

---

### Speed Index (SI)
- **Good**: ≤3.4 seconds
- **Needs Improvement**: 3.4s - 5.8s
- **Poor**: >5.8s

**What it measures**: How quickly content is visually displayed during page load

---

## 3. WCAG 2.1 Level A & AA Requirements

**Standard**: [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/) (Web Content Accessibility Guidelines)

### Most Common Violations (Detected by Lighthouse)

#### 1. Color Contrast (WCAG 2.1 - 1.4.3 Contrast Minimum - Level AA)
- **Requirement**: Minimum 4.5:1 contrast ratio for normal text, 3:1 for large text (18pt+)
- **Lighthouse Check**: Automated detection of insufficient contrast
- **Note**: Lighthouse may not detect all contrast issues (e.g., text over images)

#### 2. Missing Alt Text (WCAG 2.1 - 1.1.1 Non-text Content - Level A)
- **Requirement**: All `<img>` elements must have `alt` attribute (even if empty for decorative images)
- **Lighthouse Check**: Flags images without `alt` attribute
- **Best Practice**: Alt text should describe image content/purpose (not just "image")

#### 3. Form Labels (WCAG 2.1 - 1.3.1 Info and Relationships - Level A)
- **Requirement**: All form inputs must have associated `<label>` or `aria-label`/`aria-labelledby`
- **Lighthouse Check**: Detects unlabeled inputs
- **Exception**: Search inputs with placeholder may be acceptable if aria-label provided

#### 4. ARIA Usage (WCAG 2.1 - 4.1.2 Name, Role, Value - Level A)
- **Requirement**: ARIA attributes must be used correctly (valid roles, no conflicting attributes)
- **Common Violations**:
  - `aria-hidden="true"` on focusable elements
  - Invalid `aria-labelledby` references (ID doesn't exist)
  - Incorrect `role` attributes (e.g., `role="button"` on `<div>` without keyboard handling)

#### 5. Keyboard Navigation (WCAG 2.1 - 2.1.1 Keyboard - Level A)
- **Requirement**: All interactive elements must be keyboard accessible (Tab, Enter, Space)
- **Lighthouse Limitation**: Only checks for `tabindex` issues, not full keyboard navigation
- **Manual Testing Required**: Verify all functionality works without mouse

---

## 4. Lighthouse Export Formats

### JSON Export (Recommended for Tracking)

**Advantages**:
- Machine-readable, version-controllable
- Complete audit data (all metrics, opportunities, diagnostics)
- Enables programmatic comparison between audits
- Compact file size (~500KB - 2MB depending on page complexity)

**Structure**:
```json
{
  "lighthouseVersion": "11.3.0",
  "fetchTime": "2025-11-09T19:00:00.000Z",
  "requestedUrl": "http://localhost:5173",
  "categories": {
    "performance": { "score": 0.75, "auditRefs": [...] },
    "accessibility": { "score": 0.92 }
  },
  "audits": {
    "largest-contentful-paint": {
      "score": 0.68,
      "numericValue": 3200,
      "displayValue": "3.2 s"
    }
  }
}
```

**Use Cases**:
- Automated trend tracking (compare scores over time)
- CI/CD integration (Lighthouse CI)
- Custom reporting dashboards
- Historical analysis (git-tracked audit reports)

---

### HTML Export (Recommended for Stakeholders)

**Advantages**:
- Human-readable, interactive report
- Visualizations (charts, screenshots, filmstrip)
- Expandable details for each opportunity
- Self-contained (no dependencies)

**File Size**: ~2MB - 5MB (includes embedded screenshots)

**Use Cases**:
- Sharing with non-technical stakeholders
- Executive summaries
- Audit presentations
- Archiving visual evidence of issues

---

### CSV Export (Not Natively Supported)

**Status**: Lighthouse does not natively export CSV. JSON must be converted using external tools.

**Workaround** (if needed):
1. Export JSON report
2. Use `lighthouse-to-csv` npm package or custom script
3. Extract key metrics to CSV for spreadsheet analysis

**Limitation**: CSV loses nested data structure (opportunities, diagnostics)

---

## 5. PWA Readiness Criteria

**Source**: [web.dev/pwa-checklist](https://web.dev/pwa-checklist)

### Minimum Requirements for Installability

1. **HTTPS**: Application must be served over HTTPS (or localhost for development)
2. **Web App Manifest**: Valid `manifest.json` with:
   - `name` and `short_name`
   - `icons` (at least 192x192px and 512x512px)
   - `start_url`
   - `display: "standalone"` or `"fullscreen"` or `"minimal-ui"`
3. **Service Worker**: Registered service worker with `fetch` event handler
4. **Offline Functionality**: Service worker must respond to requests when offline

### Lighthouse PWA Audit Checks

**Fast and Reliable** (Network-independent):
- [ ] Registers a service worker that controls page and start_url
- [ ] Service worker successfully serves offline page
- [ ] Responds with 200 when offline

**Installable**:
- [ ] Web app manifest meets installability requirements
- [ ] Has `<meta name="viewport">` tag with `width` or `initial-scale`
- [ ] Provides custom splash screen (via manifest icons)

**PWA Optimized** (Enhancements):
- [ ] Redirects HTTP traffic to HTTPS
- [ ] Configured for custom splash screen
- [ ] Sets theme color for address bar customization

### Expected Result for Impetus Lock (Current State)

**Baseline PWA Score**: Likely **30-40/100** (partial compliance)

**Expected Findings**:
- ✅ HTTPS (if deployed to production) or localhost (development)
- ✅ Viewport meta tag (assumed present in React app)
- ❌ No service worker registered (not implemented)
- ❌ No web app manifest (not implemented)
- ❌ No offline functionality

**Recommendation**: Document PWA deficiencies as enhancement opportunities (P4 priority per spec.md)

---

## 6. Audit Best Practices

### Consistent Baseline Measurements

1. **Clear browser cache** before each audit run
2. **Use incognito mode** to disable extensions
3. **Close unnecessary tabs** to free system resources
4. **Run 3 times**, take median score (reduce variance)
5. **Document system conditions**: CPU load, network stability, time of day

### Network Throttling Recommendations

**For Baseline Audits**:
- **Device**: Mobile (most constrained, represents worst-case)
- **Network**: Slow 4G (1.6 Mbps down, 750 Kbps up, 150ms RTT)
- **CPU**: 4x slowdown (mobile CPU simulation)

**For Comparison**:
- **Desktop, No Throttling**: Best-case scenario
- **Fast 3G**: Moderate constraints (10 Mbps down, 5 Mbps up, 100ms RTT)

### Avoiding False Positives/Negatives

**Common Pitfalls**:
- **Browser extensions** (ad blockers, privacy tools) interfere with metrics → Use incognito
- **Development builds** have unoptimized assets → Test production builds
- **Empty cache** vs **primed cache** → Lighthouse uses empty cache by default (worst-case)
- **Server variability** (TTFB fluctuations) → Run multiple audits

---

## 7. Interpretation Guidelines

### Performance Score Interpretation

**Score 90-100**: Production-ready, meets Google's "Good" thresholds
**Score 75-89**: Good, but room for optimization (target quick wins)
**Score 50-74**: Needs improvement, prioritize render-blocking resources and large assets
**Score <50**: Critical performance issues, major refactoring likely needed

### Accessibility Score Interpretation

**Score 100**: No **automated** issues detected (still requires manual testing)
**Score 90-99**: Minor issues (likely low-severity warnings)
**Score <90**: Critical issues present, blocks users with disabilities

**Important**: Lighthouse detects ~30% of accessibility issues. **Manual testing required** for:
- Keyboard navigation workflows
- Screen reader compatibility (NVDA, JAWS, VoiceOver)
- Focus management
- Dynamic content announcements

---

## 8. Benchmarking Context (Industry Standards)

### E-Commerce Performance Benchmarks
- **Amazon**: Performance score ~80-85
- **Shopify stores** (median): ~65-70
- **Custom React apps** (median): ~55-65

### Accessibility Benchmarks
- **Government sites** (required by law): 90-100
- **SaaS apps** (median): 75-85
- **Target for Impetus Lock**: ≥85 (good accessibility compliance)

### Mobile Performance (Slow 4G)
- **LCP <2.5s**: Achieved by ~50% of top 1000 sites
- **CLS <0.1**: Achieved by ~65% of top 1000 sites
- **TBT <200ms**: Achieved by ~40% of top 1000 sites

**Insight**: Meeting all "Good" thresholds on mobile puts Impetus Lock in top 25% of web applications.

---

## References

- [Web.dev - Lighthouse Scoring](https://web.dev/performance-scoring/)
- [Web.dev - Core Web Vitals](https://web.dev/vitals/)
- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [Chrome UX Report (CrUX)](https://developers.google.com/web/tools/chrome-user-experience-report)
- [Lighthouse GitHub](https://github.com/GoogleChrome/lighthouse)

---

**Research Status**: ✅ **COMPLETE** - Methodology documented, ready for audit execution
