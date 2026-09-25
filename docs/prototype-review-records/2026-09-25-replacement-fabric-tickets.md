# 换片布菲票打印与交出联动原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-25 |
| 相关需求 / 任务 | 换片布菲票产品方案92条；继续完成整体逐项验收 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS/FCS/PDA/统一打印/本机数据管理 |
| 涉及页面路径 | 第7节命名路由及28组场景矩阵 |
| 端类型 | 管理端、裁床员工执行端、接收工厂端 |
| 主要角色与任务 | 打票员固定5Yard备布；仓管按任务随裁片同次交出；接收工厂回看原票及历史快照 |
| 分支 / 基线 | codex/replacement-fabric-acceptance-20260925 / 5ba805510f3cf70339db6e3ddd072b9c5d255a01 |
| 工作树 / 服务 | /private/tmp/higoods-replacement-fabric-release-20260925；dev43235、build21 preview43236 |
| 验收设备 | 管理1366×768/1280×720、低分辨率1024×768、PDA360×800/390×844；各命名场景单独绑定 |
| 源码manifest | build21，1240个src，04165095824efc064c2e26ef942150c79e1b17f814c2e886ddf7346a0f2f0913；主代理逐文件确认一致 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增换片布菜单/票列表/标签；固定5Yard与独立新增/补打；三类型混装分单位；当前任务/工厂需料与同次交出；Web/PDA/接收回执；源记录/附件/票/袋原子保存及失败恢复。
- 按当前治理基线 [AGENTS.md](../../AGENTS.md) 第2.4、3.1、4、5、7节验收。单浏览器原型，不代表真实工厂业务、云端共享数据库或物理出纸完成。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 真实角色阻断、三合一排除、Web/PDA主动作及指定尺寸 |
| 文案、状态、数量与单位 | 通过 | 5Yard不可改；片/米/Yard分别汇总；700/200/720片与新/旧面料覆盖 |
| 扫码、真实图片与对象识别 | 软件通过／实物待确认 | 软件唯一票扫码、正确面料图、故障阻断/重试、大图关闭已验；D04实物待用户 |
| 防错、危险确认与主管兜底 | 通过 | 缺票/占用/跨单/重复/权限/改派旧页阻断；事务失败保留和重试 |
| 交接、跨端事实与异常追溯 | 通过 | 同次交出、多袋并集/自动归集、同任务后批、不同工厂、历史回执和旧周期标签 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 指定设备实际任务、Blob附件、失败输入保留；没有真实离线队列要求 |
| 命名路由、交互、图片大图与打印 | 软件通过／实物待确认 | build21软件全部通过；D04物理标签现场接受未收到 |
| 存储与迁移 | 通过 | 登记7类生产源/8票来源/管理事件/Blob、complete/CAS/迁移/备份；未迁移库存边界明确 |
| 页面与交互性能 | 通过 | 28组全部通过，1280计时样本max463ms、issues=[]；无豁免、保留所有慢样本 |

## 4. 问题标签

- 缺扫码识别：仅D04实物纸票与现场扫码证据尚缺；软件识别已验。
- 追溯不足：仅产品现场接受与最终发布回执尚未取得，不影响已关闭的软件技术场景。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧业务存储及保存失败 | 协作断裂 | 仓管/打票/工厂 | 记录级同库complete/CAS、显式迁移读回清理、Blob引用/备份与真实失败重试 | 登记范围已过；未迁移库存仍如实读取，不称全站迁移 |
| 同assignment多料/双袋自动归集 | 选不对 | 仓管 | 按精确面料范围及完整任务袋集合；缺项与成功实际UI重放 | 已由边界r8/r5及build21双袋120复验 |
| 历史周期/时间与旧票复用 | 状态抽象 | 仓管/接收厂 | 原周期快照/本地时间一致；回收不恢复已交票 | r10与build21标签/生命周期复验通过 |
| 无关打印registry、Esc全局加载 | 视觉干扰 | 打印人 | 两类袋标签直达原builder；图片overlay捕获Esc并停止传播，避免无关FCS加载 | build21五次Esc及随后故障反馈全部通过；自动重试旧归因已修正 |
| 坏图片仍打印 | 缺扫码识别 | 打印人 | 原图片frame/失败提示/显式重试/大图及验证打印门禁 | build21增强115样本通过，含实际打印/PDF及失败阻断 |
| 待交出开窗全量计算 | 视觉干扰 | 仓管 | 精确路由原handler直派，按action计算必要model，保留资格 | build21双袋120/袋弹窗30全部通过 |
| 物理标签耗材与纸面读取 | 缺扫码识别 | 打票/仓管 | 软件100×100mm、长字段/1001号/PDF与扫码解码已验 | D04外部阻塞，用户未答复 |

## 6. 最终结论

结论：有条件通过

软件技术验收关闭，92条中90条已验证。PRINT001/002因D04现场条件已阻塞，产品实物及accepted未被软件结果替代。主代理已亲核92个条款与完整相关diff；没有尚待补做的软件功能或性能场景。

