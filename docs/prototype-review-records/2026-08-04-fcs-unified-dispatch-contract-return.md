# FCS 统一任务分配、固定合并任务、生产合同与回货履约原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-04 |
| 相关需求 / 任务 | 统一任务清单与任务分配；只允许“车缝+烫包”“裁剪+车缝+烫包”两类固定合并任务；含车缝任务按菲票装袋或自由分配且最小颗粒度为完整 SKU；派单价强制二次确认并冻结；生产合同生成、打印、签订扫描件与版本留痕；自然日阶段回货、每节点三次提醒与线上生产单进度；清除准备阶段任务、连续工序、产值计算和错误后道工序数据 |
| 涉及系统 | FCS、PCS、PFOS |
| 涉及页面路径 | `/fcs/dispatch/workbench`、`/fcs/process/task-breakdown`、`/fcs/contracts`、`/fcs/contracts/print`、`/fcs/production_order_track/index`、`/fcs/production/craft-dict`、`/fcs/process/print-orders`、`/fcs/process/dye-orders`、`/fcs/craft/dyeing/water-soluble-orders`、`/fcs/pda/task-receive`、相关 PDA 与打印路径 |
| 端类型 | 管理端、主管端、员工执行端、打印 |
| 主要角色 | PPIC、生产计划、跟单、三方工厂主管、裁床待交出仓人员、中央工厂人员、质检员、复检员、结算人员 |
| 主要任务 | 在一个工作台查看可分配任务、创建两类固定合并任务、直接派单或发起竞价；确认不可修改的派单价；生成并管理生产合同；按自然日跟踪阶段回货与催货；三方工厂在 PDA 识别完整责任范围并只进行接单、开始、交出 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `AGENTS.md`

## 2.1 已确认业务边界

1. 普通生产阶段工序任务均可在统一工作台查看和分配；准备阶段的水溶、染色、印花绝不进入任务清单、任务分配或合并任务，只由其加工单投影到 PDA。缩水、洗水在加工单、PDA 和任务体系均停用，待完整业务闭环另行启用。
2. 已分配工厂的印花、染色、水溶加工单投影为 PDA 待接单；工厂必须人工接单后才能开工。PDA 的数量、状态和交出结果实时回写原加工单，原加工单是唯一事实源，不另建一套可独立变化的 PDA 任务数据。
3. 整单任务是特殊合并任务，但不在本次范围。普通任务只能创建以下两种固定合并任务：
   - 车缝 + 烫包；
   - 裁剪 + 车缝 + 烫包。
