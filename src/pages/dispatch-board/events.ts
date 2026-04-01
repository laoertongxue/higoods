import {
  state,
  candidateFactories,
  getVisibleRows,
  getFactoryOptions,
  getCreateTenderTask,
  getTaskAllocatableGroups,
  getSelectableTenderFactoryIds,
  openAppRoute,
  supportsDetailAssignment,
  type DispatchView,
} from './context'
import {
  applyAutoAssign,
  openDispatchDialog,
  closeDispatchDialog,
  confirmDirectDispatch,
  setTaskAssignMode,
  batchSetTaskAssignMode,
} from './dispatch-domain'
import {
  openCreateTender,
  closeCreateTender,
  confirmCreateTender,
  openViewTender,
  closeViewTender,
  closePriceSnapshot,
} from './tender-domain'

function getTenderSelectableFactoryIds(): Set<string> {
  const task = getCreateTenderTask()
  if (!task) return new Set(candidateFactories.map((factory) => factory.id))
  const detailGroups =
    state.createTenderForm.mode === 'DETAIL' && supportsDetailAssignment(task)
      ? getTaskAllocatableGroups(task)
      : []
  return new Set(getSelectableTenderFactoryIds(task, detailGroups))
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (field === 'filter.keyword') {
    state.keyword = node.value
    return
  }

  if (field === 'list.selectTask' && node instanceof HTMLInputElement) {
    const taskId = node.dataset.taskId
    if (!taskId) return

    if (node.checked) {
      state.selectedIds.add(taskId)
    } else {
      state.selectedIds.delete(taskId)
    }

    return
  }

  if (field === 'list.selectAll' && node instanceof HTMLInputElement) {
    const rows = getVisibleRows()

    if (node.checked) {
      state.selectedIds = new Set(rows.map((task) => task.taskId))
    } else {
      state.selectedIds = new Set<string>()
    }

    return
  }

  if (field === 'dispatch.factoryId') {
    state.dispatchForm.factoryId = node.value
    const selectedFactory = getFactoryOptions().find((factory) => factory.id === node.value)
    state.dispatchForm.factoryName = selectedFactory?.name ?? ''
    return
  }

  if (field === 'dispatch.groupFactoryId') {
    const groupKey = node.dataset.groupKey
    if (!groupKey) return
    const selectedFactory = getFactoryOptions().find((factory) => factory.id === node.value)
    state.dispatchForm.factoryByGroupKey[groupKey] = {
      factoryId: node.value,
      factoryName: selectedFactory?.name ?? '',
    }
    return
  }

  if (field === 'dispatch.acceptDeadline') {
    state.dispatchForm.acceptDeadline = node.value
    return
  }

  if (field === 'dispatch.taskDeadline') {
    state.dispatchForm.taskDeadline = node.value
    return
  }

  if (field === 'dispatch.dispatchPrice') {
    state.dispatchForm.dispatchPrice = node.value
    return
  }

  if (field === 'dispatch.priceDiffReason') {
    state.dispatchForm.priceDiffReason = node.value
    return
  }

  if (field === 'dispatch.remark') {
    state.dispatchForm.remark = node.value
    return
  }

  if (field === 'tender.minPrice') {
    state.createTenderError = null
    state.createTenderForm.minPrice = node.value
    return
  }

  if (field === 'tender.maxPrice') {
    state.createTenderError = null
    state.createTenderForm.maxPrice = node.value
    return
  }

  if (field === 'tender.biddingDeadline') {
    state.createTenderError = null
    state.createTenderForm.biddingDeadline = node.value
    return
  }

  if (field === 'tender.taskDeadline') {
    state.createTenderError = null
    state.createTenderForm.taskDeadline = node.value
    return
  }

  if (field === 'tender.remark') {
    state.createTenderError = null
    state.createTenderForm.remark = node.value
  }
}

