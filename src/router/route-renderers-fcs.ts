type AnyAsyncRenderer = (...args: unknown[]) => Promise<string>

function createAsyncRenderer<TArgs extends unknown[]>(
  importModule: () => Promise<Record<string, unknown>>,
  exportName: string,
): (...args: TArgs) => Promise<string> {
  let modulePromise: Promise<Record<string, unknown>> | null = null

  return async (...args: TArgs): Promise<string> => {
    if (!modulePromise) {
      modulePromise = importModule().catch((error) => {
        modulePromise = null
        throw error
      })
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
export const renderFactoryOnboardingPage = createAsyncRenderer(() => import('../pages/factory-onboarding'), 'renderFactoryOnboardingPage')
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
export const renderProductionChangeDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeDetailPage',
)
export const renderProductionChangeNewPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeNewPage',
)
export const renderProductionChangeEditPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeEditPage',
)
export const renderProductionChangeOrderDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeOrderDetailPage',
)
export const renderProductionChangeRelationDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionChangeRelationDetailPage',
)
export const renderProductionCraftDictPage = createAsyncRenderer(
  () => import('../pages/production-craft-dict'),
  'renderProductionCraftDictPage',
)
export const renderProductionDemandInboxPage = createAsyncRenderer(
  () => import('../pages/production/demand-domain'),
  'renderProductionDemandInboxPage',
)
export const renderProductionTaskGenerationRulesPage = createAsyncRenderer(
  () => import('../pages/production/task-generation-rules'),
  'renderProductionTaskGenerationRulesPage',
)
export const renderProductionTaskGenerationRuleCreatePage = createAsyncRenderer(
  () => import('../pages/production/task-generation-rules'),
  'renderProductionTaskGenerationRuleCreatePage',
)
export const renderProductionTaskGenerationRuleDetailPage = createAsyncRenderer(
  () => import('../pages/production/task-generation-rules'),
  'renderProductionTaskGenerationRuleDetailPage',
)
export const renderProductionTaskGenerationRuleEditPage = createAsyncRenderer(
  () => import('../pages/production/task-generation-rules'),
  'renderProductionTaskGenerationRuleEditPage',
)
export const renderProductionDeliveryWarehousePage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionDeliveryWarehousePage',
)
export const renderProductionOrderDetailPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionOrderDetailPage',
)
export const renderProductionOrdersPage = createAsyncRenderer(() => import('../pages/production/orders-domain'), 'renderProductionOrdersPage')
export const renderProductionPlanPage = createAsyncRenderer(
  () => import('../pages/production'),
  'renderProductionPlanPage',
)
export const renderProductionPreparationTimingPage = createAsyncRenderer(
  () => import('../pages/production/preparation-timing'),
  'renderProductionPreparationTimingPage',
)
export const renderProductionPreparationTimingStatisticsPage = createAsyncRenderer(
  () => import('../pages/production/preparation-timing'),
  'renderProductionPreparationTimingStatisticsPage',
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
export const renderTechPackPage = createAsyncRenderer(() => import('../pages/tech-pack/core'), 'renderTechPackPage')
export const renderFcsProductionTechPackSnapshotPage = createAsyncRenderer(
  () => import('../pages/fcs-production-tech-pack-snapshot'),
  'renderFcsProductionTechPackSnapshotPage',
)
export const renderProductionConfirmationPrintPage = createAsyncRenderer(
  () => import('../pages/production/confirmation-print'),
  'renderProductionConfirmationPrintPage',
)
export const renderTaskDeliveryCardPrintPage = createAsyncRenderer(
  () => import('../pages/print/task-delivery-card'),
  'renderTaskDeliveryCardPrintPage',
)
export const renderTaskRouteCardPrintPage = createAsyncRenderer(
  () => import('../pages/print/task-route-card'),
  'renderTaskRouteCardPrintPage',
)
export const renderPrintPreviewPage = createAsyncRenderer(
  () => import('../pages/print/print-preview'),
  'renderPrintPreviewPage',
)
export const renderMaterialStatementsPage = createAsyncRenderer(
  () => import('../pages/material-statements'),
  'renderMaterialStatementsPage',
)
export const renderHistoryPage = createAsyncRenderer(() => import('../pages/history'), 'renderHistoryPage')
export const renderPaymentSyncPage = createAsyncRenderer(() => import('../pages/payment-sync'), 'renderPaymentSyncPage')
export const renderStatementsPage = createAsyncRenderer(() => import('../pages/statements'), 'renderStatementsPage')
export const renderAdjustmentsPage = createAsyncRenderer(() => import('../pages/adjustments'), 'renderAdjustmentsPage')
export const renderDispatchBoardPage = createAsyncRenderer(() => import('../pages/dispatch-board'), 'renderDispatchBoardPage')
export const renderSewingDispatchWorkbenchPage = createAsyncRenderer(
  () => import('../pages/sewing-dispatch-workbench'),
  'renderSewingDispatchWorkbenchPage',
)
export const renderContinuousDispatchPage = createAsyncRenderer(
  () => import('../pages/continuous-dispatch'),
  'renderContinuousDispatchPage',
)
export const renderDispatchTendersPage = createAsyncRenderer(
  () => import('../pages/dispatch-tenders'),
  'renderDispatchTendersPage',
)
export const renderDispatchAcceptanceSlaPage = createAsyncRenderer(
  () => import('../pages/dispatch-acceptance-sla'),
  'renderDispatchAcceptanceSlaPage',
)
export const renderFcsMaterialPrepListPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/list'),
  'renderFcsMaterialPrepListPage',
)
export const renderFcsDyeingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/dyeing'),
  'renderFcsDyeingPrepPage',
)
export const renderFcsPrintingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/printing'),
  'renderFcsPrintingPrepPage',
)
export const renderFcsCuttingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/cutting'),
  'renderFcsCuttingPrepPage',
)
export const renderFcsSewingPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/sewing'),
  'renderFcsSewingPrepPage',
)
export const renderFcsOtherPrepPage = createAsyncRenderer(
  () => import('../pages/fcs/material-prep/other'),
  'renderFcsOtherPrepPage',
)
export const renderProgressBoardPage = createAsyncRenderer(() => import('../pages/progress-board'), 'renderProgressBoardPage')
export const renderProgressTaskDetailPage = createAsyncRenderer(
  () => import('../pages/progress-board'),
  'renderProgressTaskDetailPage',
)
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
export const renderProductionOrderProgressTrackingPage = createAsyncRenderer(
  () => import('../pages/production-order-progress-tracking'),
  'renderProductionOrderProgressTrackingPage',
)
export const renderProgressUrgePage = createAsyncRenderer(() => import('../pages/progress-urge'), 'renderProgressUrgePage')
export const renderCraftWorkbenchOverviewPage = createAsyncRenderer(
  () => import('../pages/process-factory/workbench/overview'),
  'renderCraftWorkbenchOverviewPage',
)
export const renderCraftCuttingFeiTicketDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketDetailPage',
)
export const renderCraftCuttingFeiTicketPrintedPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketPrintedPage',
)
export const renderCraftCuttingFeiTicketPrintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketPrintPage',
)
export const renderCraftCuttingFeiTicketReprintPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketReprintPage',
)
export const renderCraftCuttingFeiTicketsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingFeiTicketsPage',
)
export const renderCraftCuttingBindingFeiTicketsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-tickets'),
  'renderCraftCuttingBindingFeiTicketsPage',
)
export const renderCraftCuttingFeiTicketNumberingPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-ticket-numbering'),
  'renderCraftCuttingFeiTicketNumberingPage',
)
export const renderCraftCuttingFeiTicketNumberingSummaryPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/fei-ticket-numbering'),
  'renderCraftCuttingFeiTicketNumberingSummaryPage',
)
export const renderCraftCuttingCutOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cut-orders'),
  'renderCraftCuttingCutOrdersPage',
)
export const renderCraftCuttingCutOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cut-orders'),
  'renderCraftCuttingCutOrderDetailPage',
)
export const renderCraftCuttingCutOrderClosePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cut-orders'),
  'renderCraftCuttingCutOrderClosePage',
)
export const renderCraftCuttingPickupManagementPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/pickup-management'),
  'renderCraftCuttingPickupManagementPage',
)
export const renderCraftCuttingPickupManagementDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/pickup-management'),
  'renderCraftCuttingPickupManagementDetailPage',
)
export const renderCraftCuttingProductionProgressPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/production-progress'),
  'renderCraftCuttingProductionProgressPage',
)
export const renderCraftCuttingProductionProgressDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/production-progress'),
  'renderCraftCuttingProductionProgressDetailPage',
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
export const renderCraftCuttingSampleWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/sample-warehouse'),
  'renderCraftCuttingSampleWarehousePage',
)
export const renderCraftCuttingSampleWarehouseDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/sample-warehouse'),
  'renderCraftCuttingSampleWarehouseDetailPage',
)
export const renderCraftCuttingSpecialProcessesPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/special-processes'),
  'renderCraftCuttingSpecialProcessesPage',
)
export const renderCraftCuttingSpecialProcessDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/special-processes'),
  'renderCraftCuttingSpecialProcessDetailPage',
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
export const renderCraftCuttingCutPieceReleasePage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cut-piece-release'),
  'renderCraftCuttingCutPieceReleasePage',
)
export const renderCraftCuttingSupplementManagementPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/supplement-management'),
  'renderCraftCuttingSupplementManagementPage',
)
export const renderCraftCuttingAbMaterialStatisticsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cutting-statistics-ab-material'),
  'renderCraftCuttingAbMaterialStatisticsPage',
)
export const renderCraftCuttingDailyProductionReportPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/cutting-daily-production-report'),
  'renderCraftCuttingDailyProductionReportPage',
)
export const renderCraftCuttingTransferBagDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/transfer-bags'),
  'renderCraftCuttingTransferBagDetailPage',
)
export const renderCraftCuttingTransferBagsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/transfer-bags'),
  'renderCraftCuttingTransferBagsPage',
)
export const renderCraftCuttingHandoverOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/handover-orders'),
  'renderCraftCuttingHandoverOrdersPage',
)
export const renderCraftCuttingHandoverOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/handover-orders'),
  'renderCraftCuttingHandoverOrderDetailPage',
)
export const renderCraftCuttingHandoverOrderRecordsPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/handover-orders'),
  'renderCraftCuttingHandoverOrderRecordsPage',
)
export const renderCraftCuttingHandoverRecordDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/handover-orders'),
  'renderCraftCuttingHandoverRecordDetailPage',
)
export const renderCraftCuttingWarehouseManagementWaitProcessPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/warehouse-hub'),
  'renderCraftCuttingWarehouseManagementWaitProcessPage',
)
export const renderCraftCuttingWarehouseManagementWaitHandoverPage = createAsyncRenderer(
  () => import('../pages/process-factory/cutting/warehouse-hub'),
  'renderCraftCuttingWarehouseManagementWaitHandoverPage',
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
export const renderCraftPrintingWorkOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/work-order-detail'),
  'renderCraftPrintingWorkOrderDetailPage',
)
export const renderCraftPrintingWaitProcessWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/warehouse'),
  'renderCraftPrintingWaitProcessWarehousePage',
)
export const renderCraftPrintingWaitHandoverWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/printing/warehouse'),
  'renderCraftPrintingWaitHandoverWarehousePage',
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
export const renderCraftDyeingWorkOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/work-order-detail'),
  'renderCraftDyeingWorkOrderDetailPage',
)
export const renderCraftDyeingWaitProcessWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/warehouse'),
  'renderCraftDyeingWaitProcessWarehousePage',
)
export const renderCraftDyeingWaitHandoverWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/dyeing/warehouse'),
  'renderCraftDyeingWaitHandoverWarehousePage',
)
export const renderCraftWoolWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/work-orders'),
  'renderCraftWoolWorkOrdersPage',
)
export const renderCraftWoolWorkOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/work-order-detail'),
  'renderCraftWoolWorkOrderDetailPage',
)
export const renderCraftWoolWaitProcessWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/warehouse'),
  'renderCraftWoolWaitProcessWarehousePage',
)
export const renderCraftWoolWaitHandoverWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/warehouse'),
  'renderCraftWoolWaitHandoverWarehousePage',
)
export const renderCraftWoolFeiTicketsPage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/fei-tickets'),
  'renderCraftWoolFeiTicketsPage',
)
export const renderCraftWoolMachineSchedulePage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/machine-schedule'),
  'renderCraftWoolMachineSchedulePage',
)
export const renderCraftWoolMachinesPage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/machines'),
  'renderCraftWoolMachinesPage',
)
export const renderCraftWoolStatisticsPage = createAsyncRenderer(
  () => import('../pages/process-factory/wool/statistics'),
  'renderCraftWoolStatisticsPage',
)
export const renderPostFinishingWorkOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/work-orders'),
  'renderPostFinishingWorkOrdersPage',
)
export const renderPostFinishingTasksPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/tasks'),
  'renderPostFinishingTasksPage',
)
export const renderPostFinishingWorkOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/work-order-detail'),
  'renderPostFinishingWorkOrderDetailPage',
)
export const renderPostFinishingQcOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/qc-orders'),
  'renderPostFinishingQcOrdersPage',
)
export const renderPostFinishingRecheckOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/recheck-orders'),
  'renderPostFinishingRecheckOrdersPage',
)
export const renderPostFinishingRecheckOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/recheck-orders'),
  'renderPostFinishingRecheckOrderDetailPage',
)
export const renderPostFinishingWaitProcessWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/warehouse'),
  'renderPostFinishingWaitProcessWarehousePage',
)
export const renderPostFinishingWaitHandoverWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/warehouse'),
  'renderPostFinishingWaitHandoverWarehousePage',
)
export const renderPostFinishingStatisticsPage = createAsyncRenderer(
  () => import('../pages/process-factory/post-finishing/statistics'),
  'renderPostFinishingStatisticsPage',
)
export const renderSpecialCraftTaskOrdersPage = createAsyncRenderer(
  () => import('../pages/process-factory/special-craft/task-orders'),
  'renderSpecialCraftTaskOrdersPage',
)
export const renderSpecialCraftTaskDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/special-craft/task-detail'),
  'renderSpecialCraftTaskDetailPage',
)
export const renderSpecialCraftWorkOrderDetailPage = createAsyncRenderer(
  () => import('../pages/process-factory/special-craft/work-order-detail'),
  'renderSpecialCraftWorkOrderDetailPage',
)
export const renderSpecialCraftDomainWaitProcessWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/special-craft/warehouse'),
  'renderSpecialCraftDomainWaitProcessWarehousePage',
)
export const renderSpecialCraftDomainWaitHandoverWarehousePage = createAsyncRenderer(
  () => import('../pages/process-factory/special-craft/warehouse'),
  'renderSpecialCraftDomainWaitHandoverWarehousePage',
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
