# 整合 main eb1b8c92 后的 PDA 冷载诊断

固定主集与 F090 身份不变。原未开启 CPU Profiler 的有效校准为 cold 1,603.5ms、refresh 1,508.7ms、navigation 882.2ms；该轮绑定当前整合资产，不能用前一工作树数据替代。全部旧慢值保留。

本次 CPU 诊断响应为 cold 1,726.0ms、refresh 1,590.6ms、navigation 882.5ms；Profiler 总持续 1,787.458ms / 1,687.508ms。只用于根因诊断，不计正式验收。原始 profile、资源时间、事务日志与 `weighted-qualified-diagnosis.json` / `main-preparation-stacks.json` 保留。

已测优化有效：PDA 详情入口 inclusive CPU 从前一版 558/528ms 降到 330/302ms；F JSON clone self 从 203/205ms 降到 121/129ms。编号目录仍有 175/163ms，其中后道 PROCESS facts 134/124ms。新增长延迟位于页面渲染之前的共享准备。

**实际出现两次后道大集 readonly：**

| 路径 | 第一次全读 | 第二次全读 |
| --- | --- | --- |
| cold | 376.2→549.3ms，173.1ms | 656.5→828.8ms，172.3ms |
| refresh | 295.4→462.0ms，166.6ms | 569.3→741.0ms，171.7ms |
| navigation | 2,441.2→2,593.0ms，151.8ms | 2,683.0→2,854.5ms，171.5ms |

普通 ensure CPU inclusive 合计也上升到 196.2/195.7ms，内部 validator 回调 94.0/90.1ms。此前版本各只有一次全读。此为实际事务证据，独立于 CPU 不能精确计函数调用次数的限制。

**新增同步主栈约 342.3ms inclusive（cold）：**

`accessory-warehouse-post-finishing.prepare → F.set adapter → F.owned-material snapshot → ownsProduction → getPreparation → accessory-warehouse-sources.getPreparations → production-material-prep projection → printing/dyeing source getter → handout 投影`。

各限定资源/位置：

- `accessory-warehouse-post-finishing-IPO_1S3P.js`，`K` line 0 column 8398，安装 adapter 时调用 `ownsProduction`。
- `post-finishing-full-flow-DmdBqrqH.js`，`wo` column 36895 / `Ue` column 36530，快照过滤会调用 adapter 的 ownership。
- `accessory-warehouse-sources-B3QUiAMG.js`，`Y` column 7692，构造 preparation 来源。
- `production-material-prep-BE6OPHMq.js`，`G` column 92219 / `de` column 37951 / `u` column 38612，生成来源投影并读取工艺任务。
- `printing-task-domain-CoJCPadK.js`，`cc` column 199447，进入染色/印花来源 getter；随后 public handout 投影产生额外 CPU。

`main-preparation-stacks.json` 包含完整带源码片段的根栈。结论来自当前资产真实执行，不能据“D10 持久备份无材料活动行”推断 adapter 安装不产生来源目录工作，也不预先把专用 mixed 迁移 helper 当根因。未对产品源码做修改；浏览器已关闭，等待主代理依据该根因作最小修复后重建。
