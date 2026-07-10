import {
  state,
  getTaskById,
  getTaskHandoverSummary,
  buildHandoverOrderDetailLink,
  getFactoryById,
  resetTaskBoardSummaryCache,
  TASK_LIST_PAGE_SIZE,
  type BlockReason,
  type TaskTabKey,
  type UrgeType,
} from './context.ts'
import {
  showProgressBoardToast,
  copyToClipboard,
  openLinkedPage,
  clearTaskFilters,
  handleTaskKpiClick,
  openTaskDetail,
  requestTaskStatusChange,
  createUrge,
  confirmTaskBlock,
} from './actions.ts'
import { buildTaskRouteCardPrintLink } from '../../data/fcs/fcs-route-links.ts'
import { isRuntimeSewingTask } from '../../data/fcs/runtime-process-tasks.ts'
import {
  closeSewingDeliveryResponsibilityReview,
  openSewingDeliveryResponsibilityReview,
  renderSewingDeliveryResponsibilityReviewDialog,
  submitSewingDeliveryResponsibilityReview,
  updateSewingDeliveryResponsibilityReviewField,
} from './task-domain.ts'

function refreshSewingDeliveryResponsibilityReviewDialog(): void {
  if (typeof document === 'undefined') return
  const host = document.querySelector<HTMLElement>('[data-sewing-sla-review-dialog-host]')
  if (host) host.innerHTML = renderSewingDeliveryResponsibilityReviewDialog()
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    state.visibleTaskLimit = TASK_LIST_PAGE_SIZE
    return
  }

  if (field === 'statusFilter' && node instanceof HTMLSelectElement) {
    state.statusFilter = node.value
    state.visibleTaskLimit = TASK_LIST_PAGE_SIZE
    return
  }

  if (field === 'assignmentStatusFilter' && node instanceof HTMLSelectElement) {
    state.assignmentStatusFilter = node.value
    state.visibleTaskLimit = TASK_LIST_PAGE_SIZE
    return
  }

  if (field === 'assignmentModeFilter' && node instanceof HTMLSelectElement) {
    state.assignmentModeFilter = node.value
    state.visibleTaskLimit = TASK_LIST_PAGE_SIZE
    return
  }

  if (field === 'stageFilter' && node instanceof HTMLSelectElement) {
    state.stageFilter = node.value
    state.visibleTaskLimit = TASK_LIST_PAGE_SIZE
    return
  }

  if (field === 'riskFilter' && node instanceof HTMLSelectElement) {
    state.riskFilter = node.value
    state.visibleTaskLimit = TASK_LIST_PAGE_SIZE
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
    openTaskDetail(taskId, 'pickup')
    return true
  }

  if (action === 'task-open-handover' && taskId) {
    openTaskDetail(taskId, 'handover')
    return true
  }

  if (action === 'task-action-update-progress' && taskId) {
    openTaskDetail(taskId, 'progress')
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
        source: '任务进度跟踪',
      }),
    )
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-material' && poId) {
    openLinkedPage('领料/配料进度', `/fcs/progress/material?po=${encodeURIComponent(poId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-print-route-card' && taskId) {
    openLinkedPage('任务流转卡', buildTaskRouteCardPrintLink('RUNTIME_TASK', taskId))
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-open-order' && poId) {
    openLinkedPage('生产单进度跟踪', `/fcs/progress/production-orders/detail?po=${encodeURIComponent(poId)}`)
    state.taskActionMenuId = null
    return true
  }

  if (action === 'task-action-dispatch' && taskId && poId) {
    const task = getTaskById(taskId)
    const path = task && isRuntimeSewingTask(task)
      ? `/fcs/dispatch/sewing?po=${encodeURIComponent(poId)}&taskId=${encodeURIComponent(taskId)}`
      : `/fcs/dispatch/non-sewing?po=${encodeURIComponent(poId)}&taskId=${encodeURIComponent(taskId)}`
    openLinkedPage(task && isRuntimeSewingTask(task) ? '车缝分配工作台' : '非车缝任务分配', path)
    state.taskActionMenuId = null
    return true
  }

  return false
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if ((action.startsWith('task-action-') || action.startsWith('task-open-')) && handleTaskAction(action, actionNode)) {
    return true
  }

  if (action === 'refresh') {
    resetTaskBoardSummaryCache()
    showProgressBoardToast('数据已刷新')
    return true
  }

  if (action === 'review-sewing-sla-responsibility') {
    const taskId = actionNode.dataset.taskId
    const ratio = Number(actionNode.dataset.ratio)
    try {
      if (!taskId) throw new Error('缺少待复核任务')
      openSewingDeliveryResponsibilityReview(taskId, ratio)
      refreshSewingDeliveryResponsibilityReviewDialog()
    } catch (error) {
      showProgressBoardToast(error instanceof Error ? error.message : '责任复核打开失败', 'error')
    }
    return true
  }

  if (action === 'cancel-sewing-sla-review') {
    closeSewingDeliveryResponsibilityReview()
    refreshSewingDeliveryResponsibilityReviewDialog()
    return true
  }

  if (action === 'submit-sewing-sla-review') {
    const result = submitSewingDeliveryResponsibilityReview()
    refreshSewingDeliveryResponsibilityReviewDialog()
    showProgressBoardToast(result.message, result.ok ? 'success' : 'error')
    return true
  }

  if (action === 'kpi-filter') {
    const kpi = actionNode.dataset.kpi
    if (kpi) handleTaskKpiClick(kpi)
    return true
  }

  if (action === 'reset-task-filters') {
    clearTaskFilters()
    return true
  }

  if (action === 'apply-task-filters') {
    return true
  }

  if (action === 'show-more-tasks') {
    state.visibleTaskLimit += TASK_LIST_PAGE_SIZE
    return true
  }

  if (action === 'switch-task-tab') {
    const tab = actionNode.dataset.tab as TaskTabKey | undefined
    if (tab) {
      state.taskDetailTab = tab
    }
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
        path: `/fcs/progress/board/tasks/${encodeURIComponent(task.taskId)}`,
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
    if (field.startsWith('sewingSlaReview.')) {
      updateSewingDeliveryResponsibilityReviewField(field.slice('sewingSlaReview.'.length), fieldNode.value)
      return true
    }
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-progress-action]')
  if (!actionNode) {
    if (state.taskActionMenuId) {
      state.taskActionMenuId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.progressAction
  if (!action) return false

  return handleAction(action, actionNode)
}
