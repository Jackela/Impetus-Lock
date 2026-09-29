# Change: 独立评估 pytest9 与 redis-py8 迁移

Status: Proposed / not approved。P-01，Tier 3，仅起草，不修改测试框架、代码或依赖。

## Why

[PR172 pytest9](https://github.com/Jackela/Impetus-Lock/pull/172) 在日期快照中 backend/matrix 失败：当前 conftest 使用已在9移除的 pytest_ignore_collect(path, config)。[PR185 redis-py8](https://github.com/Jackela/Impetus-Lock/pull/185) 快照 green，但 async pubsub、连接/重试默认值和类型变化需要真实 Redis 生命周期验证。它们没有共同实施依赖，不应合成一次盲升。只读标题核对显示当前目标为 pytest9.1.1 和 redis-py8.1.0；未安装或批准。

依据：`server/tests/conftest.py`、`server/pyproject.toml`、`server/poetry.lock`、`server/server/infrastructure/websocket/redis_pubsub.py`、`server/server/infrastructure/rate_limiting.py`、`server/tests/integration/test_redis_real.py`、`.github/workflows/{ci,test-matrix}.yml`；[本轮 Dependabot 快照](../../../.scratch/audit-2026-09/runs/2026-09-29/dependabot.md)及 hygiene-audit H07。

## What Changes

- pytest组：使用 pathlib.Path 的 collection_path，保留可用/不可用 optional SDK 的选择性收集，不减少收集范围；验证 pytest-asyncio/cov/xdist 与 Python3.11/3.12。
- Redis组：核对 redis-py8 的实际协议、响应、超时、重试/池以及异步关闭语义；最小调整既有 pubsub/限流使用，保留 JSON、TTL、计数和既有失败策略。
- 两组分别锁定、验证和回退。批准或项目实施之前，必须有 Python3.11/3.12 与真实 Redis7 证据；不可用/skip 不能替代验证。
- 不新增 Redis功能、不改授权政策、不运行真实 LLM；本票不运行 server测试、真实Redis或安装。

## Impact

- Affected specs: 复用 `dev-environment-bootstrap`，增加后端迁移与证据要求，不改当前规范和验收条件。
- Affected interfaces: pytest收集/插件/可选SDK matrix，pubsub生命周期与 rate limiter、后端依赖锁及对应CI命令。
- 未来审批证据需在单独授权的隔离环境产生，不能把批准准备阶段的实验当成项目代码实施；当前 linked Python3.12 环境不得升级/修改。

## Alternatives and approval choices

推荐 collection_path 最小适配并在8/9兼容环境做收集对照；继续pytest8是合理延期，关闭/忽略测试以便9收集不是迁移。Redis可延期7，或经证据批准8并明确 protocol/timeout/retry 选择；单凭185 green 或 mock通过不足以接受异步生命周期变化。

待批准：精确插件/包版本和可选SDK组合、Redis协议策略（推荐先保持可观察响应/操作行为）、显式超时/重试配置及限流失败策略是否仅保持原状。不存在“pytest通过即可批准redis”的共同门禁。

## Acceptance, migration and rollback

先独立准备 Python3.11/3.12、optional有/无、串行/xdist的收集与测试证据，以及真实Redis7的publish/subscribe、取消/重连/关闭、限流TTL/故障恢复。future gate 不沿用本轮不跑Redis的限制作为豁免；缺环境则保持待批准。

保存既有依赖/锁/配置基线，pytest先完成收集适配与matrix，再仅迁移其依赖；Redis在独立环境验证8后才迁移其依赖和必要调用点。pytest回退包/锁，collection_path可保留兼容8的已验证形式；Redis回退包/锁及配套client配置。两组不互相回退，不撤销本轮其他修复。
