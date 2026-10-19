# 通用后道出货打印入口冷载诊断

原有效冷载 **1568.9 ms > 1000 ms** 在相邻 `final-list-readiness-calibration-print/report.json` 保留。本目录带 Profiler 冷载 1639.0 ms 仅作定位，不覆盖原失败、不作为正式性能验收。固定 D10 和额外公开生成的 1000 件出货样本均未改。

实际地址为 `/fcs/print/preview?documentType=POST_FINISHING_OUTBOUND_ORDER&sourceType=POST_FINISHING_OUTBOUND_ORDER&sourceId=PF-OUT-PF-ACCEPT-PO-1-105`。原样本 ready 1518.9 ms、图片解码 0.2 ms、原生持久回读 37.7 ms、绘制 12 ms。五 SKU 的后道出货单已显示，没有 handler error，但因为冷载失败，内容与打印几何的新断言尚未执行。

## 观察到的主要工作

- `runtime-process-tasks` 文件 CPU 自耗 453.2 ms，其中 `Jn` 裁床来源重建 315.3 ms。主要 qualified caller 是 `material-slip-template` 模块顶层构造示例常量，调用普通工序 `j`、裁片 `G` 等来源，经过 PDA cutting 列表、warehouse runtime `H` 到 `Jn`。这些栈发生在模板导入初始化，不属于后道出货的五 SKU 排版。
- PCS 配置复制函数 `Y` 自耗 120.1 ms。实际调用链为 PMS purchase suggestions 初始化 → material requirements → canonical purchase references → techpack → config options。PCS techpack 文件自身另有 102.4 ms 自耗；包含耗时与文件自耗不能混加。
- 真正后道 hydrate `Me` 包含 53.7 ms。原冷载只有一次 D10 完整读取，耗时 164.3 ms；未发现两次 D10 ensure。之前大量 PMS readonly、PCS baseline 和相关初始化位于该次冷载前段。
- `print-preview` 的实际渲染或后道 print-job 映射没有形成超过 10 ms 的已定位 CPU 主栈。没有启用精确调用计数，不能将 sampling 节点或 hitCount 写成渲染、job 映射的调用次数。

## 证据

`qualified-generic-print-diagnosis.json` 保存 V8 timeDeltas 加权耗时；`qualified-job-source-callers.json` 保存模板顶层、PDA cutting、仓库、裁床来源及 PCS/PMS 的完整 qualified 栈。`cpu-print-GENERIC_OUTBOUND-1000-cold-1.cpuprofile` 是原始 profile。`report.json` 保留实际 URL、资源、事务和完成阶段。

`binding.json`、源清单副本、原脚本副本和 `runtime-assets/` 保留当次 `3d1ba8f2…` manifest、`b0061de5…` dist index、`8341beb5…` harness 及加载资产原字节。原三种专用出货/条码/吊牌在相邻校准目录通过内容、几何及新 PDF，但本轮未对通用来源声明通过，也未复用旧 PDF 毫秒。

诊断后浏览器已关闭，未修改产品或采集器，没有继续 generic barcode、额外三种打印冷载、15 路预检或正式 100 家族 / 520 样本。
