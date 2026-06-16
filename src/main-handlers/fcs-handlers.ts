import {
  handleFactoryPageEvent,
  handleFactoryPageSubmit,
  isFactoryPageOpenDialog,
} from '../pages/factory-profile'
import {
  handleFactoryOnboardingEvent,
  isFactoryOnboardingDialogOpen,
} from '../pages/factory-onboarding'
import {
  handleFactoryCapacityProfileEvent,
  isFactoryCapacityProfileDialogOpen,
} from '../pages/factory-capacity-profile'
import {
  handleCapabilityEvent,
  handleCapabilitySubmit,
  isCapabilityDialogOpen,
} from '../pages/capability'
import {
  handleFactoryStatusEvent,
  isFactoryStatusDialogOpen,
} from '../pages/factory-status'
import {
  handleFactoryPerformanceEvent,
  isFactoryPerformanceDialogOpen,
} from '../pages/factory-performance'
import {
  handleSettlementEvent,
  handleSettlementSubmit,
  isSettlementDialogOpen,
} from '../pages/settlement'
import { handleCapacityEvent } from '../pages/capacity'
import {
  handleProductionEvent,
  handleProductionSubmit,
  isProductionDialogOpen,
} from '../pages/production'
import {
  closeProductionCraftDictDialog,
  handleProductionCraftDictEvent,
  isProductionCraftDictDialogOpen,
} from '../pages/production-craft-dict'
import { handleTechPackEvent, isTechPackDialogOpen } from '../pages/tech-pack'
import {
  handleProcessDyeRequirementsEvent,
  isProcessDyeRequirementsDialogOpen,
} from '../pages/process-dye-requirements'
import {
  handleProcessPrintRequirementsEvent,
  isProcessPrintRequirementsDialogOpen,
} from '../pages/process-print-requirements'
import {
  handleProcessDyeOrdersEvent,
  isProcessDyeOrdersDialogOpen,
} from '../pages/process-dye-orders'
import {
  handleProcessPrintOrdersEvent,
  isProcessPrintOrdersDialogOpen,
} from '../pages/process-print-orders'
import {
  handleTaskBreakdownEvent,
  isTaskBreakdownDialogOpen,
} from '../pages/task-breakdown'
import {
  handleDyePrintOrdersEvent,
  isDyePrintOrdersDialogOpen,
} from '../pages/dye-print-orders'
import {
  handleMaterialIssueEvent,
  isMaterialIssueDialogOpen,
} from '../pages/material-issue'
import { handleQcRecordsEvent } from '../pages/qc-records'
import { handleDeductionAnalysisEvent } from '../pages/deduction-analysis'
import {
  handleStatementsEvent,
  isStatementsDialogOpen,
} from '../pages/statements'
import { handleAdjustmentsEvent } from '../pages/adjustments'
import {
  handleBatchesEvent,
  isBatchesDialogOpen,
} from '../pages/batches'
import {
  handleMaterialStatementsEvent,
  isMaterialStatementsDialogOpen,
} from '../pages/material-statements'
import {
  handlePaymentSyncEvent,
  isPaymentSyncDialogOpen,
} from '../pages/payment-sync'
import { handleHistoryEvent } from '../pages/history'
import {
  handleDispatchAcceptanceSlaEvent,
  isDispatchAcceptanceSlaDialogOpen,
} from '../pages/dispatch-acceptance-sla'
import {
  handleDispatchBoardEvent,
  isDispatchBoardDialogOpen,
} from '../pages/dispatch-board'
import {
  handleSewingDispatchWorkbenchEvent,
  isSewingDispatchWorkbenchDialogOpen,
} from '../pages/sewing-dispatch-workbench'
import {
  handleDispatchTendersEvent,
  isDispatchTendersDialogOpen,
} from '../pages/dispatch-tenders'
import {
  handleProgressBoardEvent,
  isProgressBoardDialogOpen,
} from '../pages/progress-board'
import {
  handleProgressExceptionsEvent,
  isProgressExceptionsDialogOpen,
} from '../pages/progress-exceptions'
import {
  handleProgressUrgeEvent,
  isProgressUrgeDialogOpen,
} from '../pages/progress-urge'
import {
  handleProgressHandoverEvent,
  isProgressHandoverDialogOpen,
} from '../pages/progress-handover'
import { handleProgressHandoverOrderEvent } from '../pages/progress-handover-order'
import {
  handleProgressMaterialEvent,
  isProgressMaterialDrawerOpen,
} from '../pages/progress-material'
import {
  handleProgressCuttingOverviewEvent,
  isProgressCuttingOverviewDialogOpen,
} from '../pages/progress-cutting-overview'
import { handleProgressCuttingDetailEvent } from '../pages/progress-cutting-detail'
import {
  handleProgressCuttingExceptionCenterEvent,
  isProgressCuttingExceptionCenterDialogOpen,
} from '../pages/progress-cutting-exception-center'
import {
  handleCuttingSettlementInputEvent,
  isCuttingSettlementInputDialogOpen,
} from '../pages/settlement-cutting-input'
import {
  handleProgressMilestoneConfigEvent,
  isProgressMilestoneConfigDialogOpen,
} from '../pages/progress-milestone-config'
import {
  handleCraftCuttingProductionProgressEvent,
  isCraftCuttingProductionProgressDialogOpen,
} from '../pages/process-factory/cutting/production-progress'
import {
  handleCraftCuttingMarkerPlanEvent,
  isCraftCuttingMarkerPlanDialogOpen,
} from '../pages/process-factory/cutting/marker-plan'
import {
  handleCraftCuttingMarkerSpreadingEvent,
  isCraftCuttingMarkerSpreadingDialogOpen,
} from '../pages/process-factory/cutting/marker-spreading'
import { handleCraftCuttingFeiTicketsEvent } from '../pages/process-factory/cutting/fei-tickets'
import { handleCraftCuttingFeiTicketNumberingEvent } from '../pages/process-factory/cutting/fei-ticket-numbering'
import {
  handleCraftCuttingCutOrdersEvent,
  isCraftCuttingCutOrdersDialogOpen,
} from '../pages/process-factory/cutting/cut-orders'
import {
  handleCraftCuttingSpecialProcessesEvent,
  isCraftCuttingSpecialProcessesDialogOpen,
} from '../pages/process-factory/cutting/special-processes'
import {
  handleCraftCuttingSampleWarehouseEvent,
  isCraftCuttingSampleWarehouseDialogOpen,
} from '../pages/process-factory/cutting/sample-warehouse'
import { handleCraftCuttingTransferBagsEvent } from '../pages/process-factory/cutting/transfer-bags'
import {
  handleCraftCuttingSummaryEvent,
  isCraftCuttingSummaryDialogOpen,
} from '../pages/process-factory/cutting/cutting-summary'
import {
  handleCraftCuttingCutPieceReleaseEvent,
  isCraftCuttingCutPieceReleaseDialogOpen,
} from '../pages/process-factory/cutting/cut-piece-release'
import {
  handleCraftCuttingSupplementManagementEvent,
  isCraftCuttingSupplementManagementDialogOpen,
} from '../pages/process-factory/cutting/supplement-management'
import { handleCraftCuttingAbMaterialStatisticsEvent } from '../pages/process-factory/cutting/cutting-statistics-ab-material'
import {
  handleCraftCuttingWaitHandoverEvent,
  handleCraftCuttingWaitProcessEvent,
} from '../pages/process-factory/cutting/warehouse-hub'
import { handleCraftCuttingPickupManagementEvent } from '../pages/process-factory/cutting/pickup-management'
import { handleCraftCuttingHandoverOrdersEvent } from '../pages/process-factory/cutting/handover-orders'
import { handleCraftDyeingEvent } from '../pages/process-factory/dyeing/events'
import { handlePostFinishingEvent } from '../pages/process-factory/post-finishing/events'
import { handleCraftPrintingEvent } from '../pages/process-factory/printing/events'
import { handleCraftWoolEvent } from '../pages/process-factory/wool/work-orders'
import { handleCraftWoolMachineScheduleEvent } from '../pages/process-factory/wool/machine-schedule'
import { handleCraftWoolMachinesEvent } from '../pages/process-factory/wool/machines'
import { handleSpecialCraftWorkOrderDetailEvent } from '../pages/process-factory/special-craft/work-order-detail'
import { handleSpecialCraftTaskOrdersEvent } from '../pages/process-factory/special-craft/task-orders'
import { handleSpecialCraftWarehouseEvent } from '../pages/process-factory/special-craft/warehouse'
import {
  closeFactoryWarehouseSharedDialogs,
  handleFactoryWarehouseSharedEvent,
} from '../pages/process-factory/shared/warehouse-standard'

