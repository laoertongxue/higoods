# PDA 执行详情冷载/刷新诊断

采样日期：2026-10-20。固定 D10 主备份 SHA256 `78adb8de3cac155fd32499707c4d7d703f0f7f9e48e8bad72d0642f12bb1d586`，4,000 完成/1,000 复检/1,000 出货/900 实收；未减量，未改业务源。全部是隔离本地原型诊断，不作为正式性能验收样本。

未开 Profiler 的原始校准在相邻 `calibration-heavy-pages/report.json`：cold 1,496.8ms、refresh 1,427.9ms、navigation 732.0ms，前两项真实超过 1 秒。CPU 诊断复现 cold 1,584.5ms、refresh 1,444.5ms、navigation 568.5ms；Profiler 总持续 1,650.627ms / 1,547.453ms，包含控制与结束开销，不能代替上述页面响应。

使用原生 CDP Profiler 1,000μs 采样，保存两个原始 `.cpuprofile`、各自 `-top.json`、按真实 `timeDeltas` 加权的 `weighted-diagnosis.json`，以及带文件/列/源码片段的 `qualified-stacks.json`。加权 self 时间可相加；inclusive 时间包含子栈，不能与其相加。CPU 采样并不证明函数精确调用次数。

| 诊断 | cold | refresh |
| --- | ---: | ---: |
| 页面 ready 之前 | 1,551.2ms | 1,411.7ms |
| 终点额外持久回读 | 21.8ms | 20.8ms |
| 回读之后绘制 | 11.5ms | 12.0ms |
| 普通后道全记录 readonly 事务 | 164.3ms | 161.4ms |
| ensure 函数 CPU inclusive | 97.4ms | 93.2ms |
| PDA 后道详情入口 CPU inclusive | 807.9ms | 818.6ms |
| 其中主体 render 函数 inclusive | 403.9ms | 389.4ms |
| 主体内关联编号 link-index 解析 inclusive | 295.0ms | 285.4ms |
| F JSON parse/stringify clone self | 348.9ms | 376.1ms |
| F 模块 CPU self 合计 | 511.9ms | 537.1ms |
| 公共 PDA handover 模块 CPU self 合计 | 210.9ms | 209.9ms |
| 最慢单个资源传输 | 20.1ms | 16.6ms |

实际事务证据只有一次读取后道大集的 readonly（其余两次小事务为 PCS 启动/元数据）；没有发现重复读取整个 D10 的 ensure 证据。大部分时间发生在绘制结果前的同步目录/投影构建，网络传输不是主要耗时。

主要栈由页面入口开头 `listDyeWorkOrders()` 进入染色来源初始化/关联交出查询，公共 handout 投影重建后又读取全后道待交出库存，并对出货逐次 find/JSON clone。典型真实栈为：

`renderPdaPostFinishingExecDetailPage → listDyeWorkOrders → syncFromHandovers/初始化 → 查询任务交出 → 全 handout 目录 → 后道 waitHandover/outbound getter → JSON clone`。

编译资源中的对应帧：`pda-post-finishing-exec-detail-CATxEBIh.js` 的 `ie`；`printing-task-domain-D0ZJdcyh.js` 的 `hr/we/Re/Ld`；`pda-handover-events-ClWnzCxp.js` 的 `qi/Nt/vi/we`；`post-finishing-full-flow-CdqyhgFQ.js` 的 `tt/as/k`。限定列与源码片段都在 `qualified-stacks.json`，用于明确映射，不靠猜测同名 minify 函数。

另一块独立耗时是页面内生产/工艺编号链接解析：`renderPdaObjectCode → getProductionObjectLinkIndex`，285–295ms inclusive。现有每次 render 的局部 index 复用仍需要构造目录，具体最小修改由主代理决定。上述结论不意味着可以移除已确认链接、改动其他工艺，或跳过共享恢复校验。

诊断后浏览器已关闭，未扩大正式采样。原始慢样本和资源 SHA 继续保留，等待根因对应的最小修复及新版资产后，仅按实际影响追加复验。
