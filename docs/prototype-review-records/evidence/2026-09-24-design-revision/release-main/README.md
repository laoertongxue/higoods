# main 合并版本复验

基线 main `838266c2826a1af6e4ae46bbfd7070ad81b2cfe7`；发布工作树 `/Users/laoer/.codex/worktrees/design-revision-main-release/higoods`；独立预览 `http://127.0.0.1:4733`。构建 SHA256 `0e12efb69da2eb7d8ec9118eea4dbd28820432532bf4c1d6483163e214fd3f7a`。433/433 单元测试和生产构建通过。

浏览器首批32例：30通过、2条旧图片路径断言失败，原始结果在 browser-initial。main已迁移图片到pcs-reviewed，更新测试路径后6条图片/工作预览用例全部通过（image-retry）；合计32个不同用例均在该合并构建通过。未回退main素材，也未修改图片业务以适配旧测试。

工厂入口、12路由加载、13组PDA身份/页面冷入刷新、染印交接打印、1280×720布局均重新通过；原始数据见performance目录及对应日志，退出状态见performance-status.json。使用本构建新生成的各阶段实物流转Mock快照，隔离浏览器上下文。每性能入口5次，仍仅两个加工单列表冷入≤1秒，其余<500ms。历史build43证据保留，不作为合并版替代。

冲突处理保留main来源校验、后整理来源过滤、TMF染印互斥和审核图片迁移；加入设计改款目标SKU和图片、逐卷交接、样衣自动完成、Esc局部关闭。原开发工作树未修改。此目录证明原型与PDF验证，不代表真实生产/实体打印。Git发布与最终验收分开记录。

## 发布门禁当前状态

原型治理、标准列表治理、FCS端到端、裁剪全套检查均通过，见 checks-status.json 和各日志。首次 workflow:verify 因工作树 CodeGraph 未初始化而中止，原始日志见 receipt-initial.log。用户随后明确允许初始化，继续执行索引初始化、发布收据和 main 推送。最终技术收据位于 `/tmp/dr-main-release/task-receipt.json`；Git 发布结果以本地 main、origin/main、远端 refs/heads/main 和 GitHub API 的 SHA 一致性核对为准。
