import './styles.css'
import { hydrateIcons, renderAppShell } from './components/shell'
import { appStore } from './state/store'
import {
  handleFactoryPageEvent,
  handleFactoryPageSubmit,
  isFactoryPageOpenDialog,
} from './pages/factory-profile'
import {
  handleCapabilityEvent,
  handleCapabilitySubmit,
  isCapabilityDialogOpen,
} from './pages/capability'
import {
  handleFactoryStatusEvent,
  isFactoryStatusDialogOpen,
} from './pages/factory-status'
import {
  handleFactoryPerformanceEvent,
  isFactoryPerformanceDialogOpen,
} from './pages/factory-performance'
import {
  handleSettlementEvent,
  handleSettlementSubmit,
  isSettlementDialogOpen,
} from './pages/settlement'
import { handleCapacityEvent } from './pages/capacity'
import {
  handleProductionEvent,
  handleProductionSubmit,
  isProductionDialogOpen,
} from './pages/production'
import {
  closeProductionCraftDictDialog,
  handleProductionCraftDictEvent,
  isProductionCraftDictDialogOpen,
} from './pages/production-craft-dict'
import { handleTechPackEvent, isTechPackDialogOpen } from './pages/tech-pack'
import {
  handleProcessDyeRequirementsEvent,
  isProcessDyeRequirementsDialogOpen,
} from './pages/process-dye-requirements'
import {
  handleProcessPrintRequirementsEvent,
  isProcessPrintRequirementsDialogOpen,
} from './pages/process-print-requirements'
import {
  handleTaskBreakdownEvent,
  isTaskBreakdownDialogOpen,
} from './pages/task-breakdown'
import {
  handleDyePrintOrdersEvent,
  isDyePrintOrdersDialogOpen,
} from './pages/dye-print-orders'
import {
  handleDependenciesEvent,
  isDependenciesDialogOpen,
} from './pages/dependencies'
import {
  handleMaterialIssueEvent,
  isMaterialIssueDialogOpen,
} from './pages/material-issue'
import {
  handleQcStandardsEvent,
  isQcStandardsDialogOpen,
} from './pages/qc-standards'
import { handleQcRecordsEvent } from './pages/qc-records'
import { handleReworkEvent } from './pages/rework'
import { handleDeductionCalcEvent } from './pages/deduction-calc'
import {
  handleArbitrationEvent,
  isArbitrationDialogOpen,
} from './pages/arbitration'
import { handlePenaltyOutputEvent } from './pages/penalty-output'
import {
  handleStatementsEvent,
  isStatementsDialogOpen,
} from './pages/statements'
import { handleAdjustmentsEvent } from './pages/adjustments'
import {
  handleBatchesEvent,
  isBatchesDialogOpen,
} from './pages/batches'
import {
  handleMaterialStatementsEvent,
  isMaterialStatementsDialogOpen,
} from './pages/material-statements'
import {
  handlePaymentSyncEvent,
  isPaymentSyncDialogOpen,
} from './pages/payment-sync'
import { handleHistoryEvent } from './pages/history'
import {
  handleDispatchBoardEvent,
  isDispatchBoardDialogOpen,
} from './pages/dispatch-board'
import {
  handleDispatchTendersEvent,
  isDispatchTendersDialogOpen,
} from './pages/dispatch-tenders'
import {
  handleDispatchExceptionsEvent,
  isDispatchExceptionsDialogOpen,
} from './pages/dispatch-exceptions'
import {
  handleProgressBoardEvent,
  isProgressBoardDialogOpen,
} from './pages/progress-board'
import {
  handleProgressExceptionsEvent,
  isProgressExceptionsDialogOpen,
} from './pages/progress-exceptions'
import {
  handleProgressUrgeEvent,
  isProgressUrgeDialogOpen,
} from './pages/progress-urge'
import {
  handleProgressHandoverEvent,
  isProgressHandoverDialogOpen,
} from './pages/progress-handover'
import { handleProgressStatusWritebackEvent } from './pages/progress-status-writeback'
import {
  handleProgressMaterialEvent,
  isProgressMaterialDrawerOpen,
} from './pages/progress-material'
import { handlePdaNotifyEvent } from './pages/pda-notify'
import { handlePdaNotifyDueSoonEvent } from './pages/pda-notify-due-soon'
import { handlePdaNotifyDetailEvent } from './pages/pda-notify-detail'
import { handlePdaTaskReceiveEvent } from './pages/pda-task-receive'
import { handlePdaTaskReceiveDetailEvent } from './pages/pda-task-receive-detail'
import { handlePdaExecEvent } from './pages/pda-exec'
import { handlePdaExecDetailEvent } from './pages/pda-exec-detail'
import { handlePdaHandoverEvent } from './pages/pda-handover'
import { handlePdaHandoverDetailEvent } from './pages/pda-handover-detail'
import { handlePdaSettlementEvent } from './pages/pda-settlement'