最后tracked文档/证据冻结后仍须执行最终workflow，预期收据`output/playwright/hpb/acceptance-final/task-receipt-final-frozen.json`。此刻不预记最终workflow或main/GitHub发布为通过；最终收据留output避免自引用diffHash变化。

## 7. 变更覆盖与验证

### 受管文件

以下110个用户可见文件由本任务审查；同事菜单图标提交仅为基线，不认领为本需求变更。

- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/cutting/cut-piece-return-domain.ts`
- `src/data/fcs/cutting/cutting-event-migration.ts`
- `src/data/fcs/cutting/cutting-event-repository.ts`
- `src/data/fcs/cutting/cutting-event-scope.ts`
- `src/data/fcs/cutting/cutting-file-maintenance.ts`
- `src/data/fcs/cutting/cutting-record-identity.ts`
- `src/data/fcs/cutting/cutting-record-repository.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/manual-fei-tickets.ts`
- `src/data/fcs/cutting/marker-plan-source.ts`
- `src/data/fcs/cutting/material-ledger.ts`
- `src/data/fcs/cutting/part-ticket-records.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/replacement-fabric-repository.ts`
- `src/data/fcs/cutting/replacement-fabric-scan.ts`
- `src/data/fcs/cutting/replacement-fabric-source.ts`
- `src/data/fcs/cutting/retired-cut-piece-pickup-history.ts`
- `src/data/fcs/cutting/runtime-inputs.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts`
- `src/data/fcs/cutting/simple-cut-piece-handover.ts`
- `src/data/fcs/cutting/spreading-material-readiness.ts`
- `src/data/fcs/cutting/transfer-bag-goods-label.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/cutting/transfer-bag-repack-mock.ts`
- `src/data/fcs/dispatch-task-sheet.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/garment-spu-replacement.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/production-context-actions.ts`
- `src/data/fcs/production-context-records.ts`
- `src/data/fcs/production-contracts.ts`
- `src/data/fcs/production-created-process-source-types.ts`
- `src/data/fcs/production-created-process-sources.ts`
- `src/data/fcs/production-order-demo-tech-packs.json`
- `src/data/fcs/production-order-runtime-store.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/production-task-breakdown.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/sewing-cut-piece-responsibility.ts`
- `src/data/fcs/sewing-cut-piece-return-workflow.ts`
- `src/data/fcs/sewing-material-handover.ts`
- `src/data/fcs/sewing-outsourcing-demo.ts`
- `src/data/fcs/sewing-outsourcing-responsibility.ts`
- `src/data/fcs/sewing-outsourcing-return-tracking.ts`
- `src/data/fcs/sewing-outsourcing-workbench.ts`
- `src/data/fcs/sewing-sample-approval-suggestion.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/wool-domain/cutting-receipts.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/pda-cutting-spreading.ts`
- `src/pages/pda-cutting-task-detail.ts`
- `src/pages/pda-cutting-transfer-bag-recovery.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-cutting-transfer-bag-scrap.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-shell.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/replacement-fabric-preview.ts`
- `src/pages/print/task-delivery-card.ts`
- `src/pages/print/task-route-card.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/process-factory/cutting/craft-trace-projection.ts`
- `src/pages/process-factory/cutting/cut-orders-model.ts`
- `src/pages/process-factory/cutting/fei-ticket-print-projection.ts`
- `src/pages/process-factory/cutting/fei-tickets-model.ts`
- `src/pages/process-factory/cutting/fei-tickets-projection.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/pages/process-factory/cutting/marker-plan-occupancy.ts`
- `src/pages/process-factory/cutting/marker-plan-projection.ts`
- `src/pages/process-factory/cutting/marker-plan.ts`
- `src/pages/process-factory/cutting/marker-spreading-projection.ts`
- `src/pages/process-factory/cutting/marker-spreading-submit-actions.ts`
- `src/pages/process-factory/cutting/marker-spreading.ts`
- `src/pages/process-factory/cutting/material-prep-model.ts`
- `src/pages/process-factory/cutting/replacement-fabric-data-tools.ts`
- `src/pages/process-factory/cutting/runtime-projections.ts`
- `src/pages/process-factory/cutting/traceability-projection-helpers.ts`
- `src/pages/process-factory/cutting/transfer-bags-projection.ts`
- `src/pages/process-factory/cutting/transfer-bags.ts`
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- `src/pages/process-factory/cutting/transfer-bags/state.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/production-context-recovery.ts`
- `src/pages/production-contract-print.ts`
- `src/pages/production/confirmation-print.ts`
- `src/pages/production/context.ts`
- `src/pages/production/demand-domain.ts`
- `src/pages/production/events.ts`
- `src/pages/progress-handover.ts`
- `src/pages/sewing-outsourcing/responsibility-transfers.ts`
- `src/pages/sewing-outsourcing/sample-approval-suggestions.ts`
- `src/pages/simple-cut-piece-handover-ui.ts`
- `src/pages/unified-dispatch-workbench.ts`

### 命名路由

下列路径来自build21实际浏览器脚本，动态ID为隔离Mock场景；登录使用既有PDA Mock账号，不将本原型表述为免登录。

- `/fcs/craft/cutting/replacement-fabric-fei-tickets`、`/fcs/craft/cutting/fei-tickets`、`/fcs/craft/cutting/marker-list`、`/fcs/craft/cutting/spreading-list`。
- `/fcs/craft/cutting/warehouse-management/wait-handover`、`/fcs/craft/cutting/handover-orders`、`/fcs/pda/cutting/simple-cut-piece-handover`。
- `/fcs/craft/cutting/transfer-bags`、`/fcs/craft/cutting/transfer-bag-detail`、`/fcs/pda/transfer-bag-detail`。
- `/fcs/pda/cutting/inbound/TASK-CUT-PDA-CUT-DONE-0307`、`/fcs/pda/cutting/transfer-bag/repack`、`/fcs/pda/cutting/transfer-bag/recovery`、`/fcs/pda/cutting/transfer-bag/scrap`。
- `/fcs/print/preview`：按真实标签单据参数覆盖换片布、部位票、中转袋及历史货物标识，包含打印/PDF、图片门禁与大图。
- `/fcs/dispatch/workbench?type=NON_SEWING`、`/fcs/dispatch/tenders`、`/fcs/sewing-outsourcing/sample-approval-suggestions`、`/fcs/sewing-outsourcing/responsibility-transfers`。
- `/fcs/contracts`、`/fcs/progress/handover`、`/fcs/pda/task-receive`、`/fcs/pda/exec`、`/fcs/pda/handover`。

精确动态路径、selector、前置和计时终点见归档[主链路由脚本](../product-design/replacement-fabric-evidence/2026-09-25/acceptance-completion/acceptance-final/check-routes.js)、[来源路由脚本](../product-design/replacement-fabric-evidence/2026-09-25/acceptance-completion/acceptance-source-ui-final/check-perf-final.js)及[28组矩阵](../product-design/replacement-fabric-evidence/2026-09-25/acceptance-completion/scenario-matrix-build21.md)。

### 验证命令

- `npm run build`：通过，build-final-21.log，566/566单元、Vite9.99秒。
- `npx tsc --noEmit`：失败，仅原有6处基线错误：dye-work-order-online-view两处、factory-receiving-source-sync一处、pms/tmf-material-purchases三处；tsc-final-21与原基线一致，无本任务新增。
- `npm run check:list-page-governance`：通过，list-governance-final-r3.log；偏好失败使用默认值、业务首次不可读必须报错两项均保留。r2缓存前置误断言失败归档。
- `npm run check:prototype-design-governance -- --all`：通过，governance-doc-update-r2.log，110用户可见文件；最后文档格式由冻结workflow再次核验。
- `workflow:verify`：未运行最终冻结版；历史workflow-final-16-r2已通过，不能代替最后diffHash收据。
- `git -c core.whitespace=trailing-space,space-before-tab,-blank-at-eof diff --cached --check -- . ':(exclude)docs/product-design/replacement-fabric-evidence'`：通过。原始归档日志的行尾空白不改写，1110份归档另以SHA256逐文件校验通过；不代替业务验收。
- 核心/迁移/附件/来源/动作资格专项：通过，实际日志与28组build21真实浏览器结果绑定归档，不用核心契约替代适用UI。

### 真实图片验证

面料图片读取同生产单冻结技术资料，示例/materials/fei-ticket/grey-main-fabric.png；款图使用同单技术包。图片与款/料身份同区域显示，来源和画面联合核对。build21验证正常加载、大图及三种关闭、损坏/缺失阻断打印、显式重试后复打、PDF调用；货物标识本无条码，不虚构条码要求。真实PDF/软件二维码解码不替代现场实物扫码。

### 例外

- 无性能豁免，全部适用计时小于500ms，未删除慢样本。唛架仅禁15个已迁移键、完整库存仍读未迁移收料事实，是明确存储范围边界；HPB/部位票打印/已迁移交出按禁全部localStorage验收。

### 正反向追踪与证据

[实施追踪](../product-design/换片布菲票实施追踪-2026-09-24.md)、[28组场景矩阵](../product-design/replacement-fabric-evidence/2026-09-25/acceptance-completion/scenario-matrix-build21.md)、[规范章节追踪](../product-design/replacement-fabric-evidence/2026-09-25/acceptance-completion/requirements-trace.md)、[归档索引](../product-design/replacement-fabric-evidence/2026-09-25/acceptance-completion/README.md)相互绑定。主代理已完成正反向语义审查；没有新增可变长度、独立换片布交出、自裁三方业务或后端。原失败及根因修正保留在迭代历史与原始产物。
