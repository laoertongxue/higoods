import {
  state,
  LIFECYCLE_LABEL,
  getTaskById,
  getProductionOrderHandoverSummary,
  getTaskHandoverSummary,
  buildHandoverOrderDetailLink,
  getFilteredTasks,
  getFactoryById,
  type BlockReason,
  type PoLifecycle,
  type TaskTabKey,
  type TaskStatus,
  type UrgeType,
} from './context.ts'
import {
  showProgressBoardToast,
  copyToClipboard,
  openLinkedPage,
  clearTaskFilters,
  handleTaskKpiClick,
  handlePoKpiClick,
  setTaskSelected,
  openOrderDetail,
  openTaskDetail,
  handleBatchUrge,
  openBatchDialog,
  confirmBatchAction,
  requestTaskStatusChange,
  createUrge,
  confirmTaskBlock,
} from './actions.ts'

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'statusFilter' && node instanceof HTMLSelectElement) {
    state.statusFilter = node.value
    return
  }

  if (field === 'assignmentStatusFilter' && node instanceof HTMLSelectElement) {
    state.assignmentStatusFilter = node.value
    return
  }

  if (field === 'assignmentModeFilter' && node instanceof HTMLSelectElement) {
    state.assignmentModeFilter = node.value
    return
  }

  if (field === 'stageFilter' && node instanceof HTMLSelectElement) {
    state.stageFilter = node.value
    return
  }

  if (field === 'riskFilter' && node instanceof HTMLSelectElement) {
    state.riskFilter = node.value
    return
  }

  if (field === 'poKeyword' && node instanceof HTMLInputElement) {
    state.poKeyword = node.value
    return
  }

  if (field === 'poLifecycleFilter' && node instanceof HTMLSelectElement) {
    state.poLifecycleFilter = node.value
    return
  }

  if (field === 'blockReason' && node instanceof HTMLSelectElement) {
    state.blockReason = node.value as BlockReason
    return
  }

  if (field === 'blockRemark' && node instanceof HTMLTextAreaElement) {
    state.blockRemark = node.value
  }
}

