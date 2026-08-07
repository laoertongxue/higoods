# 全项目交接动作统一为“接收”原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-07 |
| 相关需求 / 任务 | 上下游交接动作统一为“交出、接收”，全项目将旧称替换为“接收” |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS / WLS |
| 涉及页面路径 | 全项目受影响的管理端、主管端、员工执行端、PDA 与打印页面 |
| 端类型 | 管理端 / 主管端 / 员工执行端 |
| 主要角色与任务 | 上游交出后，由下游现场人员接收物料、裁片、成衣或待加工对象 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：页面文案、状态、按钮、Mock 数据、打印文案和测试口径中的旧称统一改为“接收”；业务动作边界仍是上游交出、下游接收，不改变数量、对象、责任人、库存或状态流转规则。

当前审查依据：

- `AGENTS.md` 第 4 节印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节 UI、列表和真实图片门禁。
- `AGENTS.md` 第 7 节分层验证与证据新鲜度。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 仅统一交接动作名称；角色、任务入口和页面模式不变。 |
| 文案、状态、数量与单位 | 通过 | 旧称全部改为“接收”；数量、单位、差异和状态规则不变。 |
| 扫码、真实图片与对象识别 | 通过 | 扫码对象、款式及物料图片来源和大图能力未改变。 |
| 防错、危险确认与主管兜底 | 通过 | 原有阻断、确认和主管处理规则未改变。 |
| 交接、跨端事实与异常追溯 | 通过 | Web、PDA、仓储、打印和测试使用同一“交出、接收”口径。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 未改变布局结构、弱网、上传或恢复行为。 |
| 命名路由、交互、图片大图与打印 | 通过 | 路由和交互入口不变；打印文案同步更新。 |

## 4. 问题标签

- `读不懂`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 上游直接送达下游待加工仓时，旧称不能准确表达责任转移 | `读不懂` | 上下游交接人员 | 统一使用中性的“接收”，与上游“交出”配对 | 否 |

## 6. 最终结论

结论：通过

