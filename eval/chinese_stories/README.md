# 中文故事离线评测

这份材料目前只能证明上下文、结构化输出和动作合同可以检查；真实模型对中文故事的帮助尚未评估。所有正文均为本次原创合成案例，没有使用用户稿件或其他私人材料。没有金标准续写，没有以 AI 留存率替代写作效果，也没有真实模型调用、token 或费用测量。

## 案例和比较边界

`cases.json` 共 24 个稳定 ID：001–020 为开发集，021–024 为固定留出集。留出集在生成任何输出前确定；不得查看留出输出后调整提示词。对话、动作、内心活动、悬疑、转场、未完句、短开头、选区、锁、emoji 和超过请求上限的正文均有覆盖。`must_preserve`、`allowed_reversal` 和写作意图用于人工审阅，不当作机器可证明的创作结论。

正文是单段纯文本；其中 Markdown 字符是字面字符，不假装已经过编辑器解析。`selection.from/to` 和 `locks.from/to` 是正文中的 UTF-16 偏移。对应单段 ProseMirror 请求坐标加 1；真实多段文档的节点偏移由编辑器测试验证，不能用这个加 1 换算。选区右端 `selection.to` 是上下文截止位置。末三句保留未完句、连续标点、闭引号及原始空白；仅在请求超过 2000 Unicode 字符时截取字面后缀，不切开 emoji。

锁案例的叙事禁令供人工判断。AI 对目标锁的修改可以退休该锁，目标之外的锁应由编辑器继续保留；检查器不新增“AI 不得触碰任何锁”的全局规则。离线响应检查不能证明编辑器锁持久化。

`baseline/` 是基准提交 `cdb868dcf913326b2f1e0d663f12a277fc4c6b0a` 的 TOML 原文。导出时始终检查已核实的固定 SHA-256；有完整历史时再与 `git show` 对照。CI 浅克隆缺少该提交时使用固定快照，记录 `baseline_verification=pinned_snapshot_digest`；能读取原提交时记录 `git_commit_and_digest`。修改快照、Git 检查或读取出错都会以结构化错误退出 2，不会将当前模板当作基准。`candidate` 复用当前提示词注册表。Muse 的版本是 `2024-11-13.1`，删除选项已移除；Loki 提示词没有更改，因此它的两组模板 digest 相同。

仓库中已生成的输入、匿名身份表和模拟记录保留原交付提交 `79529110` 的来源摘要，作为历史实验记录；合并准备中的工具修订不会改写这些记录的来源。使用下列命令重新导出时，会记录实际 HEAD、工作区状态和当前文件摘要。固定模拟 raw 输出继续只证明工程合同，不能冒充新模板生成的创作结果。

A/B 的两个模板使用**同一份修正后的请求输入**，只比较提示词。这不是旧版本整条前后链路的比较：基准前端原先从全文尾部提取上下文，实际中间光标可收到光标后文字，而且旧分句处理可能丢掉未完句、增加空格。该行为差异由前端回归测试单独验证；这里不冒充已回放原前端。

## 可重现命令

在仓库根目录，用已经安装项目依赖的 Python 执行：

```bash
server/.venv/bin/python scripts/prompt_eval.py
server/.venv/bin/python scripts/story_eval.py export --out eval/chinese_stories/inputs.development.json
server/.venv/bin/python scripts/story_eval.py compare --out eval/chinese_stories/anonymous_development
server/.venv/bin/python scripts/story_eval.py check --records eval/chinese_stories/simulated.json --out eval/chinese_stories/check.simulated.json
server/.venv/bin/python scripts/story_eval.py check --records eval/chinese_stories/negative.json --out eval/chinese_stories/check.negative.json
```

原来的 `python scripts/prompt_eval.py` 无参数打印模式仍可用；它不会生成模型响应。新增参数也可经此脚本调用，例如 `prompt_eval.py export --out …`。默认导出开发集；最终冻结后可显式 `--split holdout`，不要用留出输出反复调试。导出包含完整 system/user 输入、请求、模板版本及 SHA-256、基准/HEAD/tree SHA、工作区状态、相关当前源码文件 digest、语料 digest；HEAD 上未提交的提示词须以文件 digest 辨认。

`simulated.json` 是固定文本和确定的动作排列生成的离线合同样例，复用 `BasePromptLLMProvider` 和 `InterventionService`；模板不会决定其文本或动作，所以不比较创作优劣。`negative.json` 是故意错误的记录。两者都没有厂商模型响应。检查结果里的 `service_replay` 是离线重复执行服务后生成的响应；其 ID 和时间戳是本次合成值。

