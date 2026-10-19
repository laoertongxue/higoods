# 限定候选生产单后剩余成本

本轮无 Profiler 冷载 **1152.4 ms > 1000 ms**，已停止且没有继续 refresh/navigation。相邻 `final-scoped-owner-calibration-pda/report.json` 保留该有效失败。单次 CPU 诊断冷载 1164.3 ms，仅用于定位；固定 D10、原 F090 和 1 秒标准不变。浏览器已关闭，未修改产品或采集器。

当次 manifest `a35e32c1…`、dist index `8cce28bf…`、harness `6d4b40df…` 及加载资产的完整 SHA256/原始字节见 `binding.json` 和所指副本。

旧版 213 ms 的 `ownedProductionIdentities → full accessory sources` 主栈已不再出现。当前最大可定位同步入口是：

`当前 PDA 详情 de → printing-task-domain hr → we`

该直接子项包含 **132.1 ms**，位于页面实际 `E` 渲染前；新 bundle 的入口仍会对原 F090 执行显式 `listDyeWorkOrders` 分支。没有把这部分归于后台预载或材料 owner。详情 `de` 合计 445.2 ms，`E` 渲染 289.3 ms，任务 lookup `Js` 21.0 ms。是否能按已识别的后道对象避免该显式染色初始化，由主代理依据真实共享职责决定；本代理没有移除染色或待办输出。

`PROCESS_DOC` link 索引为 172.7 ms，其中 `listPostFinishingTasks` 127.7 ms，分解如下：

- 生产任务聚合有两条实际进度映射，分别读取 `totalCompletedQty`、`availableForRecheckQty`。对应 progress 子树包含 21.1 ms 与 20.8 ms；源码中的两条映射已在 `post-task-progress-breakdown.json` 保留，不从 CPU node 数冒称精确调用次数。
- 这两条映射中的 `records` 克隆自耗共 18.0 ms，SKU 克隆 6.0 ms。公开进度结果包括历史记录，但此任务聚合只读取总数。
- 聚合快照 getter 的 JSON clone 自耗：复检 9.0 ms、待交出 6.0 ms、出货 4.5 ms、加工单 1.5 ms、回货 1.5 ms。
- 当前详情的任务 lookup、分项摘要、下游动作另有全量复检 clone，自耗合计 28.5 ms；当前详情出货 clone 9.0 ms，lookup 待交出 clone 6.0 ms。

以上 CPU 包含耗时会重叠，不能相加；clone 自耗按真实祖先作用域分组。完整调用者、源码位置、采样与事务仍在原始 `.cpuprofile`、`weighted-qualified-diagnosis.json`、`qualified-stage-callers.json`、`post-task-progress-breakdown.json` 和 `report.json`。

无 Profiler 样本仍按原值失败，不使用本次诊断数字覆盖；正式 100 家族 / 520 样本尚未开始。
