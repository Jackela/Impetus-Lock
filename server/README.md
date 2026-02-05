# Impetus Lock Server

FastAPI backend for Impetus Lock - an un-deletable task pressure system with adversarial AI agents.

## 项目概述 | Project Overview

Impetus Lock 是一个基于对抗式 AI 的任务压力系统，通过"不可删除"约束来推动用户持续创作。

- **Python**: 3.11+
- **Framework**: FastAPI with async/await
- **Type Checking**: mypy strict mode (mandatory)
- **Linting**: Ruff with strict rules
- **Testing**: pytest with httpx TestClient
- **Documentation**: Google/NumPy style docstrings required

### 核心特性 | Core Features

- **Muse Mode**: 文思阻塞时提供创意建议
- **Loki Mode**: 随机混乱干预（删除/重写）
- **Lock Enforcement**: AI 添加的内容不可删除
- **BYOK LLM**: 支持 Anthropic Claude、Google Gemini 等多种 LLM 提供商

---

## 项目结构 | Project Structure

```
server/
├── server/
│   ├── api/                    # HTTP 接口层 (API Layer)
│   │   ├── routes/             # FastAPI 路由定义
│   │   │   ├── intervention.py # AI 干预端点
│   │   │   ├── tasks.py        # 任务 CRUD 端点
│   │   │   ├── metrics.py      # 可观测性端点
│   │   │   └── testing.py      # 测试辅助端点
│   │   ├── dependencies.py     # FastAPI 依赖注入
│   │   └── main.py             # 应用入口
│   │
│   ├── application/            # 应用服务层 (Application Layer)
│   │   └── services/
│   │       └── intervention_service.py  # 干预业务逻辑
│   │
│   ├── domain/                 # 领域层 (Domain Layer)
│   │   ├── entities/           # 业务实体
│   │   │   └── task.py         # 任务实体
│   │   ├── models/             # 领域模型
│   │   │   ├── intervention.py # 干预响应模型
│   │   │   └── anchor.py       # 锚点定位模型
│   │   ├── repositories/       # 仓储接口 (DIP)
│   │   │   └── task_repository.py
│   │   ├── errors.py           # 领域错误定义
│   │   ├── llm_provider.py     # LLM 抽象接口
│   │   └── text_window.py      # 文本窗口处理
│   │
│   ├── infrastructure/         # 基础设施层 (Infrastructure Layer)
│   │   ├── llm/                # LLM 提供商实现
│   │   │   ├── base_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   ├── gemini_provider.py
│   │   │   ├── instructor_provider.py
│   │   │   ├── debug_provider.py
│   │   │   └── provider_registry.py
│   │   ├── prompts/            # LLM Prompt 模板
│   │   │   ├── prompt_registry.py
│   │   │   ├── muse_prompt.py
│   │   │   └── loki_prompt.py
│   │   ├── persistence/        # 数据持久化
│   │   │   ├── database.py     # SQLAlchemy 配置
│   │   │   ├── models.py       # ORM 模型
│   │   │   ├── postgresql_task_repository.py
│   │   │   └── in_memory_task_repository.py
│   │   ├── cache/              # 缓存层
│   │   │   └── idempotency_cache.py
│   │   ├── logging/            # 日志配置
│   │   │   └── json_formatter.py
│   │   └── observability/      # 可观测性
│   │       ├── metrics.py
│   │       └── tracing.py
│   │
│   └── __init__.py
│
├── tests/                      # 测试目录
│   ├── __init__.py
│   └── test_main.py            # API 测试
│
├── alembic/                    # 数据库迁移
│   └── env.py
│
├── pyproject.toml              # Poetry 配置
├── poetry.lock                 # 依赖锁定文件
└── README.md                   # 本文件
```

### 架构原则 | Architecture Principles

遵循 **Clean Architecture** 和 **SOLID** 原则：

1. **依赖倒置 (DIP)**: 高层逻辑依赖抽象，不依赖具体实现
2. **单一职责 (SRP)**: API 端点委托给服务层处理业务逻辑
3. **开闭原则 (OCP)**: 通过 LLM Provider 接口支持多种 LLM

详见：[`../ARCHITECTURE_GUARDS.md`](../ARCHITECTURE_GUARDS.md)

---

## API 端点摘要 | API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | 健康检查 |
| POST | `/impetus/generate-intervention` | 生成 AI 干预 (核心端点) |
| GET | `/tasks` | 获取任务列表 |
| POST | `/tasks` | 创建任务 |
| GET | `/tasks/{id}` | 获取任务详情 |
| PUT | `/tasks/{id}` | 更新任务 |
| DELETE | `/tasks/{id}` | 删除任务 |

