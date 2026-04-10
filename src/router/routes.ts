import { menusBySystem } from '../data/app-shell-config'
import { appStore } from '../state/store'
import { buildDeductionEntryHrefByBasisId } from '../data/fcs/quality-chain-adapter'
import { renderFactoryProfilePage } from '../pages/factory-profile'
import { renderFactoryCapacityProfilePage } from '../pages/factory-capacity-profile'
import { renderOverviewPage, renderTodosPage } from '../pages/workbench'
import { renderPcsOverviewPage } from '../pages/pcs-workspace-overview'
import { renderPcsTodosPage } from '../pages/pcs-workspace-todos'
import { renderPcsAlertsPage } from '../pages/pcs-workspace-alerts'
import { renderPcsProjectsPage } from '../pages/pcs-projects'
import { renderPcsProjectCreatePage } from '../pages/pcs-project-create'
import { renderPcsTemplatesPage } from '../pages/pcs-templates'
import { renderPcsWorkItemsPage } from '../pages/pcs-work-items'
import {
  renderPcsTemplateCreatePage,
  renderPcsTemplateEditPage,
} from '../pages/pcs-template-editor'
import { renderPcsTemplateDetailPage } from '../pages/pcs-template-detail'
import {
  renderPcsWorkItemCreatePage,
  renderPcsWorkItemEditPage,
} from '../pages/pcs-work-item-editor'
import { renderPcsWorkItemDetailPage } from '../pages/pcs-work-item-detail'
import { renderPcsProjectDetailPage } from '../pages/pcs-project-detail'
import { renderPcsProjectWorkItemDetailPage } from '../pages/pcs-project-work-item-detail'
import { renderPcsProjectArchivePage } from '../pages/pcs-project-archive'
import { renderPcsLiveSessionsPage } from '../pages/pcs-testing-live'
import { renderPcsLiveSessionDetailPage } from '../pages/pcs-testing-live-detail'
import { renderPcsVideoRecordsPage } from '../pages/pcs-testing-video'
import { renderPcsVideoRecordDetailPage } from '../pages/pcs-testing-video-detail'
import { renderPcsChannelProductsPage } from '../pages/pcs-channel-products'
import { renderPcsChannelProductDetailPage } from '../pages/pcs-channel-product-detail'
import { renderPcsChannelProductMappingPage } from '../pages/pcs-channel-product-mapping'
import { renderPcsChannelProductStoreViewPage } from '../pages/pcs-channel-product-store'
import { renderPcsChannelStoresPage } from '../pages/pcs-channel-stores'
import { renderPcsChannelStoreDetailPage } from '../pages/pcs-channel-store-detail'
import { renderPcsChannelStoreSyncPage } from '../pages/pcs-channel-store-sync'
import { renderPcsChannelStorePayoutAccountsPage } from '../pages/pcs-channel-store-payout-accounts'
import { renderPlaceholderPage, renderRouteNotFound } from '../pages/placeholder'
import { renderSampleLedgerPage } from '../pages/pcs-sample-ledger'
import { renderSampleInventoryPage } from '../pages/pcs-sample-inventory'
import { renderSampleTransferPage } from '../pages/pcs-sample-transfer'
import { renderSampleReturnPage } from '../pages/pcs-sample-return'
import { renderSampleApplicationPage } from '../pages/pcs-sample-application'
import { renderSampleViewPage } from '../pages/pcs-sample-view'
import { renderRevisionTaskPage } from '../pages/pcs-revision-task'
import { renderPlateMakingPage } from '../pages/pcs-plate-making'
import { renderPcsPartTemplateLibraryPage } from '../pages/pcs-part-template-library'
import { renderPatternTaskPage } from '../pages/pcs-pattern-task'
import { renderPcsPatternLibraryPage } from '../pages/pcs-pattern-library'
import { renderPcsPatternLibraryCreatePage } from '../pages/pcs-pattern-library-create'
import { renderPcsPatternLibraryDetailPage } from '../pages/pcs-pattern-library-detail'
import { renderPcsPatternLibraryConfigPage } from '../pages/pcs-pattern-library-config'
import { renderFirstOrderSamplePage } from '../pages/pcs-first-order-sample'
import { renderPreProductionSamplePage } from '../pages/pcs-pre-production-sample'
import { renderCapabilityPage } from '../pages/capability'
import { renderFactoryStatusPage } from '../pages/factory-status'
import { renderFactoryPerformancePage } from '../pages/factory-performance'
import { renderProductSpuPage } from '../pages/pcs-product-spu'
import { renderProductSkuPage } from '../pages/pcs-product-sku'
import { renderPcsProductStyleDetailPage } from '../pages/pcs-product-style-detail'
import {
  renderPcsCodingRulesPage,
  renderPcsCostParametersPage,
} from '../pages/pcs-domain-pages'
import {
  renderPcsMaterialArchiveDetailPage,
  renderPcsMaterialArchiveEditorPage,
  renderPcsMaterialArchiveListPage,
} from '../pages/pcs-material-archives'
import type { MaterialArchiveKind } from '../data/pcs-material-archives'
import { renderConfigWorkspacePage } from '../pages/pcs-config-workspace'
import { renderPlatformConfigPage } from '../pages/pcs-platform-config'
import { renderSettlementDetailPage, renderSettlementInitPage, renderSettlementListPage } from '../pages/settlement'
import {
  renderCapacityOverviewPage,
  renderCapacityRiskPage,
  renderCapacityBottleneckPage,
  renderCapacityConstraintsPage,
  renderCapacityPoliciesPage,
} from '../pages/capacity'
import {
  renderProductionDemandInboxPage,
  renderProductionOrdersPage,
  renderProductionPlanPage,
  renderProductionDeliveryWarehousePage,
  renderProductionChangesPage,
  renderProductionStatusPage,
  renderProductionOrderDetailPage,
} from '../pages/production'
import { renderProductionCraftDictPage } from '../pages/production-craft-dict'
import { renderTechPackPage } from '../pages/tech-pack'
import { renderTaskBreakdownPage } from '../pages/task-breakdown'
import { renderProcessDyeRequirementsPage } from '../pages/process-dye-requirements'
import { renderProcessPrintRequirementsPage } from '../pages/process-print-requirements'
import { renderProcessDyeOrdersPage } from '../pages/process-dye-orders'
import { renderProcessPrintOrdersPage } from '../pages/process-print-orders'
import { renderMaterialIssuePage } from '../pages/material-issue'
import {
  renderQcRecordDetailPage,
  renderQcRecordMobileDetailPage,
  renderQcRecordsPage,
} from '../pages/qc-records'
import { renderDeductionAnalysisPage } from '../pages/deduction-analysis'
import { renderStatementsPage } from '../pages/statements'
import { renderAdjustmentsPage } from '../pages/adjustments'
import { renderBatchesPage } from '../pages/batches'
import { renderMaterialStatementsPage } from '../pages/material-statements'
import { renderPaymentSyncPage } from '../pages/payment-sync'
import { renderHistoryPage } from '../pages/history'
import { renderCuttingSettlementInputPage } from '../pages/settlement-cutting-input'
import { renderDispatchBoardPage } from '../pages/dispatch-board'
import { renderDispatchTendersPage } from '../pages/dispatch-tenders'
import { renderProgressBoardPage } from '../pages/progress-board'
import { renderProgressExceptionsPage } from '../pages/progress-exceptions'
import { renderProgressMaterialPage } from '../pages/progress-material'
import { renderProgressUrgePage } from '../pages/progress-urge'
import { renderProgressHandoverPage } from '../pages/progress-handover'
import { renderProgressHandoverOrderPage } from '../pages/progress-handover-order'
import { renderProgressMilestoneConfigPage } from '../pages/progress-milestone-config'
import { renderProgressCuttingOverviewPage } from '../pages/progress-cutting-overview'
import { renderProgressCuttingDetailPage } from '../pages/progress-cutting-detail'
import { renderProgressCuttingExceptionCenterPage } from '../pages/progress-cutting-exception-center'
import {
  renderTraceMappingPage,
  renderTraceParentCodesPage,
  renderTraceUnitPricePage,
  renderTraceUniqueCodesPage,
} from '../pages/trace'
import { renderPdaNotifyPage } from '../pages/pda-notify'
import { renderPdaNotifyDueSoonPage } from '../pages/pda-notify-due-soon'
import { renderPdaNotifyDetailPage } from '../pages/pda-notify-detail'
import { renderPdaQualityDetailPage, renderPdaQualityPage } from '../pages/pda-quality'
import { renderPdaTaskReceivePage } from '../pages/pda-task-receive'
import { renderPdaTaskReceiveDetailPage } from '../pages/pda-task-receive-detail'
import { renderPdaExecPage } from '../pages/pda-exec'
import { renderPdaExecDetailPage } from '../pages/pda-exec-detail'
import { renderPdaHandoverPage } from '../pages/pda-handover'
import { renderPdaHandoverDetailPage } from '../pages/pda-handover-detail'
import { renderPdaSettlementPage } from '../pages/pda-settlement'
import { renderPdaCuttingTaskDetailPage } from '../pages/pda-cutting-task-detail'
import { renderPdaCuttingExecutionUnitPage } from '../pages/pda-cutting-execution-unit'
import { renderPdaCuttingPickupPage } from '../pages/pda-cutting-pickup'
import { renderPdaCuttingSpreadingPage } from '../pages/pda-cutting-spreading'
import { renderPdaCuttingInboundPage } from '../pages/pda-cutting-inbound'
import { renderPdaCuttingHandoverPage } from '../pages/pda-cutting-handover'
import { renderPdaCuttingReplenishmentFeedbackPage } from '../pages/pda-cutting-replenishment-feedback'
import {
  renderCraftWorkbenchOverviewPage,
  renderCraftCuttingProductionProgressPage,
  renderCraftCuttingCuttablePoolPage,
  renderCraftCuttingMergeBatchesPage,
  renderCraftCuttingMarkerListPage,
  renderCraftCuttingMarkerCreatePage,
  renderCraftCuttingMarkerPlanEditPage,
  renderCraftCuttingMarkerPlanDetailPage,
  renderCraftCuttingSpreadingListPage,
  renderCraftCuttingSpreadingCreatePage,
  renderCraftCuttingMarkerSpreadingPage,
  renderCraftCuttingSpreadingDetailPage,
  renderCraftCuttingSpreadingEditPage,
  renderCraftCuttingFeiTicketsPage,
  renderCraftCuttingFeiTicketDetailPage,
  renderCraftCuttingFeiTicketPrintedPage,
  renderCraftCuttingFeiTicketRecordsPage,
  renderCraftCuttingFeiTicketPrintPage,
  renderCraftCuttingFeiTicketContinuePrintPage,
  renderCraftCuttingFeiTicketReprintPage,
  renderCraftCuttingFeiTicketVoidPage,
  renderCraftCuttingMaterialPrepPage,
  renderCraftCuttingOriginalOrdersPage,
  renderCraftCuttingFabricWarehousePage,
  renderCraftCuttingCutPieceWarehousePage,
  renderCraftCuttingSampleWarehousePage,
  renderCraftCuttingTransferBagsPage,
  renderCraftCuttingTransferBagDetailPage,
  renderCraftCuttingReplenishmentPage,
  renderCraftCuttingSpecialProcessesPage,
  renderCraftCuttingSummaryPage,
  renderCraftPrintingWorkOrdersPage,
  renderCraftPrintingPendingReviewPage,
  renderCraftPrintingProgressPage,
  renderCraftPrintingStatisticsPage,
  renderCraftPrintingDashboardsPage,
  renderCraftDyeingWorkOrdersPage,
  renderCraftDyeingDyeOrdersPage,
  renderCraftDyeingReportsPage,
} from '../pages/process-factory'
import type { MenuGroup, MenuItem } from '../data/app-shell-types'

