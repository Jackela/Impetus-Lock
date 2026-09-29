Status: Proposed / not approved。所有条目是未来迁移，不代表已安装、测试或批准。

## 1. Approval and baseline
- [ ] 1.1 刷新六PR和精确目标patch/peers；批准四组顺序、Node范围、flat规则集、hook所有者、typing政策与未来功能证据计划。
- [ ] 1.2 集成R11–R18/R20，记录有效type/lint/unit/build基线与独立失败证据；核对root/client锁、CI/Docker/runtime文档。

## 2. Group A: Vite8 + plugin-react6
- [ ] 2.1 先保存孤立plugin6/Vite7不兼容的RED证据，再配对迁移；核对实际配置、Oxc/Rolldown/CJS/CSS/targets，不新增compiler功能。
- [ ] 2.2 Node22/24 clean install、有效app/node type-check、unit/覆盖/build通过后，单独授权验证dev HMR和生产preview编辑/锁/保存重载/导出。
- [ ] 2.3 演练配对包/config/lock回退，保存独立GREEN。

## 3. Group B: Hooks7 + ESLint10
- [ ] 3.1 先重现旧preset flat config失败，再在ESLint9上接入兼容Hooks7 flat preset；核对actual exports与compiler规则选择。
- [ ] 3.2 用规则有效/无效样例和--print-config记录RED/GREEN，再迁移ESLint/@eslint/js10及兼容peers，不强制安装。
- [ ] 3.3 验证TS/JSDoc/Hooks/import guards作用于实际src；完整lint/format/type/unit通过，演练独立回退。

## 4. Group C: root hook and runtime
- [ ] 4.1 批准root17并决定client副本去留，计算所有engine交集，协调root/client manifest/locks、CI/Docker/文档。
- [ ] 4.2 在隔离fixture先写部分暂存/失败恢复RED，再验证真实root hook在Node22/24的成功和合理失败，不commit当前worktree。
- [ ] 4.3 演练hook/runtime所有权回退，确认未暂存内容保存。

## 5. Group D: typing
- [ ] 5.1 批准匹配22/24类型或26类型限制；独立执行有效app/node编译及22/24 runtime检查，不使用26专有API。
- [ ] 5.2 若无法完成runtime证据则延期189；验证typing独立回退。

## 6. Handoff
- [ ] 6.1 每组保留版本、SHA、环境和独立RED/GREEN；执行严格OpenSpec并由主代理审阅，CIgreen与功能证据分别报告。