完整 API 规范：[`../API_CONTRACT.md`](../API_CONTRACT.md)

---

## 开发工作流 | Development Workflow

### 环境要求 | Prerequisites

- Python 3.11+
- Poetry (latest)
- PostgreSQL 16+ (可选，默认使用内存数据库)

### 安装 | Installation

```bash
# 进入服务端目录
cd server

# 安装 Poetry (首次使用)
pipx install poetry

# 安装依赖
poetry install

# 验证安装
poetry run python -c "import server.main; print('✅ Package installed correctly')"
```

### 开发服务器 | Development Server

```bash
# 启动开发服务器 (热重载)
poetry run uvicorn server.main:app --reload --host 0.0.0.0 --port 8000

# 访问 API 文档
open http://localhost:8000/docs  # Swagger UI
open http://localhost:8000/redoc # ReDoc
```

### 测试 | Testing (TDD 工作流)

```bash
# 运行所有测试
poetry run pytest

# 运行特定测试文件
poetry run pytest tests/test_main.py

# 运行特定测试
poetry run pytest -k test_health

# 详细输出
poetry run pytest -v

# 覆盖率报告
poetry run pytest --cov

# 监听模式 (开发时使用)
poetry run pytest -f
```

### 代码检查 | Linting & Formatting

```bash
# Lint 检查
poetry run ruff check .

# 自动修复
poetry run ruff check --fix .

# 格式化代码
poetry run ruff format .
```

### 类型检查 | Type Checking (mandatory)

```bash
# 运行 mypy strict mode 检查
poetry run mypy .

# 检查特定文件
poetry run mypy server/main.py
```

---

## 环境变量 | Environment Variables

创建 `.env` 文件在 `server/` 目录：

```bash
# Database (可选，默认使用内存数据库)
DATABASE_URL=postgresql://user:password@localhost:5432/impetus_lock

# LLM Provider (必选，至少配置一个)
ANTHROPIC_API_KEY=sk-ant-xxx...
GOOGLE_API_KEY=xxx...

# Provider Selection
LLM_PROVIDER=anthropic  # or 'gemini', 'instructor', 'debug'

# Observability (可选)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
ENABLE_METRICS=true
ENABLE_TRACING=false

# Cache (可选)
IDEMPOTENCY_CACHE_TTL=15  # seconds
```

---

## 服务层文档 | Service Layer Documentation

### InterventionService

应用服务层，处理 AI 干预的核心业务逻辑。

**职责 | Responsibilities**:
- 解析客户端上下文
- 选择合适的 LLM Provider
- 调用 LLM 生成干预
- 幂等性缓存处理
- 错误处理和重试

**使用示例 | Usage**:

```python
from server.application.services.intervention_service import InterventionService
from server.infrastructure.llm.provider_registry import ProviderRegistry

# 初始化
registry = ProviderRegistry()
service = InterventionService(llm_registry=registry)

# 调用
response = await service.generate_intervention(
    context="他打开门,犹豫着要不要进去。",
    mode="muse",
    doc_version=42,
)
```

---

## 仓储模式 | Repository Pattern

领域层定义接口，基础设施层提供实现：

```python
# 领域层接口 (server/domain/repositories/task_repository.py)
from abc import ABC, abstractmethod

class TaskRepositoryProtocol(ABC):
    @abstractmethod
    async def save(self, task: Task) -> Task: ...

    @abstractmethod
    async def find_by_id(self, task_id: str) -> Task | None: ...

# 基础设施层实现 (server/infrastructure/persistence/postgresql_task_repository.py)
class PostgreSQLTaskRepository(TaskRepositoryProtocol):
    async def save(self, task: Task) -> Task:
        # SQLAlchemy 实现
        ...
```

---

## 常见问题 | Troubleshooting

### Poetry 安装问题

```bash
# 如果遇到 "Could not import module 'server.main'" 错误
# 确保 pyproject.toml 包含以下配置：
# [tool.poetry]
# packages = [{include = "server"}]

# 然后重新安装（不带 --no-root）
poetry install
```

### 类型检查错误

```bash
# 如果 mypy 报告缺少类型存根
poetry run mypy --install-types
```

### 测试失败

```bash
# 查看详细错误信息
poetry run pytest -vv --tb=short

# 运行特定测试并进入调试器
poetry run pytest --pdb
```

---

## 相关文档 | Related Documentation

- [API Contract](../API_CONTRACT.md) - 完整的 OpenAPI 3.0.3 规范
- [Architecture Guards](../ARCHITECTURE_GUARDS.md) - 架构分层规则
- [CLAUDE.md](../CLAUDE.md) - AI Agent 开发指南
- [Client README](../client/README.md) - 前端文档