const rootNode = document.querySelector('#app')

if (!(rootNode instanceof HTMLDivElement)) {
  throw new Error('Missing #app root node')
}

const root = rootNode

appStore.init()

function dispatchPageEvent(target: Element): boolean {
  const eventTarget = target as HTMLElement
  return (
    handleFactoryPageEvent(eventTarget) ||
    handleCapabilityEvent(eventTarget) ||
    handleFactoryStatusEvent(eventTarget) ||
    handleFactoryPerformanceEvent(eventTarget) ||
    handleSettlementEvent(eventTarget) ||
    handleCapacityEvent(eventTarget) ||
    handleProductionEvent(eventTarget) ||
    handleProductionCraftDictEvent(eventTarget) ||
    handleTechPackEvent(eventTarget) ||
    handleProcessDyeRequirementsEvent(eventTarget) ||
    handleProcessPrintRequirementsEvent(eventTarget) ||
    handleDependenciesEvent(eventTarget) ||
    handleMaterialIssueEvent(eventTarget) ||
    handleQcStandardsEvent(eventTarget) ||
    handleQcRecordsEvent(eventTarget) ||
    handleReworkEvent(eventTarget) ||
    handleDeductionCalcEvent(eventTarget) ||
    handleArbitrationEvent(eventTarget) ||
    handleStatementsEvent(eventTarget) ||
    handleAdjustmentsEvent(eventTarget) ||
    handleBatchesEvent(eventTarget) ||
    handleMaterialStatementsEvent(eventTarget) ||
    handlePaymentSyncEvent(eventTarget) ||
    handleHistoryEvent(eventTarget) ||
    handleDispatchBoardEvent(eventTarget) ||
    handleDispatchTendersEvent(eventTarget) ||
    handleDispatchExceptionsEvent(eventTarget) ||
    handleProgressBoardEvent(eventTarget) ||
    handleProgressExceptionsEvent(eventTarget) ||
    handleProgressUrgeEvent(eventTarget) ||
    handleProgressHandoverEvent(eventTarget) ||
    handleProgressStatusWritebackEvent(eventTarget) ||
    handleProgressMaterialEvent(eventTarget) ||
    handlePdaNotifyEvent(eventTarget) ||
    handlePdaNotifyDueSoonEvent(eventTarget) ||
    handlePdaNotifyDetailEvent(eventTarget) ||
    handlePdaTaskReceiveEvent(eventTarget) ||
    handlePdaTaskReceiveDetailEvent(eventTarget) ||
    handlePdaExecEvent(eventTarget) ||
    handlePdaExecDetailEvent(eventTarget) ||
    handlePdaHandoverEvent(eventTarget) ||
    handlePdaHandoverDetailEvent(eventTarget) ||
    handlePdaSettlementEvent(eventTarget) ||
    handlePenaltyOutputEvent(eventTarget) ||
    handleDyePrintOrdersEvent(eventTarget) ||
    handleTaskBreakdownEvent(eventTarget)
  )
}

function dispatchPageSubmit(form: HTMLFormElement): boolean {
  return (
    handleFactoryPageSubmit(form) ||
    handleCapabilitySubmit(form) ||
    handleSettlementSubmit(form) ||
    handleProductionSubmit(form)
  )
}

function render(): void {
  root.innerHTML = renderAppShell(appStore.getState())
  hydrateIcons(root)
}

