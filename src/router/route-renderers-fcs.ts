type AnyAsyncRenderer = (...args: unknown[]) => Promise<string>

type RenderRoute = (...args: unknown[]) => Promise<string>

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => RenderRoute {
  let modulePromise: Promise<Record<string, unknown>> | null = null

  return async (...args: TArgs): Promise<string> => {
    if (!modulePromise) {
      modulePromise = importModule()
    }

    const module = await modulePromise
    const renderer = module[exportName]

    if (typeof renderer !== 'function') {
      throw new Error(`页面渲染函数不存在: ${exportName}`)
    }

    return (renderer as AnyAsyncRenderer)(...args)
  }
}

export const renderTaskBreakdownPage = createAsyncRenderer(() => import('../pages/task-breakdown'), 'renderTaskBreakdownPage')
export const renderCapabilityPage = createAsyncRenderer(() => import('../pages/capability'), 'renderCapabilityPage')
export const renderFactoryCapacityProfilePage = createAsyncRenderer(
  () => import('../pages/factory-capacity-profile'),
  'renderFactoryCapacityProfilePage',
)
export const renderFactoryPerformancePage = createAsyncRenderer(
  () => import('../pages/factory-performance'),
  'renderFactoryPerformancePage',
)
export const renderFactoryProfilePage = createAsyncRenderer(() => import('../pages/factory-profile'), 'renderFactoryProfilePage')
export const renderFactoryStatusPage = createAsyncRenderer(() => import('../pages/factory-status'), 'renderFactoryStatusPage')
export const renderOverviewPage = createAsyncRenderer(() => import('../pages/workbench'), 'renderOverviewPage')
export const renderTodosPage = createAsyncRenderer(() => import('../pages/workbench'), 'renderTodosPage')
export const renderCapacityBottleneckPage = createAsyncRenderer(
  () => import('../pages/capacity'),
  'renderCapacityBottleneckPage',
)
export const renderCapacityConstraintsPage = createAsyncRenderer(
  () => import('../pages/capacity'),
  'renderCapacityConstraintsPage',
)
export const renderCapacityOverviewPage = createAsyncRenderer(
  () => import('../pages/capacity'),
  'renderCapacityOverviewPage',
)
export const renderCapacityPoliciesPage = createAsyncRenderer(
  () => import('../pages/capacity'),
  'renderCapacityPoliciesPage',
)
export const renderCapacityRiskPage = createAsyncRenderer(() => import('../pages/capacity'), 'renderCapacityRiskPage')
export const renderProductionChangesPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangesPage',
)
export const renderProductionCraftDictPage = createAsyncRenderer(
  () => import('../pages/production-craft-dict'),
  'renderProductionCraftDictPage',
)
export const renderProductionDemandInboxPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionDemandInboxPage',
)
export const renderProductionDeliveryWarehousePage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionDeliveryWarehousePage',
)
export const renderProductionOrderDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionOrderDetailPage',
)
export const renderProductionOrdersPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionOrdersPage',
)
export const renderProductionPlanPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionPlanPage',
)
export const renderProductionStatusPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionStatusPage',
)
export const renderProcessDyeOrdersPage = createAsyncRenderer(
  () => import('../pages/process-dye-orders'),
  'renderProcessDyeOrdersPage',
)
export const renderProcessDyeRequirementsPage = createAsyncRenderer(
  () => import('../pages/process-dye-requirements'),
  'renderProcessDyeRequirementsPage',
)
export const renderProcessPrintOrdersPage = createAsyncRenderer(
  () => import('../pages/process-print-orders'),
  'renderProcessPrintOrdersPage',
)
export const renderProcessPrintRequirementsPage = createAsyncRenderer(
  () => import('../pages/process-print-requirements'),
  'renderProcessPrintRequirementsPage',
)
export const renderMaterialIssuePage = createAsyncRenderer(
  () => import('../pages/material-issue'),
  'renderMaterialIssuePage',
)
export const renderQcRecordDetailPage = createAsyncRenderer(
  () => import('../pages/qc-records'),
  'renderQcRecordDetailPage',
)
export const renderQcRecordsPage = createAsyncRenderer(() => import('../pages/qc-records'), 'renderQcRecordsPage')
export const renderDeductionAnalysisPage = createAsyncRenderer(
  () => import('../pages/deduction-analysis'),
  'renderDeductionAnalysisPage',
)
export const renderBatchesPage = createAsyncRenderer(() => import('../pages/batches'), 'renderBatchesPage')
export const renderSettlementListPage = createAsyncRenderer(() => import('../pages/settlement'), 'renderSettlementListPage')
export const renderSettlementDetailPage = createAsyncRenderer(
  () => import('../pages/settlement'),
  'renderSettlementDetailPage',
)
export const renderSettlementInitPage = createAsyncRenderer(
  () => import('../pages/settlement'),
  'renderSettlementInitPage',
)
export const renderTechPackPage = createAsyncRenderer(() => import('../pages/tech-pack'), 'renderTechPackPage')
export const renderMaterialStatementsPage = createAsyncRenderer(
  () => import('../pages/material-statements'),
  'renderMaterialStatementsPage',
)
export const renderHistoryPage = createAsyncRenderer(() => import('../pages/history'), 'renderHistoryPage')
export const renderPaymentSyncPage = createAsyncRenderer(() => import('../pages/payment-sync'), 'renderPaymentSyncPage')
export const renderStatementsPage = createAsyncRenderer(() => import('../pages/statements'), 'renderStatementsPage')
export const renderAdjustmentsPage = createAsyncRenderer(() => import('../pages/adjustments'), 'renderAdjustmentsPage')
export const renderDispatchBoardPage = createAsyncRenderer(() => import('../pages/dispatch-board'), 'renderDispatchBoardPage')
export const renderDispatchTendersPage = createAsyncRenderer(
  () => import('../pages/dispatch-tenders'),
  'renderDispatchTendersPage',
)
export const renderProgressBoardPage = createAsyncRenderer(() => import('../pages/progress-board'), 'renderProgressBoardPage')
export const renderProgressCuttingDetailPage = createAsyncRenderer(
  () => import('../pages/progress-cutting-detail'),
  'renderProgressCuttingDetailPage',
)
export const renderProgressCuttingExceptionCenterPage = createAsyncRenderer(
  () => import('../pages/progress-cutting-exception-center'),
  'renderProgressCuttingExceptionCenterPage',
)
export const renderProgressCuttingOverviewPage = createAsyncRenderer(
  () => import('../pages/progress-cutting-overview'),
  'renderProgressCuttingOverviewPage',
)
export const renderProgressExceptionsPage = createAsyncRenderer(
  () => import('../pages/progress-exceptions'),
  'renderProgressExceptionsPage',
)
export const renderProgressHandoverOrderPage = createAsyncRenderer(
  () => import('../pages/progress-handover-order'),
  'renderProgressHandoverOrderPage',
)
export const renderProgressHandoverPage = createAsyncRenderer(
  () => import('../pages/progress-handover'),
  'renderProgressHandoverPage',
)
export const renderProgressMaterialPage = createAsyncRenderer(
  () => import('../pages/progress-material'),
  'renderProgressMaterialPage',
)
export const renderProgressMilestoneConfigPage = createAsyncRenderer(
  () => import('../pages/progress-milestone-config'),
  'renderProgressMilestoneConfigPage',
)
export const renderProgressUrgePage = createAsyncRenderer(() => import('../pages/progress-urge'), 'renderProgressUrgePage')
export const renderCraftWorkbenchOverviewPage = createAsyncRenderer(
  () => import('../pages/process-factory/workbench/overview'),
  'renderCraftWorkbenchOverviewPage',
)
export const renderCraftCuttingCuttablePoolPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cuttable-pool'),
  'renderCraftCuttingCuttablePoolPage',
)
export const renderCraftCuttingCutPieceWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cut-piece-warehouse'),
  'renderCraftCuttingCutPieceWarehousePage',
)
export const renderCraftCuttingFeiTicketContinuePrintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketContinuePrintPage',
)
export const renderCraftCuttingFeiTicketDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketDetailPage',
)
export const renderCraftCuttingFeiTicketPrintedPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketPrintedPage',
)
export const renderCraftCuttingFeiTicketReprintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketReprintPage',
)
export const renderCraftCuttingFeiTicketRecordsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketRecordsPage',
)
export const renderCraftCuttingFeiTicketVoidPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketVoidPage',
)
export const renderCraftCuttingFeiTicketsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketsPage',
)
export const renderCraftCuttingMaterialPrepPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/material-prep'),
  'renderCraftCuttingMaterialPrepPage',
)
export const renderCraftCuttingMergeBatchesPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/merge-batches'),
  'renderCraftCuttingMergeBatchesPage',
)
export const renderCraftCuttingOriginalOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/original-orders'),
  'renderCraftCuttingOriginalOrdersPage',
)
export const renderCraftCuttingProductionProgressPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/production-progress'),
  'renderCraftCuttingProductionProgressPage',
)
export const renderPlaceholderPage = createAsyncRenderer(() => import('../pages/placeholder'), 'renderPlaceholderPage')
export const renderCraftCuttingMarkerCreatePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerCreatePage',
)
export const renderCraftCuttingMarkerListPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerListPage',
)
export const renderCraftCuttingMarkerPlanDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerPlanDetailPage',
)
export const renderCraftCuttingMarkerPlanEditPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerPlanEditPage',
)
export const renderCraftCuttingMarkerSpreadingPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingMarkerSpreadingPage',
)
export const renderCraftCuttingReplenishmentPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/replenishment'),
  'renderCraftCuttingReplenishmentPage',
)
export const renderCraftCuttingSampleWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/sample-warehouse'),
  'renderCraftCuttingSampleWarehousePage',
)
export const renderCraftCuttingSpecialProcessesPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/special-processes'),
  'renderCraftCuttingSpecialProcessesPage',
)
export const renderCraftCuttingSpreadingCreatePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingCreatePage',
)
export const renderCraftCuttingSpreadingDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingDetailPage',
)
export const renderCraftCuttingSpreadingEditPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingEditPage',
)
export const renderCraftCuttingSpreadingListPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingListPage',
)
export const renderCraftCuttingSummaryPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cutting-summary'),
  'renderCraftCuttingSummaryPage',
)
export const renderCraftCuttingTransferBagDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/transfer-bags'),
  'renderCraftCuttingTransferBagDetailPage',
)
export const renderCraftCuttingTransferBagsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/transfer-bags'),
  'renderCraftCuttingTransferBagsPage',
)
export const renderCraftCuttingFabricWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fabric-warehouse'),
  'renderCraftCuttingFabricWarehousePage',
)
export const renderCraftPrintingDashboardsPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/dashboards'),
  'renderCraftPrintingDashboardsPage',
)
export const renderCraftPrintingPendingReviewPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/pending-review'),
  'renderCraftPrintingPendingReviewPage',
)
export const renderCraftPrintingProgressPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/progress'),
  'renderCraftPrintingProgressPage',
)
export const renderCraftPrintingStatisticsPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/statistics'),
  'renderCraftPrintingStatisticsPage',
)
export const renderCraftPrintingWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/work-orders'),
  'renderCraftPrintingWorkOrdersPage',
)
export const renderCraftDyeingDyeOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/dye-orders'),
  'renderCraftDyeingDyeOrdersPage',
)
export const renderCraftDyeingReportsPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/reports'),
  'renderCraftDyeingReportsPage',
)
export const renderCraftDyeingWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/work-orders'),
  'renderCraftDyeingWorkOrdersPage',
)
export const renderTraceMappingPage = createAsyncRenderer(() => import('../pages/trace'), 'renderTraceMappingPage')
export const renderTraceParentCodesPage = createAsyncRenderer(
  () => import('../pages/trace'),
  'renderTraceParentCodesPage',
)
export const renderTraceUniqueCodesPage = createAsyncRenderer(
  () => import('../pages/trace'),
  'renderTraceUniqueCodesPage',
)
export const renderTraceUnitPricePage = createAsyncRenderer(() => import('../pages/trace'), 'renderTraceUnitPricePage')
export const renderCuttingSettlementInputPage = createAsyncRenderer(
  () => import('../pages/settlement-cutting-input'),
  'renderCuttingSettlementInputPage',
)
