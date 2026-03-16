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
  handleDependenciesEvent,
  isDependenciesDialogOpen,
} from '../pages/dependencies'
import {
  handleMaterialIssueEvent,
  isMaterialIssueDialogOpen,
} from '../pages/material-issue'
import {
  handleQcStandardsEvent,
  isQcStandardsDialogOpen,
} from '../pages/qc-standards'
import { handleQcRecordsEvent } from '../pages/qc-records'
import { handleDeductionCalcEvent } from '../pages/deduction-calc'
import {
  handleArbitrationEvent,
  isArbitrationDialogOpen,
} from '../pages/arbitration'
import { handlePenaltyOutputEvent } from '../pages/penalty-output'
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
  handleDispatchExceptionsEvent,
  isDispatchExceptionsDialogOpen,
} from '../pages/dispatch-exceptions'
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
import { handleProgressStatusWritebackEvent } from '../pages/progress-status-writeback'
import {
  handleProgressMaterialEvent,
  isProgressMaterialDrawerOpen,
} from '../pages/progress-material'

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
    handleDependenciesEvent(target) ||
    handleMaterialIssueEvent(target) ||
    handleQcStandardsEvent(target) ||
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
    handleDispatchExceptionsEvent(target) ||
    handleProgressBoardEvent(target) ||
    handleProgressExceptionsEvent(target) ||
    handleProgressUrgeEvent(target) ||
    handleProgressHandoverEvent(target) ||
    handleProgressStatusWritebackEvent(target) ||
    handleProgressMaterialEvent(target) ||
    handlePenaltyOutputEvent(target) ||
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

  if (isDependenciesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.depAction = 'close-dialog'
    handleDependenciesEvent(fakeButton)
    return true
  }

  if (isMaterialIssueDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.misAction = 'close-dialog'
    handleMaterialIssueEvent(fakeButton)
    return true
  }

  if (isQcStandardsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.qcsAction = 'close-dialog'
    handleQcStandardsEvent(fakeButton)
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

  if (isDispatchExceptionsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dexAction = 'close-dialog'
    handleDispatchExceptionsEvent(fakeButton)
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

  if (isFactoryPageOpenDialog()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.factoryAction = 'close-dialog'
    handleFactoryPageEvent(fakeButton)
    return true
  }

  return false
}
