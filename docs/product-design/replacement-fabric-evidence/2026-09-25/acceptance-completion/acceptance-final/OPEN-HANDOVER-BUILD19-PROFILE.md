# 中转袋交出开窗 build19 实测归因及最小修改

工作树 `/private/tmp/higoods-replacement-fabric-release-20260925`，HEAD `5ba80551` 上的当前未提交产品改动，preview43236 build19。按主代理释放窗口后执行一次，不作为严格性能重跑。

## 实测

- 真实恢复 `batch-prerequisite-unbound-fabric-omission-and-retry.higcut` 后，仅点击“中转袋交出”，未提交交出。
- click `448.9ms` → 弹窗可见 `1893.8ms` → 两帧完成 `1907.7ms`，真实动作 **1458.8ms**。
- 一个长任务：开始 `571.7ms`，持续 **1322ms**。
- 本次无业务 console/pageerror；新增 **160 个资源**，包括全局 `fcs-handlers` 和无关生产、结算、工艺等页面模块。
- 初始弹窗：1 个真实任务（`TASKGEN-202603-0002-002__ORDER`）加空选项；5 个袋（2 个验收袋、3 个既有演示袋），全部未选；PPIC 为“请先选择车缝任务”。原任务、标签、禁用状态及完整内容保存在 JSON 的 after 字段。

## CPU 时间归因

| 路径 | inclusive采样时间 |
| --- | ---: |
| FCS handler → warehouse handler → openWaitHandoverAction | 793.1ms（包含下列弹窗计算） |
| buildModel | 645.3ms |
| 未使用的 ticketOptions → listAvailableFeiTicketsForSewingDispatch | 447.4ms |
| 同一 ticketOptions 的逐票 validateFeiTicketNumberingBeforeBagging | 165.0ms |
| 全局 handler 动态 import → cut-orders → cut-order-supplement-fixture → production-object-overview | 279.2ms |

两段 ticketOptions 约 **612.3ms**，是同一 buildModel 中的独立子调用，且都只为交出弹窗不使用的“待装袋菲票”选项服务。采样匿名 filter 位置已通过 build19 dist 对应列核对，原表达式是 `sourceBasisType === WOOL_PANEL_RECEIPT || validateFeiTicketNumberingBeforeBagging(ticket).ok`。

父子 inclusive不可重复相加。Profiler包含少量工具采集开销，页面耗时以真实click起点与可读终点为准。

## 本代理修改

仅 `src/pages/process-factory/cutting/wait-handover-actions.ts`：

1. `ticketOptions` 仅装袋弹窗计算，装袋原候选、过滤、校验全部保留。
2. 特殊工艺回仓候选仅对应回仓弹窗计算。
3. 去掉当前模板从未消费的全任务 PPIC 预计算；选中任务后的 `refreshHandoverTaskContext` 原生成逻辑不变。
4. `currentUses`、任务候选、来源袋候选、票归属校验不改。

全局FCS动态导入另由主代理在main处理，此代理未改main。未增加跨动作缓存、未减少数据、未用loading替代完成。

## 已完成验证及待办

- `open-handover-conditional-unit.txt`：相关领域单元 **20/20** 通过。
- `open-handover-conditional-flow.txt`：待交出/中转袋流转专项 **266/266** 通过。
- `git diff --check` 当前文件通过。
- 原始诊断：`profile-open-handover-build19.txt/json`，完整CPU节点、样本、资源、长任务和初始弹窗内容保留。
- 旧 `batch-ui-build19.json` 的10次慢样本全部保留。
- 尚未构建、尚未测修复后耗时；交主代理统一build20，再做前后model等价核对及受影响严格验收。当前不能宣称开窗性能通过。
