import {
  handleFactoryPageEvent,
  handleFactoryPageSubmit,
  isFactoryPageOpenDialog,
} from '../pages/factory-profile'
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
import { handleDeductionCalcEvent } from '../pages/deduction-calc'
import {
  handleArbitrationEvent,
  isArbitrationDialogOpen,
} from '../pages/arbitration'
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
  handleDispatchBoardEvent,
  isDispatchBoardDialogOpen,
} from '../pages/dispatch-board'
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
  handleCraftCuttingOrderProgressEvent,
  isCraftCuttingOrderProgressDialogOpen,
} from '../pages/process-factory/cutting/order-progress'
import { handleCraftCuttingCuttablePoolEvent } from '../pages/process-factory/cutting/cuttable-pool'
import { handleCraftCuttingMergeBatchesEvent } from '../pages/process-factory/cutting/merge-batches'
import {
  handleCraftCuttingMaterialPrepEvent,
  isCraftCuttingMaterialPrepDialogOpen,
} from '../pages/process-factory/cutting/material-prep'
import {
  handleCraftCuttingMarkerSpreadingEvent,
  isCraftCuttingMarkerSpreadingDialogOpen,
} from '../pages/process-factory/cutting/marker-spreading'
import { handleCraftCuttingFeiTicketsEvent } from '../pages/process-factory/cutting/fei-tickets'
import {
  handleCraftCuttingFabricWarehouseEvent,
  isCraftCuttingFabricWarehouseDialogOpen,
} from '../pages/process-factory/cutting/fabric-warehouse'
import {
  handleCraftCuttingCutPieceWarehouseEvent,
  isCraftCuttingCutPieceWarehouseDialogOpen,
} from '../pages/process-factory/cutting/cut-piece-warehouse'
import {
  handleCraftCuttingPieceOrdersEvent,
  isCraftCuttingPieceOrdersDialogOpen,
} from '../pages/process-factory/cutting/cut-piece-orders'
import {
  handleCraftCuttingReplenishmentEvent,
  isCraftCuttingReplenishmentDialogOpen,
} from '../pages/process-factory/cutting/replenishment'
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
  handleCraftCuttingWarehouseManagementEvent,
  isCraftCuttingWarehouseManagementDialogOpen,
} from '../pages/process-factory/cutting/warehouse-management'
import {
  handleCraftCuttingSummaryEvent,
  isCraftCuttingSummaryDialogOpen,
} from '../pages/process-factory/cutting/cutting-summary'

export function dispatchFcsPageEvent(target: HTMLElement): boolean {
  return (
    handleFactoryPageEvent(target) ||
    handleCapabilityEvent(target) ||
    handleFactoryStatusEvent(target) ||
    handleFactoryPerformanceEvent(target) ||
    handleSettlementEvent(target) ||
    handleCapacityEvent(target) ||
    handleProductionEvent(target) ||
    handleProductionCraftDictEvent(target) ||
    handleTechPackEvent(target) ||
    handleProcessDyeRequirementsEvent(target) ||
    handleProcessPrintRequirementsEvent(target) ||
    handleProcessDyeOrdersEvent(target) ||
    handleProcessPrintOrdersEvent(target) ||
    handleMaterialIssueEvent(target) ||
    handleQcRecordsEvent(target) ||
    handleDeductionCalcEvent(target) ||
    handleArbitrationEvent(target) ||
    handleStatementsEvent(target) ||
    handleAdjustmentsEvent(target) ||
    handleBatchesEvent(target) ||
    handleMaterialStatementsEvent(target) ||
    handlePaymentSyncEvent(target) ||
    handleHistoryEvent(target) ||
    handleDispatchBoardEvent(target) ||
    handleDispatchTendersEvent(target) ||
    handleProgressBoardEvent(target) ||
    handleProgressExceptionsEvent(target) ||
    handleProgressUrgeEvent(target) ||
    handleProgressHandoverEvent(target) ||
    handleProgressHandoverOrderEvent(target) ||
    handleProgressMilestoneConfigEvent(target) ||
    handleProgressMaterialEvent(target) ||
    handleProgressCuttingOverviewEvent(target) ||
    handleProgressCuttingDetailEvent(target) ||
    handleProgressCuttingExceptionCenterEvent(target) ||
    handleCuttingSettlementInputEvent(target) ||
    handleCraftCuttingOrderProgressEvent(target) ||
    handleCraftCuttingCuttablePoolEvent(target) ||
    handleCraftCuttingMergeBatchesEvent(target) ||
    handleCraftCuttingMaterialPrepEvent(target) ||
    handleCraftCuttingMarkerSpreadingEvent(target) ||
    handleCraftCuttingFeiTicketsEvent(target) ||
    handleCraftCuttingFabricWarehouseEvent(target) ||
    handleCraftCuttingCutPieceWarehouseEvent(target) ||
    handleCraftCuttingSampleWarehouseEvent(target) ||
    handleCraftCuttingTransferBagsEvent(target) ||
    handleCraftCuttingPieceOrdersEvent(target) ||
    handleCraftCuttingReplenishmentEvent(target) ||
    handleCraftCuttingSpecialProcessesEvent(target) ||
    handleCraftCuttingWarehouseManagementEvent(target) ||
    handleCraftCuttingSummaryEvent(target) ||
    handleDeductionAnalysisEvent(target) ||
    handleDyePrintOrdersEvent(target) ||
    handleTaskBreakdownEvent(target)
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

  if (isArbitrationDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.arbAction = 'close-dialog'
    handleArbitrationEvent(fakeButton)
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

  if (isCraftCuttingOrderProgressDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingProgressAction = 'close-detail'
    handleCraftCuttingOrderProgressEvent(fakeButton)
    return true
  }

  if (isCraftCuttingMaterialPrepDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingPrepAction = 'close-overlay'
    handleCraftCuttingMaterialPrepEvent(fakeButton)
    return true
  }

  if (isCraftCuttingMarkerSpreadingDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingMarkerAction = 'close-overlay'
    handleCraftCuttingMarkerSpreadingEvent(fakeButton)
    return true
  }

  if (isCraftCuttingPieceOrdersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingPieceAction = 'close-overlay'
    handleCraftCuttingPieceOrdersEvent(fakeButton)
    return true
  }

  if (isCraftCuttingFabricWarehouseDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.fabricWarehouseAction = 'close-detail'
    handleCraftCuttingFabricWarehouseEvent(fakeButton)
    return true
  }

  if (isCraftCuttingCutPieceWarehouseDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cutPieceWarehouseAction = 'close-detail'
    handleCraftCuttingCutPieceWarehouseEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSampleWarehouseDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.sampleWarehouseAction = 'close-detail'
    handleCraftCuttingSampleWarehouseEvent(fakeButton)
    return true
  }

  if (isCraftCuttingReplenishmentDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingReplenishAction = 'close-overlay'
    handleCraftCuttingReplenishmentEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSpecialProcessesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.specialProcessAction = 'close-overlay'
    handleCraftCuttingSpecialProcessesEvent(fakeButton)
    return true
  }

  if (isCraftCuttingWarehouseManagementDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingWarehouseAction = 'close-overlay'
    handleCraftCuttingWarehouseManagementEvent(fakeButton)
    return true
  }

  if (isCraftCuttingSummaryDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.cuttingSummaryAction = 'close-overlay'
    handleCraftCuttingSummaryEvent(fakeButton)
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

  return false
}