4. “车缝 + 烫包”交给三方工厂时，开扣眼和装扣子一并属于该工厂责任范围；业务名称仍只称“车缝 + 烫包”。
5. “裁剪 + 车缝 + 烫包”交给三方工厂时，除开扣眼、装扣子外，冻结技术包中的辅助工艺和特殊工艺也一并属于该工厂责任范围，不再生成对应中央工厂加工单。
6. PDA 不展示第三方工厂的内部执行步骤，不设置关键节点或单独完工，只清楚展示责任范围、完整 SKU，并提供接单、开始、交出。
7. 工序工艺字典和技术包不再承担“连续工序任务”判断；连续型、产值计算、产能计算页面和相关模型全部删除。技术包只保留真实工序、工艺、作用对象和基础顺序。
8. 含车缝任务分配均提供“按菲票装袋情况分配”和“自由分配”，默认前者；派单和竞价均以完整 SKU 为最小颗粒度。混装袋是裁床待交出仓异常，不影响任务分配，也不在分配时创建拆袋待办。
9. 车缝分配弹窗展示“车缝的辅料配料情况以及库存情况”、裁片齐套、放行和目标数量；这些信息只提示风险，不得因上游数据不完善阻断派单或竞价。
10. 派单价在直接派单或竞价中标时确定，提交前必须二次确认“谨慎确认价格，一经提交确认不得修改。”；结算只读冻结价格。价格录错的研发改数场景不在本次产品流程范围。
11. 合同和回货规则是两个独立判断。合同只适用于独立车缝、车缝 + 烫包、裁剪 + 车缝 + 烫包；工厂确定后生成，合同不打印派单价、总加工费或具体时间，只说明自然日回货规则。
12. 旧分配失效时旧合同失效留痕；新分配生成新合同版本，不覆盖旧合同。签订后合同只允许上传 JPG、JPEG、PNG 图片，支持预览、排序和删除留痕。
13. 自然日回货规则为：独立车缝第 4 天不少于 30%、第 8 天不少于 70%、第 9 天 100%；车缝 + 烫包第 5/9/10 天；裁剪 + 车缝 + 烫包第 6/9/12 天。每个节点只产生截止前 1 天、截止当天、逾期后首日三次提醒，不持续升级或重复提醒。
14. 生产单进度以线上页面的信息密度、筛选、分页、主表和展开结构为基线增量优化。回货按有效工厂分配分别计算，旧工厂回货不抵扣新工厂节点；质检、复检只是回货流程节点，不改变节点截止日期。
15. 后道是阶段，不是工序；后道阶段只有开扣眼、装扣子、烫包。质检、复检不是工序，也不进入工序工艺字典。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 管理端聚合任务、分配、合同和生产单进度；PDA 同时承接生产任务与准备加工单投影，并按对象只保留现场所需动作。 |
| 任务清晰度 | 通过 | 工作台区分独立任务与两类固定合并任务；合并弹窗先搜索生产单，再选择精确源任务。 |
| 信息架构与导航 | 通过 | 任务分配统一到一个工作台；右上角“合并任务”为唯一创建入口；合同和生产单进度保留独立同级入口。 |
| 页面模式 | 通过 | 管理列表使用标准列表和分页；生产单进度沿用线上高密度列表；PDA 使用小屏动作页；合同使用 A4 打印页。 |
| 信息负荷 | 通过 | 车缝配料库存与裁片齐套、放行、目标数量只在含车缝分配弹窗展开；回货明细只在生产单行展开后显示。 |
| 文案 | 通过 | 统一使用“固定合并任务”“后道阶段”“烫包”；不再使用“连续工序任务”“后道任务”或把质检、复检称为工序。 |
| 数量与状态 | 通过 | 分配最小颗粒度为完整 SKU；合并任务不可拆开分给不同工厂；准备加工单与 PDA 共用数量和状态；回货节点显示应回累计、实回累计、差额和状态。 |
| 扫码与识别 | 通过 | PDA 展示生产单、合并任务号、完整 SKU 与数量；裁床在实际领料时才按当时有效车缝任务处理拆袋。 |
| 防错 | 通过 | 准备阶段任务从源头排除；固定组合精确校验；已分配、已开始或中央工厂已执行的源任务阻断合并；价格强制二次确认；物料风险不阻断生产。 |
| UI 样式 | 通过 | 沿用企业后台表格、弹窗、徽章和风险色；红色仅用于阻断和逾期，黄色用于待处理，绿色用于达标。 |
| 组件交互 | 通过 | 搜索生产单、勾选任务、两次合并确认、SKU 分配、价格二次确认、合同打印和扫描件预览均有即时反馈。 |
| 协作关系 | 通过 | 合并责任范围同步影响中央工厂加工单抑制、三方 PDA、合同、回货规则和结算价格；各端读取同一冻结任务责任。 |
| 异常与追溯 | 通过 | 混装袋不污染分配；旧合同失效留痕；提醒按节点与工厂留痕；签订扫描件记录文件、上传人、时间和顺序。 |
| 现场设备可用性 | 通过 | 管理端按 1366×768、PDA 按 390×844、合同按 A4 页面完成命名路径验收。 |

## 4. 问题标签

