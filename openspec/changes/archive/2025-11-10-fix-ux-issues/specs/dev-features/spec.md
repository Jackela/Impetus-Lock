# Dev Features

## Capability Description
Hide development-only UI elements in production builds to avoid user confusion.

## ADDED Requirements

### Requirement: Dev-only buttons MUST be hidden in production

Development testing buttons SHALL only appear when running in dev mode (`import.meta.env.DEV === true`).

#### Scenario: Production build hides dev buttons
**Given** the application is built for production (`npm run build`)
**And** the production build is served (`npm run preview`)
**When** the user loads the application
**Then** "Test Delete feedback (dev only)" button is not visible
**And** "I'm stuck!" button remains visible (not dev-only)

#### Scenario: Development mode shows dev buttons
**Given** the application is running in dev mode (`npm run dev`)
**When** the user loads the application
**Then** "Test Delete feedback (dev only)" button is visible
**And** the button triggers sensory feedback when clicked

#### Scenario: Environment variable controls visibility
**Given** a component rendering conditional dev features
**When** `import.meta.env.DEV` is evaluated
**Then** it returns `true` in dev mode
**And** it returns `false` in production build
**And** JSX uses `{isDev && <DevButton />}` pattern

## MODIFIED Requirements

### Requirement: Manual trigger button MUST work in all environments

The "I'm stuck!" button is NOT dev-only and SHALL be visible in production builds.

#### Scenario: Manual trigger in production
**Given** the application is running in production mode
**When** the user clicks "I'm stuck!" button
**Then** AI intervention triggers normally
**And** locked content is added to editor

## Related Capabilities
- **sensory-feedback**: Test Delete button triggers this (dev-only)
- **manual-trigger**: "I'm stuck!" button (production-ready)
