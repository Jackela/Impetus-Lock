## Context

pyproject支持Python^3.11，当前pytest^8.3.0、pytest-asyncio^1.3.0、cov^5、xdist^3.8、redis^7.4。CI backend使用3.12，test-matrix有3.11/3.12与optional两档及Redis7。当前conftest通过文件名与importlib spec跳过缺失可选SDK；真实Redis测试不可达时会skip，所以退出0不是实际Redis证据。

## Goals / Non-Goals

目标是保持有效收集及既有pubsub/限流行为。非目标是新缓存平台、Redis模块/Cluster功能、pytest测试重写、付费模型调用、授权重构或以减少测试维持green。linked `.venv` 不在本票改动范围。

## Group A: pytest nine collection migration

当前 `pytest_ignore_collect(path: Any, config)` 的旧hook参数已在9移除。推荐使用 `collection_path: pathlib.Path` 与 config，并保持字符串文件模式匹配和缺模块跳过语义；这是8也支持的参数，可先验证兼容再迁移包。[pytest hook removal说明](https://docs.pytest.org/en/stable/deprecations.html#py-path-local-arguments-for-hooks-replaced-with-pathlib-path)

批准准备阶段仅在单独授权的隔离环境：捕获9旧hook的collection错误，再最小适配、比较8/9收集node IDs和skip原因。每个Python3.11/3.12环境分别运行optional有/无组合，缺SDK仅跳过对应文件，可用SDK仍被收集；串行与xdist的收集和测试都须通过。核对pytest-asyncio的loop/fixture生命周期、cov、xdist、hypothesis兼容，不调用provider真实API。

收集错误必须阻止迁移；不能添加 broad ignore、关plugin、扩大-k筛选或跳过新失败来冒充通过。预期的缺optional skip与意外漏收集分别记录；Python3.12一次green不能代表3.11。

## Group B: redis-py eight lifecycle migration

8默认RESP3但维持旧Python响应形状，同时改变连接/重试默认值并改进async类型。[redis-py8发布说明](https://github.com/redis/redis-py/releases/tag/v8.0.0) 当前PR目标8.1.0还涉及async维护通知和连接处理改动，未来实验须按精确目标验证，而非只按8.0摘要推断。[redis-py8.1发布说明](https://github.com/redis/redis-py/releases/tag/v8.1.0) 当前manager用redis.from_url、pubsub.subscribe/get_message、JSON payload、setex一小时room_state TTL、hash用户追踪和aclose。限流依赖incr/expire并保留当前未配置/故障时允许的策略；若改变fail-open需另行批准。

推荐先保持现有可观察响应和操作语义，记录默认RESP3或显式protocol=2的选择；不启用legacy_responses=False或新Redis模块来扩大范围。8类型变化应核对真实awaitable返回，不增加Any/cast掩盖不兼容。setex在8有deprecation，是否最小改等效set(ex=...)由精确目标版本及警告策略决定，TTL必须等价。

真实Redis7门禁包括：两个独立manager的JSON消息正确交付、subscribe/unsubscribe、listener取消与aclose、重复disconnect、断链/服务重启后重连、无重复监听/消息、客户端关闭后无残留任务；限流允许至既有限额、下次拒绝、TTL及窗口重置，Redis故障/恢复符合既有策略。重试默认变化可能延长失败等待，需记录有界结束与已批准timeout/retry预算，不凭空设新的性能SLA。

使用唯一测试namespace及cleanup，不FLUSH共享数据库。测试名称/过滤必须确保 `tests/integration/test_redis_real.py` 的真实测试确实执行；本轮命令的RedisIntegration/redis_pubsub排除不能作为未来major gate。真实Redis不可达则本组证据缺失，不因skip把它视为通过。两种Python各验证async资源生命周期。

## Evidence before approval and implementation

未来主代理先单独授权隔离兼容性实验，取得Python3.11/3.12与真实Redis7证据，再决定具体版本与项目实施。计划中的证据不是当前已有证据。本票只起草并严格校验文档，没有迁移或功能结论。

pytest组独立记录RED旧hook/GREEN正确收集与matrix；Redis组记录当前7行为基线、8候选失败/成功、实际服务器版本、Node IDs与未skip计数。pytest实验通过不会自动通过Redis；remote CI状态只对快照中SHA有效。

## Migration and rollback

通过预审批证据后，每组独立批准。pytest项目实施迁移hook/包/锁并复跑获批matrix，回退只恢复其包/锁与必要兼容hook；Redis项目实施更新包/锁与必要client配置，并复跑真实生命周期gate，回退同步恢复对应调用/配置。Redis无数据schema升级，保留原key/payload/TTL；不得用清空Redis作为回退。相关失败先隔离该组，不整体撤回另一组或本轮安全修复。

## Open approval decisions

精确包/插件patch、optional组合、协议及timeout/retry预算、setex等效替换是否必要、资源shutdown责任与故障限流政策。缺Python3.11或真实Redis环境时保留待批准，不让当前3.12 linked环境或mock证据替代。
