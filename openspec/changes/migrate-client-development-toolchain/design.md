## Context

当前 client: Vite7/plugin-react5、ESLint9/Hooks5、lint-staged16、types/node25；root lint-staged15，`.husky/pre-commit` 在 root 执行 npx lint-staged。client 没有独立 lint-staged 配置/调用脚本，单独升级 client 不验证真实 hook。当前 build 仅 vite build，type-check 基线曾无 source inputs；以后必须基于 R18 的有效 app/node 编译。

## Goals / Non-Goals

目标是兼容且可回退的开发工具迁移。非目标是浏览器支持重定义、React Compiler 引入、业务重写、替换 Milkdown、一次清偿所有 lint 告警或将 Node26 纳入运行环境。

## Group A: coordinated bundler migration

配对 Vite8/plugin-react6；插件6已不支持Vite7，并不再内置 Babel 特性，当前 react() 配置无需额外 compiler/Babel 功能。[plugin-react6 发布说明](https://github.com/vitejs/vite-plugin-react/releases/tag/plugin-react@6.0.0)

Vite8 改用 Rolldown/Oxc，默认浏览器 target 和 CJS/CSS 行为有变化。先检查 vite/vitest 配置、依赖预打包、Milkdown/ProseMirror、资产加载/分包和导出依赖，只迁移实际使用的选项。对照项目现有“最新两版”浏览器合同决定是否需要显式 target；不能因为新默认值就宣称支持范围已接受。[Vite8 迁移指南](https://vite.dev/guide/migration)

Node22与24 clean install，随后有效 type-check、unit/覆盖、build；真实 dev server HMR 保持内容和锁、production preview 编辑/不可删除/保存重载/导出作为单独功能门禁。future E2E/浏览器需另行授权，本票不执行。

## Group B: lint and flat configuration

ESLint10 与 @eslint/js10 对齐，并核对 typescript-eslint、JSDoc、Refresh 和 Hooks 的精确 peer 范围。ESLint10 改配置查找及规则/API，不能仅看某个 eslint 命令退出0。[ESLint10 迁移指南](https://eslint.org/docs/latest/use/migrate-to-10.0.0)

2026-09-29 npm metadata 显示 Hooks7.0.0/7.0.1 不声明支持 ESLint10，7.1.0/7.1.1 才包含10。推荐先在 ESLint9 上验证 Hooks7 flat 配置，再在满足所有 peer 的版本上迁移10，分别保存结果。不得强制安装冲突 peers。

使用 `reactHooks.configs.flat.recommended` 或经明确选择的 `flat['recommended-latest']`，不沿用旧顶层 preset。推荐先采用 stable recommended；新增 compiler 规则逐条列出影响、处理或有理由的临时豁免，experimental latest 必须单独确认。官方 README 是移动来源，实施前核对选定版本的实际导出。[React Hooks 官方配置](https://github.com/react/react/blob/main/packages/eslint-plugin-react-hooks/README.md)

用 --print-config 验证实际组件/hook 文件中的 TS、JSDoc、Rules of Hooks、import boundaries 均启用。用可丢弃的受控示例区分有效失败：缺少公开函数JSDoc、不合法hooks、违规组件服务import应失败；合法样例通过。不通过扩大全局 ignores、关闭严格规则、跳过 src 或仅 lint 配置文件掩盖问题。

## Group C: hook ownership and runtime intersection

建议 root 保持唯一 Husky/lint-staged 入口，升级到17并管理 root manifest/lock；审查没有独立client用途后移除client副本。保留实际 root 格式化 glob 与 unstaged 数据，不趁机增加全仓库 lint任务。

Vite8/plugin6 engine 为 `^20.19.0 || >=22.12.0`，ESLint10 为 `^20.19.0 || ^22.13.0 || >=24`，lint-staged17最低22.22.1。本轮R17现有推荐范围 `^22.13.0 || ^24.0.0` 在升级17后需提高22分支下限；候选交集 `^22.22.1 || ^24.0.0` 排除 Node23，不自动支持26。未来解析全部直接/传递依赖并记录实际 Node/npm，保证 root hook、client脚本、CI、Docker和文档一致。[lint-staged17 发布说明](https://github.com/lint-staged/lint-staged/releases/tag/v17.0.0)

建议在隔离的临时 git fixture 中测试真实 root hook 配置与 root/client 代表 staged 文件，包括部分暂存、任务失败恢复和未暂存内容保存；测试不能在生产 worktree commit。若确有client入口，保留需要说明调用者与所有者并独立验证，不能仅保留两个不同版本以图方便。

## Group D: Node typing policy

types/node26不会升级运行时。推荐先选择与受支持22/24对应的类型基线，延期189；当前25类型也需按政策审查。若批准26类型，app/node tooling实际编译、API可用性检查与22/24执行都必须通过，禁止26专有API；不能只靠编译成功。具体类型major随批准选择，manifest不在本票修改。

## Evidence and sequencing

建议顺序：有效R11–R18/R20基线；确认runtime/hook所有者；A配对；B先Hooks再ESLint；C实际hook；D单独typing。组间仅依赖共用支持范围，每组可延期/回退，不靠一次最终green覆盖中间失败。

PR状态来源为日期快照；CI green证明对应SHA执行的检查，不能证明旧 type-check 已覆盖 source、真实hook被调用或HMR/生产预览功能。保存失败和成功不同日志，记录未运行项。npm registry只读元数据记录在 P-01-docs-writer evidence prefix；不是安装/功能验证。

## Migration and rollback

每组一起管理相关 manifest/config/锁文件，clean install核验无意新增生产依赖。A回退Vite和plugin及其配置/锁；B回退lint包与preset/配置；C回退root hook及root/client依赖所有权；D回退typing。保留独立获批的R17/R18等修复，不能把回退做成整个审查前版本恢复。

## Open approval decisions

精确包patch与所有peers、stable/latest规则集、root/client副本处置、实际Node交集、类型major政策及浏览器证据安排。未完成实际环境验证前不能批准实施或验收major迁移。
