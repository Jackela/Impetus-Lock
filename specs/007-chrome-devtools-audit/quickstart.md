# Chrome DevTools Lighthouse Audit - Quick Start Guide

**Goal**: Run your first Lighthouse audit on Impetus Lock in under 10 minutes.

**Audience**: Developers new to Lighthouse or Chrome DevTools performance testing.

---

## What is Lighthouse?

Lighthouse is Google's automated tool for measuring web performance, accessibility, SEO, and best practices. It runs directly in Chrome DevTools (no installation needed).

**Why it matters for Impetus Lock**:
- Validates Core Web Vitals (LCP, TBT, CLS) for smooth writing experience
- Catches accessibility issues (keyboard navigation, screen readers)
- Identifies performance bottlenecks (slow animations, large bundles)

---

## 5-Minute First Audit

### Step 1: Start the Development Server (1 minute)

```bash
cd /mnt/d/Code/Impetus-Lock/client
npm run dev
```

**Expected Output**:
```
VITE v5.x.x  ready in 234 ms

➜  Local:   http://localhost:5173/
```

**Verify**: Open http://localhost:5173 in Chrome → you should see the Impetus Lock editor.

---

### Step 2: Open Chrome DevTools (30 seconds)

1. **Open DevTools**: Press `F12` or `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Option+I` (macOS)
2. **Navigate to Lighthouse tab**: Click "Lighthouse" in the top tab bar
   - *If hidden*: Click `>>` (overflow menu) → "Lighthouse"

**What you'll see**:
```
Lighthouse
├── Mode: Navigation (default)
├── Device: [Mobile] [Desktop]
└── Categories:
    ☑ Performance
    ☑ Accessibility
    ☑ Best practices
    ☑ SEO
    ☐ Progressive Web App
```

---

### Step 3: Configure and Run Your First Audit (30 seconds)

**Recommended Settings for First Run**:
- **Device**: Mobile (tests worst-case performance)
- **Categories**: ✅ Performance only (fastest audit)
- **Throttling**: Simulated throttling (default)

**Click**: "Analyze page load" button (blue button at bottom)

**Wait**: ~30 seconds while Lighthouse:
1. Reloads the page
2. Simulates slow 4G network
3. Measures Core Web Vitals
4. Generates report

---

### Step 4: Interpret Your Results (2 minutes)

**Performance Score**: 0-100 (higher is better)
- 90-100: ✅ **Good** (green)
- 50-89: ⚠️ **Needs Improvement** (orange)
- 0-49: ❌ **Poor** (red)

**Key Metrics to Watch**:

| Metric | What It Measures | Target |
|--------|------------------|--------|
| **LCP** (Largest Contentful Paint) | How fast main content loads | < 2.5s |
| **TBT** (Total Blocking Time) | How long page is unresponsive | < 200ms |
| **CLS** (Cumulative Layout Shift) | How much content jumps around | < 0.1 |

**Example Report**:
```
Performance: 87/100 ⚠️

Core Web Vitals:
✅ LCP: 1.8s (Good)
⚠️ TBT: 340ms (Needs Improvement)  ← Focus here!
✅ CLS: 0.05 (Good)

Opportunities:
1. Reduce unused JavaScript → Save 450ms ⚡
2. Properly size images → Save 200ms ⚡
3. Minify CSS → Save 50ms
```

---

### Step 5: Export and Save Report (1 minute)

**Why Export?**
- Track improvements over time
- Share with team
- Reference detailed recommendations later

**How to Export**:
1. Scroll to top of Lighthouse report
2. Click **gear icon** (⚙️) → "Save as HTML"
3. Save to: `specs/007-chrome-devtools-audit/audit-reports/YYYY-MM-DD/`
4. File name: `performance-2025-11-10.html`

**JSON Export** (for programmatic analysis):
1. Click **gear icon** (⚙️) → "Save as JSON"
2. File name: `performance-2025-11-10.json`

---

## What to Do Next

### Immediate Actions (Based on Your Score)

**If Score > 90** 🎉:
- You're doing great! Run Accessibility audit next.
- Focus on maintaining performance as features are added.

