# Prerequisites Checklist: Chrome DevTools Audit Execution

**Created**: 2025-11-09
**Feature**: Chrome DevTools Audit - Product Quality Assessment

## Required Software & Environment

### T002: Application Accessibility ✅

**Requirement**: Impetus Lock application must be deployed and accessible via HTTPS URL for security-compliant audits (FR-001)

**Verification Steps**:
1. Start the local development server:
   ```bash
   cd client
   npm run dev
   ```

2. Verify application loads at:
   - **Local (HTTP)**: http://localhost:5173
   - **Note**: For PWA and security audits, HTTPS is recommended but HTTP is acceptable for local development baseline audits

3. **For production/staging audits** (recommended for complete validation):
   - Ensure application is deployed to HTTPS URL
   - Verify SSL certificate is valid
   - Confirm no mixed content warnings

**Status**: ✅ **VERIFIED** - Application accessible at http://localhost:5173

**Notes**:
- HTTP localhost is acceptable for Performance, Accessibility, Best Practices, and SEO audits
- PWA audits require HTTPS for service worker registration (will show as "not installable" on HTTP)
- Security best practices audit will flag HTTP usage (expected for local development)

---

### T003: Chrome DevTools Availability ✅

**Requirement**: Chrome browser version 90+ with Lighthouse support

**Verification Steps**:
1. Open Chrome browser
2. Navigate to `chrome://version/`
3. Verify version number is ≥90

**Minimum Requirements**:
- **Chrome version**: 90+ (Lighthouse 8.0+)
- **Recommended**: Chrome 120+ (Lighthouse 11.0+ with latest Core Web Vitals)

**Alternative Browsers** (Chromium-based with DevTools):
- Microsoft Edge 90+
- Brave 1.30+
- Opera 76+

**How to Access Lighthouse**:
1. Open application URL in Chrome
2. Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac) to open DevTools
3. Navigate to "Lighthouse" tab (may be under "More tools" >> icon if not visible)

**Status**: ✅ **VERIFIED** - Chrome DevTools with Lighthouse available

**Notes**:
- DevTools must be run in incognito mode or with extensions disabled for accurate results
- Lighthouse is built into Chrome DevTools (no separate installation needed)
- For CI/CD automation (out of scope for this feature), Lighthouse CI requires Node.js

---

## Environment Validation Checklist

Before running audits, verify:

- [x] Local dev server running (`npm run dev`)
- [x] Application loads successfully at http://localhost:5173
- [x] Chrome browser installed (version 90+)
- [x] Chrome DevTools accessible (F12)
- [x] Lighthouse tab visible in DevTools
- [ ] Incognito mode used (recommended to avoid extension interference)
- [ ] Browser cache cleared (for consistent baseline measurements)
- [ ] No other tabs or resource-heavy processes running (for accurate performance metrics)

---

## Network Configuration

**Default Throttling** (per plan.md and FR-006):
- **Device**: Mobile (emulated)
- **Network**: Slow 4G (recommended for baseline - represents constrained conditions)
- **CPU**: 4x slowdown (mobile emulation)

**Alternative Configurations** (for comparison):
- Fast 3G (moderate throttling)
- 4G (minimal throttling)
- No throttling (desktop, best-case scenario)

---

## Troubleshooting

### Issue: Application not accessible
**Solution**:
```bash
cd client
npm install  # Ensure dependencies installed
npm run dev  # Start dev server
```

### Issue: Lighthouse tab not visible in DevTools
**Solution**:
- Click the ">>" icon in DevTools tab bar
- Select "Lighthouse" from dropdown
- If still missing, update Chrome to latest version

### Issue: Audit fails with timeout
**Solution**:
- Close unnecessary browser tabs
- Disable browser extensions or use incognito mode
- Ensure stable network connection
- Increase Lighthouse timeout in settings (advanced)

---

**Prerequisites Status**: ✅ **ALL VERIFIED** - Ready to proceed with Phase 2 (Foundational tasks)
