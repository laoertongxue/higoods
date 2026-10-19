# 最终 ecc 资产的 PDA 冷载诊断

这是故障定位记录，不是正式性能验收，也不把带 Profiler 的数字当作不带 Profiler 的验收结果。

- 原有效冷载失败：`../final-ecc-calibration-pda/report.json`，**1219.1 ms > 1000 ms**。stop-first 后没有继续刷新、导航或正式采样。
- 同一固定 D10、同一 F090 会话、同一生产预览资产的 CPU 诊断：冷载 **1265.5 ms**，Profiler 总时长 1318.0 ms。
- HEAD 为 `ecc8af013b5f9d67f5fef14fe5b692483aada61d` 加当前任务源码。`binding.json` 记录源清单、脚本、索引、固定夹具及实际加载资产的 SHA256。131 份加载资产的原始字节保存在 `runtime-assets/`，避免后续重建覆盖定位依据。
- 固定主集仍是 100 加工单、4000 加工完成记录、1000 复检、1000 出货、900 实收；没有减少数据、改工厂或调整门槛。

## 实际主栈

使用 V8 `timeDeltas` 加权。包含子调用的耗时相互重叠，不能相加；采样不能证明精确调用次数。

| 已确认调用链 | CPU 包含耗时 | 含义 |
| --- | ---: | --- |
| `accessory-warehouse-post-finishing` 的 `J` → `ie` | 227.5 / 209.5 ms | `ie` 在读取候选材料前先构建 `new Set(b().flatMap(...))`；来源读图继续进入 accessory sources、material prep、printing/dye、handover。 |
| 当前 PDA 详情 `de` → `E` | 312.1 / 288.1 ms | 是当前详情实际渲染，不属于后台主 Tab 预载。 |
| 当前详情 link → overview `Mt` | 168.1 ms | `PROCESS_DOC` 索引，内含后道任务投影 129.1 ms，仍会计算实际关联任务与进度。 |
| 当前详情 → PDA shell → header → todo count | 74.8 ms | marker/cutting/handover 的部分结构克隆实际来自当前页待办计数。 |

`post-finishing-full-flow` JSON 克隆自耗合计 110.7 ms，分布于关系校验、当前详情子单、任务投影和进度，不能把它全归给某一个入口。`pda-handover-events` 文件自耗合计 253.2 ms，也分布在前置来源图和当前 header，多数不是预载。

原冷载失败样本只出现 **一次 D10 全库读取**，耗时 167.3 ms；旧版两次完整读取已消失。其余小 readonly 事务不超过 2.1 ms。原样本完成阶段是 ready 1185.7 ms、原生持久回读 23.6 ms、绘制 9.7 ms，没有 handler error。

## 后台预载与当前必要工作的区分

原样本末端 1147–1166 ms 出现 `pda-settlement`、`pda-warehouse`、`pda-accessory-post-access` 等资源请求，单请求最长 18.4 ms。CPU 诊断的时间轴在 1100–1200 ms 仍能明确追到当前详情 → shell header → todo count；1200 ms 后主要是 idle、program、原生回读和 DOM 绘制，未发现足以证明超过 200 ms 的预载同步重栈。因此当前证据不支持仅停止后台预载就能消除该次 219 ms 超标。

最大可定位的前置成本是材料桥 `ie` 在无实际候选时仍先计算归属来源。是否可在确认没有候选后免算来源集合，由主代理按原归属和错误拒绝契约核定；本代理未改产品源码，也未删除染色、PPIC 或真实待办输出。

## 原始证据

- `report.json`：实际导航样本、完成阶段、事务、资源和资产身份。
- `cpu-pda-exec-detail-cold-1.cpuprofile`：原始 V8 profile。
- `weighted-qualified-diagnosis.json`：加权文件、自耗与包含耗时。
- `qualified-entry-caller-summary.json`：详情、材料桥、投影与克隆调用链。
- `qualified-handover-callers.json`：handover 的实际调用者与源码片段。
- `profile-timeline.json`：时间窗口和末端栈；Profiler 相对时间不冒充 navigation 的 `performance.now()`。
- `binding.json`、`source-manifest-at-profile.json`、`harness-at-profile.mjs`、`runtime-assets/`：当次版本与原始脚本字节。

诊断后浏览器已关闭，没有继续刷新或导航，也没有开始正式 100 家族 / 520 样本采集。
