# PDA 接单冷启动的最小等价优化

范围：`pda-task-receive.ts`、`process-mobile-task-binding.ts`、`printing-task-domain.ts`、`dyeing-task-domain.ts`；新增专项 `pda-receive-preparation-scope.test.ts`。共享工作树和分支沿用最终验收工作树，代码尚未提交。最终生产构建性能需由 build9 复验，本记录仅解释代码和 dev 诊断。

接单入口将当前工厂传入印染任务投影，按完整静态及已恢复加工单的真实 `printFactoryId` / `dyeFactoryId` 筛选。当前工厂没有该域加工单时，跳过该域的执行/接收进度初始化；仍读取来源与已保存覆盖，未按工厂能力猜测空列表。**若当前工厂存在该域加工单，仍调用原 `syncDerivedWorkflow` 全域同步，再返回本厂任务；本次没有改成只同步本厂记录。**

保留完整 canonical 任务身份集合，继续排除相同身份的旧基础/运行时任务；特殊工艺仍全量读取，序号仍按完整 canonical 数计算。其它页面调用不带第二参数时保持原路径。四个接单 Tab 与待办逻辑不变。读取失败继续由原源报错，不替换为空源。

证据：

- `pda-preparation-scope-unit-r2.txt`：3/3 专项通过；在所有当前有任务的工厂，比较完整本厂任务对象、待接单任务及中标任务，与原全量投影结果一致，断言至少 30 条非空事实。
- 首轮专项 `pda-preparation-scope-unit.txt` 发现特殊工艺 `seq` 偏移；已修正完整身份数，原失败保留。
- `pda-preparation-scope-dev-r2.txt`：真实浏览器 6 工厂任务身份/数量/状态与待接单/中标等价，四个 Tab 实际打开，无 console/page error。首轮 JSON 属性插入顺序比较误差原件保留；第二轮采用稳定键排序，没有剔除业务字段。
- `pda-accept-scoped-dev.txt`：真实管理端分配 3391 片到 OWN-CUTTING-001，PDA 接单成功，执行卡和刷新后身份/数量一致；分配 98.5 ms、接单 253.2 ms，无错误。属于真实 UI 操作证据，不是直接调用数据动作。
- `pda-receive-diagnostic-scoped.txt`：dev 3 次冷启动 450.1 / 440.5 / 479.1 ms；刷新 314.6 / 309.9 / 314.7 ms；站内进入 177.9 / 177.9 / 180.0 ms。非最终生产版严格门禁证据。
- 根代理旧 CPU profile `../acceptance-final/pda-receive-profile-build8-r2.txt`：接单页面计算 159.18 ms、移动任务投影 144.12 ms、印花 41.01 ms、染色 40.47 ms；同脚本后测 `pda-receive-profile-scoped.txt`：分别 135.40 / 121.13 / 34.99 / 26.22 ms。profile 总时长 548.5→472 ms，仅用于定位，不替代页面 5 样本门禁。
- `pda-scope-tsc.txt`：仅既有 6 个类型错误，无本次新增错误；`git diff --check` 通过。

旧 build8 冷启动 613.1 ms 慢样本仍留在 `perf-build8.txt`，不得用本 dev 结果覆盖。build9 需复验接单 cold/refresh/navigation 各 5 次及接单真实动作。没有减少 Mock 数据、任务数量、门槛或将 Loading 当终点。
