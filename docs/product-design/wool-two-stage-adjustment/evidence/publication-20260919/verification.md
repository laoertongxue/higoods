# 毛织 main 集成发布验证

本记录补充此前完整验收，不覆盖或改写其历史版本证据。

- 毛织提交：`74388a2d`。
- 集成基线：GitHub main `d6a511107c0a968e7541f525c2673a5c1f015eed`。
- 合并后受测代码：`f0c725ebd9c8c23719d9cfab84a32a957ce5c747`，工作树 `/private/tmp/higoods-wool-main-release-20260918`。
- main 并行仓储改动全部保留，无文本冲突；12 个毛织实现文件与已验收版本一致。
- 合并后构建、266 项单测：通过，见 [build.log](build.log)。
- 毛织契约检查：通过，见 [core.log](core.log)。
- 对比 main 的本任务治理检查：通过，见 [governance.log](governance.log)。
- 合并后 33 项浏览器业务回归：通过，见 [browser.log](browser.log)。
- 37 组页面/设备 × 冷进入、刷新、站内切换 × 5 次，共 555 个加载样本：通过，见 [routes.json](routes.json)。常规最大 465.2ms；PDA 队列冷启动按用户授权 <=1s 例外通过。
- 71 个主要操作 × 5 次，共 355 个操作样本：通过，最大 109.6ms，见 [actions.json](actions.json)。
- 构建 SHA256：`fe40f1cbd6f3c5c210081afc5db1e69f8a85c077debc653247db92938a6d2867`。
- 此记录之后的提交仅归档发布证据，不修改受测代码。此前完整动作覆盖及对抗式审查见 [完整验收](../acceptance-500/final-verification.md)。

本地 main 快进及 GitHub 推送结果以本次任务最终回执和 Git 引用为准；此验证记录本身不宣称部署已完成。
