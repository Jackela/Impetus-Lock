# Pull request 检查故障定位

本指南用于确认 GitHub Actions 是否已为当前提交运行，以及定位失败原因。仓库的 `ci.yml`、`ci-client.yml`、`ci-server.yml` 和 `e2e.yml` 会在符合各自过滤条件的 Pull request 事件上运行；打开 PR 默认会触发匹配的工作流，后续提交通常以 `synchronize` 事件更新检查。正常流程是先推送分支提交，再创建 PR；不需要空提交，也不必默认手动派发工作流。

为避免递归触发，`GITHUB_TOKEN` 引发的事件通常不会启动新的工作流。例外包括 `workflow_dispatch`、`repository_dispatch`，以及由该 token 创建或更新 PR 时产生的 `pull_request` opened、synchronize、reopened 事件；这些 PR 工作流会进入待批准状态。检查 PR 页面、Actions 运行记录和 workflow 的事件、分支及路径过滤条件，确认预期工作流是否匹配。不要仅凭短暂没有显示检查就推断为 webhook 延迟。详见 [GitHub 关于触发工作流的说明](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)。

## 定位步骤

1. 查看 PR 的 **Checks** 页，确认检查是否排队、运行、完成或失败。
2. 打开仓库 **Actions**，按 workflow、分支和提交 SHA 查找运行记录。若记录不存在，先核对触发事件和 workflow 的过滤条件。
3. 对失败的检查打开对应 job 和 step 日志，定位具体错误；修复后推送新提交，PR 会收到更新后的检查。
4. 若确需手动重跑，在 Actions 运行页面选择 **Re-run jobs**。只有 workflow 声明了 `workflow_dispatch` 时，才可从界面或 `gh workflow run` 手动派发；派发目标必须是 workflow 支持的分支。
5. 若权限或触发行为仍不清楚，查阅 [GitHub Actions 事件触发文档](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows) 和 [触发工作流文档](https://docs.github.com/en/actions/managing-workflow-runs/manually-running-a-workflow)。

本地 `act` 或手动命令只能提供本地验证信息；它们不能证明 GitHub 托管 runner 已通过。以 GitHub Actions 中与 PR 提交 SHA 对应的检查结果为准。