function closeMobileSidebar(): void {
  const { sidebarOpen } = appStore.getState()
  if (sidebarOpen) {
    appStore.setSidebarOpen(false)
  }
}

function hasDatasetAction(node: HTMLElement): boolean {
  return Object.keys(node.dataset).some((key) => key === 'action' || key.endsWith('Action'))
}

function hasDatasetFieldLike(node: HTMLElement): boolean {
  return Object.keys(node.dataset).some(
    (key) => key === 'field' || key === 'filter' || key.endsWith('Field') || key.endsWith('Filter'),
  )
}

function shouldBypassClickDispatch(target: Element): boolean {
  const controlNode = target.closest<HTMLElement>('input, textarea, select, option')
  if (!controlNode) return false

  const actionBound = hasDatasetAction(controlNode)

  // Let native select keep its default open/select behavior.
  if (controlNode instanceof HTMLSelectElement || controlNode instanceof HTMLOptionElement) return true
  if (controlNode.closest('select') instanceof HTMLSelectElement) return true

  if (controlNode instanceof HTMLTextAreaElement && !actionBound) return true

  if (controlNode instanceof HTMLInputElement) {
    const inputType = (controlNode.type || 'text').toLowerCase()
    const clickDrivenTypes = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'file', 'color'])
    if (!clickDrivenTypes.has(inputType) && !actionBound) return true
  }

  // Field/filter controls are synced by global input/change listeners.
  // Avoid click-triggered full rerender that causes flicker and focus loss.
  if (hasDatasetFieldLike(controlNode) && !actionBound) return true

  return false
}

root.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  if (shouldBypassClickDispatch(target)) return

  if (dispatchPageEvent(target)) {
    event.preventDefault()
    render()
    return
  }

  const navNode = target.closest<HTMLElement>('[data-nav]')
  if (navNode?.dataset.nav) {
    event.preventDefault()
    appStore.navigate(navNode.dataset.nav)
    closeMobileSidebar()
    return
  }

  const actionNode = target.closest<HTMLElement>('[data-action]')
  if (!actionNode) return

  const action = actionNode.dataset.action
  if (!action) return

  event.preventDefault()

  if (action === 'switch-system') {
    const systemId = actionNode.dataset.systemId
    if (systemId) {
      appStore.switchSystem(systemId)
      closeMobileSidebar()
    }
    return
  }

  if (action === 'set-sidebar-open') {
    appStore.setSidebarOpen(actionNode.dataset.sidebarOpen === 'true')
    return
  }

  if (action === 'toggle-sidebar-collapsed') {
    appStore.toggleSidebarCollapsed()
    return
  }

  if (action === 'toggle-menu-group') {
    const groupKey = actionNode.dataset.groupKey
    if (groupKey) appStore.toggleGroup(groupKey)
    return
  }

  if (action === 'toggle-menu-item') {
    const itemKey = actionNode.dataset.itemKey
    if (itemKey) appStore.toggleItem(itemKey)
    return
  }

  if (action === 'open-tab') {
    const href = actionNode.dataset.tabHref
    const key = actionNode.dataset.tabKey
    const title = actionNode.dataset.tabTitle

    if (href && key && title) {
      appStore.openTab({
        href,
        key,
        title,
        closable: true,
      })
      closeMobileSidebar()
    }
    return
  }

  if (action === 'activate-tab') {
    const key = actionNode.dataset.tabKey
    if (key) appStore.activateTab(key)
    return
  }

  if (action === 'close-tab') {
    const key = actionNode.dataset.tabKey
    if (key) appStore.closeTab(key)
    return
  }
})

root.addEventListener('input', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  if (dispatchPageEvent(target)) {
    render()
  }
})

root.addEventListener('change', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return

  if (dispatchPageEvent(target)) {
    render()
  }
})

