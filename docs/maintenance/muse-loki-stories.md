# Muse/Loki 中文故事首批开发

本轮修正了干预上下文、实时光标与动作范围，并建立可重复的离线合同检查和空白人工盲评材料。真实模型效果、人工盲评和作者续写试用均未评测，不能据此宣称写作效果提高。

## 基线与范围

启动时主工作区干净，基线为 `cdb868dcf913326b2f1e0d663f12a277fc4c6b0a`。更新远端引用后观察到 `origin/main` 为 `fd2f36ee51542d3dc6a3c2a76ff036f730c2a3f5`；新增三批依赖更新未合入本轮。实现保留在隔离分支 `codex/muse-loki-chinese-stories`。

依照现行 `agentic-interventions` 和 `editor-agentic-ui` 修复既有行为，不修改 API 版本、账户政策、默认模型或锁的基本合同。认证与草稿恢复沿用上一批实现。没有新增产品能力或架构提案，没有推送、远端 PR、部署、付费模型调用、私人稿件上传或长期记忆更新。

## 写作行为

- Muse/Loki 发请求时读取编辑器的实际选区两端。上下文止于选区右端，取最近三句，包含未完成句，保留中文标点、闭引号和原始空白；超过 2000 个 Unicode 字符时只取后缀。
- 请求坐标仍是 ProseMirror 文档位置。上下文由文档读取；动作范围在实际文本块中解析，不能把文档位置当作纯文本下标。带格式文字、多段正文和 emoji 有回归测试。
- Muse 提示词只允许 provoke/rewrite。后端仍防御性转换 Muse delete；Loki 少于 50 字上下文的 delete/rewrite 仍转换为 provoke。
- rewrite/delete 的后端范围对应光标前的最后一句，使用 UTF-16 位置单位，避免固定 120 位删除、短句扩到前句、尾部空白偏移和 emoji 截断。
- Muse provoke 继续以改写并加锁执行；请求处没有可改写的文字时，保留锁定段落插入行为。目标在发请求时捕获，仅移动光标不会把动作移到新的句子。
- 正文修订、撤销、恢复内容、模式切换或身份变化使旧响应失效。相同未修改快照的并发请求仍接受首个有效完成的响应；其修改使其他响应过期，没有引入新的请求胜出规则。
- 越界、拆开 emoji 或含错误文本块结构的光标尾部范围不执行；其他明确有效的多段范围继续按返回锚点执行。不因无效动作或未发生实际修改登记新锁。普通删除/撤销保护和有效 AI 动作的锁退休合同保留。

## 离线材料与使用

[中文故事评测说明](../../eval/chinese_stories/README.md) 包含完整命令与限制。`cases.json` 是 24 个原创合成故事，001–020 为开发集，021–024 为固定留出集。留出输出不得用于反复调整提示词。

`baseline/` 保存基线 TOML 原文，`inputs.development.json` 保存基线与候选模板在相同候选请求输入上的渲染结果。它只隔离提示词因素，不冒充旧前端整条链路回放。来源记录包含基线/HEAD、工作区状态、提示词版本及摘要、相关源码和语料摘要。

`simulated.json` 与检查报告证明离线管线和工程合同；`negative.json` 用于证明错误输出以失败状态退出。原始输出、错误、生成方式、参数及评审状态均保留；未知模型、费用与人工结果不填造。匿名卡片与评分表评价情节及人物一致性、具体突破、中文适配、续写空间，允许“各有优劣”和“都无帮助”。当前 A/B 输出及评分均为空。

在仓库根目录执行，使用安装了项目依赖的 Python：

```bash
server/.venv/bin/python scripts/story_eval.py export --out test-results/story/inputs.json
server/.venv/bin/python scripts/story_eval.py compare --out test-results/story/blind
server/.venv/bin/python scripts/story_eval.py check --records eval/chinese_stories/simulated.json --out test-results/story/simulated-check.json
server/.venv/bin/python scripts/story_eval.py check --records eval/chinese_stories/negative.json --out test-results/story/negative-check.json
```

