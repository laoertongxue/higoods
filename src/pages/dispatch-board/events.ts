import {
  state,
  candidateFactories,
  createDefaultAutoDispatchConfig,
  getVisibleRows,
  getFactoryOptions,
  nowTimestamp,
  getCreateTenderTask,
  getTaskAllocatableGroups,
  getTaskById,
  getSelectableTenderFactoryIds,
  openAppRoute,
  supportsDetailAssignment,
  type DispatchView,
} from './context.ts'
import {
  applyAutoAssign,
  openDispatchDialog,
  closeDispatchDialog,
  confirmDirectDispatch,
  refreshDirectDispatchBusinessAssignedAtFeedback,
  setTaskAssignMode,
  batchSetTaskAssignMode,
} from './dispatch-domain.ts'
import {
  openCreateTender,
  closeCreateTender,
  confirmCreateTender,
  getTenderMaterialPrepChecks,
  isTenderMaterialPrepReady,
  formatTenderMaterialPrepError,
  openViewTender,
  closeViewTender,
  closePriceSnapshot,
} from './tender-domain.ts'

function getTenderSelectableFactoryIds(): Set<string> {
  const task = getCreateTenderTask()
  if (!task) return new Set(candidateFactories.map((factory) => factory.id))
  const detailGroups =
    state.createTenderForm.mode === 'DETAIL' && supportsDetailAssignment(task)
      ? getTaskAllocatableGroups(task)
      : []
  return new Set(getSelectableTenderFactoryIds(task, detailGroups))
}

function getBatchTenderMaterialPrepError(taskIds: string[]): string {
  const failedChecks = taskIds
    .map((taskId) => getTaskById(taskId))
    .filter((task): task is NonNullable<typeof task> => Boolean(task))
    .flatMap((task) => getTenderMaterialPrepChecks(task))
    .filter((check) => !isTenderMaterialPrepReady([check]))

  return formatTenderMaterialPrepError(failedChecks)
}

