type AnyAsyncRenderer = (...args: unknown[]) => Promise<string>

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => Promise<string> {
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

export const renderFactoryProfilePage = createAsyncRenderer(() => import('../pages/factory-profile'), 'renderFactoryProfilePage')
export const renderFactoryCapacityProfilePage = createAsyncRenderer(
  () => import('../pages/factory-capacity-profile'),
  'renderFactoryCapacityProfilePage',
)
export const renderOverviewPage = createAsyncRenderer(() => import('../pages/workbench'), 'renderOverviewPage')
export const renderTodosPage = createAsyncRenderer(() => import('../pages/workbench'), 'renderTodosPage')
export const renderPcsResetPlaceholderPage = createAsyncRenderer(
  () => import('../pages/pcs-reset-placeholder'),
  'renderPcsResetPlaceholderPage',
)
export const renderPlaceholderPage = createAsyncRenderer(() => import('../pages/placeholder'), 'renderPlaceholderPage')
export const renderRouteNotFound = createAsyncRenderer(() => import('../pages/placeholder'), 'renderRouteNotFound')
export const renderPcsPartTemplateLibraryPage = createAsyncRenderer(
  () => import('../pages/pcs-part-template-library'),
  'renderPcsPartTemplateLibraryPage',
)
export const renderPcsPatternLibraryPage = createAsyncRenderer(
  () => import('../pages/pcs-pattern-library'),
  'renderPcsPatternLibraryPage',
)
export const renderPcsPatternLibraryCreatePage = createAsyncRenderer(
  () => import('../pages/pcs-pattern-library-create'),
  'renderPcsPatternLibraryCreatePage',
)
export const renderPcsPatternLibraryDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-pattern-library-detail'),
  'renderPcsPatternLibraryDetailPage',
)
export const renderPcsPatternLibraryConfigPage = createAsyncRenderer(
  () => import('../pages/pcs-pattern-library-config'),
  'renderPcsPatternLibraryConfigPage',
)
export const renderPcsWorkItemLibraryPage = createAsyncRenderer(
  () => import('../pages/pcs-work-items'),
  'renderPcsWorkItemLibraryPage',
)
export const renderPcsWorkItemDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-work-items'),
  'renderPcsWorkItemDetailPage',
)
export const renderPcsLiveTestingListPage = createAsyncRenderer(
  () => import('../pages/pcs-live-testing'),
  'renderPcsLiveTestingListPage',
)
export const renderPcsLiveTestingDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-live-testing'),
  'renderPcsLiveTestingDetailPage',
)
export const renderPcsVideoTestingListPage = createAsyncRenderer(
  () => import('../pages/pcs-video-testing'),
  'renderPcsVideoTestingListPage',
)
export const renderPcsVideoTestingDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-video-testing'),
  'renderPcsVideoTestingDetailPage',
)
export const renderPcsChannelStoreListPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-stores'),
  'renderPcsChannelStoreListPage',
)
export const renderPcsChannelStoreDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-stores'),
  'renderPcsChannelStoreDetailPage',
)
export const renderPcsChannelStoreSyncPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-stores'),
  'renderPcsChannelStoreSyncPage',
)
export const renderPcsStyleArchiveListPage = createAsyncRenderer(
  () => import('../pages/pcs-product-archives'),
  'renderPcsStyleArchiveListPage',
)
export const renderPcsStyleArchiveDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-product-archives'),
  'renderPcsStyleArchiveDetailPage',
)
export const renderPcsSpecificationListPage = createAsyncRenderer(
  () => import('../pages/pcs-product-archives'),
  'renderPcsSpecificationListPage',
)
export const renderPcsSpecificationDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-product-archives'),
  'renderPcsSpecificationDetailPage',
)
export const renderPcsPayoutAccountListPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-stores'),
  'renderPcsPayoutAccountListPage',
)
export const renderPcsPayoutAccountDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-stores'),
  'renderPcsPayoutAccountDetailPage',
)
export const renderPcsFabricArchiveListPage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsFabricArchiveListPage',
)
export const renderPcsFabricArchiveCreatePage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsFabricArchiveCreatePage',
)
export const renderPcsAccessoryArchiveListPage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsAccessoryArchiveListPage',
)
export const renderPcsAccessoryArchiveCreatePage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsAccessoryArchiveCreatePage',
)
export const renderPcsYarnArchiveListPage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsYarnArchiveListPage',
)
export const renderPcsYarnArchiveCreatePage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsYarnArchiveCreatePage',
)
export const renderPcsConsumableArchiveListPage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsConsumableArchiveListPage',
)
export const renderPcsConsumableArchiveCreatePage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsConsumableArchiveCreatePage',
)
export const renderPcsMaterialArchiveDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-material-archives'),
  'renderPcsMaterialArchiveDetailPage',
)
export const renderPcsChannelProductListPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-products'),
  'renderPcsChannelProductListPage',
)
export const renderPcsChannelProductDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-channel-products'),
  'renderPcsChannelProductDetailPage',
)
export const renderPcsTemplateListPage = createAsyncRenderer(
  () => import('../pages/pcs-templates'),
  'renderPcsTemplateListPage',
)
export const renderPcsTemplateDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-templates'),
  'renderPcsTemplateDetailPage',
)
export const renderPcsTemplateEditorPage = createAsyncRenderer(
  () => import('../pages/pcs-templates'),
  'renderPcsTemplateEditorPage',
)
export const renderPcsConfigWorkspacePage = createAsyncRenderer(
  () => import('../pages/pcs-config-workspace'),
  'renderPcsConfigWorkspacePage',
)
export const renderPcsProjectListPage = createAsyncRenderer(
  () => import('../pages/pcs-projects-list'),
  'renderPcsProjectListPage',
)
export const renderPcsProjectCreatePage = createAsyncRenderer(
  () => import('../pages/pcs-projects'),
  'renderPcsProjectCreatePage',
)
export const renderPcsProjectDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-projects'),
  'renderPcsProjectDetailPage',
)
export const renderPcsProjectWorkItemDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-projects'),
  'renderPcsProjectWorkItemDetailPage',
)
export const renderPcsRevisionTaskPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsRevisionTaskPage',
)
export const renderPcsRevisionTaskDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsRevisionTaskDetailPage',
)
export const renderPcsPlateMakingTaskPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsPlateMakingTaskPage',
)
export const renderPcsPlateMakingTaskDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsPlateMakingTaskDetailPage',
)
export const renderPcsPatternTaskPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsPatternTaskPage',
)
export const renderPcsPatternTaskDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsPatternTaskDetailPage',
)
export const renderPcsFirstSampleTaskPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsFirstSampleTaskPage',
)
export const renderPcsFirstSampleTaskDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsFirstSampleTaskDetailPage',
)
export const renderPcsFirstOrderSampleTaskPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsFirstOrderSampleTaskPage',
)
export const renderPcsFirstOrderSampleTaskDetailPage = createAsyncRenderer(
  () => import('../pages/pcs-engineering-tasks'),
  'renderPcsFirstOrderSampleTaskDetailPage',
)
export const renderCapabilityPage = createAsyncRenderer(() => import('../pages/capability'), 'renderCapabilityPage')
export const renderFactoryStatusPage = createAsyncRenderer(() => import('../pages/factory-status'), 'renderFactoryStatusPage')
export const renderFactoryPerformancePage = createAsyncRenderer(() => import('../pages/factory-performance'), 'renderFactoryPerformancePage')
export const renderSettlementDetailPage = createAsyncRenderer(() => import('../pages/settlement'), 'renderSettlementDetailPage')
export const renderSettlementInitPage = createAsyncRenderer(() => import('../pages/settlement'), 'renderSettlementInitPage')
export const renderSettlementListPage = createAsyncRenderer(() => import('../pages/settlement'), 'renderSettlementListPage')
export const renderCapacityOverviewPage = createAsyncRenderer(() => import('../pages/capacity'), 'renderCapacityOverviewPage')
export const renderCapacityRiskPage = createAsyncRenderer(() => import('../pages/capacity'), 'renderCapacityRiskPage')
export const renderCapacityBottleneckPage = createAsyncRenderer(() => import('../pages/capacity'), 'renderCapacityBottleneckPage')
export const renderCapacityConstraintsPage = createAsyncRenderer(() => import('../pages/capacity'), 'renderCapacityConstraintsPage')
export const renderCapacityPoliciesPage = createAsyncRenderer(() => import('../pages/capacity'), 'renderCapacityPoliciesPage')
export const renderProductionDemandInboxPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionDemandInboxPage',
)
export const renderProductionOrdersPage = createAsyncRenderer(() => import('../pages/production'), 'renderProductionOrdersPage')
export const renderProductionPlanPage = createAsyncRenderer(() => import('../pages/production'), 'renderProductionPlanPage')
export const renderProductionDeliveryWarehousePage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionDeliveryWarehousePage',
)
export const renderProductionChangesPage = createAsyncRenderer(() => import('../pages/production'), 'renderProductionChangesPage')
export const renderProductionStatusPage = createAsyncRenderer(() => import('../pages/production'), 'renderProductionStatusPage')
export const renderProductionOrderDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionOrderDetailPage',
)
export const renderProductionCraftDictPage = createAsyncRenderer(
  () => import('../pages/production-craft-dict'),
  'renderProductionCraftDictPage',
)
export const renderTechPackPage = createAsyncRenderer(() => import('../pages/tech-pack/core'), 'renderTechPackPage')
export const renderTaskBreakdownPage = createAsyncRenderer(() => import('../pages/task-breakdown'), 'renderTaskBreakdownPage')
export const renderProcessDyeRequirementsPage = createAsyncRenderer(
  () => import('../pages/process-dye-requirements'),
  'renderProcessDyeRequirementsPage',
)
export const renderProcessPrintRequirementsPage = createAsyncRenderer(
  () => import('../pages/process-print-requirements'),
  'renderProcessPrintRequirementsPage',
)
export const renderProcessDyeOrdersPage = createAsyncRenderer(
  () => import('../pages/process-dye-orders'),
  'renderProcessDyeOrdersPage',
)
export const renderProcessPrintOrdersPage = createAsyncRenderer(
  () => import('../pages/process-print-orders'),
  'renderProcessPrintOrdersPage',
)
export const renderMaterialIssuePage = createAsyncRenderer(() => import('../pages/material-issue'), 'renderMaterialIssuePage')
export const renderQcRecordDetailPage = createAsyncRenderer(() => import('../pages/qc-records'), 'renderQcRecordDetailPage')
export const renderQcRecordMobileDetailPage = createAsyncRenderer(
  () => import('../pages/qc-records'),
  'renderQcRecordMobileDetailPage',
)
export const renderQcRecordsPage = createAsyncRenderer(() => import('../pages/qc-records'), 'renderQcRecordsPage')
export const renderDeductionAnalysisPage = createAsyncRenderer(
  () => import('../pages/deduction-analysis'),
  'renderDeductionAnalysisPage',
)
export const renderStatementsPage = createAsyncRenderer(() => import('../pages/statements'), 'renderStatementsPage')
export const renderAdjustmentsPage = createAsyncRenderer(() => import('../pages/adjustments'), 'renderAdjustmentsPage')
export const renderBatchesPage = createAsyncRenderer(() => import('../pages/batches'), 'renderBatchesPage')
export const renderMaterialStatementsPage = createAsyncRenderer(
  () => import('../pages/material-statements'),
  'renderMaterialStatementsPage',
)
export const renderPaymentSyncPage = createAsyncRenderer(() => import('../pages/payment-sync'), 'renderPaymentSyncPage')
export const renderHistoryPage = createAsyncRenderer(() => import('../pages/history'), 'renderHistoryPage')
export const renderCuttingSettlementInputPage = createAsyncRenderer(
  () => import('../pages/settlement-cutting-input'),
  'renderCuttingSettlementInputPage',
)
export const renderDispatchBoardPage = createAsyncRenderer(() => import('../pages/dispatch-board'), 'renderDispatchBoardPage')
export const renderDispatchTendersPage = createAsyncRenderer(() => import('../pages/dispatch-tenders'), 'renderDispatchTendersPage')
export const renderProgressBoardPage = createAsyncRenderer(() => import('../pages/progress-board'), 'renderProgressBoardPage')
export const renderProgressExceptionsPage = createAsyncRenderer(() => import('../pages/progress-exceptions'), 'renderProgressExceptionsPage')
export const renderProgressMaterialPage = createAsyncRenderer(() => import('../pages/progress-material'), 'renderProgressMaterialPage')
export const renderProgressUrgePage = createAsyncRenderer(() => import('../pages/progress-urge'), 'renderProgressUrgePage')
export const renderProgressHandoverPage = createAsyncRenderer(() => import('../pages/progress-handover'), 'renderProgressHandoverPage')
export const renderProgressHandoverOrderPage = createAsyncRenderer(
  () => import('../pages/progress-handover-order'),
  'renderProgressHandoverOrderPage',
)
export const renderProgressMilestoneConfigPage = createAsyncRenderer(
  () => import('../pages/progress-milestone-config'),
  'renderProgressMilestoneConfigPage',
)
export const renderProgressCuttingOverviewPage = createAsyncRenderer(
  () => import('../pages/progress-cutting-overview'),
  'renderProgressCuttingOverviewPage',
)
export const renderProgressCuttingDetailPage = createAsyncRenderer(
  () => import('../pages/progress-cutting-detail'),
  'renderProgressCuttingDetailPage',
)
export const renderProgressCuttingExceptionCenterPage = createAsyncRenderer(
  () => import('../pages/progress-cutting-exception-center'),
  'renderProgressCuttingExceptionCenterPage',
)
export const renderTraceMappingPage = createAsyncRenderer(() => import('../pages/trace'), 'renderTraceMappingPage')
export const renderTraceParentCodesPage = createAsyncRenderer(() => import('../pages/trace'), 'renderTraceParentCodesPage')
export const renderTraceUnitPricePage = createAsyncRenderer(() => import('../pages/trace'), 'renderTraceUnitPricePage')
export const renderTraceUniqueCodesPage = createAsyncRenderer(() => import('../pages/trace'), 'renderTraceUniqueCodesPage')
export const renderPdaNotifyPage = createAsyncRenderer(() => import('../pages/pda-notify'), 'renderPdaNotifyPage')
export const renderPdaLoginPage = createAsyncRenderer(() => import('../pages/pda-login'), 'renderPdaLoginPage')
export const renderPdaNotifyDueSoonPage = createAsyncRenderer(
  () => import('../pages/pda-notify-due-soon'),
  'renderPdaNotifyDueSoonPage',
)
export const renderPdaNotifyDetailPage = createAsyncRenderer(
  () => import('../pages/pda-notify-detail'),
  'renderPdaNotifyDetailPage',
)
export const renderPdaQualityDetailPage = createAsyncRenderer(
  () => import('../pages/pda-quality'),
  'renderPdaQualityDetailPage',
)
export const renderPdaQualityPage = createAsyncRenderer(() => import('../pages/pda-quality'), 'renderPdaQualityPage')
export const renderPdaTaskReceivePage = createAsyncRenderer(() => import('../pages/pda-task-receive'), 'renderPdaTaskReceivePage')
export const renderPdaTaskReceiveDetailPage = createAsyncRenderer(
  () => import('../pages/pda-task-receive-detail'),
  'renderPdaTaskReceiveDetailPage',
)
export const renderPdaExecPage = createAsyncRenderer(() => import('../pages/pda-exec'), 'renderPdaExecPage')
export const renderPdaExecDetailPage = createAsyncRenderer(() => import('../pages/pda-exec-detail'), 'renderPdaExecDetailPage')
export const renderPdaHandoverPage = createAsyncRenderer(() => import('../pages/pda-handover'), 'renderPdaHandoverPage')
export const renderPdaHandoverDetailPage = createAsyncRenderer(
  () => import('../pages/pda-handover-detail'),
  'renderPdaHandoverDetailPage',
)
export const renderPdaTransferBagDetailPage = createAsyncRenderer(
  () => import('../pages/pda-transfer-bag-detail'),
  'renderPdaTransferBagDetailPage',
)
export const renderPdaSettlementPage = createAsyncRenderer(() => import('../pages/pda-settlement'), 'renderPdaSettlementPage')
export const renderPdaWarehousePage = createAsyncRenderer(() => import('../pages/pda-warehouse'), 'renderPdaWarehousePage')
export const renderPdaWarehouseWaitProcessPage = createAsyncRenderer(
  () => import('../pages/pda-warehouse-wait-process'),
  'renderPdaWarehouseWaitProcessPage',
)
export const renderPdaWarehouseWaitHandoverPage = createAsyncRenderer(
  () => import('../pages/pda-warehouse-wait-handover'),
  'renderPdaWarehouseWaitHandoverPage',
)
export const renderPdaWarehouseInboundRecordsPage = createAsyncRenderer(
  () => import('../pages/pda-warehouse-inbound-records'),
  'renderPdaWarehouseInboundRecordsPage',
)
export const renderPdaWarehouseOutboundRecordsPage = createAsyncRenderer(
  () => import('../pages/pda-warehouse-outbound-records'),
  'renderPdaWarehouseOutboundRecordsPage',
)
export const renderPdaWarehouseStocktakePage = createAsyncRenderer(
  () => import('../pages/pda-warehouse-stocktake'),
  'renderPdaWarehouseStocktakePage',
)
export const renderPdaCuttingTaskDetailPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-task-detail'),
  'renderPdaCuttingTaskDetailPage',
)
export const renderPdaCuttingExecutionUnitPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-execution-unit'),
  'renderPdaCuttingExecutionUnitPage',
)
export const renderPdaCuttingPickupPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-pickup'),
  'renderPdaCuttingPickupPage',
)
export const renderPdaCuttingSpreadingPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-spreading'),
  'renderPdaCuttingSpreadingPage',
)
export const renderPdaCuttingInboundPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-inbound'),
  'renderPdaCuttingInboundPage',
)
export const renderPdaCuttingHandoverPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-handover'),
  'renderPdaCuttingHandoverPage',
)
export const renderPdaCuttingReplenishmentFeedbackPage = createAsyncRenderer(
  () => import('../pages/pda-cutting-replenishment-feedback'),
  'renderPdaCuttingReplenishmentFeedbackPage',
)
export const renderCraftWorkbenchOverviewPage = createAsyncRenderer(
  () => import('../pages/process-factory/workbench/overview'),
  'renderCraftWorkbenchOverviewPage',
)
export const renderCraftCuttingProductionProgressPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/production-progress'),
  'renderCraftCuttingProductionProgressPage',
)
export const renderCraftCuttingCuttablePoolPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cuttable-pool'),
  'renderCraftCuttingCuttablePoolPage',
)
export const renderCraftCuttingMergeBatchesPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/merge-batches'),
  'renderCraftCuttingMergeBatchesPage',
)
export const renderCraftCuttingMarkerListPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerListPage',
)
export const renderCraftCuttingMarkerCreatePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerCreatePage',
)
export const renderCraftCuttingMarkerPlanEditPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerPlanEditPage',
)
export const renderCraftCuttingMarkerPlanDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-plan'),
  'renderCraftCuttingMarkerPlanDetailPage',
)
export const renderCraftCuttingSpreadingListPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingListPage',
)
export const renderCraftCuttingSpreadingCreatePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingCreatePage',
)
export const renderCraftCuttingMarkerSpreadingPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingMarkerSpreadingPage',
)
export const renderCraftCuttingSpreadingDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingDetailPage',
)
export const renderCraftCuttingSpreadingEditPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/marker-spreading'),
  'renderCraftCuttingSpreadingEditPage',
)
export const renderCraftCuttingFeiTicketsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketsPage',
)
export const renderCraftCuttingFeiTicketDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketDetailPage',
)
export const renderCraftCuttingFeiTicketPrintedPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketPrintedPage',
)
export const renderCraftCuttingFeiTicketRecordsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketRecordsPage',
)
export const renderCraftCuttingFeiTicketPrintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketPrintPage',
)
export const renderCraftCuttingFeiTicketContinuePrintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketContinuePrintPage',
)
export const renderCraftCuttingFeiTicketReprintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketReprintPage',
)
export const renderCraftCuttingFeiTicketVoidPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketVoidPage',
)
export const renderCraftCuttingMaterialPrepPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/material-prep'),
  'renderCraftCuttingMaterialPrepPage',
)
export const renderCraftCuttingOriginalOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/original-orders'),
  'renderCraftCuttingOriginalOrdersPage',
)
export const renderCraftCuttingFabricWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fabric-warehouse'),
  'renderCraftCuttingFabricWarehousePage',
)
export const renderCraftCuttingCutPieceWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cut-piece-warehouse'),
  'renderCraftCuttingCutPieceWarehousePage',
)
export const renderCraftCuttingSampleWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/sample-warehouse'),
  'renderCraftCuttingSampleWarehousePage',
)
export const renderCraftCuttingTransferBagsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/transfer-bags'),
  'renderCraftCuttingTransferBagsPage',
)
export const renderCraftCuttingTransferBagDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/transfer-bags'),
  'renderCraftCuttingTransferBagDetailPage',
)
export const renderCraftCuttingReplenishmentPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/replenishment'),
  'renderCraftCuttingReplenishmentPage',
)
export const renderCraftCuttingSpecialProcessesPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/special-processes'),
  'renderCraftCuttingSpecialProcessesPage',
)
export const renderCraftCuttingSummaryPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cutting-summary'),
  'renderCraftCuttingSummaryPage',
)
export const renderCraftPrintingWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/work-orders'),
  'renderCraftPrintingWorkOrdersPage',
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
export const renderCraftPrintingDashboardsPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/dashboards'),
  'renderCraftPrintingDashboardsPage',
)
export const renderCraftDyeingWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/work-orders'),
  'renderCraftDyeingWorkOrdersPage',
)
export const renderCraftDyeingDyeOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/dye-orders'),
  'renderCraftDyeingDyeOrdersPage',
)
export const renderCraftDyeingReportsPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/reports'),
  'renderCraftDyeingReportsPage',
)
