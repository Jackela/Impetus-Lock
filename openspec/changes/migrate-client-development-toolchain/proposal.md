# Change: 分组迁移前端开发工具链

Status: Proposed / not approved。P-01，Tier 3，仅起草；本票不升级包或改锁文件。

## Why

六个 client major Dependabot PR 影响相互连接的构建、lint、hook 和类型支持。快照中 plugin-react6 单独搭配 Vite7 失败；Hooks7 的旧 preset 形状不符合 flat config；lint-staged17 的 client 副本也不是 root pre-commit 实际调用的15版本。单个 PR 的绿色 CI 不能证明新的打包器、规则和实际 hook 已满足项目需求。

当前来源：`client/package.json`、两个 package-lock、root `package.json`、`.husky/pre-commit`、`client/{vite,vitest}.config.ts`、`client/eslint.config.js`、CI工作流；[2026-09-29 Dependabot 快照](../../../.scratch/audit-2026-09/runs/2026-09-29/dependabot.md)。npm metadata 于本票只读核对，不安装进仓库。

## What Changes

- 构建组：协调 Vite8 + plugin-react6，一起验证和回退；检查 Rolldown/Oxc、CJS interop、CSS/浏览器 target 及 Milkdown/React HMR。
- lint 组：ESLint10/@eslint/js10、Hooks7 与 TS/JSDoc/Refresh peers 和 flat config 分阶段验证，明确新增 compiler 规则，不以关掉规则换取 green。
- hook/runtime 组：root 是 pre-commit 所有者，建议升级 root lint-staged17 并移除没有独立入口用途的 client 副本，核对两份锁文件；root/client 支持范围同步采用实际依赖交集。
- typing 组：明确 Node types26 的用途，推荐匹配 Node22/24 的类型而暂缓26；如选择26，须禁止依赖26专有运行时 API，不能把类型升级解释成支持 Node26。
- 四组独立验收、分别回退；不一次盲升六包，不扩大产品或重写编辑器。

## Dependabot PR mapping

状态只引用上述日期快照，不是本票重新跑 CI。只读 PR 标题核对的当前目标分别为 Vite8.3.1、plugin-react6.1.1、ESLint10.11.0、Hooks7.1.1、lint-staged17.5.1 和 Node types26.6.3；相应 npm engine/peer 元数据已核对，但未安装或批准这些版本。

| PR | 建议处理及证据缺口 |
| --- | --- |
| [190 Vite8](https://github.com/Jackela/Impetus-Lock/pull/190) | 快照 green；和181成对评估，补 HMR/生产预览/锁保存导出证据 |
| [181 plugin-react6](https://github.com/Jackela/Impetus-Lock/pull/181) | 快照 test/E2E失败；不单独接入 Vite7，升级配对后再验证 |
| [180 ESLint10](https://github.com/Jackela/Impetus-Lock/pull/180) | 快照 green；检查 @eslint/js、插件 peers、实际规则范围 |
| [176 Hooks7](https://github.com/Jackela/Impetus-Lock/pull/176) | 快照 lint失败；改用已核对的 flat preset，逐项处理规则变化 |
| [177 lint-staged17](https://github.com/Jackela/Impetus-Lock/pull/177) | 快照 green；client升级未改变 root15 hook，需要明确真实所有者 |
| [189 Node types26](https://github.com/Jackela/Impetus-Lock/pull/189) | 快照 green；先批准22/24支持与类型政策，再决定延期或接受 |

本票不合并、关闭、重基、评论任何 PR。未来实施前由主代理刷新目标版本、开放状态、base 和检查结果。

## Impact

- Affected specs: 复用 `dev-environment-bootstrap`，追加工具链迁移约束；当前规范和验收条件不改。
- Affected interfaces: dev/build/preview、Vitest、ESLint flat config、root pre-commit、TS app/node configs、Node engines/CI/Docker/runtime docs、root/client manifests与锁文件。
- 前置：R11–R18 的有效类型和依赖基线、R20覆盖门禁先集成，不能用本轮空跑 type-check 证明迁移安全。

## Alternatives and approval choices

推荐 Vite 配对，lint/hook/typing 分开处理。保持现有 majors 等待证据也是可行延期路径；批量批准六个孤立 PR 会隐藏兼容和行为问题，不推荐。Hooks 7.0.x 的 peer 范围不支持 ESLint10，7.1.x 才包含10，不能使用 --force/--legacy-peer-deps 跳过条件。

待批准：分组顺序与具体兼容 patch，compiler规则集合，root升级/移除client副本，Node范围及 types26政策。推荐采用 `^22.22.1 || ^24.0.0` 的候选交集，安装后仍核对所有传递依赖；不批准 Node26 运行时或新增 Babel/React Compiler 功能。

## Acceptance, migration and rollback

批准前需要受支持 Node22/24 的可复现安装和有效 type/lint/unit/build，以及独立实际 hook、dev HMR 和生产预览功能证据。预览须覆盖编辑、不可删除锁、保存/重载和导出；绿色 unit/build 不代替这些检查。此票仅验证提案格式/来源/链接，不执行浏览器或修改依赖。

未来每组保存迁移前 manifest/config/锁文件基线，独立变更、验证再继续。Vite与plugin共同回退；lint/config/对应锁一起回退；hook恢复root配置与runtime要求；typing单独恢复类型与锁。回退不撤销本轮已授权类型、同步、覆盖修复。
