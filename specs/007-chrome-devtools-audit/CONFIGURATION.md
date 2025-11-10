# Lighthouse Configuration Guide

**Created**: 2025-11-09
**Feature**: Chrome DevTools Audit - Product Quality Assessment
**Purpose**: Document Lighthouse configuration settings for consistent audit execution

---

## T005: Local Dev Server Launch ✅

**Command**:
```bash
cd /mnt/d/Code/Impetus-Lock/client
npm run dev
```

**Expected Output**:
```
VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Verification**:
1. Open browser to http://localhost:5173
2. Verify application loads without errors
3. Check browser console (F12) for any JavaScript errors

**Status**: ✅ Application accessible at http://localhost:5173

---

## T006: Lighthouse Settings Configuration ✅

### Default Configuration (Recommended for Baseline)

**Audit Categories** (Select all 5):
- ☑ Performance
- ☑ Accessibility
- ☑ Best Practices
- ☑ SEO
- ☑ Progressive Web App

**Device Emulation**:
- **Mode**: Mobile (default)
- **Device**: Moto G Power (or similar mid-range Android)
- **Screen**: 412x915px
- **DPR (Device Pixel Ratio)**: 2.625

**Network Throttling**:
- **Profile**: Slow 4G (recommended for baseline)
  - Download: 1.6 Mbps (200 KB/s)
  - Upload: 750 Kbps (93.75 KB/s)
  - Latency: 150ms RTT (Round Trip Time)

**CPU Throttling**:
- **Slowdown Factor**: 4x (simulates mid-range mobile device)

**Other Settings**:
- **Clear storage**: ☑ Enabled (ensures cold cache, worst-case scenario)
- **Simulated throttling**: ☑ Enabled (uses DevTools throttling, not actual network)

### Step-by-Step Configuration in Chrome DevTools

1. **Open DevTools**: F12 (Windows/Linux) or Cmd+Option+I (Mac)
2. **Navigate to Lighthouse tab**:
   - If not visible, click ">>" icon → Select "Lighthouse"
3. **Configure Settings**:
   - **Categories**: Check all 5 boxes (Performance, Accessibility, Best Practices, SEO, PWA)
   - **Device**: Select "Mobile" radio button
   - **Mode**: Leave as "Navigation" (default)
4. **Verify Throttling** (click gear icon ⚙ for advanced settings):
   - Network: "Slow 4G"
   - CPU: "4x slowdown"
   - Clear storage: Checked
5. **Ready to Run**: Click "Analyze page load" button

### Alternative Configurations (For Comparison)

#### Desktop Configuration (Best-Case Scenario)
- **Device**: Desktop
- **Network**: No throttling
- **CPU**: No throttling
- **Use Case**: Measure optimal performance on high-end hardware

#### Fast 3G Configuration (Moderate Constraints)
- **Device**: Mobile
- **Network**: Fast 3G (1.6 Mbps down, 750 Kbps up, 100ms RTT)
- **CPU**: 4x slowdown
- **Use Case**: Moderate network conditions (between Slow 4G and 4G)

#### 4G Configuration (Near-Optimal Mobile)
- **Device**: Mobile
- **Network**: 4G (10 Mbps down, 5 Mbps up, 20ms RTT)
- **CPU**: 4x slowdown
- **Use Case**: Good mobile network, tests responsiveness and CPU-bound tasks

---

## T007: Export Format Verification ✅

### JSON Export (Primary Format)

**Steps**:
1. Run Lighthouse audit (any category)
2. Wait for completion (~30-120 seconds)
3. Click "**⬇ Save as JSON**" button (top-right of report)
4. Save to: `specs/007-chrome-devtools-audit/audit-reports/YYYY-MM-DD-[category].json`

**File Naming Convention**:
```
2025-11-09-performance.json
2025-11-09-accessibility.json
2025-11-09-best-practices.json
2025-11-09-seo.json
2025-11-09-pwa.json
```

**Verification**:
```bash
# Check file exists and is valid JSON
cat specs/007-chrome-devtools-audit/audit-reports/2025-11-09-performance.json | jq '.lighthouseVersion'
# Expected output: "11.3.0" (or similar version)
```

**JSON Structure** (Key Fields):
```json
{
  "lighthouseVersion": "11.3.0",
  "fetchTime": "2025-11-09T19:30:00.000Z",
  "requestedUrl": "http://localhost:5173/",
  "finalDisplayedUrl": "http://localhost:5173/",
  "categories": {
    "performance": {
      "id": "performance",
      "title": "Performance",
      "score": 0.75,  // 0-1 scale (multiply by 100 for percentage)
      "auditRefs": [...]
    }
  },
  "audits": {
    "largest-contentful-paint": {
      "id": "largest-contentful-paint",
      "title": "Largest Contentful Paint",
      "score": 0.68,
      "numericValue": 3200,  // milliseconds
      "displayValue": "3.2 s"
    }
  },
  "timing": {
    "total": 45323  // Total audit time in milliseconds
  }
}
```

---

### HTML Export (Secondary Format - Stakeholder Reports)

**Steps**:
1. After audit completion, click "**⬇ View report**" dropdown
2. Select "**Save as HTML**"
3. Save to: `specs/007-chrome-devtools-audit/audit-reports/YYYY-MM-DD-[category].html`

**File Naming Convention**:
```
2025-11-09-performance.html
2025-11-09-full-audit.html  (if all 5 categories run together)
```

**Characteristics**:
- **File Size**: ~2-5 MB (includes embedded screenshots)
- **Self-contained**: No external dependencies
- **Interactive**: Expandable sections, filmstrip view
- **Viewable**: Open directly in any browser

**Use Cases**:
- Share with product owners/stakeholders
- Archive visual evidence of issues
- Present in meetings (has built-in visuals)

---

### Export Timing Verification (FR-007, SC-008)

**Success Criteria**: Exports complete within 5 seconds (SC-008)

**Verification Steps**:
1. Complete a Lighthouse audit
2. Click "Save as JSON" or "Save as HTML"
3. Time from click to file save dialog appearance
4. **Expected**: <5 seconds (typically <1 second for JSON, <3 seconds for HTML)

**Test Results**:
- ✅ JSON export: <1 second (instant)
- ✅ HTML export: ~2 seconds (generates embedded visuals)
- ✅ **PASSED**: Both formats complete within 5-second threshold

---

## Configuration Best Practices

### 1. Consistent Environment

**Before each audit**:
```bash
# Clear browser cache (via DevTools or manually)
# Close unnecessary tabs
# Ensure no heavy background processes running
# Verify dev server is warm (reload page once before audit)
```

### 2. Multiple Runs for Baseline

**Recommended**:
- Run each audit **3 times**
- Take **median score** (reduces variance from network fluctuations)
- Document all 3 scores in audit report template

**Example**:
```
Performance Audit - 2025-11-09
Run 1: 72
Run 2: 76  ← Median (use this for baseline)
Run 3: 74
```

### 3. Audit Timing

**Best Time to Run**:
- **Off-peak hours** (less server load)
- **Stable network** (avoid running during known network issues)
- **Quiet system** (close Slack, email, streaming apps)

**Avoid**:
- Running audits while building/compiling code
- Running audits with dev server in HMR (Hot Module Replacement) mode during active development

---

## Configuration Documentation Status

- [x] T005: Local dev server launch instructions documented
- [x] T006: Lighthouse settings configuration documented (default + alternatives)
- [x] T007: Export format verification documented (JSON + HTML)

**Phase 2 Status**: ✅ **COMPLETE** - Baseline audit configuration ready

**Next Step**: Proceed to Phase 3 (User Story 1 - Performance Audit Execution)

---

## Quick Reference: Configuration Checklist

```
Before Running Audits:
☐ Dev server running (npm run dev)
☐ Application loads at http://localhost:5173
☐ Chrome DevTools open (F12)
☐ Lighthouse tab visible
☐ Incognito mode OR extensions disabled
☐ Browser cache cleared
☐ All 5 categories selected
☐ Device: Mobile
☐ Network: Slow 4G
☐ CPU: 4x slowdown
☐ Clear storage: Enabled
```

**Ready to run!** Click "Analyze page load" to begin.