- `算不准`
- `选不对`
- `点错风险`
- `状态抽象`
- `字段过载`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 准备阶段工序错误进入任务清单、任务分配和合并候选 | 选不对、协作断裂 | PPIC、中央工厂 | 任务产物分成生产任务和生产准备加工单；准备阶段在任务生成、运行时任务、列表和合并资格四层排除，并清理相关 Mock | 否 |
| 准备加工单虽被排除出任务体系，却无法供印染工厂在 PDA 接单、开工和交出 | 协作断裂、状态抽象 | 印花、染色、水溶工厂 | 将已分配加工单投影到 PDA 待接单；人工接单后方可开始；开工、交出、数量和状态同步回原加工单；缩水、洗水在闭环完成前停用 | 否 |
| 通用“连续工序”模型允许任意相邻任务合并 | 选不对、状态抽象 | PPIC、三方工厂 | 删除通用连续判断，只保留两种精确合并组合；合并前按生产单、真实工序、任务状态和中央工厂执行状态校验 | 否 |
| 合并入口与分配动作混杂 | 点错风险 | PPIC | 工作台右上角提供独立“合并任务”按钮；弹窗搜索单一生产单、展示源任务、识别固定模式，再进行二次确认 | 否 |
| 三方工厂只看到业务简称，无法确认辅助/特殊工艺责任 | 协作断裂 | 三方工厂主管 | PDA 展示冻结责任范围与完整 SKU；车缝 + 烫包吸收开扣眼、装扣子，裁剪 + 车缝 + 烫包继续吸收辅助和特殊工艺；不展示内部执行步骤 | 否 |
| 含车缝分配容易打乱菲票装袋或被物料不完善阻断 | 点错风险、字段过载 | PPIC、裁床 | 默认按装袋推荐，也允许自由分配；均以完整 SKU 为最小粒度；车缝辅料配料和库存、裁片状态只作风险提示 | 否 |
| 派单价到结算才处理，缺少不可修改确认边界 | 点错风险、追溯不足 | 跟单、结算 | 直接派单和竞价中标均执行明确二次确认并冻结价格；结算无修改入口 | 否 |
| 合同适用范围、打印、签回和版本留痕不完整 | 协作断裂、追溯不足 | 跟单、三方工厂 | 仅三类合同任务在工厂确定后生成；自然日、日期、累计数量写入合同；支持 A4 打印和图片扫描件；旧合同失效、新合同新版本 | 否 |
| 合同与回货规则错误绑定 | 算不准、状态抽象 | 跟单、三方工厂 | 分别判断合同资格与回货规则；合同只说明规则，不打印派单价、加工费和具体时间 | 否 |
| 24 小时滚动和持续逾期升级不符合口径 | 算不准、追溯不足 | 跟单、生产主管 | 全部按业务分配日期起算自然日；每节点只生成截止前一日、截止当天、逾期后首日三种一次性提醒 | 否 |
| 原型生产单进度与线上页面差异过大 | 字段过载、协作断裂 | 跟单、生产主管 | 以线上筛选、分页、主表列和行展开为基础，只增量加入回货规则、节点、合同、扫描件和提醒 | 否 |
| 后道、包装、质检、复检混入工序和工厂能力 Mock | 状态抽象 | 工厂运营、PPIC | 后道阶段唯一工序为开扣眼、装扣子、烫包；质检、复检只保留回货流程节点；熨烫、包装仅保留历史停用归一映射，不进入新 Mock | 否 |
| 连续型、产值计算及产能页面继续制造错误业务含义 | 状态抽象、字段过载 | 研发、产品、工厂运营 | 删除字段、类型、数据、页面、路由、菜单、检查命令和相关旧 Mock；字典只展示真实阶段、工序、工艺和任务边界 | 否 |

## 6. 最终结论

结论：通过

说明：

