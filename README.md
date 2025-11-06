# 🔒 Impetus Lock

[![CI](https://github.com/YOUR_USERNAME/impetus-lock/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/impetus-lock/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **An adversarial AI agent that acts as your "creative sparring partner."** It breaks through mental blocks by forcefully imposing un-deletable creative constraints—transforming lonely writing into a human-AI rogue-like game.

---

## 🎯 The "Aha!" Moment

Traditional AI assistants (like ChatGPT) are too **polite** and **passive**. They're Q&A machines that can't solve the real enemy of creators: **mental set** and **blank page anxiety**.

**Impetus Lock is a proactive actor.**

It follows the `Perceive → Decide → Act` agent loop, actively "perceiving" your writing state. It doesn't "suggest"—it **intervenes**.

> **We've turned lonely writing into a human-AI adversarial rogue-like game.**

---

## 🎮 Core Modes

### 1. **"Muse Mode"** (Inspiration Infusion)
- **Vibe:** Strict mentor
- **Rule:** When the agent perceives you're **STUCK** (e.g., 60 seconds of no input), it autonomously **injects** a context-aware "creative pressure" block
- **Constraint:** The injected block is **un-deletable**

### 2. **"Loki Mode"** (Chaos Trickster)
- **Vibe:** Chaotic, unpredictable game opponent
- **Rule:** The agent acts at **random** intervals, **whether you're writing or not**
- **Actions:**
  - **[DELETE]:** Randomly deletes your last sentence
  - **[PRESSURE]:** Injects a new "un-deletable" constraint
- **Constraint:** All Loki actions are **irreversible** and **un-deletable**

---

## 🏗️ Architecture & "AI Safety Net"

This project is protected by an **"AI Safety Net"** on the `main` branch. All feature development (including AI coding) must happen under TDD and CI constraints.

### Tech Stack

**Frontend (`client/`)** — React + Vite + TypeScript
- **Vibe Core:** [Milkdown](https://milkdown.dev/) (ProseMirror-based) — Uses `filterTransaction` to implement "un-deletable" constraints at the editor kernel level
- **Animation:** [Framer Motion](https://www.framer.com/motion/)
- **Testing:** [Playwright](https://playwright.dev/) (E2E) + [Vitest](https://vitest.dev/) (unit)

**Backend (`server/`)** — FastAPI + Python 3.11+
- **AI Core:** [Instructor](https://github.com/jxnl/instructor) + Pydantic — Strongly-typed LLM outputs (no raw strings)
- **Testing:** [pytest](https://pytest.org/) + [httpx](https://www.python-httpx.org/) (FastAPI TestClient)

**CI/CD (`.github/`)** — GitHub Actions
- Auto-runs `lint`, `type-check`, `backend-tests`, `frontend-tests` on every PR
- 4 parallel jobs for fast feedback

**SSOT (Single Source of Truth)**:
- **Constitution:** `.specify/memory/constitution.md` — Project governance (5 articles)
- **Spec Kit:** `.specify/templates/` — Specification-driven development
- **OpenAPI:** Contract-first API design
- **Prompts:** Versioned prompt registry

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** with [Poetry](https://python-poetry.org/)
- **Node.js 20+** (LTS)
- **Git**
- **Docker** (optional, for local CI testing with [Act](https://github.com/nektos/act))

### 1. Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies with Poetry
poetry install --no-root

# Set up environment variables
cp .env.example .env
# Edit .env and add your LLM API key (e.g., OPENAI_API_KEY)

# Run development server
poetry run uvicorn server.main:app --reload
```

🟢 **Backend now running at:** `http://localhost:8000`  
📚 **API Docs:** `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
# Navigate to client directory (in a new terminal)
cd client

# Install dependencies
npm ci

# Run development server
npm run dev
```

🟢 **Frontend now running at:** `http://localhost:5173`

### 3. Verify Installation

```bash
# Backend health check
curl http://localhost:8000/health
# Expected: {"status":"ok","service":"impetus-lock","version":"0.1.0"}

# Frontend: Open browser to http://localhost:5173
# You should see the Vite + React welcome page
```

---

## 🧪 Testing (TDD Workflow)

**Article III of our Constitution:** Test-Driven Development is **NON-NEGOTIABLE**.

### Backend Tests (pytest)

```bash
cd server

# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=server --cov-report=html
# Open htmlcov/index.html to view coverage

# Run specific test
poetry run pytest tests/test_main.py::test_health_endpoint_returns_200

# TDD watch mode (requires pytest-watch)
poetry run pytest-watch
```

### Frontend Tests (Vitest + Playwright)

```bash
cd client

# Unit tests (Vitest) - TDD watch mode
npm run test:watch

# Run all unit tests once
npm run test

# E2E tests (Playwright)
npm run test:e2e

# Install Playwright browsers (first time)
npx playwright install --with-deps

# Interactive E2E debugging
npx playwright test --ui
```

### Quality Gates (Pre-Commit Validation)

**Use Act CLI to run main CI locally (fast ~4 min):**

```bash
# Test main CI pipeline (lint, type-check, tests)
act

# Or test specific job
act -j lint
act -j type-check
act -j backend-tests
act -j frontend-tests
```

**E2E tests run separately:**
```bash
# Local E2E testing (interactive UI mode recommended)
cd client
npx playwright test --ui

# Or headless mode
npm run test:e2e
```

**Quick quality check (without tests):**

```bash
# Backend
cd server && poetry run ruff check . && poetry run mypy .

# Frontend
cd client && npm run lint && npm run type-check
```

---

## 🔄 Development Workflow

This project follows **Spec-Driven Development (SDD)** protected by the AI Safety Net.

### 1️⃣ **Define** (Specification)
```bash
# Define project constitution (first time only)
/speckit.constitution

# Create feature specification (auto-creates feature branch)
/speckit.specify <feature-description>
```

### 2️⃣ **Test** (Red Phase - TDD)
```bash
# Write FAILING test first (Article III requirement)
cd server
# Edit tests/test_task_lock.py
poetry run pytest tests/test_task_lock.py
# Expected: ❌ FAILED

cd client
# Edit src/components/TaskCard.test.tsx
npm run test:watch
# Expected: ❌ FAILED
```

### 3️⃣ **Implement** (Green Phase - TDD)
```bash
# Write minimal code to make tests pass
cd server
# Edit server/services/task_service.py
poetry run pytest tests/test_task_lock.py
# Expected: ✅ PASSED

cd client
# Edit src/components/TaskCard.tsx
# Watch mode auto-reruns
# Expected: ✅ PASSED
```

### 4️⃣ **Refactor** (Blue Phase - TDD)
```bash
# Improve code while keeping tests green
# Tests continue to pass: ✅ PASSED
```

### 5️⃣ **Review** (Pull Request)
```bash
# Create PR to main
git push origin feature/task-lock

# CI (AI Safety Net) automatically runs:
# ✅ lint
# ✅ type-check  
# ✅ backend-tests
# ✅ frontend-tests

# Merge only when ALL checks pass
```

---

## 🤖 Local CI Testing (Act CLI)

Test GitHub Actions workflows locally before pushing:

```bash
# Install Act CLI
# macOS: brew install act
# Windows: choco install act-cli
# Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run all CI jobs locally
act

# Run specific job
act -j lint
act -j type-check
act -j backend-tests
act -j frontend-tests

# List available workflows
act -l
```

**Configuration:** `.actrc` and `.secrets.example` are pre-configured.

---

## 📚 Documentation

- **[DEVELOPMENT.md](DEVELOPMENT.md)** — Comprehensive development guide
- **[TESTING.md](TESTING.md)** — Testing strategies and TDD workflow
- **[CLAUDE.md](CLAUDE.md)** — AI assistant operational guide
- **[Constitution](.specify/memory/constitution.md)** — Project governance (5 articles)
- **[API Docs](http://localhost:8000/docs)** — FastAPI auto-generated docs (run backend first)

---

## 🏛️ Project Constitution

This project operates under 5 constitutional articles:

1. **Simplicity & Anti-Abstraction** — 5-day MVP sprint, no over-engineering
2. **Vibe-First Imperative** — "Un-deletable pressure" is the ONLY P1 priority
3. **Test-First Imperative** — TDD is non-negotiable (Red-Green-Refactor)
4. **SOLID Principles** — Backend services follow SRP and DIP
5. **Clear Comments & Documentation** — JSDoc (frontend) + Docstrings (backend) required

**Constitutional Gates:**
- ✅ P1 priority reserved ONLY for un-deletable constraint
- ✅ Tests written → verified failing → minimal implementation → refactor
- ✅ FastAPI endpoints delegate to services (SRP)
- ✅ Constructor injection for dependencies (DIP)
- ✅ ≥80% test coverage for P1 features

See [`.specify/memory/constitution.md`](.specify/memory/constitution.md) for complete details.

---

## 🛠️ Troubleshooting

### Common Issues

**Poetry not found:**
```bash
python -m pip install --user pipx
python -m pipx ensurepath
pipx install poetry
```

**npm permission errors:**
```bash
# Kill running processes
# Windows: taskkill /F /IM node.exe
# Linux/macOS: killall node

npm cache clean --force
cd client && npm ci
```

**Playwright browsers not installed:**
```bash
cd client
npx playwright install --with-deps
```

**Tests hanging:**
```bash
# Force run mode (not watch)
npm run test -- --run
```

See [DEVELOPMENT.md](DEVELOPMENT.md#troubleshooting) for more solutions.

---

## 🤝 Contributing

1. Read the [Constitution](.specify/memory/constitution.md)
2. Follow the [Development Workflow](#-development-workflow)
3. Ensure all [Quality Gates](#quality-gates-pre-commit-checklist) pass
4. Test with [Act CLI](#-local-ci-testing-act-cli) before pushing
5. Create PR with descriptive title (Conventional Commits format)

All contributions must comply with our 5 constitutional articles.

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

- **Milkdown** — For the ProseMirror-based editor that enables kernel-level transaction filtering
- **Instructor** — For strongly-typed LLM outputs with Pydantic
- **Act CLI** — For local GitHub Actions testing
- **The TDD Community** — For evangelizing test-first development

---

<div align="center">

**Built with ❤️ and adversarial AI**

[Report Bug](https://github.com/YOUR_USERNAME/impetus-lock/issues) · [Request Feature](https://github.com/YOUR_USERNAME/impetus-lock/issues) · [Documentation](DEVELOPMENT.md)

</div>