说明：全项目可检索文件中的旧称已清零（排除 Git、CodeGraph 数据库和 Excel 临时锁文件），构建及补料相关 61 项回归通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/production-object-overview.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/cutting-task-print-source.ts`
- `src/data/fcs/cutting/cut-order-close-records.ts`
- `src/data/fcs/cutting/cut-piece-orders.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/cutting-summary.ts`
- `src/data/fcs/cutting/material-ledger.ts`
- `src/data/fcs/cutting/material-prep.ts`
- `src/data/fcs/cutting/order-progress.ts`
- `src/data/fcs/cutting/pda-cutting-mock-matrix.ts`
- `src/data/fcs/cutting/pickup-discrepancy.ts`
- `src/data/fcs/cutting/pickup-node-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/spreading-differences.ts`
- `src/data/fcs/cutting/spreading-material-readiness.ts`
- `src/data/fcs/cutting/supplement-material-prep-demand-registry.ts`
- `src/data/fcs/cutting/supplement-node-facts.ts`
- `src/data/fcs/cutting/warehouse-runtime.ts`
- `src/data/fcs/factory-internal-warehouse-locations.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-mobile-todo-routes.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-warehouse-linkage.ts`
- `src/data/fcs/handover-ledger-view.ts`
- `src/data/fcs/material-request-drafts.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-platform-status-adapter.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/process-work-order-stock.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/production-order-change-workflow.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-task-generation-rules.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/progress-exception-lifecycle.ts`
- `src/data/fcs/progress-exception-taxonomy.ts`
- `src/data/fcs/progress-statistics-linkage.ts`
- `src/data/fcs/settlement-flow-boundaries.ts`
- `src/data/fcs/special-craft-pda-scope.ts`
- `src/data/fcs/special-craft-task-generation.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-dispatch-process.ts`
- `src/data/fcs/store-domain-pda.ts`
- `src/data/fcs/store-domain-progress.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/pages/fcs/material-prep/cutting.ts`
- `src/pages/fcs/material-prep/dyeing.ts`
- `src/pages/fcs/material-prep/other.ts`
- `src/pages/fcs/material-prep/printing.ts`
- `src/pages/fcs/material-prep/sewing.ts`
- `src/pages/material-issue.ts`
- `src/pages/material-statements.ts`
- `src/pages/pda-cutting-spreading.ts`
- `src/pages/pda-cutting-task-detail-helpers.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-notify-due-soon.ts`
- `src/pages/pda-notify.ts`
- `src/pages/pda-shell.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-shared.ts`
- `src/pages/pda-warehouse-stocktake.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-warehouse.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/print/templates/material-slip-template.ts`
- `src/pages/process-factory/cutting/binding-strip-orders.ts`
- `src/pages/process-factory/cutting/cut-orders-model.ts`
- `src/pages/process-factory/cutting/cut-orders.ts`
- `src/pages/process-factory/cutting/cutting-daily-production-report-model.ts`
- `src/pages/process-factory/cutting/cutting-summary-checks.ts`
- `src/pages/process-factory/cutting/cutting-summary.helpers.ts`
- `src/pages/process-factory/cutting/cutting-summary.ts`
- `src/pages/process-factory/cutting/marker-plan-model.ts`
- `src/pages/process-factory/cutting/marker-spreading-model.ts`
- `src/pages/process-factory/cutting/marker-spreading-utils.ts`
- `src/pages/process-factory/cutting/marker-spreading.ts`
- `src/pages/process-factory/cutting/material-prep-model.ts`
- `src/pages/process-factory/cutting/material-prep.helpers.ts`
- `src/pages/process-factory/cutting/meta.ts`
- `src/pages/process-factory/cutting/navigation-context.ts`
- `src/pages/process-factory/cutting/pickup-management-list.ts`
- `src/pages/process-factory/cutting/pickup-management-projection.ts`
- `src/pages/process-factory/cutting/production-progress-model.ts`
- `src/pages/process-factory/cutting/production-progress.ts`
- `src/pages/process-factory/cutting/special-processes-model.ts`
- `src/pages/process-factory/cutting/special-processes.ts`
- `src/pages/process-factory/cutting/summary-model.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/process-factory/dyeing/warehouse.ts`
- `src/pages/process-factory/printing/warehouse.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/shared/warehouse-standard.ts`
- `src/pages/process-factory/shared/web-status-action-dialog.ts`
- `src/pages/process-factory/special-craft/shared.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-factory/special-craft/warehouse.ts`
- `src/pages/production-order-progress-tracking.ts`
- `src/pages/production/changes-domain.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/production/events.ts`
- `src/pages/production/orders-domain.ts`
- `src/pages/production/task-generation-rules.ts`
- `src/pages/progress-board/actions.ts`
- `src/pages/progress-board/context.ts`
- `src/pages/progress-board/core.ts`
- `src/pages/progress-board/events.ts`
- `src/pages/progress-board/task-domain.ts`
- `src/pages/progress-cutting-detail.ts`
- `src/pages/progress-cutting-exception-center.ts`
- `src/pages/progress-cutting-overview.ts`
- `src/pages/progress-exceptions/context.ts`
- `src/pages/progress-exceptions/detail-domain.ts`
- `src/pages/progress-exceptions/events.ts`
- `src/pages/progress-exceptions/overview-domain.ts`
- `src/pages/progress-handover-order.ts`
- `src/pages/progress-handover.ts`
- `src/pages/progress-material.ts`
- `src/pages/progress-urge.ts`
- `src/pages/settlement-cutting-input.ts`
- `src/pages/statements.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/pages/wls-fabric-demand-board.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- 全项目既有 FCS、PFOS、WLS、PDA 与打印路由（路由结构未改变）。

### 验证命令

- `全仓旧称零匹配扫描`：通过，零匹配。
- `npx playwright test tests/cut-order-supplement-linkage.spec.ts tests/supplement-management-list-template.spec.ts --workers=1`：通过，61 项。
- `npm run build`：通过。
- `git diff --check`：通过。

### 真实图片验证

- 本次未修改图片资源、对象对应关系、缩略图位置、大图弹窗和图片失败态。

### 例外

- 未逐路由进行浏览器截图验收；本次为机械术语替换，以全仓零匹配、构建、受影响补料链路回归和既有专项检查同步作为证据。