function handleTaskAction(action: string, actionNode: HTMLElement): boolean {
  const taskId = actionNode.dataset.taskId
  const poId = actionNode.dataset.poId

  if (action === 'task-open-pickup' && taskId) {
    openTaskDetail(taskId)
    state.taskDetailTab = 'pickup'
    return true
  }

  if (action === 'task-open-handover' && taskId) {
    openTaskDetail(taskId)
    state.taskDetailTab = 'handover'
    return true
  }

  if (action === 'task-action-update-progress' && taskId) {
    openTaskDetail(taskId)
    state.taskDetailTab = 'progress'
    return true
  }

  if (action === 'task-action-view-exception' && taskId) {
    openLinkedPage('异常定位与处理', `/fcs/progress/exceptions?taskId=${encodeURIComponent(taskId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-handover' && taskId && poId) {
    const handoverSummary = getTaskHandoverSummary(taskId)
    openLinkedPage(
      '交接链路',
      buildHandoverOrderDetailLink({
        productionOrderId: poId,
        taskId,
        focus: handoverSummary.recommendedFocus,
        source: '看板',
      }),
    )
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-material' && poId) {
    openLinkedPage('领料进度跟踪', `/fcs/progress/material?po=${encodeURIComponent(poId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-open-order' && poId) {
    openOrderDetail(poId)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-dispatch' && taskId && poId) {
    openLinkedPage('任务分配', `/fcs/dispatch/board?po=${encodeURIComponent(poId)}&taskId=${encodeURIComponent(taskId)}`)
    state.taskActionMenuId = null
    return true
  }

  return false
}

function handleOrderAction(action: string, actionNode: HTMLElement): boolean {
  const orderId = actionNode.dataset.orderId
  if (!orderId) return false

  if (action === 'order-action-detail') {
    state.detailOrderId = orderId
    state.orderActionMenuId = null
    return true
  }

  if (action === 'order-action-exception') {
    openLinkedPage('异常定位与处理', `/fcs/progress/exceptions?po=${encodeURIComponent(orderId)}`)
    state.orderActionMenuId = null
    return true
  }

  if (action === 'order-action-dispatch') {
    openLinkedPage('任务分配', `/fcs/dispatch/board?po=${encodeURIComponent(orderId)}`)
    state.orderActionMenuId = null
    return true
  }

  if (action === 'order-action-handover') {
    const handoverSummary = getProductionOrderHandoverSummary(orderId)
    openLinkedPage(
      '交接链路',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        focus: handoverSummary.recommendedFocus,
        source: '看板',
      }),
    )
    state.orderActionMenuId = null
    return true
  }

  return false
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if ((action.startsWith('task-action-') || action.startsWith('task-open-')) && handleTaskAction(action, actionNode)) {
    return true
  }

  if (action.startsWith('order-action-') && handleOrderAction(action, actionNode)) {
    return true
  }

  if (action === 'switch-dimension') {
    const dimension = actionNode.dataset.dimension
    if (dimension === 'task' || dimension === 'order') {
      state.dimension = dimension
    }
    return true
  }

  if (action === 'switch-view') {
    const view = actionNode.dataset.view
    if (view === 'list' || view === 'kanban') {
      state.viewMode = view
    }
    return true
  }

  if (action === 'refresh') {
    showProgressBoardToast('数据已刷新')
    return true
  }

  if (action === 'kpi-filter') {
    const kpi = actionNode.dataset.kpi
    if (kpi) handleTaskKpiClick(kpi)
    return true
  }

  if (action === 'po-kpi-filter') {
    const lifecycle = actionNode.dataset.lifecycle as PoLifecycle | undefined
    if (lifecycle && lifecycle in LIFECYCLE_LABEL) {
      handlePoKpiClick(lifecycle)
    }
    return true
  }

  if (action === 'reset-task-filters') {
    clearTaskFilters()
    return true
  }

  if (action === 'reset-order-filters') {
    state.poKeyword = ''
    state.poLifecycleFilter = 'ALL'
    return true
  }

  if (action === 'select-all') {
    const checked = actionNode instanceof HTMLInputElement ? actionNode.checked : false
    const filtered = getFilteredTasks()

    if (checked) {
      state.selectedTaskIds = filtered.map((task) => task.taskId)
    } else {
      state.selectedTaskIds = []
    }

    return true
  }

  if (action === 'toggle-task-select') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    const checked = actionNode instanceof HTMLInputElement ? actionNode.checked : false
    setTaskSelected(taskId, checked)
    return true
  }

  if (action === 'open-task-detail') {
    if (actionNode.closest('[data-progress-stop="true"]')) return false
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openTaskDetail(taskId)
    }
    return true
  }

  if (action === 'close-task-drawer') {
    state.detailTaskId = null
    return true
  }

  if (action === 'switch-task-tab') {
    const tab = actionNode.dataset.tab as TaskTabKey | undefined
    if (tab) {
      state.taskDetailTab = tab
    }
    return true
  }

  if (action === 'open-order-detail') {
    if (actionNode.closest('[data-progress-stop="true"]')) return false
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      state.detailOrderId = orderId
    }
    return true
  }

  if (action === 'close-order-drawer') {
    state.detailOrderId = null
    return true
  }

  if (action === 'order-view-tasks') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.detailOrderId = null
    state.dimension = 'task'
    state.keyword = orderId
    return true
  }

  if (action === 'copy-task-id') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      copyToClipboard(taskId)
    }
    return true
  }

  if (action === 'toggle-task-menu') {
    const taskId = actionNode.dataset.taskId
    if (!taskId) return true

    state.taskActionMenuId = state.taskActionMenuId === taskId ? null : taskId
    state.orderActionMenuId = null
    return true
  }

  if (action === 'toggle-order-menu') {
    const orderId = actionNode.dataset.orderId
    if (!orderId) return true

    state.orderActionMenuId = state.orderActionMenuId === orderId ? null : orderId
    state.taskActionMenuId = null
    return true
  }

  if (action === 'batch-urge') {
    handleBatchUrge()
    return true
  }

  if (action === 'batch-start') {
    openBatchDialog('start')
    return true
  }

  if (action === 'batch-finish') {
    openBatchDialog('finish')
    return true
  }

  if (action === 'confirm-batch') {
    confirmBatchAction()
    return true
  }

  if (action === 'close-batch-dialog') {
    state.confirmDialogType = null
    state.confirmTaskIds = []
    return true
  }

  if (action === 'task-status-start') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'IN_PROGRESS')
    return true
  }

  if (action === 'task-status-finish') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'DONE')
    return true
  }

  if (action === 'task-status-block') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'BLOCKED')
    return true
  }

  if (action === 'task-status-unblock') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null
    if (task) requestTaskStatusChange(task, 'IN_PROGRESS')
    return true
  }

  if (action === 'task-status-cancel') {
    showProgressBoardToast('取消任务功能仅限管理员', 'error')
    return true
  }

  if (action === 'task-send-urge') {
    const taskId = actionNode.dataset.taskId
    const task = taskId ? getTaskById(taskId) : null

    if (!task || !task.assignedFactoryId || ['DONE', 'CANCELLED'].includes(task.status)) {
      showProgressBoardToast('当前任务不可催办', 'error')
      return true
    }

    const factory = getFactoryById(task.assignedFactoryId)
    const urgeType: UrgeType =
      task.status === 'NOT_STARTED'
        ? 'URGE_START'
        : task.status === 'BLOCKED'
          ? 'URGE_UNBLOCK'
          : 'URGE_FINISH'

    createUrge({
      urgeType,
      fromType: 'INTERNAL_USER',
      fromId: 'U002',
      fromName: '跟单A',
      toType: 'FACTORY',
      toId: task.assignedFactoryId,
      toName: factory?.name ?? task.assignedFactoryId,
      targetType: 'TASK',
      targetId: task.taskId,
      message: `请尽快处理任务 ${task.taskId}`,
      deepLink: {
        path: '/fcs/progress/board',
        query: { taskId: task.taskId },
      },
    })

    showProgressBoardToast('催办发送成功')
    return true
  }

  if (action === 'confirm-block') {
    confirmTaskBlock()
    return true
  }

  if (action === 'close-block-dialog') {
    state.blockDialogTaskId = null
    return true
  }

  return false
}

export function handleProgressBoardEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-progress-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.progressField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-progress-action]')
  if (!actionNode) {
    if (state.taskActionMenuId || state.orderActionMenuId) {
      state.taskActionMenuId = null
      state.orderActionMenuId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.progressAction
  if (!action) return false

  return handleAction(action, actionNode)
}
