## ADDED Requirements

### Requirement: Bundler Migration Uses a Compatible Verified Pair
Vite8 和 plugin-react6 SHALL 作为兼容配对迁移及回退；受支持Node22/24环境 SHALL 完成可复现安装、有效类型/单元/覆盖/构建检查与独立dev HMR/生产预览证据。检查 SHALL 保留现有编辑、锁、保存/重载与导出行为。

#### Scenario: Plugin six is selected with Vite seven
- **WHEN** 候选配对不满足 plugin6 的 Vite8 peer要求
- **THEN** 迁移 SHALL 被阻止，不通过强制安装或单PR green接受不兼容组合。

#### Scenario: CI is green but editor preview is not verified
- **WHEN** 类型/unit/build通过但未验证HMR及生产预览功能
- **THEN** 迁移 SHALL 标为功能证据未完成，不宣称可验收。

### Requirement: Lint Migration Preserves Effective Flat Rules
ESLint10/Hooks7迁移 SHALL 使用满足精确peer范围的版本与选定版本实际flat preset。TS、JSDoc、Hooks和import guards SHALL 作用于既有源码范围；新增compiler规则 SHALL 有明确处理决定，不以关闭全部规则或跳过源码通过。

#### Scenario: Legacy preset or incompatible peer is selected
- **WHEN** Hooks preset有legacy plugins数组，或所选Hooks7.0.x不支持ESLint10
- **THEN** 候选 SHALL 失败并纠正版本/flat配置，不强制安装。

#### Scenario: Representative invalid source is checked
- **WHEN** 受控示例违反启用的JSDoc/Hooks/import规则
- **THEN** 实际lint SHALL 拒绝，合法示例 SHALL 通过，并保存print-config证据。

### Requirement: Staged Hook Ownership and Runtime Are Explicit
lint-staged17迁移 SHALL 明确root hook所有者与client副本用途，协调两份manifest/lock并用全部依赖engine交集确定支持Node范围。实际staged hook SHALL 经过成功、失败和部分暂存恢复验证。

#### Scenario: Only client lint staged changes
- **WHEN** client升级17而root hook仍调用15
- **THEN** 该结果 SHALL 不被当成root hook迁移成功。

#### Scenario: Runtime is below the selected dependency intersection
- **WHEN** Node不满足选定依赖交集，包括17的22.22.1下限
- **THEN** 配置 SHALL 明确拒绝该运行环境，不声称支持。

#### Scenario: Formatting task fails with partially staged content
- **WHEN** root hook任务失败且存在未暂存内容
- **THEN** hook SHALL 报失败并保留未暂存内容，不以迁移丢失本地修改。

### Requirement: Node Typing Upgrade Does Not Imply Runtime Support
Node types26 SHALL 仅在明确批准的类型政策及Node22/24实际检查下使用；类型升级 SHALL 不授权26专有API或Node26运行时支持。构建、lint、hook、typing各组 SHALL 有独立验收和回退。

#### Scenario: Node twenty six only API typechecks
- **WHEN** types26允许某API但受支持22/24不可执行
- **THEN** 候选 SHALL 被拒绝，不能用编译通过代替运行时兼容。

#### Scenario: One migration group fails
- **WHEN** 任一组未满足获批检查
- **THEN** 该组 SHALL 独立延期或回退，其余组 SHALL 只按各自证据评估。
