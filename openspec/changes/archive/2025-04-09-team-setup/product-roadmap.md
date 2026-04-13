# Impetus Lock - Product Roadmap

## Vision

Impetus Lock (创意施压者) is an adversarial AI writing tool that breaks psychological fixation and blank page anxiety through "un-deletable creative constraints." We turn solitary writing into a human-AI adversarial rogue-like game.

---

## Q2 2026 Goals (April - June)

### North Star Metrics

| Metric | Current | Q2 Target |
|--------|---------|-----------|
| Weekly Active Users (WAU) | 0 (MVP) | 500 |
| Task Completion Rate | N/A | 60% |
| User Retention (7-day) | N/A | 30% |
| Avg. Session Duration | N/A | 15 min |

### Strategic Pillars

```
┌─────────────────────────────────────────────────────────────────┐
│  PILLAR 1          PILLAR 2           PILLAR 3          PILLAR 4│
│  Foundation        Engagement         Growth           Quality  │
│  ━━━━━━━━━        ━━━━━━━━━━         ━━━━━━           ━━━━━━━  │
│  • Persistence    • Task Modes      • Sharing         • Polish │
│  • Auth           • Analytics       • Templates       • Perf   │
│  • Data Model     • Gamification    • Onboarding      • Bugfix │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Priority Matrix

### P0 - Critical (Must Have for Launch)

| Feature | User Story | Est. Effort | Owner | Target |
|---------|------------|-------------|-------|--------|
| Task Persistence | As a user, I want my tasks saved to database so I don't lose work | 5d | Backend | Week 1 |
| User Authentication | As a user, I want to create an account and log in securely | 3d | Backend | Week 2 |
| Task CRUD API | As a user, I want to create/read/update/delete tasks via API | 3d | Backend | Week 1-2 |
| Task List UI | As a user, I want to see and manage my tasks in a list view | 4d | Frontend | Week 2-3 |

### P1 - High (Differentiating Features)

| Feature | User Story | Est. Effort | Owner | Target |
|---------|------------|-------------|-------|--------|
| Task Categories | As a user, I want to categorize tasks (Writing/Planning/Research) | 2d | Full Stack | Week 3 |
| Priority Levels | As a user, I want to set task priority (High/Medium/Low) | 2d | Full Stack | Week 3 |
| Due Dates | As a user, I want to set due dates for tasks | 2d | Full Stack | Week 4 |
| Task Templates | As a user, I want quick-start templates for common task types | 3d | Frontend | Week 4 |
| Progress Tracking | As a user, I want to see my writing progress over time | 3d | Full Stack | Week 5 |

### P2 - Medium (Engagement Boosters)

| Feature | User Story | Est. Effort | Owner | Target |
|---------|------------|-------------|-------|--------|
| Writing Streaks | As a user, I want to track my daily writing streaks | 2d | Full Stack | Week 5 |
| Achievement System | As a user, I want to unlock achievements for milestones | 3d | Frontend | Week 6 |
| Export to Markdown | As a user, I want to export my work as Markdown files | 2d | Backend | Week 6 |
| Dark Mode Polish | As a user, I want a refined dark mode experience | 2d | Frontend | Week 6 |

### P3 - Low (Nice to Have)

| Feature | User Story | Est. Effort | Owner | Target |
|---------|------------|-------------|-------|--------|
| Collaborative Locks | As a user, I want to share locked constraints with friends | 4d | Full Stack | Week 7+ |
| Public Templates | As a user, I want to browse community-created templates | 3d | Full Stack | Week 7+ |
| Mobile App (PWA) | As a user, I want to use Impetus Lock on my phone | 5d | Frontend | Week 8+ |
| AI Writing Coach | As a user, I want personalized writing tips from AI | 4d | Backend | Week 8+ |

---

## User Story Map

### Epic: Task Management

```
BACKBONE: Task Lifecycle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE                    MANAGE                    COMPLETE
─────────────────────────────────────────────────────────────────
• Create blank task      • View task list         • Mark complete
• Use template           • Filter by status       • Archive task
• Duplicate task         • Sort by priority       • Export result
                         • Search tasks           • Share achievement
                         • Edit metadata

USER ACTIVITIES (Walking Skeleton)
─────────────────────────────────────────────────────────────────
[Discover] → [Create] → [Write] → [Review] → [Complete]
    │           │          │          │           │
    ▼           ▼          ▼          ▼           ▼
 See demo   Choose      Use Muse    Review     Celebrate
 onboarding template    /Loki       history    progress

RELEASE SLICES
─────────────────────────────────────────────────────────────────
MVP (Week 3): Create → Write → Basic List View
V1.1 (Week 5): Templates → Categories → Progress Tracking
V1.2 (Week 7): Achievements → Sharing → Export
```

### Epic: User Identity & Data

```
BACKBONE: User Journey
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ONBOARDING              AUTHENTICATION           DATA MANAGEMENT
─────────────────────────────────────────────────────────────────
• Welcome modal        • Register account       • View all tasks
• Feature tour         • Login/logout           • Sync across devices
• Quick start guide    • Password reset         • Export data
• Template selection   • Session management     • Delete account

USER ACTIVITIES
─────────────────────────────────────────────────────────────────
[First Visit] → [Sign Up] → [First Task] → [Return Visit]
      │              │            │              │
      ▼              ▼            ▼              ▼
  See value      Create        Experience     Continue
  proposition    account       core loop      where left off
