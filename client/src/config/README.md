# Configuration Module

This directory contains centralized configuration constants for the Impetus Lock client application.

## Structure

```
config/
├── index.ts           # Barrel exports for all config modules
├── animation.ts       # Animation durations, timing constants
└── sensory-feedback.ts # Sensory feedback configuration
```

## Usage

Import configurations from the barrel export:

```typescript
import { DEFAULT_FEEDBACK_DURATION_MS, LOKI_COOLDOWN_MS, MUSE_STUCK_TIMEOUT_MS } from "../config";
```

Or import specific modules:

```typescript
import { DEFAULT_FEEDBACK_DURATION_MS } from "../config/animation";
```

## Guidelines

1. **Centralize Magic Numbers**: All timing values, durations, and thresholds should be defined here
2. **Use Descriptive Names**: Constants should clearly indicate their purpose and unit
3. **Add Units Suffix**: Use `_MS` suffix for millisecond values, `_PX` for pixels
4. **Document**: Each constant should have a JSDoc comment explaining its purpose
5. **Group Related Constants**: Keep related constants together (e.g., all animation durations)

## Adding New Configuration

1. Add the constant to the appropriate file (or create a new one)
2. Export it from `index.ts`
3. Update the documentation in this README
4. Replace any hardcoded values in the codebase with the new constant