type RouteRenderer = (pathname: string) => string

function renderRouteRedirect(targetPath: string, title: string): string {
  const currentPath = appStore.getState().pathname
  if (currentPath !== targetPath) {
    queueMicrotask(() => {
      if (appStore.getState().pathname !== targetPath) {
        appStore.navigate(targetPath, { historyMode: 'replace' })
      }
    })
  }
  return renderPlaceholderPage(title, '正在跳转到新的页面结构…', '页面跳转')
}

function normalizePathname(pathname: string): string {
  return pathname.split('#')[0].split('?')[0] || '/'
}

const exactRoutes: Record<string, RouteRenderer> = {
  '/': () => renderOverviewPage(),
  '/pcs': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
  '/pcs/workspace': () => renderRouteRedirect('/pcs/workspace/overview', '正在跳转到商品中心工作台'),
  '/fcs/factories/profile': () => renderFactoryProfilePage(),
  '/fcs/factories/capacity-profile': () => renderFactoryCapacityProfilePage(),
  '/fcs/factories/capability': () => renderCapabilityPage(),
  '/fcs/factories/status': () => renderFactoryStatusPage(),
  '/fcs/factories/performance': () => renderFactoryPerformancePage(),
  '/fcs/factories/settlement': () => renderSettlementListPage(),
  '/fcs/factories/settlement/new': () => renderSettlementListPage(),
  '/fcs/workbench/overview': () => renderOverviewPage(),
  '/pcs/workspace/overview': () => renderPcsOverviewPage(),
  '/pcs/workspace/todos': () => renderPcsTodosPage(),
  '/pcs/workspace/alerts': () => renderPcsAlertsPage(),
  '/pcs/projects': () => renderPcsProjectsPage(),
  '/pcs/projects/create': () => renderPcsProjectCreatePage(),
  '/pcs/templates': () => renderPcsTemplatesPage(),
  '/pcs/templates/new': () => renderPcsTemplateCreatePage(),
  '/pcs/work-items': () => renderPcsWorkItemsPage(),
  '/pcs/work-items/new': () => renderPcsWorkItemCreatePage(),
  '/pcs/testing/live': () => renderPcsLiveSessionsPage(),
  '/pcs/testing/video': () => renderPcsVideoRecordsPage(),
  '/pcs/channels/products': () =>
    renderRouteRedirect('/pcs/products/channel-products', '正在跳转到渠道商品'),
  '/pcs/channels/products/mapping': () =>
    renderRouteRedirect('/pcs/products/channel-attributes', '正在跳转到渠道属性对应'),
  '/pcs/channels/products/store': () =>
    renderRouteRedirect('/pcs/products/channel-products/store', '正在跳转到渠道商品店铺视图'),
  '/pcs/channels/stores': () => renderPcsChannelStoresPage(),
  '/pcs/channels/stores/sync': () => renderPcsChannelStoreSyncPage(),
  '/pcs/channels/stores/payout-accounts': () => renderPcsChannelStorePayoutAccountsPage(),
  '/pcs/samples/ledger': () => renderSampleLedgerPage(),
  '/pcs/samples/inventory': () => renderSampleInventoryPage(),
  '/pcs/samples/transfer': () => renderSampleTransferPage(),
  '/pcs/samples/return': () => renderSampleReturnPage(),
  '/pcs/samples/application': () => renderSampleApplicationPage(),
  '/pcs/samples/view': () => renderSampleViewPage(),
  '/pcs/samples/first-sample': () => renderFirstOrderSamplePage(),
  '/pcs/samples/first-order': () =>
    renderRouteRedirect('/pcs/samples/first-sample', '正在跳转到首版样衣打样'),
  '/pcs/samples/pre-production': () => renderPreProductionSamplePage(),
  '/pcs/production/pre-check': () =>
    renderRouteRedirect('/pcs/samples/pre-production', '正在跳转到产前版样衣'),
  '/pcs/patterns': () => renderPlateMakingPage(),
  '/pcs/patterns/part-templates': () => renderPcsPartTemplateLibraryPage(),
  '/pcs/patterns/colors': () => renderPatternTaskPage(),
  '/pcs/patterns/revision': () => renderRevisionTaskPage(),
  '/pcs/patterns/plate-making': () => renderPlateMakingPage(),
  '/pcs/patterns/artwork': () => renderPatternTaskPage(),
  '/pcs/pattern-library': () => renderPcsPatternLibraryPage(),
  '/pcs/pattern-library/create': () => renderPcsPatternLibraryCreatePage(),
  '/pcs/pattern-library/config': () => renderPcsPatternLibraryConfigPage(),
  '/pcs/products/styles': () => renderProductSpuPage(),
  '/pcs/products/specifications': () => renderProductSkuPage(),
  '/pcs/products/channel-products': () => renderPcsChannelProductsPage(),
  '/pcs/products/channel-products/store': () => renderPcsChannelProductStoreViewPage(),
  '/pcs/products/channel-attributes': () => renderPcsChannelProductMappingPage(),
  '/pcs/products/coding-rules': () => renderPcsCodingRulesPage(),
  '/pcs/products/spu': () =>
    renderRouteRedirect('/pcs/products/styles', '正在跳转到款式档案'),
  '/pcs/products/sku': () =>
    renderRouteRedirect('/pcs/products/specifications', '正在跳转到规格档案'),
  '/pcs/products/yarn': () =>
    renderRouteRedirect('/pcs/materials/yarn', '正在跳转到纱线档案'),
  '/pcs/materials/fabric': () => renderPcsMaterialArchiveListPage('fabric'),
  '/pcs/materials/fabric/new': () => renderPcsMaterialArchiveEditorPage('fabric'),
  '/pcs/materials/accessory': () => renderPcsMaterialArchiveListPage('accessory'),
  '/pcs/materials/accessory/new': () => renderPcsMaterialArchiveEditorPage('accessory'),
  '/pcs/materials/yarn': () => renderPcsMaterialArchiveListPage('yarn'),
  '/pcs/materials/yarn/new': () => renderPcsMaterialArchiveEditorPage('yarn'),
  '/pcs/materials/consumable': () => renderPcsMaterialArchiveListPage('consumable'),
  '/pcs/materials/consumable/new': () => renderPcsMaterialArchiveEditorPage('consumable'),
  '/pcs/settings/cost-parameters': () => renderPcsCostParametersPage(),
  '/pcs/settings/config-workspace': () => renderConfigWorkspacePage(),
  '/pcs/settings/template-center': () => renderPcsTemplatesPage(),
  '/pcs/settings/platforms': () => renderPlatformConfigPage(),
  '/fcs/workbench/todos': () => renderTodosPage(),
  '/fcs/capacity/overview': () => renderCapacityOverviewPage(),
  '/fcs/capacity/risk': () => renderCapacityRiskPage(),
  '/fcs/capacity/bottleneck': () => renderCapacityBottleneckPage(),
  '/fcs/capacity/constraints': () => renderCapacityConstraintsPage(),
  '/fcs/capacity/policies': () => renderCapacityPoliciesPage(),
  '/fcs/production/demand-inbox': () => renderProductionDemandInboxPage(),
  '/fcs/production/orders': () => renderProductionOrdersPage(),
  '/fcs/production/plan': () => renderProductionPlanPage(),
  '/fcs/production/delivery-warehouse': () => renderProductionDeliveryWarehousePage(),
  '/fcs/production/changes': () => renderProductionChangesPage(),
  '/fcs/production/status': () => renderProductionStatusPage(),
  '/fcs/production/craft-dict': () => renderProductionCraftDictPage(),
  '/fcs/process/task-breakdown': () => renderTaskBreakdownPage(),
  '/fcs/process/dye-requirements': () => renderProcessDyeRequirementsPage(),
  '/fcs/process/print-requirements': () => renderProcessPrintRequirementsPage(),
  '/fcs/process/dye-orders': () => renderProcessDyeOrdersPage(),
  '/fcs/process/print-orders': () => renderProcessPrintOrdersPage(),
  '/fcs/process/material-issue': () => renderMaterialIssuePage(),
  '/fcs/quality/qc-records': () => renderQcRecordsPage(),
  '/fcs/quality/deduction-analysis': () => renderDeductionAnalysisPage(),
  '/fcs/quality/deduction-calc': () =>
    renderRouteRedirect('/fcs/quality/deduction-analysis', '正在跳转到扣款分析'),
  '/fcs/quality/arbitration': () =>
    renderRouteRedirect('/fcs/quality/qc-records?view=WAIT_PLATFORM_REVIEW', '正在跳转到质检记录'),
  '/fcs/quality/penalty-output': () => renderDeductionAnalysisPage(),
  // 对账与结算只固定 4 个主对象路由：对账单、预结算流水、车缝领料对账、预付款批次。
  // payment-sync 和 history 仅是预付款批次的生命周期视图；cutting-input 属于专项输入页。
  '/fcs/settlement/statements': () => renderStatementsPage(),
  '/fcs/settlement/adjustments': () => renderAdjustmentsPage(),
  '/fcs/settlement/batches': () => renderBatchesPage(),
  '/fcs/settlement/material-statements': () => renderMaterialStatementsPage(),
  '/fcs/settlement/payment-sync': () => renderPaymentSyncPage(),
  '/fcs/settlement/history': () => renderHistoryPage(),
  '/fcs/settlement/cutting-input': () =>
    renderRouteRedirect('/fcs/craft/cutting/settlement-scoring', '正在跳转到裁片结算评分'),
  '/fcs/dispatch/board': () => renderDispatchBoardPage(),
  '/fcs/dispatch/tenders': () => renderDispatchTendersPage(),
  '/fcs/dispatch/exceptions': () => renderProgressExceptionsPage(),
  '/fcs/progress/board': () => renderProgressBoardPage(),
  '/fcs/progress/exceptions': () => renderProgressExceptionsPage(),
  '/fcs/progress/handover': () => renderProgressHandoverPage(),
  '/fcs/progress/urge': () => renderProgressUrgePage(),
  '/fcs/progress/milestone-config': () => renderProgressMilestoneConfigPage(),
  '/fcs/progress/material': () => renderProgressMaterialPage(),
  '/fcs/progress/cutting-overview': () => renderProgressCuttingOverviewPage(),
  '/fcs/progress/cutting-exception-center': () => renderProgressCuttingExceptionCenterPage(),
  '/fcs/craft/workbench/overview': () => renderCraftWorkbenchOverviewPage(),
  '/fcs/craft/workbench/todos': () => renderCraftWorkbenchOverviewPage(),
  '/fcs/craft/workbench/risks': () => renderCraftWorkbenchOverviewPage(),
  // 下面这组 canonical 路由是裁片域后续实现和内部跳转的主入口。
  // 旧路由仍保留，但只承担兼容职责，后续功能不得再优先依赖旧路径命名。
  '/fcs/craft/cutting': () =>
    renderRouteRedirect('/fcs/craft/cutting/production-progress', '正在跳转到生产单进度'),
  '/fcs/craft/cutting/production-progress': () => renderCraftCuttingProductionProgressPage(),
  '/fcs/craft/cutting/cuttable-pool': () => renderCraftCuttingCuttablePoolPage(),
  '/fcs/craft/cutting/merge-batches': () => renderCraftCuttingMergeBatchesPage(),
  '/fcs/craft/cutting/original-orders': () => renderCraftCuttingOriginalOrdersPage(),
  '/fcs/craft/cutting/marker-list': () => renderCraftCuttingMarkerListPage(),
  '/fcs/craft/cutting/marker-create': () => renderCraftCuttingMarkerCreatePage(),
  '/fcs/craft/cutting/spreading-list': () => renderCraftCuttingSpreadingListPage(),
  '/fcs/craft/cutting/spreading-create': () => renderCraftCuttingSpreadingCreatePage(),
  '/fcs/craft/cutting/marker-spreading': () => renderCraftCuttingMarkerSpreadingPage(),
  '/fcs/craft/cutting/settlement-scoring': () => renderCuttingSettlementInputPage(),
  '/fcs/craft/cutting/marker-detail': () =>
    renderRouteRedirect('/fcs/craft/cutting/marker-list', '正在跳转到唛架列表'),
  '/fcs/craft/cutting/marker-edit': () =>
    renderRouteRedirect('/fcs/craft/cutting/marker-list', '正在跳转到唛架列表'),
  '/fcs/craft/cutting/spreading-detail': () => renderCraftCuttingSpreadingDetailPage(),
  '/fcs/craft/cutting/spreading-edit': () => renderCraftCuttingSpreadingEditPage(),
  '/fcs/craft/cutting/fei-tickets': () => renderCraftCuttingFeiTicketsPage(),
  '/fcs/craft/cutting/fei-ticket-detail': () => renderCraftCuttingFeiTicketDetailPage(),
  '/fcs/craft/cutting/fei-ticket-printed': () => renderCraftCuttingFeiTicketPrintedPage(),
  '/fcs/craft/cutting/fei-ticket-records': () => renderCraftCuttingFeiTicketRecordsPage(),
  '/fcs/craft/cutting/fei-ticket-print': () => renderCraftCuttingFeiTicketPrintPage(),
  '/fcs/craft/cutting/fei-ticket-continue-print': () => renderCraftCuttingFeiTicketContinuePrintPage(),
  '/fcs/craft/cutting/fei-ticket-reprint': () => renderCraftCuttingFeiTicketReprintPage(),
  '/fcs/craft/cutting/fei-ticket-void': () => renderCraftCuttingFeiTicketVoidPage(),
  '/fcs/craft/cutting/fabric-warehouse': () => renderCraftCuttingFabricWarehousePage(),
  '/fcs/craft/cutting/cut-piece-warehouse': () => renderCraftCuttingCutPieceWarehousePage(),
  '/fcs/craft/cutting/sample-warehouse': () => renderCraftCuttingSampleWarehousePage(),
  '/fcs/craft/cutting/transfer-bags': () => renderCraftCuttingTransferBagsPage(),
  '/fcs/craft/cutting/transfer-bag-detail': () => renderCraftCuttingTransferBagDetailPage(),
  '/fcs/craft/cutting/special-processes': () => renderCraftCuttingSpecialProcessesPage(),
  '/fcs/craft/cutting/summary': () => renderCraftCuttingSummaryPage(),
  // 裁片 alias 只用于承接历史入口；页面打开后必须展示 canonical 标题和 breadcrumb。
  // 兼容存在的目的仅是防止 404 和死链，不能继续把旧语义带回正式对象模型。
  '/fcs/craft/cutting/order-progress': () =>
    renderRouteRedirect('/fcs/craft/cutting/production-progress', '正在跳转到生产单进度'),
  '/fcs/craft/cutting/tasks': () =>
    renderRouteRedirect('/fcs/craft/cutting/production-progress', '正在跳转到生产单进度'),
  '/fcs/craft/cutting/material-prep': () => renderCraftCuttingMaterialPrepPage(),
  '/fcs/craft/cutting/orders': () =>
    renderRouteRedirect('/fcs/craft/cutting/original-orders', '正在跳转到原始裁片单'),
  '/fcs/craft/cutting/cut-piece-orders': () =>
    renderRouteRedirect('/fcs/craft/cutting/original-orders', '正在跳转到原始裁片单'),
  '/fcs/craft/cutting/fei-ticket': () =>
    renderRouteRedirect('/fcs/craft/cutting/fei-tickets', '正在跳转到打印菲票'),
  '/fcs/craft/cutting/fei-list': () =>
    renderRouteRedirect('/fcs/craft/cutting/fei-tickets', '正在跳转到打印菲票'),
  '/fcs/craft/cutting/warehouse': () =>
    renderRouteRedirect('/fcs/craft/cutting/fabric-warehouse', '正在跳转到裁床仓'),
  '/fcs/craft/cutting/warehouse-management': () =>
    renderRouteRedirect('/fcs/craft/cutting/fabric-warehouse', '正在跳转到裁床仓'),
  '/fcs/craft/cutting/replenishment': () => renderCraftCuttingReplenishmentPage(),
  '/fcs/craft/cutting/stats': () =>
    renderRouteRedirect('/fcs/craft/cutting/summary', '正在跳转到裁剪总表'),
  '/fcs/craft/cutting/bed-stats': () =>
    renderRouteRedirect('/fcs/craft/cutting/summary', '正在跳转到裁剪总表'),
  '/fcs/craft/cutting/cutting-summary': () =>
    renderRouteRedirect('/fcs/craft/cutting/summary', '正在跳转到裁剪总表'),
  '/fcs/craft/printing': () => renderCraftPrintingWorkOrdersPage(),
  '/fcs/craft/printing/work-orders': () => renderCraftPrintingWorkOrdersPage(),
  '/fcs/craft/printing/tasks': () => renderCraftPrintingWorkOrdersPage(),
  '/fcs/craft/printing/orders': () => renderCraftPrintingWorkOrdersPage(),
  '/fcs/craft/printing/pending-review': () => renderCraftPrintingPendingReviewPage(),
  '/fcs/craft/printing/batches': () => renderCraftPrintingPendingReviewPage(),
  '/fcs/craft/printing/progress': () => renderCraftPrintingProgressPage(),
  '/fcs/craft/printing/stats': () => renderCraftPrintingStatisticsPage(),
  '/fcs/craft/printing/statistics': () => renderCraftPrintingStatisticsPage(),
  '/fcs/craft/printing/dashboards': () => renderCraftPrintingDashboardsPage(),
  '/fcs/craft/dyeing': () => renderCraftDyeingWorkOrdersPage(),
  '/fcs/craft/dyeing/work-orders': () => renderCraftDyeingWorkOrdersPage(),
  '/fcs/craft/dyeing/tasks': () => renderCraftDyeingWorkOrdersPage(),
  '/fcs/craft/dyeing/orders': () => renderCraftDyeingDyeOrdersPage(),
  '/fcs/craft/dyeing/dye-orders': () => renderCraftDyeingDyeOrdersPage(),
  '/fcs/craft/dyeing/batches': () => renderCraftDyeingDyeOrdersPage(),
  '/fcs/craft/dyeing/stats': () => renderCraftDyeingReportsPage(),
  '/fcs/craft/dyeing/reports': () => renderCraftDyeingReportsPage(),
  '/fcs/production/create': () =>
    renderPlaceholderPage(
      '生成生产单',
      '根据生产需求创建生产单，包括拆单规则配置、批次划分、工艺路线选择等。',
      '生产单管理',
    ),
  '/fcs/trace/mapping': () =>
    renderTraceMappingPage(),
  '/fcs/trace/parent-codes': () =>
    renderTraceParentCodesPage(),
  '/fcs/trace/unique-codes': () =>
    renderTraceUniqueCodesPage(),
  '/fcs/trace/unit-price': () =>
    renderTraceUnitPricePage(),
  '/fcs/pda': () => renderPdaNotifyPage(),
  '/fcs/pda/notify': () => renderPdaNotifyPage(),
  '/fcs/pda/notify/due-soon': () => renderPdaNotifyDueSoonPage(),
  '/fcs/pda/quality': () => renderPdaQualityPage(),
  '/fcs/pda/task-receive': () => renderPdaTaskReceivePage(),
  '/fcs/pda/exec': () => renderPdaExecPage(),
  '/fcs/pda/handover': () => renderPdaHandoverPage(),
  '/fcs/pda/settlement': () => renderPdaSettlementPage(),
}

