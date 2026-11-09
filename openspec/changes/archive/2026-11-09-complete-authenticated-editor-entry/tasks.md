Status: Safety implementation, current remote integration, independent reviews and PR #207 merge are complete. Implementation worktrees, redundant branches and temporary services are cleaned up with verified recovery copies. Actual assistive technology was waived by the user on 2026-10-12 and remains unexecuted and unverified. No deployment or user acceptance is implied.

## 5. Approved 2026-10-11 safety completion

- [x] 5.1 核实本地与实时远端基线、隔离分支和环境，保留原有工作；记录实际测试收集及跳过。
- [x] 5.2 逐项 RED/GREEN：最终快照、预期账户、独立副本、未知版本、选中身份、旧稿拒读、完整分页、创建结果未知。
- [x] 5.3 Web Locks 认证写请求协调、取消/页面关闭/迟到响应保护、广播和焦点检查；不支持时安全暂停。
- [x] 5.4 完成恢复结果说明、表单、弹窗焦点、编辑器名称、格式键盘操作、选择语义、状态播报与既有 DESIGN 修正。
- [x] 5.5 完成真实认证场景矩阵、浏览器存储/数据库比对和本轮实际停服重启恢复。
- [x] 5.6 全部适用前后端质量、完整回归、锁覆盖、API、依赖及严格 OpenSpec 检查；关键保护可逆破坏实验。
- [x] 5.7 两次独立 Chromium 冷启动、生产构建及 Firefox/WebKit 核心流程，无自动重试或核心跳过。
- [x] 5.8 键盘、320 CSS 像素、200% 文字、400% 缩放、对比度、目标尺寸；实际辅助技术按 2026-10-12 用户决定豁免、未执行；10,000 词输入/切换/锁每项至少 30 样本 p95 <100ms。
- [x] 5.9 两名新只读复核者检查同一冻结候选，原缺陷全部复查，无范围内 S0-S2 或未查明核心数据安全疑点。
- [x] 5.10 必要使用说明和验证状态准确；全部 DoD 后创建可审阅本地提交并整合，清理本轮临时服务和完整整合工作区，保留必要恢复材料。

2026-10-12 用户明确决定跳过旁白检查，继续完成其余检查、PR、合并和多余分支清理。实际辅助技术未执行、未验证；此项为用户豁免，不能记作通过或据此宣称全站 WCAG 合规。远端操作现已获授权；不部署、不调用付费模型、不修改默认模型配置、不更新长期记忆的边界继续有效。整合以实时远端主线为基础，保留其既有修复和依赖，并验证新的组合候选。

原安全候选12与远端组合候选7的结果分别见 validation。当前组合产品两次Chromium冷启动各47项、官方stock Firefox18项、macOS WebKit18项与Linux WebKit两项真实焦点全部通过；精确PR头的必需CI完成。两名新只读复核者核对相同冻结候选，无范围内未解决S0–S2。PR #207已实际合并，六个原实施工作区与对应多余本地分支已清理，恢复副本验证完成，临时服务已停止；5.10按这些实际结果关闭。此后的三份文档收尾PR及其工作区清理单独完成，不预先记作已合并。

## 1. Approval and baseline

- [x] 1.1 批准单页入口、注册可见性、session-expired 本地写作和未归属草稿处理；批准范围见 proposal 的 2026-10-07 记录。
- [x] 1.2 核对已挂载 auth endpoints 与 R04 修复后的 client 合同、R13 保存行为、实际 App 组装，不引入新 cookie/CSRF 政策。基线 main@20482ff；61 项相关前端测试、类型、lint、构建和本提案严格检查通过。

## 2. Entry and session TDD slices

- [x] 2.1 在实际 AppProviders/App 入口写 initial loading/me200/me401/network 的 RED，再最小接入 AuthProvider 和 gate，确保 loading 无受保护请求。
- [x] 2.2 写 login/register 错误/成功和键盘/error 状态 RED，再复用表单与公共 auth client。
- [x] 2.3 写 logout204/失败和受保护401/403 的 RED，再实现停远端工作、可信会话状态和重试，不读取 HttpOnly cookie 推断登录。

## 3. Draft and account isolation

- [x] 3.1 写未保存 content/lock_ids、会话过期与同账号恢复版本冲突 RED，再接入已修复同步行为。
- [x] 3.2 写账号切换、旧查询/保存完成和缓存隔离 RED，再实现账户生命周期，不向新账号展示或上传前一账号草稿。
- [x] 3.3 写旧全局缓存迁移/锁恢复/显式导入 RED，再保留未归属副本并提供恢复选择。

## 4. Verification and rollback

- [x] 4.1 保存独立 RED/GREEN，完成 auth-entry/client/同步回归、有效 app+node TypeScript、lint/format/build 与严格 OpenSpec。
- [x] 4.2 按本次授权验证普通浏览器的实际登录、注册、刷新、logout失败、session过期和账号切换；真实后端认证，无 TESTING 绕过，不用真实 LLM。
- [x] 4.3 演练安全回退与草稿恢复；主协调者核对逆补丁在一次性源码副本的实际回退、暂停/导出/同账号恢复证据；未运行旧全局入口，不代表用户验收。