检查退出码为 0（通过）、1（输出合同失败）、2（输入无效）。负例应返回 1，不能把它记作通过。旧 `prompt_eval.py` 无参数打印模式保留，打印模板不是创作效果评测。

工具默认离线，没有真实生成命令。未来真实调用前须一次确认 provider、模型、生成次数、重复采样、评分方式及费用上限；禁用的 `real-plan.json` 仅是计划格式。后续真实 raw 输出可导入同一检查器，须固定有效参数并另行记录人工结果。

## 重复验证

前端从 `client/` 执行：`npm run lint`、`npm run format`、`npm run type-check`、`npm run test -- --coverage`、`npm run build`；API 类型及运行时元数据检查见 `package.json`。

后端从 `server/` 执行：`poetry run ruff check .`、`poetry run ruff format --check`、`poetry run pydocstyle server/`、`poetry run mypy .`、`poetry run lint-imports`、`poetry run pytest tests/ --cov=server --cov-report=term-missing`、`poetry run python check_critical_coverage.py`、`poetry build`。完整测试需隔离的 `POSTGRES_TEST_URL`、`REDIS_URL` 和 `REQUIRE_REDIS_TESTS=1`；单元测试的 `DATABASE_URL` 保持未设置。

正常浏览器检查使用可销毁 PostgreSQL 数据库的 `DATABASE_URL`，从仓库根目录执行 `server/.venv/bin/python scripts/run-story-e2e.py`；加 `STORY_FRONTEND_MODE=preview` 可验证生产构建预览。运行器拒绝借用其他进程的 8001 端口，关闭测试认证绕过和模型凭据，正常处理 Cookie/CSRF，并清理自己的服务。所有模型请求在浏览器 HTTP 边界受控；实际账户、任务保存及恢复仍使用后端。生产 Loki 测试通过 Playwright 时钟触发既有计时器。

严格规范检查为 `npm exec --yes --package=@fission-ai/openspec@0.23.0 -- openspec validate --all --strict --no-interactive`。本轮未修改工作流。

本轮在 Node 24、Python 3.12、隔离 PostgreSQL 16/Redis 7 环境执行的结果如下。最终提交 SHA 与独立复核结论见本轮交付报告；这些检查不等于部署或作者验收。

| 检查 | 结果 |
| --- | --- |
| 前端 lint、format、三个 TypeScript 配置、构建 | 通过；构建保留既有大文件提示 |
| 前端完整测试 | 1006 通过，4 项既有音频跳过 |
| 前端固定关键覆盖 | 总行覆盖 97.70%，各文件均超过 80% |
| 后端 Ruff、format、pydocstyle、mypy、import contracts、构建 | 通过，3 项依赖合同保留 |
| 后端完整测试，含真实 PostgreSQL/Redis | 908 通过，4 项既有授权占位跳过 |
| 后端固定关键覆盖 | 总行覆盖 95.90%，各文件均超过 80%；全后端覆盖 82.10% |
| 正常 Chromium 开发版及生产预览 | 各 10 通过，无跳过或自动重试 |
| API 类型及运行时元数据测试 | 各 2 通过 |
| 严格 OpenSpec | 18 通过，0 失败 |
| 离线样例与负例 | 80 条模拟记录退出 0；9 条故意错误记录退出 1 |

附加检查把服务器的禁止打印规则应用到仓库根目录旧 `prompt_eval.py` 时，报告 6 处 T201；基线原文也存在这些有意打印。该脚本不属于现行服务器 CI 的扫描范围，未为消除附加报告而改变原有打印用途。新增脚本通过检查，打印模板仍不作为真实效果证据。

本地详细日志与浏览器记录保存在忽略目录 `server/test-results/story/`、`client/test-results/story/`；包含会话的浏览器证据不进入提交。既有四项前端音频跳过和四项后端授权占位测试跳过须单独报告，不代表本轮核心流程跳过。旁白按用户要求未执行；本轮浏览器证据限于 Chromium，不宣称其他浏览器、辅助技术、部署或用户验收完成。