```

### Epic: AI Agent Experience

```
BACKBONE: Agent Interaction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MUSE MODE                    LOKI MODE
─────────────────────────────────────────────────────────────────
• Detect stuck state        • Random interventions
• Inject constraints        • Provoke with chaos
• Offer guidance            • Delete last sentence
• Celebrate breakthroughs   • Rewrite text

SENSORY FEEDBACK
─────────────────────────────────────────────────────────────────
• Visual: Glitch effects, color shifts, animations
• Audio: Contextual sound effects (opt-in)
• Haptic: Mobile vibration patterns

USER ACTIVITIES
─────────────────────────────────────────────────────────────────
[Start Writing] → [Hit Block] → [Muse Helps] → [Breakthrough]
      │                              │
      └────────── [Loki Strikes] ←───┘
                     │
                     ▼
              [Adapt & Continue]
```

---

## Release Timeline

### Milestone 1: Foundation (Week 1-3)
**Goal**: Working task persistence with basic CRUD

```
Week 1: Task Persistence Backend
├── Database schema design
├── Task CRUD API endpoints
├── Authentication foundation
└── Unit tests (TDD)

Week 2: Frontend Integration
├── Task list UI component
├── Task creation modal
├── API integration layer
└── E2E tests

Week 3: Integration & Polish
├── End-to-end flow validation
├── Error handling
├── Loading states
└── MVP demo ready
```

### Milestone 2: Engagement (Week 4-6)
**Goal**: Features that drive daily usage

```
Week 4: Organization Features
├── Task categories
├── Priority levels
├── Due dates
└── Filtering & sorting

Week 5: User Motivation
├── Progress dashboard
├── Writing streaks
├── Basic achievements
└── Export functionality

Week 6: Experience Polish
├── Dark mode refinement
├── Animation improvements
├── Performance optimization
└── V1.1 release
```

### Milestone 3: Growth (Week 7-8)
**Goal**: Virality and retention mechanisms

```
Week 7: Social Features
├── Share locked constraints
├── Public template gallery
├── Achievement sharing
└── Collaborative features (basic)

Week 8: Scale Preparation
├── PWA support
├── Performance monitoring
├── Analytics instrumentation
└── V1.2 release candidate
```

---

## Technical Debt & Architecture

### Q2 Architecture Goals

| Priority | Item | Impact | Effort |
|----------|------|--------|--------|
| P0 | Database migration system | Required for persistence | 1d |
| P0 | API versioning strategy | Future compatibility | 1d |
| P1 | Caching layer (Redis) | Performance | 2d |
| P1 | Background job queue | Async processing | 2d |
| P2 | Monitoring & alerting | Reliability | 2d |
| P2 | CDN for static assets | Performance | 1d |

### Database Schema Evolution

```
Phase 1 (MVP):
├── users (id, email, created_at)
├── tasks (id, user_id, title, content, status, created_at, updated_at)
└── sessions (id, user_id, token, expires_at)

Phase 2 (V1.1):
├── categories (id, user_id, name, color)
├── task_categories (task_id, category_id)
├── achievements (id, name, description, icon)
└── user_achievements (user_id, achievement_id, earned_at)

Phase 3 (V1.2):
├── templates (id, author_id, name, content, is_public)
├── shared_locks (id, task_id, shared_by, shared_with, permissions)
└── analytics_events (id, user_id, event_type, metadata, created_at)
```

---

## Success Criteria

### Definition of Done (Per Feature)

- [ ] Code implemented following TDD
- [ ] Unit tests ≥80% coverage (critical paths)
- [ ] E2E tests for user flows
- [ ] Documentation updated
- [ ] Code review approved
- [ ] QA validation passed
- [ ] Feature flag configurable

### Launch Readiness Checklist

- [ ] All P0 features complete
- [ ] Authentication secure
- [ ] Data persistence reliable
- [ ] Mobile responsive
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] Onboarding flow smooth
- [ ] Error handling robust

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Database performance issues | Medium | High | Early load testing, query optimization |
| Authentication complexity | Low | High | Use proven libraries (Auth0/Clerk fallback) |
| Scope creep | High | Medium | Strict P0/P1 prioritization, weekly reviews |
| User adoption | Medium | High | Early beta testing, feedback loops |
| AI intervention latency | Medium | Medium | Caching, async processing, fallbacks |

---

## Appendix: Current State (Baseline)

### Existing Capabilities

- ✅ Lock system (core un-deletable constraint)
- ✅ Muse Mode (AI mentor intervention)
- ✅ Loki Mode (chaos/trickster intervention)
- ✅ Editor with Milkdown (Markdown-based)
- ✅ Sensory feedback system (visual/audio)
- ✅ Manual trigger system
- ✅ Writing state detection

### Technical Foundation

- ✅ React 18 + Vite + TypeScript
- ✅ FastAPI + PostgreSQL + SQLAlchemy
- ✅ Docker + Docker Compose
- ✅ CI/CD with GitHub Actions
- ✅ TDD workflow established

### Gaps to Address

- ❌ Task persistence (in-memory only)
- ❌ User authentication
- ❌ Task management UI
- ❌ Data model for users/tasks
- ❌ Cross-session state

---

*Last Updated: 2026-04-09*
*Next Review: 2026-04-23*