export async function dispatchFcsPageEvent(target: HTMLElement): Promise<boolean> {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  if (pathname.startsWith('/fcs/dispatch/acceptance-sla')) {
    return handleDispatchAcceptanceSlaEvent(target)
  }
  if (pathname.startsWith('/fcs/factories/profile')) {
    return handleFactoryPageEvent(target)
  }
  if (
    pathname.startsWith('/fcs/craft/cutting/special-processes')
    && target.closest('[data-cutting-binding-action]')
  ) {
    return handleCraftCuttingSpecialProcessesEvent(target)
  }
  if (target.closest('[data-cutting-supplement-action]')) {
    return handleCraftCuttingSupplementManagementEvent(target)
  }
  if (target.closest('[data-cut-piece-release-action]')) {
    return handleCraftCuttingCutPieceReleaseEvent(target)
  }

  const isPostFinishingRoute =
    pathname.includes('/fcs/craft/post-finishing')
  if (
    isPostFinishingRoute
    && target.closest('[data-post-finishing-action], [data-process-web-status-action]')
  ) {
    return handlePostFinishingEvent(target)
  }
  const isSpecialCraftRoute =
    pathname.includes('/fcs/process-factory/special-craft') ||
    pathname.includes('/fcs/craft/special-craft')
  if (
    isSpecialCraftRoute
    && target.closest([
      '[data-special-craft-web-action]',
      '[data-process-web-status-action]',
      '[data-special-craft-task-field]',
      '[data-special-craft-task-action]',
      '[data-special-craft-task-page-size]',
      '[data-special-craft-warehouse-field]',
      '[data-special-craft-warehouse-action]',
      '[data-special-craft-warehouse-page-size]',
    ].join(', '))
  ) {
    return (
      handleSpecialCraftTaskOrdersEvent(target) ||
      handleSpecialCraftWarehouseEvent(target) ||
      handleSpecialCraftWorkOrderDetailEvent(target)
    )
  }

  return (
    await handleCraftPrintingEvent(target) ||
    await handleCraftDyeingEvent(target) ||
    await handleFactoryWarehouseSharedEvent(target) ||
    await handleCraftWoolMachineScheduleEvent(target) ||
    await handleCraftWoolEvent(target) ||
    await handleCraftWoolMachinesEvent(target) ||
    await handlePostFinishingEvent(target) ||
    handleSpecialCraftTaskOrdersEvent(target) ||
    handleSpecialCraftWarehouseEvent(target) ||
    await handleSpecialCraftWorkOrderDetailEvent(target) ||
    await handleCraftCuttingCutOrdersEvent(target) ||
    await handleFactoryOnboardingEvent(target) ||
    await handleFactoryPageEvent(target) ||
    await handleFactoryCapacityProfileEvent(target) ||
    await handleCapabilityEvent(target) ||
    await handleFactoryStatusEvent(target) ||
    await handleFactoryPerformanceEvent(target) ||
    await handleSettlementEvent(target) ||
    await handleCapacityEvent(target) ||
    await handleProductionEvent(target) ||
    await handleProductionCraftDictEvent(target) ||
    await handleTechPackEvent(target) ||
    await handleProcessDyeRequirementsEvent(target) ||
    await handleProcessPrintRequirementsEvent(target) ||
    await handleProcessDyeOrdersEvent(target) ||
    await handleProcessPrintOrdersEvent(target) ||
    await handleMaterialIssueEvent(target) ||
    await handleQcRecordsEvent(target) ||
    await handleStatementsEvent(target) ||
    await handleAdjustmentsEvent(target) ||
    await handleBatchesEvent(target) ||
    await handleMaterialStatementsEvent(target) ||
    await handlePaymentSyncEvent(target) ||
    await handleHistoryEvent(target) ||
    await handleDispatchAcceptanceSlaEvent(target) ||
    await handleSewingDispatchWorkbenchEvent(target) ||
    await handleDispatchBoardEvent(target) ||
    await handleDispatchTendersEvent(target) ||
    await handleProgressBoardEvent(target) ||
    await handleProgressExceptionsEvent(target) ||
    await handleProgressUrgeEvent(target) ||
    await handleProgressHandoverEvent(target) ||
    await handleProgressHandoverOrderEvent(target) ||
    await handleProgressMilestoneConfigEvent(target) ||
    await handleProgressMaterialEvent(target) ||
    await handleProgressCuttingOverviewEvent(target) ||
    await handleProgressCuttingDetailEvent(target) ||
    await handleProgressCuttingExceptionCenterEvent(target) ||
    await handleCuttingSettlementInputEvent(target) ||
    await handleCraftCuttingProductionProgressEvent(target) ||
    await handleCraftCuttingMarkerPlanEvent(target) ||
    await handleCraftCuttingMarkerSpreadingEvent(target) ||
    await handleCraftCuttingFeiTicketsEvent(target) ||
    await handleCraftCuttingFeiTicketNumberingEvent(target) ||
    await handleCraftCuttingWaitProcessEvent(target) ||
    await handleCraftCuttingWaitHandoverEvent(target) ||
    await handleCraftCuttingPickupManagementEvent(target) ||
    await handleCraftCuttingHandoverOrdersEvent(target) ||
    await handleCraftCuttingSampleWarehouseEvent(target) ||
    await handleCraftCuttingTransferBagsEvent(target) ||
    await handleCraftCuttingSpecialProcessesEvent(target) ||
    await handleCraftCuttingSummaryEvent(target) ||
    await handleCraftCuttingCutPieceReleaseEvent(target) ||
    await handleCraftCuttingSupplementManagementEvent(target) ||
    await handleCraftCuttingAbMaterialStatisticsEvent(target) ||
    await handleDeductionAnalysisEvent(target) ||
    await handleDyePrintOrdersEvent(target) ||
    await handleTaskBreakdownEvent(target)
  )
}

