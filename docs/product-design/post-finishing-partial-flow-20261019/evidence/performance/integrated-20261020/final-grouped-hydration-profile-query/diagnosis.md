# 后道列表查询的材料来源重复计算

这是同一最终分组读取资产的故障定位。无 Profiler 的列表查询 **1898.3 ms > 1000 ms** 在相邻 `final-grouped-hydration-calibration-delta/report.json` 保留；本目录带 Profiler 查询 1957.8 ms，不覆盖原失败，不作为正式验收。程序按原顺序完成了前七个校准家族后只对查询启用 Profiler，没有继续重置、翻页或后续正式家族。

固定 D10 为 100 个加工父单，查询第一个父单完整单号 `PO-QC-202608-001-1-ZJ-HD`。真实事件为可信按钮 click 加原生 submit；最终筛选结果为一个父单、一条列表行，统计与分页总数一致，4000 个完成记录原生回读有效，五张对象图片已加载。实际角色签责和历史承接校准已成功，但不能由此声称完整正式包通过。

## 主栈

实际列表 renderer `work-orders-De1W33Gj.js` 的 `oe` 包含 CPU **1546.8 ms**。其先对全部 100 个父单执行映射，再筛选。映射的直接子项为：

| 子项 | CPU 包含耗时 |
| --- | ---: |
| 材料可用情况 `Po` | 1465.6 ms |
| 完整加工进度 `Z → ot(true)` | 58.6 ms |
| 单条回货快照 | 1.5 ms |
| 单条质检快照 | 1.5 ms |

材料路径有两个按实际调用次序执行的部分：

1. `adapter.readiness → preparationFor → listAccessoryPreparations → material prep projections`：1083.5 ms，其中 material prep 投影 868.7 ms。
2. readiness 没有返回可用结果时，原材料回退 `listMaterialTransferOrders → ownsProduction → scoped owned production query`：380.6 ms。

该固定夹具的 100 张原回货属于同一已评审生产单，因而同一生产单材料来源被列表父单映射反复读取。CPU sampling 的节点数不是函数调用次数；100 父单的迭代范围由当前数组映射和固定夹具共同确定，不冒称由 hitCount 计出了调用次数。

当前只有一条列表 renderer 的 qualified 入口，来自 `route-renderers-fcs`。动作事务只有一次完整 D10 读取，没有第二次全量读取；现有证据不支持把慢值归于重复整页渲染。没有 handler error。上述包含耗时互相重叠，不能随意相加。

## 证据

- `report.json`：实际事件、URL、持久回读、图片、事务和完成阶段。
- `cpu-list-query-1.cpuprofile`：原始 profile。
- `qualified-query-diagnosis.json`：材料来源、prepared sources、fallback ownership 的实际函数栈和源片段。
- `query-render-callers.json`：列表 renderer 入口和映射调用者。
- `binding.json`、源清单副本、脚本副本和 `runtime-assets/`：当次 `feb915d5…` 源清单、`1f454460…` dist index、`8341beb5…` harness 及原始加载资产。

诊断后浏览器已关闭。没有修改产品或采集器，没有减少 D10、改变数据归属、放宽门槛或启动正式 100 家族 / 520 样本。
