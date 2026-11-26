# Architecture Guards - "架构即代码"安全网

**Created:** 2025-11-06  
**Status:** ✅ Active in CI  
**Philosophy:** Architecture rules enforced as code, not documentation

---

## 📡 Observability Guardrails

- Backend logging configuration lives in `server/server/infrastructure/logging/json_formatter.py`; API/routes must call `setup_json_logging` so correlation IDs and redaction rules remain consistent.
- Metrics/tracing helpers in `server/server/infrastructure/observability/` may only be consumed from the API/application layers; domain code stays observability-agnostic to preserve clean architecture boundaries.
- Frontend telemetry flows must go through the `Telemetry` logger/service so BYOK secrets are never serialized, and must honor the opt-in toggle stored in localStorage.

---

## 🎯 目标

防止架构腐化 (Architecture Decay) 通过**自动化检测违反分层架构的导入**。

### 问题陈述

在传统开发中：

- ❌ 架构规则仅存在于文档中
- ❌ 开发者可能无意中违反分层原则
- ❌ Code review 难以捕获所有违规
- ❌ 技术债务随时间累积

### 解决方案

在 CI 中：

- ✅ 自动验证每次提交的架构合规性
- ✅ 构建失败如果违反分层规则
- ✅ 即时反馈，零成本强制执行
- ✅ 架构规则成为可测试的代码

---

## 🏗️ 后端架构 (Clean Architecture)

### 分层结构

```
server/
├── domain/          # 核心业务逻辑 (最内层)
│   ├── entities/    # 业务实体
│   ├── value_objects/ # 值对象
│   └── repositories/ # 仓储接口 (DIP)
│
├── application/     # 用例/应用服务
│   └── services/    # 应用服务
│
├── infrastructure/  # 外部依赖实现
│   ├── persistence/ # 数据库实现
│   ├── external/    # 第三方 API
│   └── messaging/   # 消息队列
│
└── api/            # HTTP 接口层 (最外层)
    ├── routes/      # FastAPI 路由
    ├── schemas/     # Pydantic 模型
    └── dependencies.py # FastAPI 依赖注入
```

### 导入契约

[服务端配置](server/pyproject.toml)启用了三条 `forbidden` 契约：

| 来源                    | 受限目标                                                    |
| ----------------------- | ----------------------------------------------------------- |
| `server.domain`         | `server.application`、`server.infrastructure`、`server.api` |
| `server.application`    | `server.api`、`server.infrastructure`                       |
| `server.infrastructure` | `server.api`                                                |

应用层契约有一条明确例外，允许
`server.application.services.intervention_service` 导入
`server.infrastructure.observability.tracing`。FastAPI 入口负责用
`server/api/dependencies.py` 注入基础设施实现。额外的 `layers` 契约仍处于注释停用状态。

### 本地测试

```bash
cd server
poetry run lint-imports
```

**输出示例 (成功):**

```
=============
Import Linter
=============

---------
Contracts
---------

✓ Clean Architecture: Domain Layer Independence
✓ Clean Architecture: Application Layer Dependencies
✓ Clean Architecture: Infrastructure Layer Dependencies

Contracts: 3 kept, 0 broken.
```

> 第 4 个契约（`API Layer (Outermost)` layers）目前在 `pyproject.toml` 中被注释停用，因此不计入结果。

**输出示例 (违规):**

```
✗ Clean Architecture: Domain Layer Independence

server.domain.entities.task imports server.infrastructure.database:
    server/domain/entities/task.py:5 (l.5)
```

---

## 🎨 前端架构 (Layer Separation)

### 展示组件、Hooks 和服务

生产代码通常由 `components/` 使用 `hooks/`，Hooks 调用
`services/`。任务与编辑器现有逻辑沿用这一结构；`features/`
目前保留占位文件。

[ESLint 配置](client/eslint.config.js)对 TS/TSX 默认禁止匹配
`**/features/**` 和 `**/services/**` 的导入。这条规则按导入路径
匹配，在 `features/` 内的普通文件同样适用。
`hooks/**/*.ts` 只禁止匹配 `**/features/**` 的导入，可以使用服务。

以下文件模式有现存的 `no-restricted-imports` 例外：

- `contexts/**/*.tsx` 和 `types/**/*.ts`。
- `components/Editor/` 下的 `EditorCore.tsx`、`LockDecorations.ts`、
  `TransactionFilter.ts`，以及 `utils/prosemirror-helpers.ts`。
- `*.test.{ts,tsx}`、`*.spec.{ts,tsx}` 及 `e2e/**/*.{ts,tsx}`。

### 本地测试

```bash
cd client
npm run lint
```

**输出示例 (违规):**

```
src/components/ui/Button.tsx
  1:1  error  '../../services/api/taskClient' import is restricted  no-restricted-imports
```

---

## 🚦 CI 集成

### GitHub Actions Workflow (`.github/workflows/ci.yml`)

```yaml
lint:
  name: Lint (Backend + Frontend)
  steps:
    # Backend
    - name: Run import-linter (Architecture Guard)
      working-directory: ./server
      run: poetry run lint-imports

    # Frontend
    - name: Run ESLint (includes architecture rules)
      working-directory: ./client
      run: npm run lint
```