**If Score 50-89** ⚠️:
- Review "Opportunities" section in report
- Prioritize items with highest time savings (ms impact)
- Common quick wins:
  - Lazy load images: `loading="lazy"` attribute
  - Code splitting: Dynamic imports for routes
  - Remove unused dependencies: Check bundle size

**If Score < 50** ❌:
- Start with "Diagnostics" section (red flags)
- Check for blocking scripts in `<head>`
- Verify dev server isn't throttled by system resources
- Re-run audit 2-3 times to rule out anomalies

---

## Running Other Audit Categories

### Accessibility Audit (WCAG 2.1 Compliance)

**When to run**: After every UI change (toolbar, modals, forms)

**Configuration**:
- Device: **Desktop** (keyboard nav is primary)
- Categories: ✅ **Accessibility** only
- Throttling: No throttling

**Key Checks**:
- ✅ All interactive elements have ARIA labels
- ✅ Color contrast ratios meet 4.5:1 (text) / 3:1 (UI elements)
- ✅ Focus indicators visible on keyboard navigation

**Common Issues for Impetus Lock**:
- Toolbar buttons missing `aria-label` attributes
- Locked content not announced to screen readers
- Modal dialogs not trapping focus

---

### Best Practices Audit (Security & Errors)

**When to run**: Before every deployment

**Configuration**:
- Device: Desktop
- Categories: ✅ **Best Practices** only

**Key Checks**:
- ❌ No browser console errors
- ✅ HTTPS used (N/A for `localhost`)
- ✅ No deprecated APIs (e.g., `document.execCommand`)

---

### SEO Audit (Discoverability)

**When to run**: Once per quarter (unless adding new pages)

**Configuration**:
- Device: Mobile
- Categories: ✅ **SEO** only

**Key Checks**:
- ✅ `<title>` tag present: "Impetus Lock - AI-Powered Writing Pressure System"
- ✅ `<meta name="description">` tag present
- ✅ Viewport meta tag configured

---

## Real-World Example: Debugging a Performance Issue

### Scenario: Toolbar Animation Feels Sluggish

**Step 1**: Run Performance audit
```
Result: TBT = 450ms (⚠️ Needs Improvement)
Opportunity: "Reduce unused JavaScript" → 600ms savings
Details: @milkdown/preset-commonmark (200KB) loaded but rarely used
```

**Step 2**: Investigate with Performance Profiler
1. DevTools → Performance tab
2. Record → Trigger toolbar animation → Stop
3. Look for long tasks (yellow/red bars > 50ms)

**Step 3**: Implement Fix
```typescript
// Before: Eager load entire preset
import { commonmark } from '@milkdown/preset-commonmark';

// After: Lazy load on-demand
const loadCommonmark = () => import('@milkdown/preset-commonmark');
```

**Step 4**: Re-run Audit
```
Result: TBT = 180ms (✅ Good) → 270ms improvement!
```

---

## Common Pitfalls & Solutions

### Pitfall 1: Scores Vary Between Runs

**Symptoms**: Performance score is 85, then 72, then 91 on consecutive runs.

**Causes**:
- Background tasks (downloads, OS updates)
- Other browser tabs consuming resources
- Non-deterministic code (timers, animations)

**Solutions**:
- ✅ Use **Incognito mode** (clean slate, no extensions)
- ✅ Run audit **3 times**, use **median score**
- ✅ Close other applications
- ✅ Use "Simulated throttling" (not "DevTools throttling")

---

### Pitfall 2: Mobile vs Desktop Score Mismatch

**Symptoms**: Desktop: 95, Mobile: 68

**Why**: Mobile audits apply:
- CPU throttling (4x slowdown)
- Network throttling (slow 4G)
- Smaller viewport (forces layout recalculations)

**What to do**:
- **Prioritize mobile score** (worst-case scenario)
- Optimize for mobile first, desktop benefits automatically
- Use `@media (max-width: 768px)` for responsive design

---

### Pitfall 3: Lighthouse Says "Reduce JavaScript" but Bundle is Already Small

**Symptoms**: Opportunity shows "Save 800ms" but `npm run build` shows only 150KB bundle.

**Why**: Third-party scripts count:
- Milkdown editor library
- Framer Motion animations
- Dev-only code (if not tree-shaken)

