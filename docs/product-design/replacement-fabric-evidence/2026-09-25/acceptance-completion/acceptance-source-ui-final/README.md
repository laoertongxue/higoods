# 生产来源动作最终验收证据（进行中）

工作树：`/private/tmp/higoods-replacement-fabric-release-20260925`；分支 `codex/replacement-fabric-acceptance-20260925`；HEAD `3a3d16481156a8858155f992aab492cd2cf6bfde`。Preview 43236 由主代理统一构建，dev 43235 仅用于故障定位与功能回放，不作为最终性能。

## 已保留的失败与修正

| 证据 | 事实与处理 |
| --- | --- |
| routes-build2.json | 8 条可读路由 × 冷启动/刷新/导航 ×5 =120 个有效样本，最大467.5ms；PDA执行5次使用不存在于空列表的动作选择器超时，不能算作加载慢。最终脚本已用页面根+搜索输入，另有真实接单任务场景。 |
| actions-build2.json | 派单5次选择F090失败是该任务工厂下拉没有此选项；已按实际HiGood裁床厂OWN-CUTTING-001修正。 |
| actions-build2.json / scope-tender-dev.txt | legacy定标成功但刷新丢失，已接入effects记录；dev真实确认与刷新显示已定标。 |
| sample-refresh-stack.txt | 样衣接收/移交保存成功后刷新失败，原因静态fixture命令重放到已移交记录。 |
| sample-refresh-fixed-dev-2.txt / sample-fixture-unit.txt | 静态基线隔离后叠加用户覆盖；真实上传、接收、移交、刷新后样衣照片1张/待领取一致；专项1/1验证命令去重及异常恢复。 |
| scope-dev-4.txt | 真正进入裁床产生3种面料待打印票；A新增1张后整任务改派离开，列表移除，A001/002历史不可操作。测试误要求未持久化B/C派生票也出现在历史，已按数据来源修正。 |
| pda-accept-dev.txt | 真实派单、该厂账号登录、接单确认、执行列表看到原任务；待接收来料使开工按钮依法阻断。 |

## 最终脚本

- `check-perf-final.js`：9路由×3访问方式×5样本，端口43236；Web1366×768、PDA390×844，可读内容与视口图片完成后两帧，不以Loading为终点。记录consoleerror与pageerror。
- `check-actions-final.js`：派到HiGood裁床→默认票→新增独立票→整任务改派离开→历史不可操作；legacy定标及刷新；样衣真实文件接收/移交及刷新。每场景5个新浏览器上下文。
- `check-pda-accept-final.js`：Web真实分配→PDA真实账号登录→确认接单→执行列表→刷新一致，5样本。

当前不得将 build2 或 dev 结果视为最终 build4 通过。合同打印、责任移交和工厂结束两入口须由真实可操作前置任务验收；默认空列表不冒充这些动作通过。

## 合并任务开工遗漏修复（最终编译前）

真实 preview 点击“开始生产”原先因未进入来源事务被阻断：`start-ui-probe-3.txt`。两个 MERGED 开工入口现等待同一个来源事务，已有仓库交出头由已保存 runtime 事实读出；只有真正新增的空交出单头才写 `started-handover-head` 记录，不复制交出/实收明细。

`start-failure-fixed-dev-4.txt` 为 Mock 前置（180 件、两 SKU、已接单、前置已接收）＋真实 PDA 按钮：真正 taskOverrides 写入注入失败，页面维持待开始；解除注入后同按钮重试，刷新仍为生产中待交出，IDB 单次 START_TASK，原 formal 交出键零写入，console/pageerror 零错误。前面未触发头写入的注入样本完整保留；原因是仓库来源已经按 runtime 生成交出头，不能将其记作故障通过。

`start-codec-unit-2.txt` 35/35；`start-tsc.txt` 仅既有六处错误。最终 production 严格性能仍等待统一构建后重采，以上仅功能定位与开发服务器复验，不替代最终同版证据。

## 拆解预览首读落盘修复（build8前）

`breakdown-stage-stacks.txt` 将真实生成、打开预览、确认拆解分阶段抓栈：所有旧业务写来自打开预览触发印花演示执行初始化，创建仅写页签偏好，确认拆解不写旧源。修复只改预览直接读链：`production-task-breakdown.ts` 读取加工单来源状态；`printing-task-domain.ts` 不在轻量来源读取时初始化示例收料/进度；`dyeing-task-domain.ts` 提供相同语义的来源摘要读取。

`breakdown-stage-stacks-fixed-2.txt` 原真实UI重放仅页签偏好写入。`breakdown-abort-fixed-dev.txt` 对实际确认拆解 orders put 注入失败：records/commands完全不变、预览仍在；解除后实际按钮重试，刷新产生且仅产生两个2400件任务。`breakdown-source-unit-3.txt` 原生Node13/13，`breakdown-source-unit-2.txt`仓库tsx13/13；最初原生Node JSON导入兼容失败保留。最终受影响production性能等待build8。
