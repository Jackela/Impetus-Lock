# 本地实施与验证记录

本提案按 2026-10-07 用户批准实施。生产源码固定于 `46efcb8`；本地基线 `20482ff`，实时远端 `149cf18` 的 13 项依赖提交未直接合入。当前仅为本地实现及验证，不代表发布、远端 CI 或用户验收。最终整合身份见仓库本地 `.scratch/authenticated-editor-entry-2026-10-07/local-integration.json`。

## 实现与独立提交

- `0359dcb`、`af293e6`：依次整合原 Sol 候选 `485b2d1`、`7a8d38f`，原候选分支保留。
- `ae14687`：5 项同主版本安全修复，只有客户端和服务端锁文件。
- `e38c474`：认证入口、服务器身份确认、会话暂停与退出确认、账户草稿/查询和请求代次隔离。
- `5b2fdb9`、`46efcb8`：独立复核和真实浏览器发现的恢复、导出、存储、标题规范化及 AI 当前锁问题；未增加认证规则或路由平台。

同账号恢复先检查服务器版本，冲突保留两份正文/锁和本地恢复备份。旧全局草稿保留原始副本，只有明确导入才创建新账户草稿。坏锁或坏快照明确报错、只读保留和原串导出。退出存储失败不卸载最后一份正文，退出服务端失败不假装成功。

## 自动化结果

| 检查                                                  | 当前结果                                                             | 本地证据                                                  |
| ----------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| 前端完整 Vitest / 关键路径逐文件覆盖                  | 852 通过、4 既有音频 skip；6 文件均 ≥80%，合计行覆盖 96.88%          | frontend-tests-final.log、frontend-coverage/              |
| app/tests/node TypeScript、ESLint、Prettier、生产构建 | 全通过；既有大块体积警告保留                                         | frontend-{types,lint,format,build}-final.log              |
| 离线 API 类型合同和运行时元数据                       | API 与离线 FastAPI schema 一致，合同测试通过                         | frontend-contracts.log                                    |
| 后端完整回归（不运行 llm_live）                       | 847 通过、6 skip；含真实 PostgreSQL 归属/版本原子性，合计覆盖 81.66% | backend-tests-integrated.log                              |
| 后端锁关键路径逐文件覆盖                              | 16 文件均 ≥80%，合计 95.62%                                          | backend-lock-coverage.log                                 |
| Ruff、format、pydocstyle、mypy、import-linter         | 全通过；107 源文件、3 分层合同                                       | backend-quality.log                                       |
| 当前 Sol 专属离线合同                                 | 75 通过，socket guard 网络尝试 0；已包含在 847 中，不能加总          | sol/current-contracts.log、sol/offline_network_guard.json |
| 全量严格 OpenSpec 0.23.0                              | 23 通过、0 失败                                                      | openspec-all.log                                          |

以上证据路径统一相对仓库 `.scratch/authenticated-editor-entry-2026-10-07/`；关键证据已逐文件核对 SHA256 后保留到原仓，覆盖率产物也保留于其中的 frontend-coverage/，避免误读原仓既有旧报告。后端 pytest 采用其既有测试认证环境和 SQLite/独立 PostgreSQL schema；此表不代替下述真实认证浏览器验证。6 个后端 skip 为 4 个既有授权占位和 2 个不可达 Redis 用例，未实施协作扩展。前端 4 个 skip 位于 useAudioFeedback.test.ts。

关键行为保留小步 RED/GREEN：auth/（入口、表单、查询及导出）、drafts/（账户保存/冲突、存储读取写入、坏源）、editor/（请求生命周期、实际锁定位），另有 conflict-editor、canonical-lock、final-lock-boundaries 和 malformed-app 日志。Prettier 首次与 coverage 临时反例 fixture 并发时误报，待测试清理后顺序复跑通过；不是产品源码格式故障。

## 普通浏览器和真实持久化