root.addEventListener('submit', (event) => {
  const target = event.target
  if (!(target instanceof HTMLFormElement)) return

  if (dispatchPageSubmit(target)) {
    event.preventDefault()
    render()
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return

  if (isCapabilityDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.capAction = 'close-dialog'
    handleCapabilityEvent(fakeButton)
    render()
    return
  }

  if (isFactoryStatusDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.statusAction = 'close-dialog'
    handleFactoryStatusEvent(fakeButton)
    render()
    return
  }

  if (isFactoryPerformanceDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.perfAction = 'close-dialog'
    handleFactoryPerformanceEvent(fakeButton)
    render()
    return
  }

  if (isSettlementDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.settleAction = 'close-dialog'
    handleSettlementEvent(fakeButton)
    render()
    return
  }

  if (isProductionDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.prodAction = 'close-dialog'
    handleProductionEvent(fakeButton)
    render()
    return
  }

  if (isProductionCraftDictDialogOpen()) {
    closeProductionCraftDictDialog()
    render()
    return
  }

  if (isTechPackDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.techAction = 'close-dialog'
    handleTechPackEvent(fakeButton)
    render()
    return
  }

  if (isTaskBreakdownDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.breakdownAction = 'close-dialog'
    handleTaskBreakdownEvent(fakeButton)
    render()
    return
  }

  if (isProcessDyeRequirementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dyeReqAction = 'close-all'
    handleProcessDyeRequirementsEvent(fakeButton)
    render()
    return
  }

  if (isProcessPrintRequirementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.printReqAction = 'close-all'
    handleProcessPrintRequirementsEvent(fakeButton)
    render()
    return
  }

  if (isDependenciesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.depAction = 'close-dialog'
    handleDependenciesEvent(fakeButton)
    render()
    return
  }

  if (isMaterialIssueDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.misAction = 'close-dialog'
    handleMaterialIssueEvent(fakeButton)
    render()
    return
  }

  if (isQcStandardsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.qcsAction = 'close-dialog'
    handleQcStandardsEvent(fakeButton)
    render()
    return
  }

  if (isArbitrationDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.arbAction = 'close-dialog'
    handleArbitrationEvent(fakeButton)
    render()
    return
  }

  if (isStatementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.stmAction = 'close-detail'
    handleStatementsEvent(fakeButton)
    render()
    return
  }

  if (isBatchesDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.batchAction = 'close-detail'
    handleBatchesEvent(fakeButton)
    render()
    return
  }

  if (isMaterialStatementsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.mstAction = 'close-detail'
    handleMaterialStatementsEvent(fakeButton)
    render()
    return
  }

  if (isPaymentSyncDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.payAction = 'close-dialog'
    handlePaymentSyncEvent(fakeButton)
    render()
    return
  }

  if (isDyePrintOrdersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dyeAction = 'close-dialog'
    handleDyePrintOrdersEvent(fakeButton)
    render()
    return
  }

  if (isDispatchBoardDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dispatchAction = 'close-dialog'
    handleDispatchBoardEvent(fakeButton)
    render()
    return
  }

  if (isDispatchTendersDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.tenderAction = 'close-dialog'
    handleDispatchTendersEvent(fakeButton)
    render()
    return
  }

  if (isDispatchExceptionsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.dexAction = 'close-dialog'
    handleDispatchExceptionsEvent(fakeButton)
    render()
    return
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
    render()
    return
  }

  if (isProgressExceptionsDialogOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.peAction = 'close-detail'
    handleProgressExceptionsEvent(fakeButton)
    fakeButton.dataset.peAction = 'close-unblock-dialog'
    handleProgressExceptionsEvent(fakeButton)
    fakeButton.dataset.peAction = 'close-extend-dialog'
    handleProgressExceptionsEvent(fakeButton)
    render()
    return
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
    render()
    return
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
    render()
    return
  }

  if (isProgressMaterialDrawerOpen()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.materialAction = 'close-drawer'
    handleProgressMaterialEvent(fakeButton)
    render()
    return
  }

  if (isFactoryPageOpenDialog()) {
    const fakeButton = document.createElement('button')
    fakeButton.dataset.factoryAction = 'close-dialog'
    handleFactoryPageEvent(fakeButton)
    render()
    return
  }

  if (appStore.getState().sidebarOpen) {
    appStore.setSidebarOpen(false)
  }
})

appStore.subscribe(render)
render()
