# Change: Sprint 3 - Gamification Features (Achievements, Stats, Streaks, Templates)

## Why

Users need motivation to maintain consistent writing habits. Adding gamification elements (achievements, streaks, statistics) encourages sustained engagement. Template support enables quick task creation and workflow efficiency.

## What Changes

### Backend Additions

- **Achievements API**: Track and reward writing milestones
- **Stats API**: Provide writing statistics and analytics
- **Streaks API**: Track consecutive writing days
- **Templates API**: CRUD for reusable task templates

### Frontend Additions

- **ThemeToggle**: Switch between light/dark/ElevenLabs themes
- **Achievements component**: Display earned achievements
- **Stats component**: Show writing statistics dashboard
- **Export component**: Export tasks/stats in various formats

## Impact

- New API routes under `/achievements`, `/stats`, `/streaks`, `/templates`
- New React components in `client/src/components/`
- Database migrations for new models
- No breaking changes to existing APIs

## Effort

- Backend: ~4 API endpoints, ~3 models
- Frontend: ~4 new components with tests
- Medium complexity, 2-3 days estimated
