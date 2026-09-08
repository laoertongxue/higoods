# PPIC、工艺路线与跨端链路当前版本原型审查记录

## 1. 基本信息

| 项目 | 内容 |
|---|---|
| 记录日期 | 2026-09-08 |
| 当前分支 | `codex/ppic-20260907` |
| 基线 HEAD | `77cd316a6bbf24dc3b45b0134d3ae7f06a0696c8` |
| 任务边界 | 当前工作树内车缝外发协同、生产工艺路线、全阶段加工单、上下游交接、后道、PDA 与打印的续作收口 |
| 记录模式 | 完整产品审查 |
| 治理基线 | `AGENTS.md` 第 3.1、4、5、7、8 节 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：当前修改改变车缝外发协同页面、生产与加工任务对象关系、上下游交接、后道处理、PDA 操作、数量与单位、图片呈现和打印内容，需要按当前工作树做完整原型审查。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
|---|---|---|
| 角色、任务与页面模式 | 有条件通过 | PPIC、工厂、裁床、仓库、质检等软件角色边界已完成专项验证；真实现场账号与产品接受仍需外部执行 |
| 信息密度、页面模式与导航 | 通过 | 车缝外发协同 9 个页面已完成首次进入、再次打开和页面错误复验 |
| 文案、状态、数量、单位与差异 | 通过 | 57 类路线对象、17 类辅助/特殊工艺、毛织汇合、后道 15 条链和打印口径均有当前专项证据 |
| 扫码、真实图片与对象识别 | 有条件通过 | 本地缩略图、大图和打印数据映射已验证；准确业务图片与实体扫码证据不得由原型占位图替代 |
| 防错、危险确认与主管兜底 | 通过 | 超量、重复、错源、角色越权及重复收货等边界由当前专项验证 |
| 交接、跨端事实与异常追溯 | 通过 | Web/PDA/仓库/质检/后道读取同一事实的本地链路已双轮复验 |
| 低分辨率、PDA、上传恢复与性能 | 有条件通过 | 浏览器模拟设备和低分辨率已验证；真实 iData 设备 19 项现场检查仍需实机 |
| 命名路由、关键交互、图片大图与打印 | 有条件通过 | 命名路由和打印预览已验证；实体打印、实体扫码及准确素材仍需现场证据 |

## 4. 需求与当前证据摘要