- 当前代码、Mock、Web、PDA 与打印均按以上固定业务模型收口，不再保留可运行的通用连续工序或产值计算逻辑。
- 原型中的分配、合同、提醒与扫描件用于演示完整产品行为，不代表生产后端、真实合同签订或真实工厂履约已经发生。
- 整单任务和价格录错后的研发改数不在本次产品流程范围。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/sewing-delivery-sla-preview.ts`
- `src/components/shell.ts`
- `src/components/production-object-entry.ts`
- `src/components/production-object-overview.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/capacity-calendar-overrides.ts`
- `src/data/fcs/capacity-calendar.ts`
- `src/data/fcs/capacity-rules.ts`
- `src/data/fcs/capacity-usage-ledger.ts`
- `src/data/fcs/combined-dyeing-domain.ts`
- `src/data/fcs/cutting/generated-cut-orders.ts`
- `src/data/fcs/cutting/pda-cutting-mock-matrix.ts`
- `src/data/fcs/cutting/pda-cutting-task-scenarios.ts`
- `src/data/fcs/cutting/pda-cutting-task-source.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/dispatch-acceptance-sla.ts`
- `src/data/fcs/dispatch-fulfillment-audit.ts`
- `src/data/fcs/dispatch-fulfillment-permissions.ts`
- `src/data/fcs/dispatch-fulfillment-status.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/factory-capacity-profile-mock.ts`
- `src/data/fcs/factory-master-store.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/factory-onboarding-flow.ts`
- `src/data/fcs/factory-onboarding-store.ts`
- `src/data/fcs/factory-types.ts`
- `src/data/fcs/handover-ledger-view.ts`
- `src/data/fcs/merged-production-task.ts`
- `src/data/fcs/milestone-configs.ts`
- `src/data/fcs/output-value-field-display.ts`
- `src/data/fcs/page-adapters/task-execution-adapter.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-receive-scope.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/pda-task-scenario-matrix.ts`
- `src/data/fcs/post-finishing-domain.ts`
- `src/data/fcs/post-process-route.ts`
- `src/data/fcs/post-stage-taxonomy.ts`
- `src/data/fcs/print-service.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/process-craft-output-value-explainer.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-types.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/production-contracts.ts`
- `src/data/fcs/production-demands.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/production-order-tech-pack-runtime.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-process-snapshot-derivation.ts`
- `src/data/fcs/production-return-fulfillment.ts`
- `src/data/fcs/production-task-generation-rules.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/quality-deduction-shared-facts.ts`
- `src/data/fcs/return-inbound-qc-view.ts`
- `src/data/fcs/return-inbound-quality-chain-facts.ts`
- `src/data/fcs/routing-templates.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-sewing-reassignment.ts`
- `src/data/fcs/settlement-linked-mock-factory.ts`
- `src/data/fcs/sewing-delivery-sla.ts`
- `src/data/fcs/sewing-dispatch-workbench.ts`
- `src/data/fcs/special-craft-pda-scope.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-quality-seeds.ts`
- `src/data/fcs/store-domain-statement-grain.ts`
- `src/data/fcs/task-fulfillment-policy.ts`
- `src/data/fcs/task-generation-boundaries.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/fcs/third-party-factory-comprehensive-assessment.ts`
- `src/data/fcs/third-party-factory-rating.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/fcs/wool-task-domain.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-technical-data-fcs-adapter.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/tech-pack-process-route.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/capacity.ts`
- `src/pages/continuous-dispatch.ts`
- `src/pages/dispatch-board.ts`
- `src/pages/dispatch-board/board-domain.ts`
- `src/pages/dispatch-board/context.ts`
- `src/pages/dispatch-board/core.ts`
- `src/pages/dispatch-board/dialogs.ts`
- `src/pages/dispatch-board/dispatch-domain.ts`
- `src/pages/dispatch-board/events.ts`
- `src/pages/dispatch-board/tender-domain.ts`
- `src/pages/dispatch-tenders.ts`
- `src/pages/factory-capacity-profile.ts`
- `src/pages/factory-profile.ts`
- `src/pages/fcs-production-tech-pack-snapshot.ts`
- `src/pages/pda-cutting-spreading.ts`
- `src/pages/pda-cutting-task-detail.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-outbound-records.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/print/templates/post-finishing-route-card-template.ts`
- `src/pages/print/templates/production-contract-template.ts`
- `src/pages/print/templates/task-delivery-card-template.ts`
- `src/pages/print/templates/task-route-card-template.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-factory/cutting/marker-plan.ts`
- `src/pages/process-factory/cutting/special-processes.ts`
- `src/pages/process-factory/cutting/supplement-management.ts`
- `src/pages/process-factory/dyeing/combined-dyeing.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/statistics.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/production-contract-center.ts`
- `src/pages/production-contract-print.ts`
- `src/pages/production-craft-dict.ts`
- `src/pages/production-order-progress-tracking.ts`
- `src/pages/production/context.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/production/events.ts`
- `src/pages/production/orders-domain.ts`
- `src/pages/production/task-generation-rules.ts`
- `src/pages/progress-board/events.ts`
- `src/pages/progress-board/task-domain.ts`
- `src/pages/progress-exceptions/events.ts`
- `src/pages/progress-urge.ts`
- `src/pages/sewing-dispatch-workbench.ts`
- `src/pages/task-breakdown.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/third-party-factory-comprehensive-assessment.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- `/fcs/dispatch/workbench`
- `/fcs/process/task-breakdown`
- `/fcs/dispatch/tenders`
- `/fcs/contracts`
- `/fcs/contracts/print?contractId=...`
- `/fcs/production_order_track/index`（线上同名主入口）
- `/fcs/progress/production-orders`（历史地址兼容）
- `/fcs/production/craft-dict`
- `/fcs/process/print-orders`
- `/fcs/process/dye-orders`
- `/fcs/craft/printing/work-orders/:workOrderId`
- `/fcs/craft/dyeing/work-orders/:workOrderId`
- `/fcs/craft/dyeing/water-soluble-orders`
- `/fcs/pda/task-receive`
- `/fcs/pda/exec/:taskId`
- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/craft/post-finishing/tasks`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/qc-orders`
- `/fcs/craft/post-finishing/recheck-orders`