const dynamicRoutes: Array<{ pattern: RegExp; render: (match: RegExpExecArray) => string }> = [
  {
    pattern: /^\/fcs\/craft\/cutting\/marker-edit\/([^/]+)$/,
    render: (match) => renderCraftCuttingMarkerPlanEditPage(match[1]),
  },
  {
    pattern: /^\/fcs\/craft\/cutting\/marker-detail\/([^/]+)$/,
    render: (match) => renderCraftCuttingMarkerPlanDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/templates\/([^/]+)\/edit$/,
    render: (match) => renderPcsTemplateEditPage(match[1]),
  },
  {
    pattern: /^\/pcs\/templates\/([^/]+)$/,
    render: (match) => renderPcsTemplateDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/work-items\/([^/]+)\/edit$/,
    render: (match) => renderPcsWorkItemEditPage(match[1]),
  },
  {
    pattern: /^\/pcs\/work-items\/([^/]+)$/,
    render: (match) => renderPcsWorkItemDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/pattern-library\/([^/]+)$/,
    render: (match) => renderPcsPatternLibraryDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/materials\/(fabric|accessory|yarn|consumable)\/([^/]+)\/edit$/,
    render: (match) =>
      renderPcsMaterialArchiveEditorPage(match[1] as MaterialArchiveKind, match[2]),
  },
  {
    pattern: /^\/pcs\/materials\/(fabric|accessory|yarn|consumable)\/([^/]+)$/,
    render: (match) =>
      renderPcsMaterialArchiveDetailPage(match[1] as MaterialArchiveKind, match[2]),
  },
  {
    pattern: /^\/pcs\/products\/styles\/([^/]+)$/,
    render: (match) => renderPcsProductStyleDetailPage(decodeURIComponent(match[1])),
  },
  {
    pattern: /^\/pcs\/products\/spu\/([^/]+)$/,
    render: (match) =>
      renderRouteRedirect(`/pcs/products/styles/${match[1]}`, '正在跳转到款式档案详情'),
  },
  {
    pattern: /^\/pcs\/products\/channel-products\/([^/]+)$/,
    render: (match) => renderPcsChannelProductDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/channels\/products\/([^/]+)$/,
    render: (match) =>
      renderRouteRedirect(`/pcs/products/channel-products/${match[1]}`, '正在跳转到渠道商品详情'),
  },
  {
    pattern: /^\/pcs\/products\/sku\/([^/]+)$/,
    render: () =>
      renderRouteRedirect('/pcs/products/specifications', '正在跳转到规格档案'),
  },
  {
    pattern: /^\/pcs\/projects\/([^/]+)\/work-items\/([^/]+)$/,
    render: (match) => {
      const [, projectId, projectNodeId] = match
      return renderPcsProjectWorkItemDetailPage(projectId, projectNodeId)
    },
  },
  {
    pattern: /^\/pcs\/projects\/([^/]+)\/archive$/,
    render: (match) => renderPcsProjectArchivePage(match[1]),
  },
  {
    pattern: /^\/pcs\/projects\/([^/]+)$/,
    render: (match) => renderPcsProjectDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/testing\/live\/([^/]+)$/,
    render: (match) => renderPcsLiveSessionDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/testing\/video\/([^/]+)$/,
    render: (match) => renderPcsVideoRecordDetailPage(match[1]),
  },
  {
    pattern: /^\/pcs\/channels\/stores\/([^/]+)$/,
    render: (match) => renderPcsChannelStoreDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/production\/orders\/([^/]+)$/,
    render: (match) => renderProductionOrderDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/factories\/settlement\/new\/([^/]+)$/,
    render: (match) => renderSettlementInitPage(match[1]),
  },
  {
    pattern: /^\/fcs\/factories\/settlement\/([^/]+)$/,
    render: (match) => renderSettlementDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/quality\/qc-records\/([^/]+)$/,
    render: (match) => renderQcRecordDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/qc-records\/([^/]+)$/,
    render: (match) => renderQcRecordMobileDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/quality\/([^/]+)$/,
    render: (match) => renderPdaQualityDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/quality\/deduction-calc\/([^/]+)$/,
    render: (match) =>
      renderRouteRedirect(
        buildDeductionEntryHrefByBasisId(decodeURIComponent(match[1])),
        '正在跳转到关联质检记录',
      ),
  },
  {
    pattern: /^\/pcs\/products\/styles\/([^/]+)\/technical-data\/([^/]+)$/,
    render: (match) =>
      renderTechPackPage(match[2], {
        styleId: decodeURIComponent(match[1]),
        technicalVersionId: decodeURIComponent(match[2]),
      }),
  },
  {
    pattern: /^\/fcs\/tech-pack\/([^/]+)$/,
    render: (match) =>
      renderTechPackPage(match[1], {
        compatibilityMode: true,
      }),
  },
  {
    pattern: /^\/fcs\/pda\/notify\/([^/]+)$/,
    render: (match) => renderPdaNotifyDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/exec\/([^/]+)$/,
    render: (match) => renderPdaExecDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/task\/([^/]+)$/,
    render: (match) => renderPdaCuttingTaskDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/unit\/([^/]+)\/([^/]+)$/,
    render: (match) => renderPdaCuttingExecutionUnitPage(match[1], match[2]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/pickup\/([^/]+)$/,
    render: (match) => renderPdaCuttingPickupPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/spreading\/([^/]+)$/,
    render: (match) => renderPdaCuttingSpreadingPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/inbound\/([^/]+)$/,
    render: (match) => renderPdaCuttingInboundPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/handover\/([^/]+)$/,
    render: (match) => renderPdaCuttingHandoverPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/cutting\/replenishment-feedback\/([^/]+)$/,
    render: (match) => renderPdaCuttingReplenishmentFeedbackPage(match[1]),
  },
  {
    pattern: /^\/fcs\/progress\/cutting-overview\/([^/]+)$/,
    render: (match) => renderProgressCuttingDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/task-receive\/([^/]+)$/,
    render: (match) => renderPdaTaskReceiveDetailPage(match[1]),
  },
  {
    pattern: /^\/fcs\/progress\/handover\/order\/([^/]+)$/,
    render: (match) => renderProgressHandoverOrderPage(match[1]),
  },
  {
    pattern: /^\/fcs\/pda\/handover\/([^/]+)$/,
    render: (match) => renderPdaHandoverDetailPage(match[1]),
  },
]

function findMenuByPath(pathname: string): { group: MenuGroup; item: MenuItem } | null {
  const normalizedPathname = normalizePathname(pathname)
  const allGroups = Object.values(menusBySystem).flat()

  for (const group of allGroups) {
    for (const item of group.items) {
      if (item.href === normalizedPathname) {
        return { group, item }
      }

      if (item.children) {
        const child = item.children.find((childItem) => childItem.href === normalizedPathname)
        if (child) {
          return { group, item: child }
        }
      }
    }
  }

  return null
}

export function resolvePage(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname)

  const directRenderer = exactRoutes[normalizedPathname]
  if (directRenderer) {
    return directRenderer(normalizedPathname)
  }

  for (const route of dynamicRoutes) {
    const matched = route.pattern.exec(normalizedPathname)
    if (matched) {
      return route.render(matched)
    }
  }

  const menu = findMenuByPath(normalizedPathname)
  if (menu) {
    return renderPlaceholderPage(
      menu.item.title,
      `${menu.item.title} 页面已接入路由与菜单联动，待迁移完整 UI 与交互。`,
      menu.group.title,
    )
  }

  return renderRouteNotFound(pathname)
}