最终固定 `46efcb8` 的 **29 项全部通过，0 跳过、失败或 flaky，127.3 秒，errors=[]**（browser-results.json）。包含首次身份等待/200/401/网络/5xx、真实登录注册成功/失败、创建/保存/刷新与锁、会话过期/同账号恢复/冲突选择、退出成功/失败/存储拒写、A/B 迟到查询/保存/AI/导出、旧稿显式处理及坏锁/坏元数据。补充验证任务切换拒读与重试、标题锁、可信 AI 删除/重写仅移除目标旧锁并保留其他锁；改写新锁仍拒绝人工删除。

独立 `client/playwright.auth.config.ts` 使用正常 Chromium、真实后端 8001、Vite 3000 和独立 PostgreSQL `impetus_auth_7ca73b788436`。后端 TESTING 未设置，cookie/CSRF 与任务 API 真实执行；没有关闭浏览器安全设置。每例独立 context，测试账户通过真实 UI 注册，真实 cookie 仅在内存复用以遵守原有限流。AI 全部使用受控 HTTP 响应与假测试 key，不调用付费模型。

实际服务器 SIGTERM 后监听消失，再以同一隔离数据库/签名设置重启。旧测试账号通过真实 UI 登录和选择原任务，正文、lockIds、version 逐项完全一致：browser-server-shutdown.json、browser-restart-durability.json。此证据不证明活跃 Sol 请求退出或数据库历史 drain。

原始失败及归因保留于 browser-evidence.md：第一轮存在文本比较、键盘定位和实施中热更新；第二轮发现真实 canonical 正文恢复及页脚指针问题，已修复；后续补充用例修正了欢迎弹窗、抽屉和编辑器准备的正常操作等待，未 force-click 或放宽数据断言。扩充全跑曾因外部 Google Fonts 等待造成截图/导航超时，业务断言已通过；改为 DOM 就绪导航并严格等编辑器准备，截图直接读取 Chromium 实际像素，不修改 DOM、字体或浏览器安全设置。最终 JSON、关键截图与原串下载位于 browser\*。

## 独立复核与安全回退

两项独立只读规范/标准复核发现并推动修复导出会话绕过、服务器版本安装失败和坏账户快照静默跳过。补充独立复核发现读取错误、标题自动 ID 及可信 AI 修改后的历史锁；固定 `46efcb8` 的限定 React/HTTP/真实 Milkdown 复核确认原反例消失，普通删除及恢复不会静默去锁。固定 `46efcb8` 的最终 Standards/必要安全只读收口未发现未解决问题；主协调者核对了原反例、真实浏览器 JSON 与关键截图（review-closeout.md）。

已演练暂停远端、保留本地稿、原串导出、重新登录和冲突恢复。逆补丁实际应用于一次性源码副本，233 文件字节匹配既定 `ae14687` 基线；主工作区和浏览器数据不变，副本已移除（rollback-check.json）。未启动不安全的旧全局缓存入口；实际回退须保留认证 gate/账户 reader 或暂停远端，禁止旧稿自动上传。

## 安全依赖与明确后续

锁文件更新 Mako 1.4.2、multidict 6.9.1、urllib3 2.8.0、DOMPurify 3.4.16、source-map-js 1.2.2。兼容回归和 5 个针对性 smoke 通过，官方告警链接、版本/哈希与触发说明见 security/checks.json。npm audit 仍有 7 个受影响包，不宣称清空 GitHub 告警。

后续需独立范围与兼容验证：cryptography 大版本的加密/旧数据读取；Starlette/FastAPI 约束迁移的认证、CORS/CSRF 和中间件；pytest 大版本的 fixture/collection/全回归；micromark-extension-math 约束允许修复后的 KaTeX 的解析/导出；React Router 大版本的既有 ProtectedRoute 合同。本次入口未引入 router。bcrypt 长密码字节边界仍需独立处理，不新增长度限制或截断来暗改后端规则。

Sol 原交接已纠正完整提交状态并保留历史审批超时材料。真实模型 API、活跃 Sol HTTP/数据库历史 drain、Windows Mako 驱动器路径运行时、真实 Redis、远端 CI/PR/push/部署均未运行；不作为本次已完成的证据。
