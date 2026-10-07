Status: Approved for local implementation on 2026-10-07; only verified work is checked. R04/R13 remain independent.

## 1. Approval and baseline
- [x] 1.1 批准单页入口、注册可见性、session-expired 本地写作和未归属草稿处理；批准范围见 proposal 的 2026-10-07 记录。
- [x] 1.2 核对已挂载 auth endpoints 与 R04 修复后的 client 合同、R13 保存行为、实际 App 组装，不引入新 cookie/CSRF 政策。基线 main@20482ff；61 项相关前端测试、类型、lint、构建和本提案严格检查通过。

## 2. Entry and session TDD slices
- [ ] 2.1 在实际 AppProviders/App 入口写 initial loading/me200/me401/network 的 RED，再最小接入 AuthProvider 和 gate，确保 loading 无受保护请求。
- [ ] 2.2 写 login/register 错误/成功和键盘/error 状态 RED，再复用表单与公共 auth client。
- [ ] 2.3 写 logout204/失败和受保护401/403 的 RED，再实现停远端工作、可信会话状态和重试，不读取 HttpOnly cookie 推断登录。

## 3. Draft and account isolation
- [ ] 3.1 写未保存 content/lock_ids、会话过期与同账号恢复版本冲突 RED，再接入已修复同步行为。
- [ ] 3.2 写账号切换、旧查询/保存完成和缓存隔离 RED，再实现账户生命周期，不向新账号展示或上传前一账号草稿。
- [ ] 3.3 写旧全局缓存迁移/锁恢复/显式导入 RED，再保留未归属副本并提供恢复选择。

## 4. Verification and rollback
- [ ] 4.1 保存独立 RED/GREEN，完成 auth-entry/client/同步回归、有效 app+node TypeScript、lint/format/build 与严格 OpenSpec。
- [ ] 4.2 按本次授权验证普通浏览器的实际登录、注册、刷新、logout失败、session过期和账号切换；真实后端认证，无 TESTING 绕过，不用真实 LLM。
- [ ] 4.3 演练安全回退与草稿恢复；主代理审阅证据并验收，本票草案检查不代表未来 UI 已接受。
