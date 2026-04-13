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
│   ├── use_cases/   # 业务用例
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
    └── dependencies/ # FastAPI 依赖注入
```

### 黄金规则 (由 import-linter 强制执行)

```python
# ✅ ALLOWED: 依赖方向 (从外到内)
api          → application → domain
infrastructure → application → domain

# ❌ FORBIDDEN: 反向依赖
domain       ✗→ application
domain       ✗→ infrastructure
domain       ✗→ api
application  ✗→ api
application  ✗→ infrastructure
infrastructure ✗→ api
```

### 配置 (`pyproject.toml`)

```toml
[tool.importlinter]
root_package = "server"
include_external_packages = true

# Contract 1: Domain Layer 完全独立
[[tool.importlinter.contracts]]
name = "Clean Architecture: Domain Layer Independence"
type = "forbidden"
source_modules = ["server.domain"]
forbidden_modules = [
    "server.application",
    "server.infrastructure",
    "server.api",
]

# Contract 2: Application Layer 不依赖外层
[[tool.importlinter.contracts]]
name = "Clean Architecture: Application Layer Dependencies"
type = "forbidden"
source_modules = ["server.application"]
forbidden_modules = [
    "server.api",
    "server.infrastructure",
]

# Contract 3: Infrastructure Layer 不依赖 API
[[tool.importlinter.contracts]]
name = "Clean Architecture: Infrastructure Layer Dependencies"
type = "forbidden"
source_modules = ["server.infrastructure"]
forbidden_modules = [
    "server.api",
]

# Contract 4: 分层顺序验证
[[tool.importlinter.contracts]]
name = "Clean Architecture: API Layer (Outermost)"
type = "layers"
layers = [
    "server.api",
    "server.application",
    "server.domain",
]
containers = ["server"]
```

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
✓ Clean Architecture: API Layer (Outermost)

Contracts: 4 kept, 0 broken.
```

**输出示例 (违规):**
```
✗ Clean Architecture: Domain Layer Independence

server.domain.entities.task imports server.infrastructure.database:
    server/domain/entities/task.py:5 (l.5)
```

---

## 🎨 前端架构 (Layer Separation)

### 分层结构

```
client/src/
├── components/     # 展示组件 (最内层)
│   ├── ui/         # 纯 UI 组件 (Button, Input)
│   └── layout/     # 布局组件 (Header, Sidebar)
│
├── features/       # 业务特性 (中间层)
│   ├── tasks/      # 任务功能模块
│   │   ├── hooks/  # useTask, useTaskLock
│   │   └── components/ # TaskCard, TaskList
│   └── editor/     # 编辑器功能模块
│
├── services/       # API 和外部服务 (外层)
│   ├── api/        # REST API 客户端
│   └── storage/    # LocalStorage 抽象
│
├── hooks/          # 共享自定义 Hooks
├── utils/          # 工具函数
└── types/          # TypeScript 类型定义
```

### 黄金规则 (由 ESLint 强制执行)

```typescript
// ✅ ALLOWED: 依赖方向
features/    → components/  (使用展示组件)
features/    → services/    (调用 API)
features/    → hooks/       (使用共享 hooks)

// ❌ FORBIDDEN: 反向依赖
components/  ✗→ features/   (展示组件不能依赖业务逻辑)
components/  ✗→ services/   (展示组件不能直接调用 API)
```

### 配置 (`eslint.config.js`)

```javascript
export default defineConfig([
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/features/**"],
              message:
                "Components (presentational layer) must not import from features (business logic layer). " +
                "Use props/callbacks for data and event handling instead.",
            },
            {
              group: ["**/services/**"],
              message:
                "Components must not directly import services. " +
                "Use custom hooks from features/ layer to access services.",
            },
          ],
        },
      ],
    },
  },
]);
```

### 本地测试

```bash
cd client
npm run lint
```

**输出示例 (违规):**
```
error: Components (presentational layer) must not import from features (business logic layer).
Use props/callbacks for data and event handling instead.
  src/components/ui/Button.tsx
  5:1  error  'useTaskLock' import from '../features/tasks/hooks' is restricted
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

| 场景 | 结果 |
|------|------|
| ✅ 所有架构规则遵守 | Build 通过 |
| ❌ Backend 违反分层 | Build 失败 (import-linter) |
| ❌ Frontend 违反分层 | Build 失败 (ESLint) |
| ⚠️ 违规但添加 ignore | Build 通过 (需 code review 审核) |

### Current Status ✅

**Backend Contracts (import-linter)**:
- ✅ Domain Layer Independence: KEPT
- ✅ Application Layer Dependencies: KEPT
- ✅ Infrastructure Layer Dependencies: KEPT

All 3 contracts passing with 66 files and 177 dependencies analyzed.

---

## 📖 开发者工作流

### 添加新功能时

#### 后端 (FastAPI)

1. **编写领域实体** (`server/domain/entities/`)
   - ✅ 不导入任何外层模块
   - ✅ 只使用标准库和 Pydantic

2. **编写应用用例** (`server/application/use_cases/`)
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

2. **编写业务组件** (`client/src/features/tasks/components/`)
   - ✅ 使用 hooks 管理状态
   - ✅ 导入 components/ui/ 展示组件

3. **编写自定义 Hooks** (`client/src/features/tasks/hooks/`)
   - ✅ 调用 services/ API
   - ✅ 管理业务逻辑状态

---

## 🔧 故障排除

### Backend: "import-linter not found"

```bash
cd server
poetry install --no-root
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
error: Components must not import from features
  src/components/ui/Button.tsx
  3:1  error  'useTaskLock' import is restricted
```

**修复步骤:**
1. 将 `useTaskLock` 调用移到 `features/` 组件
2. 通过 props 传递数据到 `components/ui/Button`
3. 使用回调函数而非直接调用

---

## 📊 架构合规性监控

### 度量指标

| 指标 | 目标 | 当前 | 状态 |
|------|------|------|------|
| **Backend Contracts** | 4/4 ✅ | 4/4 | ✅ |
| **Frontend Rules** | 2/2 ✅ | 2/2 | ✅ |
| **CI 失败率 (架构)** | 0% | 0% | ✅ |
| **违规 Ignore 行数** | <5 | 0 | ✅ |

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
- ✅ `server/main.py` 已移动到 `server/api/main.py`
- ✅ 测试导入已更新: `from server.api.main import app`
- ✅ 目录结构已创建

### P1 实现时
1. 创建 `server/domain/entities/task.py`
2. 创建 `server/application/use_cases/lock_task.py`
3. 创建 `server/api/routes/tasks.py`
4. 运行 `poetry run lint-imports` 验证

---

## 📚 参考资料

- **Clean Architecture** - Robert C. Martin
- **import-linter** - https://github.com/seddonym/import-linter
- **ESLint no-restricted-imports** - https://eslint.org/docs/rules/no-restricted-imports
- **Dependency Inversion Principle** - Article IV of Constitution

---

**Last Updated:** 2025-11-06  
**Status:** ✅ Active in CI, Ready for P1 Development
