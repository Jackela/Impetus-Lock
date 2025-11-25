# production-readiness Specification

## Purpose
Ensure application presents professional, branded experience in production builds by displaying correct page title.

## ADDED Requirements

### Requirement: Branded Page Title

The application SHALL display "Impetus Lock - AI-Powered Writing Pressure System" as the browser tab title.

**Rationale**: Improves brand visibility, tab discoverability, and SEO. Generic "client" title creates unprofessional impression and makes tab hard to find among many open tabs.

#### Scenario: Production Build Page Title

**Given** the application is built for production (`npm run build`)
**And** a user opens the application in a browser
**When** the page loads
**Then** the browser tab title SHALL display "Impetus Lock - AI-Powered Writing Pressure System"
**And** the document `<title>` element SHALL contain "Impetus Lock - AI-Powered Writing Pressure System"

**Acceptance Criteria**:
- [ ] Page title visible in browser tab: "Impetus Lock - AI-Powered Writing Pressure System"
- [ ] E2E test validates page title via `await page.title()`
- [ ] Title persists across page navigation/reload
- [ ] Title length is reasonable (<70 characters for SEO best practices)

---

### Requirement: Development Button Visibility (Validation Only)

The application SHALL hide development-only UI elements in production builds.

**Rationale**: Development artifacts (debug buttons, test triggers) must not appear in production to maintain professional appearance and prevent user confusion.

**Note**: ✅ Already implemented - ManualTriggerButton.tsx:99 gates "Test Delete" button with `import.meta.env.DEV`. This requirement validates existing behavior.

#### Scenario: Test Delete Button Hidden in Production

**Given** the application is built for production (`npm run build` with `NODE_ENV=production`)
**And** a user opens the application in a browser
**When** the user views the main interface
**Then** the "Test Delete" button SHALL NOT be visible
**And** the "Test Delete" button SHALL NOT be present in the DOM

**Acceptance Criteria**:
- [ ] Production build: "Test Delete" button absent from rendered HTML
- [ ] Development build: "Test Delete" button visible (regression protection)
- [ ] E2E test validates button absence in production build
- [ ] Visual screenshot comparison confirms no dev buttons in production UI

---