**What to do**:
- ✅ Check **production build**: `npm run build && npm run preview`
- ✅ Use **Tree-shaking**: Ensure `"sideEffects": false` in package.json
- ✅ Code-split routes: Dynamic imports for non-critical features

---

## Quarterly Audit Workflow

**Goal**: Track performance trends over time, not one-off scores.

### Step 1: Create Quarterly Folder
```bash
mkdir -p specs/007-chrome-devtools-audit/audit-reports/2025-Q4
```

### Step 2: Run All 5 Audits (30 minutes)
```
✅ Performance (Mobile, simulated throttling)
✅ Accessibility (Desktop, no throttling)
✅ Best Practices (Desktop, no throttling)
✅ SEO (Mobile, no throttling)
✅ PWA (Mobile, optional)
```

### Step 3: Fill Out Report Template
```bash
cp specs/007-chrome-devtools-audit/audit-templates/report-template.md \
   specs/007-chrome-devtools-audit/audit-reports/2025-Q4/report.md
```

Edit `report.md`:
- Record scores for each category
- Compare to previous quarter (Q3)
- Prioritize opportunities by impact

### Step 4: Create Action Items
```markdown
## Q4 2025 Action Items

High Priority:
- [ ] Reduce TBT by lazy-loading Milkdown plugins (ETA: 2 weeks)
- [ ] Fix color contrast on toolbar buttons (ETA: 2 days)

Low Priority:
- [ ] Add service worker for PWA (ETA: Q1 2026)
```

---

## Reference Documentation

### Detailed Guides (When You Need More Info)
- **[EXECUTION_GUIDE.md](./EXECUTION_GUIDE.md)**: Step-by-step instructions for all 5 audit categories
- **[CONFIGURATION.md](./CONFIGURATION.md)**: Lighthouse settings, throttling configs, device modes
- **[PREREQUISITES.md](./PREREQUISITES.md)**: Environment setup, browser requirements

### Templates (For Reporting)
- **[report-template.md](./audit-templates/report-template.md)**: Standardized quarterly report format
- **[audit-checklist.md](./audit-templates/audit-checklist.md)**: Quarterly audit workflow checklist

### Research (For Deep Dives)
- **[research.md](./research.md)**: Lighthouse methodology, Core Web Vitals benchmarks, WCAG 2.1 requirements
- **[UX_IMPROVEMENT_PLAN.md](./UX_IMPROVEMENT_PLAN.md)**: Prioritized roadmap for performance improvements

---

## Getting Help

### Lighthouse Reports Hard to Interpret?
- Read: [Web.dev Lighthouse Documentation](https://web.dev/lighthouse-performance/)
- Video: [Google Chrome Developers - Lighthouse Tutorial](https://www.youtube.com/watch?v=VyaHwvPWuZU)

### Need to Automate Audits?
- See: `specs/007-chrome-devtools-audit/research.md` → "Future Work: Lighthouse CI"
- Tool: [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) (GitHub Actions integration)

### Found a Bug or Issue?
- Create issue: `specs/007-chrome-devtools-audit/audit-reports/YYYY-QX/issues.md`
- Reference Lighthouse report JSON for reproducibility

---

## Checklist: Your First Audit in 10 Minutes

- [ ] Step 1: Start dev server (`npm run dev`)
- [ ] Step 2: Open DevTools → Lighthouse tab
- [ ] Step 3: Configure (Mobile, Performance only, Simulated throttling)
- [ ] Step 4: Click "Analyze page load"
- [ ] Step 5: Review score and Core Web Vitals (LCP, TBT, CLS)
- [ ] Step 6: Export HTML report to `audit-reports/`
- [ ] Step 7: Pick 1 high-impact opportunity from "Opportunities" section
- [ ] Step 8: Implement fix, re-run audit, verify improvement

**Time Spent**: 10 minutes
**Value Gained**: Baseline performance metrics + 1 actionable improvement

---

**Next Steps**:
1. Run your first audit using this guide
2. Export and save the report
3. Share findings with team
4. Schedule quarterly audits (add to calendar)

**Last Updated**: 2025-11-10
**Version**: 1.0.0
**Maintained By**: Impetus Lock Team
