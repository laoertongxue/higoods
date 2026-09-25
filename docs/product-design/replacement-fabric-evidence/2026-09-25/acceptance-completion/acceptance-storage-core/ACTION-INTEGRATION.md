# 上游真实动作事务接入专项交付

工作树 `/private/tmp/higoods-replacement-fabric-release-20260925`，分支 `codex/replacement-fabric-acceptance-20260925`，基线 `3a3d16481156a8858155f992aab492cd2cf6bfde`。本记录为共享工作树未提交改动专项，源码散列见 action-source-manifest.json，不代表产品整体验收完成。

## 实现范围

- source action 将运行任务、生产单、有效分配、样衣、合同/扫描件、责任归属、SLA、物料交接、回货规则、竞价、合并特殊工艺失效记录、拆解 processTasks 的实际差量纳入同一 IndexedDB 事务。动作计算后立即还原旧内存，等待事务 complete 后发布新状态。记录按实体分拆，未修改静态默认记录不落盘。
- 合同/样衣的 data URL 在事务前转换为原始 Blob，记录与 command.result 仅存 `$productionFile` 引用；按字节指纹复用，临时 object URL 只用于当前会话预览。迁移附件读回核验字节指纹后才清理旧源。删除文件仍需父任务统一全引用清理入口，动作不擅自删除文件。
- saveProductionSourceAction 支持额外 capture/restore/prepareChange/CAS guard 参与者，以及 events 模式，将裁片开工事件与 runtime/production 状态一次提交。
- 已包装的 UI：统一任务直接派单/改派/竞价/自动分配/合并撤销/合同重试与扫描件维护，竞价定标与取消，PDA接单/开工与裁剪开工完成，样衣接收/交接/反馈/建议提交，PPIC责任转移，合同打印前确认。成功提示/关闭对话框位于 await 之后；失败保留输入。自动分配任一条失败整批撤回，避免 runtime 已派而有效分配失败。
- fixtures 仅使用明确静态 helper，禁止页面读操作自动写有效分配或样衣。到期自动接单为所有浏览器消费者一致的时间推导，含 staged动作与直达读取；不改源记录，不生成虚构的自动接单审计。
- codec新增runtime静态删除标记、COMPLETE迁移历史不约束后续合法删除、7来源的实体验证、附件引用与生产创建匹配来源验证。

## 当前证据

| 证据 | 结果与边界 |
| --- | --- |
| action-unit-final-3.txt | 75/75通过（32 codec +43 TMF），含Node window-only替身兼容、来源损坏阻断、生产匹配身份校验 |
| action-browser-final-4.txt | 5/5真实浏览器场景通过：assignment commit/abort重试/command幂等、禁LS刷新恢复、附件迁移、event/runtime commit/abort；写request阶段核对内存仍为旧值；abort记录与Blob均无半套 |
| ui-assignment-final.txt / ui-cutting-assigned.png | 1366×768实际统一分配页面，PO14671裁片任务分给PT Mulia Cutting Center、1000 IDR/件，提交后刷新同一分配和价格，pageerror为空。此证据不冒充自营裁床/改派/整链打印验收 |
| read-projection-results-3.txt | 到期任务接受结果正确、acceptedAt=保存的deadline、源/生产单/审计不变 |
| action-foundation-final.txt / action-sample-final.txt / action-task-sheet-results-2.txt / action-ppic-results-2.txt | 分配基础、样衣、任务单、PPIC专项通过；其运行早于最后纯校验/到期投影微调，最终集成仍由父任务统一复验 |
| action-typecheck-final.txt | 仅6处既有范围外错误（dye-work-order-online-view×2/factory-receiving-source-sync×1/tmf-material-purchases×3），本范围无TS错误 |

所有原始失败样本保留：Vite独立query模块副本造成早发断言、错误测试任务不满足开工门禁、首次恢复卡、旧只读任务单外层写入等，后续修复或单入口harness替代均有新证据，没有覆盖隐藏旧输出。

## 父任务收口项

- main所有新增async处理器必须await；生产创建与交出由父任务/其他子任务集成。本子任务未修改其负责文件。
- PDA markPdaHandoutHeadCompleted 的 factoryCompletionRequired 回归已修复：runtime DONE 与工厂结束单条事实同context动作，普通交接数量仍读取旧来源；两个UI await。
- 首次仅source保存后禁LS的初始化缺口已收口：核心锁内 prepareSnapshot 使用同一当前数据库快照 hydratePartTicketRecords + prepareManagedScope；同事务附 part/scope/archive 初始化记录，提交时同时断言旧源未变。非events动作同样执行。
- 此专项未完成真实自营裁床分配→新增票→改派离开→PDA交出→打印整链、性能或全项目构建；父任务必须按最终生产build统一验收。

## 后续初始化修复复验

`ui-source-init-no-ls.txt`：新隔离浏览器只做一次真实页面派单，随后令 Storage.getItem/setItem 全部抛错并刷新，主入口及任务列表正常，原分配工厂和冻结价格仍在，pageerror为空。`source-init-actions.txt` 五场景全部通过（含首次初始化记录一并中止后0记录），`source-init-unit.txt`32/32，`source-init-types.txt`仍只有旧范围外6错。最后修改仅actions/core两文件；git diff --check通过。

## 后续工厂结束回归修复

新增 `factory-completion:<handoverId>` effect 仅允许 handoverId/taskId/completedAt/completedBy；codec拒绝数量/明细等额外字段。`markPdaHandoutHeadCompleted` 在工厂结束分支使用稳定结束命令，和 runtime DONE 同事务。头摘要从该事实合成工厂结束状态，原接收状态及交出数量不复制、不改写；普通非工厂完成分支保持原动作。PDA详情、进度交接处理器等待返回后提示。旧检查脚本将相应断言/main改为await，避免对Promise作同步假断言。

`completion-final-2.txt` 使用真实浏览器/IndexedDB和显式受控Mock交接头，验证提交前头与任务不提前变化；提交成功后fresh reload从原旧头源加新结束事实恢复，task DONE、factoryMarkedComplete=true、原交出100件不变；重复命令保持首次时间；注入abort后0记录且头/任务均原状；整个结束动作的Storage.setItem调用为0。该证据是受控Mock动作事务与刷新一致性证据，不冒充真实工厂交接或两页点击验收。

`completion-unit-final.txt`33/33通过；`completion-types-final.txt`本范围无类型错误、仍仅旧范围外6错；`git diff --check`通过。`completion-pda-pages.txt`旧专项在import阶段因wool-task-domain缺少resetWoolFactWorkflowMock导出停止，未执行断言；没有为通过而跳过检查。父任务已接收该阻断。