- 车缝外发协同双轮：每轮 27/27 项，通过 12 步数据操作回执。
- 工艺路线全阶段：准备 12 类、生产 28 类、后道 17 类，共 57 类对象通过。
- 辅助/特殊工艺：17 类工艺两轮逐单浏览器验证，每轮 190/190，通过 Web 与 360×640 PDA 页面检查。
- 后道：两轮各 15 条回货链、75 条 SKU 数量链、42 张页面截图；领域层最终成衣仓收货及重复收货幂等通过。
- 毛织：整件毛织与部位毛织/普通裁片汇合的领域及浏览器专项通过。
- 打印：后道路线卡、任务交货卡、生产确认单和打印治理当前专项通过。
- 性能：车缝外发协同 9 个页面首次进入 120–1021ms、再次打开 107–521ms，未出现页面错误或分钟级等待。
- 七张新需求：现有原页面已经形成 3 条业务终点链；由于真实技术资料、准确图片、真实设备与部分业务输入尚未具备，不能把软件矩阵伪装为 7 张真实新单完整验收。

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/binding-process-pda-scan.ts`
- `src/data/fcs/cut-piece-release.ts`
- `src/data/fcs/cutting/cut-piece-orders.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/cutting-task-routing.ts`
- `src/data/fcs/cutting/fei-ticket-numbering.ts`
- `src/data/fcs/cutting/generated-cut-orders.ts`
- `src/data/fcs/cutting/generated-cut-release.ts`
- `src/data/fcs/cutting/generated-fei-tickets.ts`
- `src/data/fcs/cutting/material-ledger.ts`
- `src/data/fcs/cutting/order-progress.ts`
- `src/data/fcs/cutting/pda-cutting-task-source.ts`
- `src/data/fcs/cutting/pickup-demand-domain.ts`
- `src/data/fcs/cutting/pickup-node-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/runtime-inputs.ts`
- `src/data/fcs/cutting/sewing-dispatch.ts`
- `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`
- `src/data/fcs/cutting/spreading-differences.ts`
- `src/data/fcs/cutting/spreading-material-readiness.ts`
- `src/data/fcs/cutting/storage/special-processes-storage.ts`
- `src/data/fcs/cutting/transfer-bag-handover-mock.ts`
- `src/data/fcs/cutting/transfer-bag-repack-mock.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-material-receipts.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/effective-task-assignments.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-mobile-warehouse.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/factory-onboarding-store.ts`
- `src/data/fcs/kol-goto-pda-domain.ts`
- `src/data/fcs/material-request-drafts.ts`
- `src/data/fcs/mobile-execution-task-index.ts`
- `src/data/fcs/page-adapters/long-tail-pages-adapter.ts`
- `src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- `src/data/fcs/pda-cutting-execution-source.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/platform-process-result-view.ts`
- `src/data/fcs/post-finishing-current-read-model.ts`
- `src/data/fcs/post-finishing-domain.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/post-finishing-outbound-orders.ts`
- `src/data/fcs/post-finishing-return-source-adapter.ts`
- `src/data/fcs/post-finishing-return-source-fact-bridge.ts`
- `src/data/fcs/post-process-route.ts`
- `src/data/fcs/pre-settlement-ledger-repository.ts`
- `src/data/fcs/preparation-material-receipt-sources.ts`
- `src/data/fcs/printing-material-receipts.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/printing-work-order-business.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-craft-dict.ts`
- `src/data/fcs/process-execution-writeback.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/process-platform-status-adapter.ts`
- `src/data/fcs/process-quantity-labels.ts`
- `src/data/fcs/process-statistics-domain.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/process-work-order-domain.ts`
- `src/data/fcs/process-work-order-generation-key.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/production-order-tech-pack-runtime.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-process-snapshot-derivation.ts`
- `src/data/fcs/production-process-work-order-service.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/quality-deduction-analysis.ts`
- `src/data/fcs/quality-deduction-shared-facts.ts`
- `src/data/fcs/retired-process-history.ts`
- `src/data/fcs/return-inbound-quality-chain-facts.ts`
- `src/data/fcs/return-inbound-workflow.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/runtime-task-read-bridge.ts`
- `src/data/fcs/sewing-cut-piece-return-workflow.ts`
- `src/data/fcs/sewing-outsourcing-demo.ts`
- `src/data/fcs/special-craft-dedicated-factories.ts`
- `src/data/fcs/special-craft-operations.ts`
- `src/data/fcs/special-craft-source-task-registry.ts`
- `src/data/fcs/special-craft-task-generation.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/store-domain-pda.ts`
- `src/data/fcs/store-domain-quality-seeds.ts`
- `src/data/fcs/store-domain-quality-types.ts`
- `src/data/fcs/store-domain-statement-source-adapter.ts`
- `src/data/fcs/supplement-print-prerequisite.ts`
- `src/data/fcs/task-detail-rows.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/data/fcs/water-soluble-material-receipts.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/data/fcs/wool-domain/cutting-receipts.ts`
- `src/data/fcs/wool-domain/queries.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/fcs/wool-domain/tech-pack-source.ts`
- `src/data/fcs/wool-task-domain.ts`
- `src/data/pcs-sample-cost-review-pricing.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/data/pcs-tech-pack-review-diff.ts`
- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-technical-data-fcs-adapter.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/tech-pack-process-route.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/dye-print-orders.ts`
- `src/pages/fcs-production-tech-pack-snapshot.ts`
- `src/pages/fcs/material-prep/cutting.ts`
- `src/pages/fcs/material-prep/dyeing.ts`
- `src/pages/fcs/material-prep/other.ts`
- `src/pages/fcs/material-prep/printing.ts`
- `src/pages/fcs/material-prep/sewing.ts`
- `src/pages/fcs/material-prep/shared.ts`
- `src/pages/garment-spu-replacements.ts`
- `src/pages/pda-cutting-fei-ticket-numbering.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-spreading.ts`
- `src/pages/pda-cutting-task-detail.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-kol-goto-exec.ts`
- `src/pages/pda-notify.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/pda-sewing-self-return.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-outbound-records.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/print/print-preview.ts`
- `src/pages/print/print-styles.ts`
- `src/pages/print/templates/post-finishing-outbound-template.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/print/templates/post-finishing-route-card-template.ts`
- `src/pages/print/templates/printing-work-order-template.ts`
- `src/pages/print/templates/task-delivery-card-template.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-factory/accessory/lace/work-order-detail.ts`
- `src/pages/process-factory/cutting/binding-strip-order-types.ts`
- `src/pages/process-factory/cutting/binding-strip-orders.ts`
- `src/pages/process-factory/cutting/cut-orders-model.ts`
- `src/pages/process-factory/cutting/cut-orders.ts`
- `src/pages/process-factory/cutting/cut-piece-release.ts`
- `src/pages/process-factory/cutting/cut-piece-return-warehouse.ts`
- `src/pages/process-factory/cutting/cutting-summary-checks.ts`
- `src/pages/process-factory/cutting/cutting-summary.ts`
- `src/pages/process-factory/cutting/fei-tickets-model.ts`
- `src/pages/process-factory/cutting/fei-tickets.ts`
- `src/pages/process-factory/cutting/marker-plan-projection.ts`
- `src/pages/process-factory/cutting/marker-plan.ts`
- `src/pages/process-factory/cutting/marker-spreading-model.ts`
- `src/pages/process-factory/cutting/marker-spreading-projection.ts`
- `src/pages/process-factory/cutting/marker-spreading-utils.ts`
- `src/pages/process-factory/cutting/marker-spreading.ts`
- `src/pages/process-factory/cutting/pickup-management-list.ts`
- `src/pages/process-factory/cutting/pickup-management-projection.ts`
- `src/pages/process-factory/cutting/runtime-projections.ts`
- `src/pages/process-factory/cutting/special-processes-domain.ts`
- `src/pages/process-factory/cutting/special-processes-model.ts`
- `src/pages/process-factory/cutting/special-processes-projection.ts`
- `src/pages/process-factory/cutting/special-processes.ts`
- `src/pages/process-factory/cutting/summary-model.ts`
- `src/pages/process-factory/cutting/traceability-projection-helpers.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/dyeing/dye-orders.ts`
- `src/pages/process-factory/dyeing/events.ts`
- `src/pages/process-factory/dyeing/shared.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/events.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/outbound-orders.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/statistics.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/process-factory/printing/dashboards.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/pending-review.ts`
- `src/pages/process-factory/printing/shared.ts`
- `src/pages/process-factory/printing/statistics.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/pages/process-factory/special-craft/warehouse.ts`
- `src/pages/process-factory/wool/handover-print.ts`
- `src/pages/process-factory/wool/work-order-detail.ts`
- `src/pages/process-order-task-relations.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-water-soluble-orders.ts`
- `src/pages/production-craft-dict.ts`
- `src/pages/production/context.ts`
- `src/pages/production/demand-domain.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/production/events.ts`
- `src/pages/production/orders-domain.ts`
- `src/pages/progress-board/task-domain.ts`
- `src/pages/progress-material.ts`
- `src/pages/qc-records/actions.ts`
- `src/pages/qc-records/fact-view.ts`
- `src/pages/retired-process-history.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/core.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/tech-pack/process-route-logicflow.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/pages/wls-finished-inbound.ts`
- `src/pages/wls-inbound.ts`
- `src/pages/workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/route-utils.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes.ts`

## 6. 最终结论

结论：有条件通过。当前工作树的软件实现、构建、主要业务契约、页面模拟设备与打印预览可以进入版本收口；真实 PDA、实体打印/扫码、准确业务图片、七张真实新单资料门禁和产品接受必须保留为外部验收项，不能由本地自动化代签。

### 验证命令

- `npm run build`：通过
- `npm run check:list-page-governance`：通过；381 个列表页静态检查、公共列表模板 Chromium 交互和 245 个受管文件原型治理均通过
- `npm run check:cutting:all`：通过；裁片单、数量账、四种铺布模式、54 张菲票、装袋、入仓、整袋交出、拆袋重装、回收与移动端闭环连续通过
- `npm run check:menu-routes`：通过；176 个菜单入口全部有唯一可达路由
- `npx playwright test tests/wool-management-fact-workflow.spec.ts`：通过；13/13 项毛织管理、PDA、打印、性能与低分辨率浏览器场景通过
- `npm run check:process-route-full-stage-delivery`：通过
- `VERIFICATION_PASS=pass-1 VERIFICATION_DIRECTION=forward PPIC_EVIDENCE_DIR=output/verification/sewing-outsourcing/final/pass-1 node --import tsx scripts/check-sewing-outsourcing-verification-pass.ts`：通过
- `VERIFICATION_PASS=pass-2 VERIFICATION_DIRECTION=reverse PPIC_EVIDENCE_DIR=output/verification/sewing-outsourcing/final/pass-2 node --import tsx scripts/check-sewing-outsourcing-verification-pass.ts`：通过
- `PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_PORT=43268 CUTTING_E2E_TEST_TIMEOUT=180000 npx playwright test tests/sewing-outsourcing-production-performance.spec.ts --workers=1 --reporter=line`：通过
- `npm run workflow:verify -- --output output/verification/final/task-receipt.json --task-boundary "PPIC、工艺路线、上下游交接、后道、PDA与打印当前工作树续作收口"`：不适用；该命令是审查记录完成后的外层最终收据生成器，不作为自身前置验证，最终结果固定写入 `output/verification/final/task-receipt.json`

### 例外

- 真实 iData PDA 的 19 项现场操作缺少设备、实际账号、可操作现场单据和照片，当前只能保留为外部阻塞。
- 款式、面料、裁片、纸样和加工凭证仍缺少与每个对象准确对应的业务素材；不得用通用占位图冒充。
- 实体打印与二维码扫码尚无现场照片和回执。
- 七张新生产需求不能在缺少真实冻结技术资料、单位和适用业务输入时强行补成终态；软件能力矩阵与真实新单验收分别记录。
- 产品接受必须由有权限的产品负责人对明确版本确认，助手不能代替。