### 验证命令

- `npm run check:fcs-unified-assignment-foundation`：通过
- `npm run check:preparation-order-pda-closure`：通过
- `npm run check:pda-task-receive-scope`：通过
- `npx playwright test tests/print-dye-web-action-dialog-and-dispatch.spec.ts`：通过（6/6），覆盖 Web 动作二次弹窗、统一写回、染色详情直达、平台派单方式与价格展示、PDA 接单后执行。
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4175 playwright test tests/pda-task-receive-pending-accept.spec.ts`：通过
- `npm run check:water-soluble-process`：通过
- `npm run check:water-soluble-pages`：通过
- `npm run check:water-soluble-pda`：通过
- `npx tsx scripts/check-printing-workflow.ts`：通过
- `npx tsx scripts/check-dyeing-workflow.ts`：通过
- `npm run check:dye-work-order-online-alignment`：通过
- `npm run check:mobile-execution-writeback`：通过
- `npx tsx scripts/check-process-mobile-task-binding.ts`：通过
- `npx tsx scripts/check-mobile-list-direct-detail-consistency.ts`：通过
- `npx tsx scripts/check-platform-process-order-events.ts PRINT`：通过
- `npx tsx scripts/check-platform-process-order-events.ts DYE`：通过
- `npm run check:fcs-unified-dispatch-contract-return`：通过
- `npm run check:fcs-upstream-cutting-chain`：通过
- `npx tsx scripts/check-factory-onboarding-p2.ts`：通过
- `npx tsx scripts/check-factory-onboarding-final-flow.ts`：通过
- `npm run check:production-order-progress-tracking`：通过
- `npm run check:production-order-progress-performance`：通过
- `npm run check:process-craft-final-taxonomy`：通过
- `npm run check:production-craft-dict-page`：通过
- `npm run check:pda-exec-task-detail`：通过
- `npm run check:pda-cutting-task-spreading-orders`：通过
- `npm run check:dispatch-acceptance-sla`：通过
- `npm run check:post-finishing-flow-correction`：通过
- `npm run check:post-route-qc-recheck`：通过
- `npm run check:fcs-inactive-process-craft-usage`：通过
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过，生产构建无 Browserslist 数据过期或主应用分包超限警告
- `npm run workflow:verify -- --output <临时目录>/task-receipt.json --task-boundary <本次任务边界>`：通过，状态 `verified`

### 现场验收证据

- 统一工作台：真实浏览器完成固定合并任务搜索、精确三任务勾选、模式识别、第一次确认和强制二次确认；合并后源任务不再单独执行。
- 车缝派单：真实浏览器验证按菲票装袋默认、自由分配、完整 SKU、车缝辅料配料与库存、裁片齐套/放行/目标数量，以及上游风险不阻断。
- 价格与竞价：真实浏览器验证直接派单和竞价均支持两种分配方式；直接派单提交前出现不可修改价格二次确认，竞价在中标确定工厂和价格前不生成合同。
- 合同：真实浏览器验证合同生成、A4 打印、自然日与日期、无具体时间和价格；扫描件仅接受 JPG/JPEG/PNG，并支持预览、排序、删除。
- 生产单进度：真实浏览器验证线上列表基线、回货规则、每节点三次提醒、应回/实回/差额、合同与扫描件、有效工厂分别计算、质检/复检流程节点。
- PDA：390×844 验证固定合并任务责任范围、完整 SKU，任务主动作只保留开始/交出，不存在执行步骤、关键节点或单独完工。
- 准备加工单 PDA：390×844 验证印花、染色、水溶加工单可接单、开工、交出；未接单不可开工；列表、详情和原加工单数量、状态一致；印花加工单不再被旧接单范围过滤器隐藏，接单后通过移动应用页内导航进入执行列表；缩水、洗水不可见且不可操作。
- 字典：1366×768 验证准备阶段不出生产任务；后道阶段只有开扣眼、装扣子、烫包；质检/复检不是工序；无连续型和产值计算。
- 图片：款式、辅料、库存物料使用对应真实图片并可查看大图；合同扫描件展示用户实际上传图片，未使用色块或无关占位图冒充。

### 例外

- 无
