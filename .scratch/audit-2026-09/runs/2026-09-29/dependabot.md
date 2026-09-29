# Dependabot 开放 PR 与处理建议

2026-09-29 13:11:18 UTC 的交付前只读核对仍为 **8 个开放 PR**，全部涉及主要版本升级。本轮没有批准、合并、关闭、评论、触发更新或推送；远端检查通过不等于本地验收通过。

| PR | 观察到的状态 | 风险与建议 | 将来获批后的必要验证 |
|---|---|---|---|
| [#190 Vite 8](https://github.com/Jackela/Impetus-Lock/pull/190) | CLEAN，检查通过 | 中；与 plugin-react 6 协调迁移，检查 Rolldown/Oxc 和浏览器目标变化 | Node 22/24 安装、HMR、生产预览中的编辑、锁、保存、重载和导出 |
| [#189 Node types 26](https://github.com/Jackela/Impetus-Lock/pull/189) | CLEAN，检查通过 | 低至中；类型版本领先于支持的运行环境 | 明确类型版本策略，不能引入仅 Node 26 才有的运行时 API |
| [#185 redis-py 8](https://github.com/Jackela/Impetus-Lock/pull/185) | BEHIND，检查通过 | 中；关注异步连接生命周期，先对齐新基线 | 真实 Redis 7 的 pubsub、限流、重连、取消与关闭 |
| [#181 plugin-react 6](https://github.com/Jackela/Impetus-Lock/pull/181) | BLOCKED，测试与 E2E 失败 | 高；现有 Vite 7 缺少 plugin 6 所需的 vite/internal 导出 | 与 Vite 8 一起验证单元测试、构建、HMR 和 E2E |
| [#180 ESLint 10](https://github.com/Jackela/Impetus-Lock/pull/180) | CLEAN，检查通过 | 中；检查运行环境要求及插件、配置变化 | 在支持的 Node 上确认 TypeScript、JSDoc、Hooks 规则实际生效 |
| [#177 lint-staged 17](https://github.com/Jackela/Impetus-Lock/pull/177) | CLEAN，检查通过 | 中；要求 Node ≥22.22.1，根目录 hook 仍使用 lint-staged 15 | 明确客户端副本用途，验证真实 staged hook 与根配置的关系 |
| [#176 Hooks 7](https://github.com/Jackela/Impetus-Lock/pull/176) | BLOCKED，lint 失败 | 高；现有 preset 与 flat config 不兼容 | 采用正确的 flat preset，并审查新增编译器规则的影响 |
| [#172 pytest 9](https://github.com/Jackela/Impetus-Lock/pull/172) | BEHIND，后端与矩阵检查失败 | 高；旧 path hook 被移除，导致收集失败 | collection_path、Python 3.11/3.12、可选依赖、xdist 和真实 Redis 矩阵 |

风险判断结合了 PR 差异、发布说明及失败日志。主要迁移依据：[Vite 迁移说明](https://vite.dev/guide/migration)、[ESLint 10 迁移说明](https://eslint.org/docs/latest/use/migrate-to-10.0.0)、[pytest hook 迁移说明](https://docs.pytest.org/en/stable/deprecations.html#py-path-local-arguments-for-hooks-replaced-with-pathlib-path)。原始只读清单和检查状态见 `logs/closeout-dependabot.json`、`logs/closeout-dependabot-read.log`。相关 Tier3 草案见[提案索引](proposal-index.md)，本轮不执行升级。