function updateField(field: string, node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): void {
  if (field === 'filter.keyword') {
    state.keyword = node.value
    state.listPage = 1
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
    const pageSize = Math.max(1, state.listPageSize)
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
    const currentPage = Math.min(Math.max(1, state.listPage), pageCount)
    const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    if (node.checked) {
      state.selectedIds = new Set([...state.selectedIds, ...pageRows.map((task) => task.taskId)])
    } else {
      for (const task of pageRows) {
        state.selectedIds.delete(task.taskId)
      }
      state.selectedIds = new Set(state.selectedIds)
    }

    return
  }

  if (field === 'list.pageSize') {
    const pageSize = Number(node.value)
    state.listPageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20
    state.listPage = 1
    return
  }

  if (field === 'auto.enabled' && node instanceof HTMLInputElement) {
    const processCode = node.dataset.processCode
    if (!processCode) return
    const current = state.autoDispatchConfigs[processCode] ?? createDefaultAutoDispatchConfig()
    state.autoDispatchConfigs[processCode] = {
      ...current,
      enabled: node.checked,
      updatedBy: '跟单A',
      updatedAt: nowTimestamp(),
    }
    return
  }

  if (field === 'auto.factoryId') {
    const processCode = node.dataset.processCode
    if (!processCode) return
    const selectedFactory = getFactoryOptions().find((factory) => factory.id === node.value)
    const current = state.autoDispatchConfigs[processCode] ?? createDefaultAutoDispatchConfig()
    state.autoDispatchConfigs[processCode] = {
      ...current,
      factoryId: node.value,
      factoryName: selectedFactory?.name ?? '',
      updatedBy: '跟单A',
      updatedAt: nowTimestamp(),
    }
    return
  }

  if (field === 'auto.taskDeadlineDays') {
    const processCode = node.dataset.processCode
    if (!processCode) return
    const current = state.autoDispatchConfigs[processCode] ?? createDefaultAutoDispatchConfig()
    state.autoDispatchConfigs[processCode] = {
      ...current,
      taskDeadlineDays: node.value,
      updatedBy: '跟单A',
      updatedAt: nowTimestamp(),
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

  if (field === 'dispatch.mainFactoryGroupKey') {
    state.dispatchForm.mainFactoryGroupKey = node.value
    return
  }

  if (field === 'dispatch.acceptDeadline') {
    state.dispatchForm.acceptDeadline = node.value
    return
  }

  if (field === 'dispatch.businessAssignedAt') {
    state.dispatchForm.businessAssignedAt = node.value
    state.dispatchDialogError = null
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

  if (field === 'tender.mainFactoryId') {
    state.createTenderError = null
    state.createTenderForm.mainFactoryId = node.value
    const selectedFactory = candidateFactories.find((factory) => factory.id === node.value)
    state.createTenderForm.mainFactoryName = selectedFactory?.name ?? ''
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
    if (field === 'dispatch.businessAssignedAt') {
      refreshDirectDispatchBusinessAssignedAtFeedback(fieldNode)
    }
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
    if (view === 'list') {
      state.view = view
    }
    return true
  }

  if (action === 'clear-keyword') {
    state.keyword = ''
    state.listPage = 1
    return true
  }

  if (action === 'switch-list-tab') {
    const tab = actionNode.dataset.tab
    if (
      tab === 'UNASSIGNED' ||
      tab === 'AWAIT_AWARD' ||
      tab === 'BIDDING' ||
      tab === 'DIRECT_ASSIGNED' ||
      tab === 'AWARDED' ||
      tab === 'HOLD' ||
      tab === 'EXCEPTION' ||
      tab === 'ALL'
    ) {
      state.listTab = tab
      state.listPage = 1
      state.selectedIds = new Set<string>()
      state.actionMenuTaskId = null
    }
    return true
  }

  if (action === 'run-auto-assign') {
    applyAutoAssign()
    return true
  }

  if (action === 'open-auto-config') {
    state.autoDispatchConfigOpen = true
    return true
  }

  if (action === 'close-auto-config') {
    state.autoDispatchConfigOpen = false
    return true
  }

  if (action === 'save-auto-config') {
    state.autoDispatchConfigOpen = false
    state.autoAssignMessage = '自动分配配置已保存。'
    state.autoAssignFeedback = null
    return true
  }

  if (action === 'toggle-auto-config') {
    state.autoDispatchConfigOpen = !state.autoDispatchConfigOpen
    return true
  }

  if (action === 'list-prev-page') {
    state.listPage = Math.max(1, state.listPage - 1)
    return true
  }

  if (action === 'list-next-page') {
    const rows = getVisibleRows()
    const pageCount = Math.max(1, Math.ceil(rows.length / Math.max(1, state.listPageSize)))
    state.listPage = Math.min(pageCount, state.listPage + 1)
    return true
  }

  if (action === 'list-goto-page') {
    const rows = getVisibleRows()
    const pageCount = Math.max(1, Math.ceil(rows.length / Math.max(1, state.listPageSize)))
    const page = Number(actionNode.dataset.page ?? '1')
    state.listPage = Math.max(1, Math.min(pageCount, Number.isFinite(page) ? page : 1))
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
      const selectedTaskIds = Array.from(state.selectedIds)
      const materialPrepError = getBatchTenderMaterialPrepError(selectedTaskIds)
      if (materialPrepError) {
        state.autoAssignMessage = materialPrepError
        return true
      }

      batchSetTaskAssignMode(selectedTaskIds, 'BIDDING', '跟单A')
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

    if (!state.createTenderForm.selectedPool.has(state.createTenderForm.mainFactoryId)) {
      state.createTenderForm.mainFactoryId = ''
      state.createTenderForm.mainFactoryName = ''
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
    state.createTenderForm.mainFactoryId = ''
    state.createTenderForm.mainFactoryName = ''
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
