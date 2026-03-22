import {
  state,
  OWNER_OPTIONS,
  isSubCategoryKey,
  getSubCategoryOptions,
  getCaseById,
  getOrderById,
  getProductionOrderHandoverSummary,
  buildHandoverOrderDetailLink,
  getTaskById,
  mockInternalUsers,
  type SubCategoryKey,
  type UnifiedCategory,
  type CloseReasonCode,
  type UiCaseStatus,
} from './context'
import {
  clearFilters,
  assignCaseOwner,
  confirmUnblock,
  confirmExtendTender,
  confirmPauseFollowUp,
  confirmPauseAllowContinue,
  openCloseDialog,
  closeCloseDialog,
  confirmCloseException,
  createUrge,
  showProgressExceptionsToast,
  openLinkedPage,
} from './actions'

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    return
  }

  if (field === 'severityFilter' && node instanceof HTMLSelectElement) {
    state.severityFilter = node.value
    return
  }

  if (field === 'categoryFilter' && node instanceof HTMLSelectElement) {
    state.categoryFilter = node.value as 'ALL' | UnifiedCategory
    const currentSubCategoryOptions = getSubCategoryOptions(state.categoryFilter)
    if (
      state.subCategoryFilter !== 'ALL' &&
      !currentSubCategoryOptions.some((option) => option.key === state.subCategoryFilter)
    ) {
      state.subCategoryFilter = 'ALL'
    }
    return
  }

  if (field === 'subCategoryFilter' && node instanceof HTMLSelectElement) {
    state.subCategoryFilter = node.value as 'ALL' | SubCategoryKey
    return
  }

  if (field === 'statusFilter' && node instanceof HTMLSelectElement) {
    state.statusFilter = node.value as 'ALL' | UiCaseStatus
    return
  }

  if (field === 'ownerFilter' && node instanceof HTMLSelectElement) {
    state.ownerFilter = node.value
    return
  }

  if (field === 'factoryFilter' && node instanceof HTMLSelectElement) {
    state.factoryFilter = node.value
    return
  }

  if (field === 'processFilter' && node instanceof HTMLSelectElement) {
    state.processFilter = node.value
    return
  }

  if (field === 'unblockRemark' && node instanceof HTMLTextAreaElement) {
    state.unblockRemark = node.value
    return
  }

  if (field === 'pauseFollowUpRemark' && node instanceof HTMLTextAreaElement) {
    state.pauseFollowUpRemark = node.value
    return
  }

  if (field === 'closeReason' && node instanceof HTMLSelectElement) {
    state.closeReason = node.value as CloseReasonCode
    return
  }

  if (field === 'closeRemark' && node instanceof HTMLTextAreaElement) {
    state.closeRemark = node.value
    return
  }

  if (field === 'closeMergeCaseId' && node instanceof HTMLInputElement) {
    state.closeMergeCaseId = node.value
  }
}

function handleRowAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'row-view') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.detailCaseId = caseId
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-unblock') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.unblockDialogCaseId = caseId
    state.unblockRemark = ''
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-pause-followup') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.pauseFollowUpCaseId = caseId
    state.pauseFollowUpRemark = ''
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-pause-continue') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    confirmPauseAllowContinue(caseId)
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-extend') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.extendDialogCaseId = caseId
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-reassign') {
    const taskId = actionNode.dataset.taskId || ''
    const orderId = actionNode.dataset.orderId || ''
    openLinkedPage('任务分配', `/fcs/dispatch/board?taskId=${encodeURIComponent(taskId)}&po=${encodeURIComponent(orderId)}`)
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-tech-pack') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    const exc = getCaseById(caseId)
    if (!exc) return true
    const firstOrder = exc.relatedOrderIds[0] ? getOrderById(exc.relatedOrderIds[0]) : null
    if (firstOrder) {
      openLinkedPage('技术包', `/fcs/tech-pack/${encodeURIComponent(firstOrder.demandSnapshot.spuCode)}`)
    }
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-material') {
    const orderId = actionNode.dataset.orderId || ''
    const title = orderId ? `领料进度-${orderId}` : '领料进度'
    const href = `/fcs/progress/material${orderId ? `?po=${encodeURIComponent(orderId)}` : ''}`
    openLinkedPage(title, href)
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-handover') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    const summary = getProductionOrderHandoverSummary(orderId)
    openLinkedPage(
      '交接链路',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: summary.recommendedFocus,
        source: '异常定位',
      }),
    )
    state.rowActionMenuCaseId = null
    return true
  }

  if (action === 'row-handover-objection') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    openLinkedPage(
      '数量异议',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: 'objection',
        source: '异常定位',
      }),
    )
    state.rowActionMenuCaseId = null
    return true
  }

  return false
}

function handleDrawerAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'drawer-tech-pack') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    const exc = getCaseById(caseId)
    if (!exc) return true
    const firstOrder = exc.relatedOrderIds[0] ? getOrderById(exc.relatedOrderIds[0]) : null
    if (firstOrder) {
      openLinkedPage('技术包', `/fcs/tech-pack/${encodeURIComponent(firstOrder.demandSnapshot.spuCode)}`)
    }
    return true
  }

  if (action === 'drawer-view-handover') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    const summary = getProductionOrderHandoverSummary(orderId)
    openLinkedPage(
      '交接链路',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: summary.recommendedFocus,
        source: '异常定位',
      }),
    )
    return true
  }

  if (action === 'drawer-view-handover-objection') {
    const orderId = actionNode.dataset.orderId || ''
    const taskId = actionNode.dataset.taskId || ''
    openLinkedPage(
      '数量异议',
      buildHandoverOrderDetailLink({
        productionOrderId: orderId,
        taskId,
        focus: 'objection',
        source: '异常定位',
      }),
    )
    return true
  }

  if (action === 'drawer-view-material') {
    const orderId = actionNode.dataset.orderId || ''
    const title = orderId ? `领料进度-${orderId}` : '领料进度'
    openLinkedPage(title, `/fcs/progress/material${orderId ? `?po=${encodeURIComponent(orderId)}` : ''}`)
    return true
  }

  return false
}

