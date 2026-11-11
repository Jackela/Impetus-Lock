# Dependabot read-only inventory

2026-09-14 查询：开放PR14个，其中Dependabot13个；#115非Dependabot不计入。PR状态是读取时快照，本轮未rebase、合并、评论或修改远端。风险与本地Tier授权独立；所有major迁移至少Tier3，不把工具依赖更新归为Tier1文档。

| PR                                                       | 标题                                                                                       | 查询状态 | 风险       | 建议                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- | ---------- | ------------------------------------------------------------------------------ |
| [#117](https://github.com/Jackela/Impetus-Lock/pull/117) | chore(deps)(deps-dev): update mypy requirement from ^1.11.0 to ^1.20.0 in /server          | BEHIND   | 低         | mypy同major工具更新；重放后检查Python3.11/3.12 typing结果。                    |
| [#118](https://github.com/Jackela/Impetus-Lock/pull/118) | chore(deps)(deps-dev): update import-linter requirement from ^2.0 to ^2.11 in /server      | BEHIND   | 中         | import-linter更新；重放后验证三条架构contract和忽略项。                        |
| [#119](https://github.com/Jackela/Impetus-Lock/pull/119) | chore(deps)(deps): update opentelemetry-api requirement from ^1.27.0 to ^1.41.0 in /server | BEHIND   | 中         | OpenTelemetry API须与SDK/exporter一致验证，不能仅因minor就视为安全。           |
| [#120](https://github.com/Jackela/Impetus-Lock/pull/120) | chore(deps)(deps-dev): update pytest-xdist requirement from ^3.6.0 to ^3.8.0 in /server    | BEHIND   | 低         | pytest-xdist同major；重放并行测试与资源隔离。                                  |
| [#126](https://github.com/Jackela/Impetus-Lock/pull/126) | chore(deps)(deps-dev): bump jsdom from 27.4.0 to 29.0.2 in /client                         | UNSTABLE | 高 / Tier3 | jsdom major；单独验证Node engines和真实编辑器DOM测试。                         |
| [#127](https://github.com/Jackela/Impetus-Lock/pull/127) | chore(deps)(deps-dev): bump eslint-plugin-jsdoc from 61.7.1 to 62.9.0 in /client           | UNSTABLE | 高 / Tier3 | eslint-plugin-jsdoc 61→62 major；审查规则默认值和lint结果。                    |
| [#128](https://github.com/Jackela/Impetus-Lock/pull/128) | chore(deps)(deps-dev): bump globals from 16.5.0 to 17.5.0 in /client                       | UNSTABLE | 高 / Tier3 | globals 16→17 major；审查全局变量集合变化与lint。                              |
| [#129](https://github.com/Jackela/Impetus-Lock/pull/129) | chore(deps)(deps-dev): bump @types/node from 24.10.13 to 25.6.0 in /client                 | UNSTABLE | 高 / Tier3 | @types/node 24→25 major；先决定支持运行时，避免类型领先运行时。                |
| [#134](https://github.com/Jackela/Impetus-Lock/pull/134) | chore(deps)(deps): update redis requirement from ^5.0.0 to >=5,<8 in /server               | UNSTABLE | 高 / Tier3 | redis约束放宽到<8且未同步lock；先决定迁移版本并覆盖Redis集成，不合并当前草稿。 |
| [#135](https://github.com/Jackela/Impetus-Lock/pull/135) | chore(ci)(deps): bump the actions group with 2 updates                                     | UNSTABLE | 中         | CI action组合升级；审查release说明、权限及输入输出，再运行CI。                 |
| [#136](https://github.com/Jackela/Impetus-Lock/pull/136) | chore(ci)(deps): bump dependabot/fetch-metadata from 2 to 3                                | UNSTABLE | 高 / Tier3 | fetch-metadata v2→v3 major影响依赖自动处理；独立审查输出与权限。               |
| [#137](https://github.com/Jackela/Impetus-Lock/pull/137) | chore(ci)(deps): bump docker/setup-buildx-action from 3 to 4                               | UNSTABLE | 高 / Tier3 | setup-buildx v3→v4 major；独立审查runner要求和构建行为，不能本轮执行push验证。 |
| [#141](https://github.com/Jackela/Impetus-Lock/pull/141) | chore(deps)(deps): bump the minor-patch group across 1 directory with 23 updates           | BLOCKED  | 高         | 23项前端依赖组合；建议先拆编辑器和测试工具链再验证。本轮不升级、不合并。       |

建议顺序：同major开发工具更新 → 协调的telemetry/CI变更 → 单独major proposals → 拆分后的前端组合。每组依据当时最新base与测试结果重新审查；当前本地通过不证明这些PR通过。
