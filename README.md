# Impetus Lock

Impetus Lock 是一个 React + Vite 前端与 FastAPI 后端组成的创作工具。用户在编辑器中写作，选择普通编辑、Muse 或 Loki 模式；AI 可以注入带锁定标记的创作内容，编辑器会阻止删除已锁定内容。项目同时提供任务保存、版本回载、风格学习、统计与成就等配套界面。

[![CI](https://github.com/Jackela/impetus-lock/actions/workflows/ci.yml/badge.svg)](https://github.com/Jackela/impetus-lock/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Jackela/impetus-lock/actions/workflows/codeql.yml/badge.svg)](https://github.com/Jackela/impetus-lock/actions/workflows/codeql.yml)
[![Version](https://img.shields.io/badge/version-0.5.1-blue.svg)](https://github.com/Jackela/Impetus-Lock/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![Node 24](https://img.shields.io/badge/node-24.x-brightgreen.svg)](https://nodejs.org/)

> **Status**: v0.5.1 (pre-1.0). CI green means the checked gates passed; it is not a deployment or user acceptance. Current working rules and gates live in [`AGENTS.md`](AGENTS.md).

演示产物：[Muse/Loki 流程录像](demo-artifacts/impetus-lock-demo.webm)（本地录制，约 1.2 MB）。

## 实际功能

- **编辑器**：基于 Milkdown/ProseMirror，支持 Markdown 内容编辑、基础格式化、保存与回载。
- **Agent 模式**：`Off` 为普通编辑；`Muse` 在检测到停滞或手动触发时生成施压内容；`Loki` 可随机生成施压内容或重写内容。具体触发和安全降级逻辑以当前代码与测试为准。
- **锁定约束**：AI 注入内容带有唯一 `lock_id` 和来源标记；编辑器过滤针对锁定内容的删除与逆向变更，并提供视觉和音频反馈。
- **任务与辅助面板**：支持任务列表、任务状态同步、风格学习、统计、连续记录、成就和模板等功能；后端提供相应的 API 路由。
- **LLM 与持久化**：后端通过 provider registry 接入配置的 LLM；PostgreSQL 用于需要持久化的任务和历史数据，未配置数据库时部分数据库功能不可用。

## 快速启动

### 环境要求

- Python 3.11+ 与 [Poetry](https://python-poetry.org/)。本机已用 Python 3.12 验证。
- Node.js 22.13+ 或 24.x（`.nvmrc` 为 24，与 CI 一致）；`client/package.json` 声明 `engines.node "^22.13.0 || ^24.0.0"`。
- Docker（使用便捷启动脚本时提供 PostgreSQL）。

### 便捷启动（Linux / WSL）

```bash
./scripts/dev-start.sh
```

该脚本会准备一个 PostgreSQL 容器、执行迁移，并启动后端 `8000` 端口和 Vite 前端 `5173` 端口。可通过 `AUTO_START_POSTGRES=0` 或 `AUTO_START_FRONTEND=0` 关闭对应步骤。Windows PowerShell 可使用：

```powershell
.\scripts\dev-start.ps1
```

### 手动启动

先准备 PostgreSQL。以下使用便捷脚本默认的本地开发连接；已有数据库请替换连接串，让迁移和后端复用同一值：

```bash
export DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/postgres'
```

后端会在导入应用时读取 `server/.env`（由 `server/.env.example` 复制而来），但 Alembic 迁移脚本直接读取进程环境变量。因此运行迁移时请确保当前 shell 已设置 `DATABASE_URL`：

```bash
cd server
poetry install
cp .env.example .env
```

按需编辑 `server/.env` 中的 LLM provider 配置和密钥；终端中已导出的 `DATABASE_URL` 优先于 `.env`。不要提交 `.env` 或密钥。然后在同一终端执行：

```bash
DATABASE_URL="$DATABASE_URL" poetry run alembic upgrade head
poetry run uvicorn server.api.main:app --reload
```

另开终端启动前端：

```bash
cd client
npm ci
npm run dev
```

打开 <http://localhost:5173>。后端健康检查：

```bash
curl http://localhost:8000/health
```

成功时返回包含 `status`, `service` 和 `version` 的 JSON。

## 登录、保存与恢复

打开页面后可选择登录或注册。进入编辑器后，顶部显示当前账户和保存状态；新建任务、写作和 AI 锁会随自动保存进入当前账户。刷新会恢复正文及锁。

会话过期时可以继续本地写作，远端保存和 AI 暂停。重新登录同一账户后先检查服务器版本；若版本未知且完整正文或锁不同，同样保留双方内容并进入冲突处理。可继续本地写作、另存为新草稿，或先备份本地稿再采用服务器版本。每个写作页面保存独立副本，刷新恢复本页面最后选择的草稿。

退出等待期间可以继续编辑。服务器确认退出后，应用再次保存当时最新的正文和锁；本地保存失败时，保留写作区并分别说明服务端退出成功和本地保存失败。此时应保持页面打开，导出正文，或恢复浏览器存储后重新检查会话。

登录、注册和退出需要浏览器的 Web Locks 支持及可用存储。其他标签页改变共享会话时，本页暂停远端工作并检查身份；旧账户请求不会进入新账户。认证请求的结果不确定时，不再改变共享会话，应先导出写作并检查当前会话，或使用新的浏览器配置文件或隐私窗口登录。

任务创建可能已经成功但响应丢失时，应用保留完整尝试并停止自动重复创建。重新检查只列出可能的服务器任务，须明确选择；没有匹配结果也不能证明原请求未提交。账户导出读取全部分页，任一页失败或发现可观察的集合变化时停止下载并提示重试；这不是数据库的原子快照。

旧全局草稿会显示为“Unassigned draft”。选择“Import as a new draft”才会导入当前账户的新草稿，原副本保留；也可导出或明确丢弃。锁或浏览器存储无法可靠恢复时，先导出原始备份并重试，勿清空浏览器数据。账户草稿仅在原账户重新登录后显示。

本次本地验证与尚未验证项见[认证入口验证记录](openspec/changes/archive/2026-11-09-complete-authenticated-editor-entry/validation.md)。
隔离 PostgreSQL、Redis、真实认证及生产浏览器的复现步骤见[验证环境说明](scripts/authenticated-editor-validation/README.md)。

## 开发与门禁

前端和后端各自维护依赖锁文件。常用检查如下：

```bash
cd server
poetry run ruff check .
poetry run pydocstyle server/
poetry run ruff format --check
poetry run lint-imports
poetry run mypy .
poetry run pytest tests/ -n auto --cov=server --cov-report=term-missing
poetry run python check_critical_coverage.py

cd ../client
npm ci
npm run lint
npm run format
npm run type-check
npm run api:check
npm run test -- --coverage
npm run test:coverage-gate
npm run build
```

提交前保持测试与实现同步，并通过 GitHub Actions 的 lint、类型检查、测试和 Validate 任务。完整门禁与文件边界以 [`AGENTS.md`](AGENTS.md) 为准；`act` 本地 CI 流程见[开发指南](DEVELOPMENT.md)。

2026-11-11 的本地验证结果如下；远端 CI 是权威门禁，本地结果不代表部署或用户验收。

| 范围                                                                       | 结果                                                                         |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 后端测试                                                                   | 910 passed, 0 skipped；branch coverage 79.98%，关键路径 94.40%               |
| 前端测试                                                                   | 986 tests；lines 81.72 / statements 80.40 / branches 78.59 / functions 75.31 |
| E2E                                                                        | 主套件 111 passed / 4 fixme；Story E2E 与 browser authentication 通过        |
| Ruff、pydocstyle、import-linter、mypy、ESLint、Prettier、TypeScript、build | PASS                                                                         |
| OpenSpec 严格校验 / actionlint                                             | 21/21 / PASS                                                                 |

证据见 [测试套件优化报告](docs/reports/20261111-test-suite-optimization.md) 与 [质量路线图报告](docs/reports/20261109-quality-roadmap.md)。

## 文档导航

- [开发指南](DEVELOPMENT.md)：开发流程、测试策略和 CI 说明。
- [测试指南](TESTING.md)：测试分层、命令和调试方式。
- [文档索引](docs/INDEX.md)：当前指南、报告、组件文档和历史归档。
- [贡献指南](CONTRIBUTING.md) 与 [安全策略](SECURITY.md)：提交前要求与漏洞披露。
- [部署指南](docs/guides/deployment.md)：部署配置与运行方式。
- [故障排查](docs/guides/troubleshooting.md)：常见开发问题。
- [OpenSpec 指南](openspec/AGENTS.md)：新能力、架构或 API 变更的提案流程。
- [客户端说明](client/README.md) 与 [服务端说明](server/README.md)：分层实现和组件细节。
- [功能规格](specs/README.md)：已冻结的遗留功能规格；OpenSpec 规格与变更以 `openspec/` 为准。
- [历史 E2E 快照（2026-03-17）](docs/archive/2026-09/README_E2E_SNAPSHOT_2026-03-17.md)：仅供历史追踪。

## 贡献

完整流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。简要要求：

1. 从 `main` 创建分支，保持改动聚焦，并为行为改动补充有区分度的测试。
2. 在对应目录安装依赖并运行本页门禁；提交前检查 `git diff --check`。
3. Pull request 应说明用户可见变化、验证命令和未解决事项。涉及新能力、破坏性变化或架构调整时，先按 [OpenSpec 指南](openspec/AGENTS.md) 创建并获批变更提案。
4. 不要提交 `.env`、API key、cookie 或本地测试产物；安全披露见 [SECURITY.md](SECURITY.md)。

项目采用 MIT License，详见 [LICENSE](LICENSE)。