function handleAction(action: string, actionNode: HTMLElement): boolean {
  if (action.startsWith('row-') && handleRowAction(action, actionNode)) {
    return true
  }

  if (action.startsWith('drawer-') && handleDrawerAction(action, actionNode)) {
    return true
  }

  if (action === 'refresh') {
    showProgressExceptionsToast('刷新完成')
    return true
  }

  if (action === 'clear-filters') {
    clearFilters()
    return true
  }

  if (action === 'kpi-open') {
    state.statusFilter = 'OPEN'
    state.severityFilter = 'ALL'
    state.aggregateFilter = null
    return true
  }

  if (action === 'kpi-in-progress') {
    state.statusFilter = 'IN_PROGRESS'
    state.severityFilter = 'ALL'
    state.aggregateFilter = null
    return true
  }

  if (action === 'kpi-s1') {
    state.severityFilter = 'S1'
    state.statusFilter = 'ALL'
    state.aggregateFilter = null
    return true
  }

  if (action === 'quick-category') {
    const category = actionNode.dataset.category as 'ALL' | UnifiedCategory | undefined
    if (!category) return true
    state.categoryFilter = category
    const currentSubCategoryOptions = getSubCategoryOptions(state.categoryFilter)
    if (
      state.subCategoryFilter !== 'ALL' &&
      !currentSubCategoryOptions.some((option) => option.key === state.subCategoryFilter)
    ) {
      state.subCategoryFilter = 'ALL'
    }
    state.aggregateFilter = null
    return true
  }

  if (action === 'aggregate-reason') {
    const value = actionNode.dataset.value
    if (value && isSubCategoryKey(value)) {
      state.aggregateFilter = { type: 'reason', value }
    }
    return true
  }

  if (action === 'aggregate-factory') {
    const value = actionNode.dataset.value
    if (value) {
      state.aggregateFilter = { type: 'factory', value }
    }
    return true
  }

  if (action === 'aggregate-process') {
    const value = actionNode.dataset.value
    if (value) {
      state.aggregateFilter = { type: 'process', value }
    }
    return true
  }

  if (action === 'clear-aggregate') {
    state.aggregateFilter = null
    return true
  }

  if (action === 'open-detail') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.detailCaseId = caseId
      state.rowActionMenuCaseId = null
    }
    return true
  }

  if (action === 'close-detail') {
    state.detailCaseId = null
    closeCloseDialog()
    return true
  }

  if (action === 'toggle-row-menu') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.rowActionMenuCaseId = state.rowActionMenuCaseId === caseId ? null : caseId
    return true
  }

  if (action === 'goto-order') {
    const orderId = actionNode.dataset.orderId
    if (orderId) {
      openLinkedPage(`生产单 ${orderId}`, `/fcs/production/orders/${encodeURIComponent(orderId)}`)
    }
    return true
  }

  if (action === 'goto-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('任务进度', `/fcs/progress/board?taskId=${encodeURIComponent(taskId)}`)
    }
    return true
  }

  if (action === 'goto-tender') {
    const tenderId = actionNode.dataset.tenderId
    if (tenderId) {
      openLinkedPage('任务分配', `/fcs/dispatch/board?tenderId=${encodeURIComponent(tenderId)}`)
    }
    return true
  }

  if (action === 'go-start') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('执行（PDA）', `/fcs/pda/exec/${encodeURIComponent(taskId)}?action=start`)
    }
    return true
  }

  if (action === 'goto-pda-task') {
    const taskId = actionNode.dataset.taskId
    if (taskId) {
      openLinkedPage('执行（PDA）', `/fcs/pda/exec/${encodeURIComponent(taskId)}`)
    }
    return true
  }

  if (action === 'assign-owner') {
    const caseId = actionNode.dataset.caseId
    if (!caseId || !(actionNode instanceof HTMLSelectElement)) return true

    const userId = actionNode.value
    const user = OWNER_OPTIONS.find((item) => item.id === userId)
    const exc = getCaseById(caseId)
    if (!exc || !user) return true
    if (exc.ownerUserId === user.id) return true

    assignCaseOwner(exc, user.id, user.name)
    showProgressExceptionsToast(`已指派给 ${user.name}`)
    return true
  }

  if (action === 'open-close-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) openCloseDialog(caseId)
    return true
  }

  if (action === 'close-close-dialog') {
    closeCloseDialog()
    return true
  }

  if (action === 'confirm-close-exception') {
    confirmCloseException()
    return true
  }

  if (action === 'status-change') {
    showProgressExceptionsToast('请使用分类专项动作或关闭异常流程处理状态', 'error')
    return true
  }

  if (action === 'urge-owner') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true

    const exc = getCaseById(caseId)
    if (!exc || !exc.ownerUserId) return true

    const owner = mockInternalUsers.find((item) => item.id === exc.ownerUserId)
    if (!owner) return true

    createUrge({
      urgeType: 'URGE_CASE_HANDLE',
      fromType: 'INTERNAL_USER',
      fromId: 'U001',
      fromName: '管理员',
      toType: 'INTERNAL_USER',
      toId: owner.id,
      toName: owner.name,
      targetType: 'CASE',
      targetId: exc.caseId,
      message: `请尽快处理异常单 ${exc.caseId}`,
      deepLink: {
        path: '/fcs/progress/exceptions',
        query: { caseId: exc.caseId },
      },
    })

    showProgressExceptionsToast('催办发送成功')
    return true
  }

  if (action === 'open-unblock-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.unblockDialogCaseId = caseId
      state.unblockRemark = ''
    }
    return true
  }

  if (action === 'close-unblock-dialog') {
    state.unblockDialogCaseId = null
    state.unblockRemark = ''
    return true
  }

  if (action === 'confirm-unblock') {
    confirmUnblock()
    return true
  }

  if (action === 'open-extend-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.extendDialogCaseId = caseId
    }
    return true
  }

  if (action === 'close-extend-dialog') {
    state.extendDialogCaseId = null
    return true
  }

  if (action === 'confirm-extend-dialog') {
    confirmExtendTender()
    return true
  }

  if (action === 'open-pause-followup-dialog') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.pauseFollowUpCaseId = caseId
      state.pauseFollowUpRemark = ''
    }
    return true
  }

  if (action === 'close-pause-followup-dialog') {
    state.pauseFollowUpCaseId = null
    state.pauseFollowUpRemark = ''
    return true
  }

  if (action === 'confirm-pause-followup') {
    confirmPauseFollowUp()
    return true
  }

  if (action === 'pause-allow-continue') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      confirmPauseAllowContinue(caseId)
    }
    return true
  }

  return false
}

export function handleProgressExceptionsEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pe-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const field = fieldNode.dataset.peField
    if (!field) return true
    updateField(field, fieldNode)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-pe-action]')
  if (!actionNode) {
    if (state.rowActionMenuCaseId) {
      state.rowActionMenuCaseId = null
      return true
    }
    return false
  }

  const action = actionNode.dataset.peAction
  if (!action) return false

  return handleAction(action, actionNode)
}