export function dispatchFcsPageSubmit(form: HTMLFormElement): boolean {
  return (
    handleFactoryPageSubmit(form) ||
    handleCapabilitySubmit(form) ||
    handleSettlementSubmit(form) ||
    handleProductionSubmit(form)
  )
}

export function closeFcsDialogsOnEscape(): boolean {
  if (closeFactoryWarehouseSharedDialogs()) {
    return true
  }

  if (isFactoryCapacityProfileDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.capacityAction = 'close-detail'
    handleFactoryCapacityProfileEvent(fakeButton)
    return true
  }

  if (isCapabilityDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.capAction = 'close-dialog'
    handleCapabilityEvent(fakeButton)
    return true
  }

  if (isFactoryStatusDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.statusAction = 'close-dialog'
    handleFactoryStatusEvent(fakeButton)
    return true
  }

  if (isFactoryPerformanceDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.perfAction = 'close-dialog'
    handleFactoryPerformanceEvent(fakeButton)
    return true
  }

  if (isSettlementDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.settleAction = 'close-dialog'
    handleSettlementEvent(fakeButton)
    return true
  }

  if (isProductionDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.prodAction = 'close-dialog'
    handleProductionEvent(fakeButton)
    return true
  }

  if (isProductionCraftDictDialogOpen()) {
    closeProductionCraftDictDialog()
    return true
  }

  if (isTechPackDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.techAction = 'close-dialog'
    handleTechPackEvent(fakeButton)
    return true
  }

  if (isTaskBreakdownDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.breakdownAction = 'close-dialog'
    handleTaskBreakdownEvent(fakeButton)
    return true
  }

  if (isProcessDyeRequirementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dyeReqAction = 'close-all'
    handleProcessDyeRequirementsEvent(fakeButton)
    return true
  }

  if (isProcessPrintRequirementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.printReqAction = 'close-all'
    handleProcessPrintRequirementsEvent(fakeButton)
    return true
  }

  if (isProcessDyeOrdersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dyeOrderAction = 'close-all'
    handleProcessDyeOrdersEvent(fakeButton)
    return true
  }

  if (isProcessPrintOrdersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.printOrderAction = 'close-all'
    handleProcessPrintOrdersEvent(fakeButton)
    return true
  }

  if (isMaterialIssueDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.misAction = 'close-dialog'
    handleMaterialIssueEvent(fakeButton)
    return true
  }

  if (isStatementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.stmAction = 'close-detail'
    handleStatementsEvent(fakeButton)
    return true
  }

  if (isBatchesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.batchAction = 'close-detail'
    handleBatchesEvent(fakeButton)
    return true
  }

  if (isMaterialStatementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.mstAction = 'close-detail'
    handleMaterialStatementsEvent(fakeButton)
    return true
  }

  if (isPaymentSyncDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.payAction = 'close-dialog'
    handlePaymentSyncEvent(fakeButton)
    return true
  }

  if (isDyePrintOrdersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dyeAction = 'close-dialog'
    handleDyePrintOrdersEvent(fakeButton)
    return true
  }

  if (isDispatchBoardDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dispatchAction = 'close-dialog'
    handleDispatchBoardEvent(fakeButton)
    return true
  }

  if (isDispatchAcceptanceSlaDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.acceptanceSlaAction = 'close-dialog'
    handleDispatchAcceptanceSlaEvent(fakeButton)
    return true
  }

  if (isSewingDispatchWorkbenchDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.sewingDispatchAction = 'close-detail'
    handleSewingDispatchWorkbenchEvent(fakeButton)
    fakeButton.dataset.sewingDispatchAction = 'close-dispatch'
    handleSewingDispatchWorkbenchEvent(fakeButton)
    return true
  }

  if (isDispatchTendersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.tenderAction = 'close-dialog'
    handleDispatchTendersEvent(fakeButton)
    return true
  }

  if (isProgressBoardDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.progressAction = 'close-task-drawer'
    handleProgressBoardEvent(fakeButton)
    fakeButton.dataset.progressAction = 'close-order-drawer'
    handleProgressBoardEvent(fakeButton)
    fakeButton.dataset.progressAction = 'close-block-dialog'
    handleProgressBoardEvent(fakeButton)
    fakeButton.dataset.progressAction = 'close-batch-dialog'
    handleProgressBoardEvent(fakeButton)
    return true
  }

  if (isProgressExceptionsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.peAction = 'close-detail'
    handleProgressExceptionsEvent(fakeButton)
    fakeButton.dataset.peAction = 'close-unblock-dialog'
    handleProgressExceptionsEvent(fakeButton)
    fakeButton.dataset.peAction = 'close-extend-dialog'
    handleProgressExceptionsEvent(fakeButton)
    return true
  }

  if (isProgressUrgeDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.urgeAction = 'close-notification-detail'
    handleProgressUrgeEvent(fakeButton)
    fakeButton.dataset.urgeAction = 'close-urge-detail'
    handleProgressUrgeEvent(fakeButton)
    fakeButton.dataset.urgeAction = 'close-new-urge'
    handleProgressUrgeEvent(fakeButton)
    fakeButton.dataset.urgeAction = 'close-resend-dialog'
    handleProgressUrgeEvent(fakeButton)
    return true
  }

  if (isProgressHandoverDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.handoverAction = 'close-detail'
    handleProgressHandoverEvent(fakeButton)
    fakeButton.dataset.handoverAction = 'close-new-drawer'
    handleProgressHandoverEvent(fakeButton)
    fakeButton.dataset.handoverAction = 'close-confirm-dialog'
    handleProgressHandoverEvent(fakeButton)
    fakeButton.dataset.handoverAction = 'close-dispute-dialog'
    handleProgressHandoverEvent(fakeButton)
    fakeButton.dataset.handoverAction = 'close-writeback-dialog'
    handleProgressHandoverEvent(fakeButton)
    fakeButton.dataset.handoverAction = 'close-objection-dialog'
    handleProgressHandoverEvent(fakeButton)
    return true
  }

  if (isProgressMaterialDrawerOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.materialAction = 'close-drawer'
    handleProgressMaterialEvent(fakeButton)
    return true
  }

  if (isProgressCuttingOverviewDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.platformCuttingAction = 'close-summary'
    handleProgressCuttingOverviewEvent(fakeButton)
    return true
  }

  if (isProgressCuttingExceptionCenterDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingExceptionAction = 'close-overlay'
    handleProgressCuttingExceptionCenterEvent(fakeButton)
    return true
  }

  if (isCuttingSettlementInputDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingSettlementAction = 'close-overlay'
    handleCuttingSettlementInputEvent(fakeButton)
    return true
  }

  if (isCraftCuttingProductionProgressDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingProgressAction = 'close-detail'
    handleCraftCuttingProductionProgressEvent(fakeButton)
    return true
  }

  if (isCraftCuttingMarkerPlanDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.markerPlanAction = 'close-context-drawer'
    handleCraftCuttingMarkerPlanEvent(fakeButton)
    return true
  }

  if (isCraftCuttingMarkerSpreadingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingMarkerAction = 'close-overlay'
    handleCraftCuttingMarkerSpreadingEvent(fakeButton)
    return true
  }

  if (isCraftCuttingCutOrdersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingPieceAction = 'close-overlay'
    handleCraftCuttingCutOrdersEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSampleWarehouseDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.sampleWarehouseAction = 'close-detail'
    handleCraftCuttingSampleWarehouseEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSpecialProcessesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingBindingAction = 'close-overlay'
    handleCraftCuttingSpecialProcessesEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSummaryDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingSummaryAction = 'close-overlay'
    handleCraftCuttingSummaryEvent(fakeButton)
    return true
  }

  if (isCraftCuttingCutPieceReleaseDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cutPieceReleaseAction = 'close-overlay'
    handleCraftCuttingCutPieceReleaseEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSupplementManagementDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingSupplementAction = 'close-overlay'
    handleCraftCuttingSupplementManagementEvent(fakeButton)
    return true
  }

  if (isProgressMilestoneConfigDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.milestoneAction = 'close-drawer'
    handleProgressMilestoneConfigEvent(fakeButton)
    return true
  }

  if (isFactoryPageOpenDialog()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.factoryAction = 'close-dialog'
    handleFactoryPageEvent(fakeButton)
    return true
  }

  if (isFactoryOnboardingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.factoryOnboardingAction = 'close-detail'
    handleFactoryOnboardingEvent(fakeButton)
    fakeButton.dataset.factoryOnboardingAction = 'close-review'
    handleFactoryOnboardingEvent(fakeButton)
    fakeButton.dataset.factoryOnboardingAction = 'close-conversion'
    handleFactoryOnboardingEvent(fakeButton)
    return true
  }

  return false
}