### CI 行为

| 场景                 | 结果                       |
| -------------------- | -------------------------- |
| ✅ 所有架构规则遵守  | Build 通过                 |
| ❌ Backend 违反分层  | Build 失败 (import-linter) |
| ❌ Frontend 违反分层 | Build 失败 (ESLint)        |

### Current Status ✅

**Backend Contracts (import-linter): 3 contracts enforced + 1 temporarily disabled**

- ✅ Domain Layer Independence: KEPT
- ✅ Application Layer Dependencies: KEPT
- ✅ Infrastructure Layer Dependencies: KEPT
- ⏸️ API Layer (Outermost, `layers`): **temporarily disabled** — commented out in `pyproject.toml` ("layers contract temporarily disabled due to import-linter behavior"). Do not enable or delete it without an approved change; the three `forbidden` contracts above remain the enforced set.

The CI workflow runs the enforced contracts with `poetry run lint-imports`; the output of the current CI run is the validation record.

**Documentation enforcement note:** Article V remains a constitutional requirement and is now enforced by CI, not only by review:

- Backend: `poetry run pydocstyle server/` runs in `.github/workflows/ci.yml`, so missing or malformed Python docstrings fail the build.
- Frontend: the ESLint `jsdoc/*` rules are enforced under `--max-warnings=0` from `npm run lint` — `jsdoc/require-jsdoc`, `jsdoc/require-description`, `jsdoc/require-param`, `jsdoc/require-returns` are errors, while `jsdoc/check-types` and `jsdoc/valid-types` run as warnings that the zero-warning budget also turns into failures. `jsdoc/check-param-names` stays off for destructured props, and test files opt out of the presence rules.

---

## 📖 开发者工作流

### 添加新功能时

#### 后端 (FastAPI)

1. **编写领域实体** (`server/domain/entities/`)
   - ✅ 不导入任何外层模块
   - ✅ 只使用标准库和 Pydantic

2. **编写应用用例** (`server/application/services/`)
   - ✅ 导入 domain 层
   - ❌ 不导入 api 或 infrastructure

3. **编写基础设施实现** (`server/infrastructure/`)
   - ✅ 实现 domain 层定义的接口
   - ❌ 不导入 api 层

4. **编写 API 路由** (`server/api/routes/`)
   - ✅ 导入 application 用例
   - ✅ 使用依赖注入传递 infrastructure

#### 前端 (React)

1. **编写展示组件** (`client/src/components/ui/`)
   - ✅ 只接受 props
   - ❌ 不导入 features/ 或 services/

2. **编写自定义 Hooks** (`client/src/hooks/`)
   - ✅ 调用 services/ API
   - ✅ 管理业务逻辑状态

---

## 🔧 故障排除

### Backend: "import-linter not found"

```bash
cd server
poetry install
poetry run lint-imports
```

### Backend: "Contract broken"

**错误示例:**

```
server.domain.entities.task imports server.infrastructure.database
```

**修复步骤:**

1. 在 `domain/repositories/` 定义接口
2. 在 `infrastructure/persistence/` 实现接口
3. 在 `api/dependencies.py` 注入实现

### Frontend: ESLint "restricted import"

**错误示例:**

```
src/components/ui/Button.tsx
  1:1  error  '../../services/api/taskClient' import is restricted  no-restricted-imports
```

**修复步骤:**

将状态和服务调用放在 `hooks/`。使用 props 和回调将结果传给展示组件。

---

## 📊 架构合规性监控

检查结果以对应提交的 CI 产物为准。本页上方的契约和例外来自当前配置。

### 审计日志

```bash
# Backend 架构审计
cd server
poetry run lint-imports --verbose

# Frontend 架构审计
cd client
npm run lint -- --format json > lint-report.json
```

---

## 🎓 最佳实践

### ✅ DO

1. **早期捕获违规**: 在本地运行 lint 验证
2. **小步重构**: 逐步修复违规，不一次性大改
3. **Code Review**: 审查所有 ignore 注释
4. **文档更新**: 架构变更时更新此文档

### ❌ DON'T

1. **盲目添加 ignore**: 每个 ignore 都需要充分理由
2. **绕过 CI**: 不要禁用架构检查
3. **混淆分层**: 清晰定义每个模块的职责
4. **过度抽象**: 遵循 YAGNI，只在需要时分层

---

## 🔄 迁移指南 (现有代码)

### 当前状态

- ✅ 应用入口位于 `server/server/api/main.py`（仓库相对路径，包内导入路径 `server.api.main`）
- ✅ 测试导入已更新: `from server.api.main import app`
- ✅ 目录结构已创建

---

## 📚 参考资料

- **Clean Architecture** - Robert C. Martin
- **import-linter** - https://github.com/seddonym/import-linter
- **ESLint no-restricted-imports** - https://eslint.org/docs/rules/no-restricted-imports
- **Dependency Inversion Principle** - Article IV of Constitution

---

**Last Updated:** 2026-11-26

**Status:** ✅ Active in CI
