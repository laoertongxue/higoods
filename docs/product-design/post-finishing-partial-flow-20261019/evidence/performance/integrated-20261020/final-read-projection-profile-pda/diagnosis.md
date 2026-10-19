# 数量投影优化后的冷载诊断

无 Profiler 的有效冷载 **1160.4 ms > 1000 ms**，在相邻 `final-read-projection-calibration-pda/report.json` 原样保留，stop-first 后没有继续刷新或导航。一次同资产 CPU 诊断为 1063.1 ms，仅作定位，不覆盖前者，也不作正式性能验收。固定 D10、原 F090、全部门槛和真实保存终点均未改。

源清单 `3d200b11…`、dist index `4ac24a5c…`、harness `8341beb5…` 的完整身份及加载资产字节已保存在 `binding.json` 所指文件。

## 已观察到的实际优化

- 当前后道单 lookup/getWorkOrder：4.5 ms，先前约 21 ms；其父 ID 限定的 snapshot 约 3.0 ms。
- actual render：218.6 ms，先前约 289 ms；同次渲染共享的单父 children/facts 没有形成超过 1.2 ms 的采样重栈。
- 对象链接索引：102.0 ms，先前约 173 ms；其中 `listPostFinishingTasks` 57.0 ms，先前约 128 ms。
- 任务投影中的特殊工艺来源 provider：22.5 ms，先前约 60 ms。
- 无历史记录的数量摘要一次映射：7.5 ms；先前两个完整 progress 映射各约 21 ms。

这些改善由实际当前资产 CPU 栈确认，不从源码优化意图推断已经达标。

## 剩余同步工作

当前入口仍在渲染前执行 DYE 分支 `hr → we`，包含 **130.6 ms**。其直接子项为染色初始化 `Re` 90.0 ms，以及已有工序交接处理 `it` 39.1 ms。调用者明确是当前 PDA 详情入口，不属于可随意归于后台预载的工作；本代理没有跳过原 F090 的染色调用。

actual render 中，PDA shell header 104.5 ms，较上一 profile 的约 78 ms 增加，可能涉及只读特殊工艺初始化后正常仓输出恢复；这里仅记录实际栈和变化，具体因果需继续追到子调用。对象链接索引余下 43.5 ms 仍位于固定生产单的 `PROCESS_DOC` 工艺任务 builder。后道任务投影仍有完整快照 clone，复检 12.0 ms、待交出 6.0 ms、出货 4.5 ms。

以上值是 V8 `timeDeltas` 的加权采样；包含耗时相互重叠，不能相加，也不能据 node 数推算精确调用次数。

## 证据与边界

`actual-entry-link-breakdown.json` 保存当前入口、DYE、lookup、渲染和链接的直接子调用排序；`qualified-stage-callers.json`、`weighted-qualified-diagnosis.json` 与原始 `.cpuprofile` 保留来源、函数和代码片段；`report.json` 保留真实资源、事务及完成阶段。`runtime-assets/` 保存加载资产原始字节，避免后续构建覆盖。

诊断后浏览器已关闭，未继续其他家族，未修改产品或采集器。正式 100 家族 / 520 个新样本尚未开始。