export function handleDispatchBoardEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-dispatch-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLSelectElement ||
    fieldNode instanceof HTMLTextAreaElement
  ) {
    const field = fieldNode.dataset.dispatchField
    if (!field) return true

    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-dispatch-action]')
  if (!actionNode) {
    if (state.actionMenuTaskId && !target.closest('[data-dispatch-menu-root]')) {
      state.actionMenuTaskId = null
      return true
    }

    return false
  }

  const action = actionNode.dataset.dispatchAction
  if (!action) return false

  if (action === 'noop') return true

  if (action === 'switch-view') {
    const view = actionNode.dataset.view as DispatchView | undefined
    if (view === 'kanban' || view === 'list') {
      state.view = view
    }
    return true
  }

  if (action === 'clear-keyword') {
    state.keyword = ''
    return true
  }

  if (action === 'run-auto-assign') {
    applyAutoAssign()
    return true
  }

  if (action === 'open-direct-dispatch') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openDispatchDialog([taskId])
      return true
    }

    openDispatchDialog(Array.from(state.selectedIds))
    return true
  }

  if (action === 'close-direct-dispatch') {
    closeDispatchDialog()
    return true
  }

  if (action === 'confirm-direct-dispatch') {
    confirmDirectDispatch()
    return true
  }

  if (action === 'switch-dispatch-mode') {
    const mode = actionNode.dataset.mode
    if (mode === 'TASK' || mode === 'DETAIL') {
      state.dispatchForm.mode = mode
      state.dispatchDialogError = null
    }
    return true
  }

  if (action === 'switch-tender-mode') {
    const mode = actionNode.dataset.mode
    if (mode === 'TASK' || mode === 'DETAIL') {
      state.createTenderForm.mode = mode
      state.createTenderError = null
    }
    return true
  }

  if (action === 'batch-direct-dispatch') {
    openDispatchDialog(Array.from(state.selectedIds))
    return true
  }

  if (action === 'batch-bidding') {
    if (state.selectedIds.size > 0) {
      batchSetTaskAssignMode(Array.from(state.selectedIds), 'BIDDING', '跟单A')
      state.selectedIds = new Set<string>()
    }
    return true
  }

  if (action === 'batch-hold') {
    if (state.selectedIds.size > 0) {
      batchSetTaskAssignMode(Array.from(state.selectedIds), 'HOLD', '跟单A')
      state.selectedIds = new Set<string>()
    }
    return true
  }

  if (action === 'set-hold') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    setTaskAssignMode(taskId, 'HOLD', '跟单A')
    state.actionMenuTaskId = null
    return true
  }

  if (action === 'open-create-tender') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    setTaskAssignMode(taskId, 'BIDDING', '跟单A')
    openCreateTender(taskId)
    return true
  }

  if (action === 'close-create-tender') {
    closeCreateTender()
    return true
  }

  if (action === 'toggle-pool') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    const selectableFactoryIds = getTenderSelectableFactoryIds()
    state.createTenderError = null

    if (state.createTenderForm.selectedPool.has(factoryId)) {
      state.createTenderForm.selectedPool.delete(factoryId)
    } else if (selectableFactoryIds.has(factoryId)) {
      state.createTenderForm.selectedPool.add(factoryId)
    }

    state.createTenderForm.selectedPool = new Set(state.createTenderForm.selectedPool)
    return true
  }

  if (action === 'select-all-pool') {
    state.createTenderError = null
    state.createTenderForm.selectedPool = getTenderSelectableFactoryIds()
    return true
  }

  if (action === 'clear-all-pool') {
    state.createTenderError = null
    state.createTenderForm.selectedPool = new Set<string>()
    return true
  }

  if (action === 'confirm-create-tender') {
    confirmCreateTender()
    return true
  }

  if (action === 'open-view-tender') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    openViewTender(taskId)
    return true
  }

  if (action === 'close-view-tender') {
    closeViewTender()
    return true
  }

  if (action === 'open-price-snapshot') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    state.priceSnapshotTaskId = taskId
    state.actionMenuTaskId = null
    return true
  }

  if (action === 'close-price-snapshot') {
    closePriceSnapshot()
    return true
  }

  if (action === 'toggle-row-menu') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    state.actionMenuTaskId = state.actionMenuTaskId === taskId ? null : taskId
    return true
  }

  if (action === 'open-order') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.actionMenuTaskId = null
    openAppRoute(`/fcs/production/orders/${orderId}`, `po-${orderId}`, `生产单管理 ${orderId}`)
    return true
  }

  if (action === 'close-dialog') {
    closeDispatchDialog()
    closeCreateTender()
    closeViewTender()
    closePriceSnapshot()
    return true
  }

  return false
}
