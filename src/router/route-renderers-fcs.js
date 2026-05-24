function createAsyncRenderer(importModule, exportName) {
  let modulePromise = null;
  return async (...args) => {
    if (!modulePromise) {
      modulePromise = importModule().catch((error) => {
        modulePromise = null;
        throw error;
      });
    }
    const module = await modulePromise;
    const renderer = module[exportName];
    if (typeof renderer !== "function") {
      throw new Error(`\u9875\u9762\u6E32\u67D3\u51FD\u6570\u4E0D\u5B58\u5728: ${exportName}`);
    }
    return renderer(...args);
  };
}
const renderTaskBreakdownPage = createAsyncRenderer(() => import("../pages/task-breakdown"), "renderTaskBreakdownPage");
const renderCapabilityPage = createAsyncRenderer(() => import("../pages/capability"), "renderCapabilityPage");
const renderFactoryCapacityProfilePage = createAsyncRenderer(
  () => import("../pages/factory-capacity-profile"),
  "renderFactoryCapacityProfilePage"
);
const renderFactoryInternalWarehousePage = createAsyncRenderer(
  () => import("../pages/factory-internal-warehouse"),
  "renderFactoryInternalWarehousePage"
);
const renderFactoryPerformancePage = createAsyncRenderer(
  () => import("../pages/factory-performance"),
  "renderFactoryPerformancePage"
);
const renderFactoryOnboardingPage = createAsyncRenderer(() => import("../pages/factory-onboarding"), "renderFactoryOnboardingPage");
const renderFactoryProfilePage = createAsyncRenderer(() => import("../pages/factory-profile"), "renderFactoryProfilePage");
const renderFactoryStatusPage = createAsyncRenderer(() => import("../pages/factory-status"), "renderFactoryStatusPage");
const renderOverviewPage = createAsyncRenderer(() => import("../pages/workbench"), "renderOverviewPage");
const renderTodosPage = createAsyncRenderer(() => import("../pages/workbench"), "renderTodosPage");
const renderCapacityBottleneckPage = createAsyncRenderer(
  () => import("../pages/capacity"),
  "renderCapacityBottleneckPage"
);
const renderCapacityConstraintsPage = createAsyncRenderer(
  () => import("../pages/capacity"),
  "renderCapacityConstraintsPage"
);
const renderCapacityOverviewPage = createAsyncRenderer(
  () => import("../pages/capacity"),
  "renderCapacityOverviewPage"
);
const renderCapacityPoliciesPage = createAsyncRenderer(
  () => import("../pages/capacity"),
  "renderCapacityPoliciesPage"
);
const renderCapacityRiskPage = createAsyncRenderer(() => import("../pages/capacity"), "renderCapacityRiskPage");
const renderProductionChangesPage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionChangesPage"
);
const renderProductionCraftDictPage = createAsyncRenderer(
  () => import("../pages/production-craft-dict"),
  "renderProductionCraftDictPage"
);
const renderProductionDemandInboxPage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionDemandInboxPage"
);
const renderProductionDeliveryWarehousePage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionDeliveryWarehousePage"
);
const renderProductionOrderDetailPage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionOrderDetailPage"
);
const renderProductionOrdersPage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionOrdersPage"
);
const renderProductionPlanPage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionPlanPage"
);
const renderProductionStatusPage = createAsyncRenderer(
  () => import("../pages/production"),
  "renderProductionStatusPage"
);
const renderProcessDyeOrdersPage = createAsyncRenderer(
  () => import("../pages/process-dye-orders"),
  "renderProcessDyeOrdersPage"
);
const renderProcessDyeRequirementsPage = createAsyncRenderer(
  () => import("../pages/process-dye-requirements"),
  "renderProcessDyeRequirementsPage"
);
const renderProcessPrintOrdersPage = createAsyncRenderer(
  () => import("../pages/process-print-orders"),
  "renderProcessPrintOrdersPage"
);
const renderProcessPrintRequirementsPage = createAsyncRenderer(
  () => import("../pages/process-print-requirements"),
  "renderProcessPrintRequirementsPage"
);
const renderMaterialIssuePage = createAsyncRenderer(
  () => import("../pages/material-issue"),
  "renderMaterialIssuePage"
);
const renderQcRecordDetailPage = createAsyncRenderer(
  () => import("../pages/qc-records"),
  "renderQcRecordDetailPage"
);
const renderQcRecordsPage = createAsyncRenderer(() => import("../pages/qc-records"), "renderQcRecordsPage");
const renderDeductionAnalysisPage = createAsyncRenderer(
  () => import("../pages/deduction-analysis"),
  "renderDeductionAnalysisPage"
);
const renderBatchesPage = createAsyncRenderer(() => import("../pages/batches"), "renderBatchesPage");
const renderSettlementListPage = createAsyncRenderer(() => import("../pages/settlement"), "renderSettlementListPage");
const renderSettlementDetailPage = createAsyncRenderer(
  () => import("../pages/settlement"),
  "renderSettlementDetailPage"
);
const renderSettlementInitPage = createAsyncRenderer(
  () => import("../pages/settlement"),
  "renderSettlementInitPage"
);
const renderTechPackPage = createAsyncRenderer(() => import("../pages/tech-pack/core"), "renderTechPackPage");
const renderFcsProductionTechPackSnapshotPage = createAsyncRenderer(
  () => import("../pages/fcs-production-tech-pack-snapshot"),
  "renderFcsProductionTechPackSnapshotPage"
);
const renderProductionConfirmationPrintPage = createAsyncRenderer(
  () => import("../pages/production/confirmation-print"),
  "renderProductionConfirmationPrintPage"
);
const renderTaskDeliveryCardPrintPage = createAsyncRenderer(
  () => import("../pages/print/task-delivery-card"),
  "renderTaskDeliveryCardPrintPage"
);
const renderTaskRouteCardPrintPage = createAsyncRenderer(
  () => import("../pages/print/task-route-card"),
  "renderTaskRouteCardPrintPage"
);
const renderPrintPreviewPage = createAsyncRenderer(
  () => import("../pages/print/print-preview"),
  "renderPrintPreviewPage"
);
const renderMaterialStatementsPage = createAsyncRenderer(
  () => import("../pages/material-statements"),
  "renderMaterialStatementsPage"
);
const renderHistoryPage = createAsyncRenderer(() => import("../pages/history"), "renderHistoryPage");
const renderPaymentSyncPage = createAsyncRenderer(() => import("../pages/payment-sync"), "renderPaymentSyncPage");
const renderStatementsPage = createAsyncRenderer(() => import("../pages/statements"), "renderStatementsPage");
const renderAdjustmentsPage = createAsyncRenderer(() => import("../pages/adjustments"), "renderAdjustmentsPage");
const renderDispatchBoardPage = createAsyncRenderer(() => import("../pages/dispatch-board"), "renderDispatchBoardPage");
const renderDispatchTendersPage = createAsyncRenderer(
  () => import("../pages/dispatch-tenders"),
  "renderDispatchTendersPage"
);
const renderProgressBoardPage = createAsyncRenderer(() => import("../pages/progress-board"), "renderProgressBoardPage");
const renderProgressCuttingDetailPage = createAsyncRenderer(
  () => import("../pages/progress-cutting-detail"),
  "renderProgressCuttingDetailPage"
);
const renderProgressCuttingExceptionCenterPage = createAsyncRenderer(
  () => import("../pages/progress-cutting-exception-center"),
  "renderProgressCuttingExceptionCenterPage"
);
const renderProgressCuttingOverviewPage = createAsyncRenderer(
  () => import("../pages/progress-cutting-overview"),
  "renderProgressCuttingOverviewPage"
);
const renderProgressExceptionsPage = createAsyncRenderer(
  () => import("../pages/progress-exceptions"),
  "renderProgressExceptionsPage"
);
const renderProgressHandoverOrderPage = createAsyncRenderer(
  () => import("../pages/progress-handover-order"),
  "renderProgressHandoverOrderPage"
);
const renderProgressHandoverPage = createAsyncRenderer(
  () => import("../pages/progress-handover"),
  "renderProgressHandoverPage"
);
const renderProgressMaterialPage = createAsyncRenderer(
  () => import("../pages/progress-material"),
  "renderProgressMaterialPage"
);
const renderProgressMilestoneConfigPage = createAsyncRenderer(
  () => import("../pages/progress-milestone-config"),
  "renderProgressMilestoneConfigPage"
);
const renderProgressUrgePage = createAsyncRenderer(() => import("../pages/progress-urge"), "renderProgressUrgePage");
const renderCraftWorkbenchOverviewPage = createAsyncRenderer(
  () => import("../pages/process-factory/workbench/overview"),
  "renderCraftWorkbenchOverviewPage"
);
const renderCraftCuttingCuttablePoolPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/cuttable-pool"),
  "renderCraftCuttingCuttablePoolPage"
);
const renderCraftCuttingFeiTicketDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketDetailPage"
);
const renderCraftCuttingFeiTicketPrintedPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketPrintedPage"
);
const renderCraftCuttingFeiTicketPrintPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketPrintPage"
);
const renderCraftCuttingFeiTicketReprintPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketReprintPage"
);
const renderCraftCuttingFeiTicketRecordsPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketRecordsPage"
);
const renderCraftCuttingFeiTicketVoidPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketVoidPage"
);
const renderCraftCuttingFeiTicketsPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/fei-tickets"),
  "renderCraftCuttingFeiTicketsPage"
);
const renderCraftCuttingCutOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/cut-orders"),
  "renderCraftCuttingCutOrdersPage"
);
const renderCraftCuttingProductionProgressPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/production-progress"),
  "renderCraftCuttingProductionProgressPage"
);
const renderPlaceholderPage = createAsyncRenderer(() => import("../pages/placeholder"), "renderPlaceholderPage");
const renderCraftCuttingMarkerCreatePage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-plan"),
  "renderCraftCuttingMarkerCreatePage"
);
const renderCraftCuttingMarkerListPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-plan"),
  "renderCraftCuttingMarkerListPage"
);
const renderCraftCuttingMarkerPlanDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-plan"),
  "renderCraftCuttingMarkerPlanDetailPage"
);
const renderCraftCuttingMarkerPlanEditPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-plan"),
  "renderCraftCuttingMarkerPlanEditPage"
);
const renderCraftCuttingMarkerSpreadingPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-spreading"),
  "renderCraftCuttingMarkerSpreadingPage"
);
const renderCraftCuttingReplenishmentPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/replenishment"),
  "renderCraftCuttingReplenishmentPage"
);
const renderCraftCuttingReplenishmentDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/replenishment"),
  "renderCraftCuttingReplenishmentDetailPage"
);
const renderCraftCuttingSampleWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/sample-warehouse"),
  "renderCraftCuttingSampleWarehousePage"
);
const renderCraftCuttingSpecialProcessesPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/special-processes"),
  "renderCraftCuttingSpecialProcessesPage"
);
const renderCraftCuttingSpreadingCreatePage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-spreading"),
  "renderCraftCuttingSpreadingCreatePage"
);
const renderCraftCuttingSpreadingDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-spreading"),
  "renderCraftCuttingSpreadingDetailPage"
);
const renderCraftCuttingSpreadingEditPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-spreading"),
  "renderCraftCuttingSpreadingEditPage"
);
const renderCraftCuttingSpreadingListPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/marker-spreading"),
  "renderCraftCuttingSpreadingListPage"
);
const renderCraftCuttingSummaryPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/cutting-summary"),
  "renderCraftCuttingSummaryPage"
);
const renderCraftCuttingTransferBagDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/transfer-bags"),
  "renderCraftCuttingTransferBagDetailPage"
);
const renderCraftCuttingTransferBagsPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/transfer-bags"),
  "renderCraftCuttingTransferBagsPage"
);
const renderCraftCuttingHandoverOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/handover-orders"),
  "renderCraftCuttingHandoverOrdersPage"
);
const renderCraftCuttingHandoverOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/handover-orders"),
  "renderCraftCuttingHandoverOrderDetailPage"
);
const renderCraftCuttingHandoverOrderRecordsPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/handover-orders"),
  "renderCraftCuttingHandoverOrderRecordsPage"
);
const renderCraftCuttingHandoverRecordDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/handover-orders"),
  "renderCraftCuttingHandoverRecordDetailPage"
);
const renderCraftCuttingWarehouseManagementWaitProcessPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/warehouse-hub"),
  "renderCraftCuttingWarehouseManagementWaitProcessPage"
);
const renderCraftCuttingWarehouseManagementWaitHandoverPage = createAsyncRenderer(
  () => import("../pages/process-factory/cutting/warehouse-hub"),
  "renderCraftCuttingWarehouseManagementWaitHandoverPage"
);
const renderCraftPrintingDashboardsPage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/dashboards"),
  "renderCraftPrintingDashboardsPage"
);
const renderCraftPrintingPendingReviewPage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/pending-review"),
  "renderCraftPrintingPendingReviewPage"
);
const renderCraftPrintingProgressPage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/progress"),
  "renderCraftPrintingProgressPage"
);
const renderCraftPrintingStatisticsPage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/statistics"),
  "renderCraftPrintingStatisticsPage"
);
const renderCraftPrintingWorkOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/work-orders"),
  "renderCraftPrintingWorkOrdersPage"
);
const renderCraftPrintingWorkOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/work-order-detail"),
  "renderCraftPrintingWorkOrderDetailPage"
);
const renderCraftPrintingWaitProcessWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/warehouse"),
  "renderCraftPrintingWaitProcessWarehousePage"
);
const renderCraftPrintingWaitHandoverWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/printing/warehouse"),
  "renderCraftPrintingWaitHandoverWarehousePage"
);
const renderCraftDyeingDyeOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/dyeing/dye-orders"),
  "renderCraftDyeingDyeOrdersPage"
);
const renderCraftDyeingReportsPage = createAsyncRenderer(
  () => import("../pages/process-factory/dyeing/reports"),
  "renderCraftDyeingReportsPage"
);
const renderCraftDyeingWorkOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/dyeing/work-orders"),
  "renderCraftDyeingWorkOrdersPage"
);
const renderCraftDyeingWorkOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/dyeing/work-order-detail"),
  "renderCraftDyeingWorkOrderDetailPage"
);
const renderCraftDyeingWaitProcessWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/dyeing/warehouse"),
  "renderCraftDyeingWaitProcessWarehousePage"
);
const renderCraftDyeingWaitHandoverWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/dyeing/warehouse"),
  "renderCraftDyeingWaitHandoverWarehousePage"
);
const renderCraftWoolWorkOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/work-orders"),
  "renderCraftWoolWorkOrdersPage"
);
const renderCraftWoolWorkOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/work-order-detail"),
  "renderCraftWoolWorkOrderDetailPage"
);
const renderCraftWoolWaitProcessWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/warehouse"),
  "renderCraftWoolWaitProcessWarehousePage"
);
const renderCraftWoolWaitHandoverWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/warehouse"),
  "renderCraftWoolWaitHandoverWarehousePage"
);
const renderCraftWoolFeiTicketsPage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/fei-tickets"),
  "renderCraftWoolFeiTicketsPage"
);
const renderCraftWoolMachineSchedulePage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/machine-schedule"),
  "renderCraftWoolMachineSchedulePage"
);
const renderCraftWoolMachinesPage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/machines"),
  "renderCraftWoolMachinesPage"
);
const renderCraftWoolStatisticsPage = createAsyncRenderer(
  () => import("../pages/process-factory/wool/statistics"),
  "renderCraftWoolStatisticsPage"
);
const renderPostFinishingWorkOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/work-orders"),
  "renderPostFinishingWorkOrdersPage"
);
const renderPostFinishingTasksPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/tasks"),
  "renderPostFinishingTasksPage"
);
const renderPostFinishingWorkOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/work-order-detail"),
  "renderPostFinishingWorkOrderDetailPage"
);
const renderPostFinishingQcOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/qc-orders"),
  "renderPostFinishingQcOrdersPage"
);
const renderPostFinishingRecheckOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/recheck-orders"),
  "renderPostFinishingRecheckOrdersPage"
);
const renderPostFinishingRecheckOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/recheck-orders"),
  "renderPostFinishingRecheckOrderDetailPage"
);
const renderPostFinishingWaitProcessWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/warehouse"),
  "renderPostFinishingWaitProcessWarehousePage"
);
const renderPostFinishingWaitHandoverWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/warehouse"),
  "renderPostFinishingWaitHandoverWarehousePage"
);
const renderPostFinishingStatisticsPage = createAsyncRenderer(
  () => import("../pages/process-factory/post-finishing/statistics"),
  "renderPostFinishingStatisticsPage"
);
const renderSpecialCraftTaskOrdersPage = createAsyncRenderer(
  () => import("../pages/process-factory/special-craft/task-orders"),
  "renderSpecialCraftTaskOrdersPage"
);
const renderSpecialCraftTaskDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/special-craft/task-detail"),
  "renderSpecialCraftTaskDetailPage"
);
const renderSpecialCraftWorkOrderDetailPage = createAsyncRenderer(
  () => import("../pages/process-factory/special-craft/work-order-detail"),
  "renderSpecialCraftWorkOrderDetailPage"
);
const renderSpecialCraftDomainWaitProcessWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/special-craft/warehouse"),
  "renderSpecialCraftDomainWaitProcessWarehousePage"
);
const renderSpecialCraftDomainWaitHandoverWarehousePage = createAsyncRenderer(
  () => import("../pages/process-factory/special-craft/warehouse"),
  "renderSpecialCraftDomainWaitHandoverWarehousePage"
);
const renderTraceMappingPage = createAsyncRenderer(() => import("../pages/trace"), "renderTraceMappingPage");
const renderTraceParentCodesPage = createAsyncRenderer(
  () => import("../pages/trace"),
  "renderTraceParentCodesPage"
);
const renderTraceUniqueCodesPage = createAsyncRenderer(
  () => import("../pages/trace"),
  "renderTraceUniqueCodesPage"
);
const renderTraceUnitPricePage = createAsyncRenderer(() => import("../pages/trace"), "renderTraceUnitPricePage");
const renderCuttingSettlementInputPage = createAsyncRenderer(
  () => import("../pages/settlement-cutting-input"),
  "renderCuttingSettlementInputPage"
);
export {
  renderAdjustmentsPage,
  renderBatchesPage,
  renderCapabilityPage,
  renderCapacityBottleneckPage,
  renderCapacityConstraintsPage,
  renderCapacityOverviewPage,
  renderCapacityPoliciesPage,
  renderCapacityRiskPage,
  renderCraftCuttingCutOrdersPage,
  renderCraftCuttingCuttablePoolPage,
  renderCraftCuttingFeiTicketDetailPage,
  renderCraftCuttingFeiTicketPrintPage,
  renderCraftCuttingFeiTicketPrintedPage,
  renderCraftCuttingFeiTicketRecordsPage,
  renderCraftCuttingFeiTicketReprintPage,
  renderCraftCuttingFeiTicketVoidPage,
  renderCraftCuttingFeiTicketsPage,
  renderCraftCuttingHandoverOrderDetailPage,
  renderCraftCuttingHandoverOrderRecordsPage,
  renderCraftCuttingHandoverOrdersPage,
  renderCraftCuttingHandoverRecordDetailPage,
  renderCraftCuttingMarkerCreatePage,
  renderCraftCuttingMarkerListPage,
  renderCraftCuttingMarkerPlanDetailPage,
  renderCraftCuttingMarkerPlanEditPage,
  renderCraftCuttingMarkerSpreadingPage,
  renderCraftCuttingProductionProgressPage,
  renderCraftCuttingReplenishmentDetailPage,
  renderCraftCuttingReplenishmentPage,
  renderCraftCuttingSampleWarehousePage,
  renderCraftCuttingSpecialProcessesPage,
  renderCraftCuttingSpreadingCreatePage,
  renderCraftCuttingSpreadingDetailPage,
  renderCraftCuttingSpreadingEditPage,
  renderCraftCuttingSpreadingListPage,
  renderCraftCuttingSummaryPage,
  renderCraftCuttingTransferBagDetailPage,
  renderCraftCuttingTransferBagsPage,
  renderCraftCuttingWarehouseManagementWaitHandoverPage,
  renderCraftCuttingWarehouseManagementWaitProcessPage,
  renderCraftDyeingDyeOrdersPage,
  renderCraftDyeingReportsPage,
  renderCraftDyeingWaitHandoverWarehousePage,
  renderCraftDyeingWaitProcessWarehousePage,
  renderCraftDyeingWorkOrderDetailPage,
  renderCraftDyeingWorkOrdersPage,
  renderCraftPrintingDashboardsPage,
  renderCraftPrintingPendingReviewPage,
  renderCraftPrintingProgressPage,
  renderCraftPrintingStatisticsPage,
  renderCraftPrintingWaitHandoverWarehousePage,
  renderCraftPrintingWaitProcessWarehousePage,
  renderCraftPrintingWorkOrderDetailPage,
  renderCraftPrintingWorkOrdersPage,
  renderCraftWoolFeiTicketsPage,
  renderCraftWoolMachineSchedulePage,
  renderCraftWoolMachinesPage,
  renderCraftWoolStatisticsPage,
  renderCraftWoolWaitHandoverWarehousePage,
  renderCraftWoolWaitProcessWarehousePage,
  renderCraftWoolWorkOrderDetailPage,
  renderCraftWoolWorkOrdersPage,
  renderCraftWorkbenchOverviewPage,
  renderCuttingSettlementInputPage,
  renderDeductionAnalysisPage,
  renderDispatchBoardPage,
  renderDispatchTendersPage,
  renderFactoryCapacityProfilePage,
  renderFactoryInternalWarehousePage,
  renderFactoryOnboardingPage,
  renderFactoryPerformancePage,
  renderFactoryProfilePage,
  renderFactoryStatusPage,
  renderFcsProductionTechPackSnapshotPage,
  renderHistoryPage,
  renderMaterialIssuePage,
  renderMaterialStatementsPage,
  renderOverviewPage,
  renderPaymentSyncPage,
  renderPlaceholderPage,
  renderPostFinishingQcOrdersPage,
  renderPostFinishingRecheckOrderDetailPage,
  renderPostFinishingRecheckOrdersPage,
  renderPostFinishingStatisticsPage,
  renderPostFinishingTasksPage,
  renderPostFinishingWaitHandoverWarehousePage,
  renderPostFinishingWaitProcessWarehousePage,
  renderPostFinishingWorkOrderDetailPage,
  renderPostFinishingWorkOrdersPage,
  renderPrintPreviewPage,
  renderProcessDyeOrdersPage,
  renderProcessDyeRequirementsPage,
  renderProcessPrintOrdersPage,
  renderProcessPrintRequirementsPage,
  renderProductionChangesPage,
  renderProductionConfirmationPrintPage,
  renderProductionCraftDictPage,
  renderProductionDeliveryWarehousePage,
  renderProductionDemandInboxPage,
  renderProductionOrderDetailPage,
  renderProductionOrdersPage,
  renderProductionPlanPage,
  renderProductionStatusPage,
  renderProgressBoardPage,
  renderProgressCuttingDetailPage,
  renderProgressCuttingExceptionCenterPage,
  renderProgressCuttingOverviewPage,
  renderProgressExceptionsPage,
  renderProgressHandoverOrderPage,
  renderProgressHandoverPage,
  renderProgressMaterialPage,
  renderProgressMilestoneConfigPage,
  renderProgressUrgePage,
  renderQcRecordDetailPage,
  renderQcRecordsPage,
  renderSettlementDetailPage,
  renderSettlementInitPage,
  renderSettlementListPage,
  renderSpecialCraftDomainWaitHandoverWarehousePage,
  renderSpecialCraftDomainWaitProcessWarehousePage,
  renderSpecialCraftTaskDetailPage,
  renderSpecialCraftTaskOrdersPage,
  renderSpecialCraftWorkOrderDetailPage,
  renderStatementsPage,
  renderTaskBreakdownPage,
  renderTaskDeliveryCardPrintPage,
  renderTaskRouteCardPrintPage,
  renderTechPackPage,
  renderTodosPage,
  renderTraceMappingPage,
  renderTraceParentCodesPage,
  renderTraceUniqueCodesPage,
  renderTraceUnitPricePage
};