## 导入和检查

输入是 `{"records": [...]}`，字段类型参考 `record.schema.json`。每条至少有 `case_id`、`mode`、`kind`（`simulated`、`replayed` 或 `real`）、`context` 和原样 JSON 字符串 `raw_output`。`raw_output` 是模型 draft，仅含 `action/content`；可另外提供完整 `request` 和最终 API `response`。`request-response.schema.json` 与 `draft.schema.json` 是项目模型生成的参考。Loki 的短上下文 destructive draft 允许由服务纠正，记录 `guard_applied`；Muse draft 删除仍违反提示词合同。draft 和最终响应必须分别检查，不能把服务纠正过的结果当作原始提示词成功。

检查器覆盖 JSON/schema、正文截止位置、选区坐标、Muse 禁止删除、Loki 少于 50 字上下文的最终响应必须 provoke、无样式前缀或锁注释、最终响应动作字段、来源和锚点，以及原始 draft 与服务纠正后的动作/正文是否对应。rewrite/delete 最终锚点须是 UTF-16 的光标尾句；范围不得超出提交上下文或切断 surrogate pair。它不会机械判断人物关系、中文风格、反转合理性或故事是否有帮助。

退出码 0 表示本批合同检查通过；1 表示至少一个输出失败（空记录也不通过）；2 表示输入文件不可读，或文件/记录结构与字段类型不合法。结果保留每条原始输入和完整错误；坏 JSON 文件保留 `raw_source`。错误不会只打印后以成功码退出。`review_state=unreviewed` 和 `writing_effect=unassessed` 不因合同通过而改变。

## 匿名人工比较

`anonymous_development/review_cards.json` 包含 40 对案例、请求上下文、写作边界及空的 A/B 输出。`ratings.csv` 是空评分表；身份对应只在 `identity_key.json` 中，审阅者不看该文件。A/B 顺序按固定散列排列，可复现。获得可比的真实输出后，按身份文件填入 A/B 文本，保留 raw 输出于独立运行记录；不得用模拟样例填入后声称模型质量已测。

A、B 分别在每个维度给 1–5 分或“无法判断”，并在理由中指明具体文本：

| 维度             | 审阅问题                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| 情节与人物一致性 | 是否保留请求上下文已提供的情节事实、人物、关系与动机；变动是否有文本依据？ |
| 突破是否具体     | 是否带来能写下去的动作、信息、选择或代价，而不是空泛要求？                 |
| 中文适配         | 语气、指代、对白及表达是否贴合该段中文和文体？                             |
| 续写空间         | 是否留下多个可发展的方向，而非替作者解释完或强行终结？                     |

总体选择只有 `A`、`B`、`各有优劣`、`都无帮助`。正文全貌给审阅者定位，但光标之后及末三句之外的信息没有给模型，不能要求模型凭空知道。记录缺失事实或边界冲突，不自动填分。分别报告 Muse/Loki、开发/留出；合同失败与人工写作评分分别报告。

## 未来真实调用

当前**没有实现真实生成命令**；`real-plan.json` 和 `real-plan.schema.json` 是待批准的一次调用计划入口，默认禁用，可在批准后由项目 provider 生成 raw 记录再导入同一个检查器。不得读取本地密钥、尝试真实调用或改变默认配置来“补齐”这里的未评估状态。

离线 CLI 在导入服务时隔离继承的 OTLP 遥测设置，随后恢复环境值；独立进程回归验证不会构造外部 exporter。产品遥测源码和默认设置保持原样。

启动前需要一次明确确认 provider、model、调用数量、重复次数、四维人工评分办法和费用上限；示例计划限定单个开发案例、一个模式、一个模板、一次请求、无重试。批准记录及 `enabled=true` 是前提，时间流逝不构成批准。未知参数/费用填 `unknown` 或 `null`，不填 0。正式 A/B 运行须另行批准包含两组的调用预算，不能把一次试调用当作对照实验。

每次真实记录应附 provider/model、有效参数、模板版本/digest、来源 SHA、请求、原始输出/错误、token、费用、耗时和人工审阅状态；未测项保持 unknown。API 接受、合同通过、人工有帮助及发布是不同状态。真实模型适用性、厂商可用性、费用和人工偏好均未验证。
