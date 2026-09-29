# Change: 在当前编辑器接入完整登录与会话状态

Status: Proposed / not approved。P-01，Tier 3，仅起草；不启用新 UI。

## Why

`main.tsx` 通过 `AppProviders` 直接挂载当前 `App`，provider 仅包含 ErrorBoundary、QueryClient 和 LockManager，没有 AuthProvider 或登录入口。App 会启动任务同步，而 backend 保护这些 API。现有 AuthContext、LoginForm、RegisterForm 和 ProtectedRoute 尚未接入当前编辑器；另一个 authService 从 document.cookie 判断 HttpOnly access_token，也不能作为可靠会话状态来源。

依据：`client/src/{main,AppProviders,App}.tsx`、`client/src/contexts/AuthContext.tsx`、`client/src/components/Auth/`、`client/src/hooks/useTaskSync.ts`、`client/src/services/security/auth.ts`；已挂载 `server/server/auth/router.py` 与 AuthenticationMiddleware。frontend-audit 明确将完整认证 UI 留给 Tier3。

## What Changes

- 推荐复用 AuthProvider、LoginForm 和已挂载 `/auth/me/login/register/logout` 合同，在现有单页增加 loading、登录、认证编辑器和 session-expired 状态。
- 只在确认当前用户后启动受保护的任务查询、同步和 AI 请求；认证失败提示重新登录，网络故障提示重试，不把两者混成“无账号”。
- 提供明确 logout 入口，认证操作等待/失败状态可读且支持键盘；不通过读取 HttpOnly cookie 或本地布尔值推断身份。
- 保留未保存草稿与锁，按用户和任务隔离本地缓存、React Query 与异步保存结果。旧全局缓存仅作为未归属草稿等待用户确认，不自动上传到新账号。
- **BREAKING**：未认证入口先显示登录而不是直接启动远端任务同步；旧共享缓存不再静默绑定当前账户。

## Impact

- Affected specs: 复用 `editor-agentic-ui`，追加入口、会话和草稿要求，不改当前编辑器锁/保存要求。
- Affected interfaces: 当前 AppProviders/App、AuthContext/Form、任务同步/查询缓存、现有 auth/task/intervention client 的已修复公共合同。
- R04 恢复 cookie/CSRF 传输，R13 处理任务保存竞态；两票独立且已有授权。本提案不修改 token/cookie/CSRF 政策、不重新实施这些修复，也不以接入 UI 作为 R04 完成条件。未来整体流程验证以已集成的修复为基线。

## Alternatives and approval choices

推荐单页状态入口，复用已有 auth 组件和 client 合同。完整路由体系可复用 ProtectedRoute，但当前它依赖未接入的 react-router-dom；如果仅为登录新增路由和依赖，范围与收益不匹配。继续匿名远端编辑要求改变后端身份/任务政策，不属于本提案；可保留已认证用户会话中断后的本地草稿编辑。

待批准：注册入口是否同时开放（推荐复用现有表单）；会话中断时允许继续本地写作的提示；旧未归属草稿的导入/导出/丢弃交互及保留策略。方案默认未归属草稿仅在登录后由用户明确选择导入，不向另一账号展示已归属草稿。

## Acceptance, migration and rollback

草案场景覆盖首次 loading 无受保护请求、me 成功/401/网络失败、登录错误/成功、退出失败/成功、编辑时会话过期、重新登录及账号切换、旧缓存恢复与锁保留。使用当前 App 组装和真实 client 的受控 HTTP 边界测试，不只 mock useAuth。

未来先验证已修复 transport，再引入 auth 状态边界，最后迁移缓存。缓存迁移须保留原内容副本并防止自动上传；回退 UI 时保留新旧草稿和用户归属记录，不恢复跨账户全局缓存读取，不关闭后端认证。浏览器实际流程是未来独立授权验证，本票不执行。
