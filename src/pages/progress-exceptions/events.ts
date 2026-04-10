import {
  state,
  OWNER_OPTIONS,
  isSubCategoryKey,
  getSubCategoryOptions,
  getCaseById,
  getExceptionTotalPages,
  getOrderById,
  filterCases,
  getProductionOrderHandoverSummary,
  buildHandoverOrderDetailLink,
  getTaskById,
  mockInternalUsers,
  nowTimestamp,
  type SubCategoryKey,
  type UnifiedCategory,
  type CloseReasonCode,
  type UiCaseStatus,
} from './context'
import { getClaimDisputeByCaseId, updateClaimDisputePlatformHandling } from '../../state/fcs-claim-dispute-store'
import {
  getPdaPickupDisputeByCaseId,
  updatePdaPickupDisputePlatformHandling,
} from '../../helpers/fcs-pda-pickup-dispute'
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
import { resolveTechnicalDataEntryBySpuCode } from '../../data/pcs-technical-data-entry-resolver.ts'

function openTechnicalCompatibilityBySpuCode(spuCode: string): void {
  const target = resolveTechnicalDataEntryBySpuCode(spuCode)
  openLinkedPage(target.targetTitle, target.targetPath)
}

function syncClaimDisputeHandleForm(caseId: string | null): void {
  if (!caseId) {
    state.claimDisputeHandleStatus = 'VIEWED'
    state.claimDisputeHandleConclusion = ''
    state.claimDisputeHandleNote = ''
    return
  }

  const dispute = getClaimDisputeByCaseId(caseId)
  if (!dispute) {
    state.claimDisputeHandleStatus = 'VIEWED'
    state.claimDisputeHandleConclusion = ''
    state.claimDisputeHandleNote = ''
    return
  }

  state.claimDisputeHandleStatus = dispute.status
  state.claimDisputeHandleConclusion = dispute.handleConclusion || ''
  state.claimDisputeHandleNote = dispute.handleNote || ''
}

function syncPickupDisputeHandleForm(caseId: string | null): void {
  if (!caseId) {
    state.pickupDisputeHandleStatus = 'PROCESSING'
    state.pickupDisputeHandleResolvedQty = ''
    state.pickupDisputeHandleNote = ''
    return
  }

  const dispute = getPdaPickupDisputeByCaseId(caseId)
  if (!dispute) {
    state.pickupDisputeHandleStatus = 'PROCESSING'
    state.pickupDisputeHandleResolvedQty = ''
    state.pickupDisputeHandleNote = ''
    return
  }

  state.pickupDisputeHandleStatus = dispute.record.status === 'OBJECTION_RESOLVED' ? 'RESOLVED' : 'PROCESSING'
  state.pickupDisputeHandleResolvedQty =
    typeof dispute.record.finalResolvedQty === 'number' ? String(dispute.record.finalResolvedQty) : ''
  state.pickupDisputeHandleNote = dispute.record.resolvedRemark || dispute.record.followUpRemark || ''
}

function updateField(field: string, node: HTMLElement): void {
  if (field === 'keyword' && node instanceof HTMLInputElement) {
    state.keyword = node.value
    state.currentPage = 1
    return
  }

  if (field === 'severityFilter' && node instanceof HTMLSelectElement) {
    state.severityFilter = node.value
    state.currentPage = 1
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
    state.currentPage = 1
    return
  }

  if (field === 'subCategoryFilter' && node instanceof HTMLSelectElement) {
    state.subCategoryFilter = node.value as 'ALL' | SubCategoryKey
    state.currentPage = 1
    return
  }

  if (field === 'statusFilter' && node instanceof HTMLSelectElement) {
    state.statusFilter = node.value as 'ALL' | UiCaseStatus
    state.currentPage = 1
    return
  }

  if (field === 'ownerFilter' && node instanceof HTMLSelectElement) {
    state.ownerFilter = node.value
    state.currentPage = 1
    return
  }

  if (field === 'factoryFilter' && node instanceof HTMLSelectElement) {
    state.factoryFilter = node.value
    state.currentPage = 1
    return
  }

  if (field === 'processFilter' && node instanceof HTMLSelectElement) {
    state.processFilter = node.value
    state.currentPage = 1
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
    return
  }

  if (field === 'claimDisputeHandleStatus' && node instanceof HTMLSelectElement) {
    state.claimDisputeHandleStatus = node.value as typeof state.claimDisputeHandleStatus
    return
  }

  if (field === 'claimDisputeHandleConclusion' && node instanceof HTMLInputElement) {
    state.claimDisputeHandleConclusion = node.value
    return
  }

  if (field === 'claimDisputeHandleNote' && node instanceof HTMLTextAreaElement) {
    state.claimDisputeHandleNote = node.value
    return
  }

  if (field === 'pickupDisputeHandleStatus' && node instanceof HTMLSelectElement) {
    state.pickupDisputeHandleStatus = node.value as typeof state.pickupDisputeHandleStatus
    return
  }

  if (field === 'pickupDisputeHandleResolvedQty' && node instanceof HTMLInputElement) {
    state.pickupDisputeHandleResolvedQty = node.value
    return
  }

  if (field === 'pickupDisputeHandleNote' && node instanceof HTMLTextAreaElement) {
    state.pickupDisputeHandleNote = node.value
  }
}

function handleRowAction(action: string, actionNode: HTMLElement): boolean {
  if (action === 'row-view') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    state.detailCaseId = caseId
    syncClaimDisputeHandleForm(caseId)
    syncPickupDisputeHandleForm(caseId)
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
      openTechnicalCompatibilityBySpuCode(firstOrder.demandSnapshot.spuCode)
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
      openTechnicalCompatibilityBySpuCode(firstOrder.demandSnapshot.spuCode)
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

  if (action === 'drawer-go-craft-dispute') {
    const originalCutOrderNo = actionNode.dataset.originalCutOrderNo || ''
    openLinkedPage(
      '仓库配料领料',
      `/fcs/craft/cutting/material-prep${originalCutOrderNo ? `?originalCutOrderNo=${encodeURIComponent(originalCutOrderNo)}` : ''}`,
    )
    return true
  }

  if (action === 'drawer-go-pda-dispute') {
    const taskId = actionNode.dataset.taskId || ''
    if (!taskId) return true
    openLinkedPage('执行（PDA）', `/fcs/pda/cutting/task/${encodeURIComponent(taskId)}`)
    return true
  }

  if (action === 'drawer-go-pda-pickup-dispute') {
    const handoverId = actionNode.dataset.handoverId || ''
    if (!handoverId) return true
    openLinkedPage('待领料详情', `/fcs/pda/handover/${encodeURIComponent(handoverId)}`)
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
    state.currentPage = 1
    return true
  }

  if (action === 'kpi-in-progress') {
    state.statusFilter = 'IN_PROGRESS'
    state.severityFilter = 'ALL'
    state.aggregateFilter = null
    state.currentPage = 1
    return true
  }

  if (action === 'kpi-s1') {
    state.severityFilter = 'S1'
    state.statusFilter = 'ALL'
    state.aggregateFilter = null
    state.currentPage = 1
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
    state.currentPage = 1
    return true
  }

  if (action === 'aggregate-reason') {
    const value = actionNode.dataset.value
    if (value && isSubCategoryKey(value)) {
      state.aggregateFilter = { type: 'reason', value }
    }
    state.currentPage = 1
    return true
  }

  if (action === 'aggregate-factory') {
    const value = actionNode.dataset.value
    if (value) {
      state.aggregateFilter = { type: 'factory', value }
    }
    state.currentPage = 1
    return true
  }

  if (action === 'aggregate-process') {
    const value = actionNode.dataset.value
    if (value) {
      state.aggregateFilter = { type: 'process', value }
    }
    state.currentPage = 1
    return true
  }

  if (action === 'clear-aggregate') {
    state.aggregateFilter = null
    state.currentPage = 1
    return true
  }

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    const totalPages = getExceptionTotalPages(filterCases().length)
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'goto-page') {
    const page = Number(actionNode.dataset.page ?? '1')
    const totalPages = getExceptionTotalPages(filterCases().length)
    state.currentPage = Math.max(1, Math.min(totalPages, Number.isFinite(page) ? page : 1))
    return true
  }

  if (action === 'open-detail') {
    const caseId = actionNode.dataset.caseId
    if (caseId) {
      state.detailCaseId = caseId
      syncClaimDisputeHandleForm(caseId)
      syncPickupDisputeHandleForm(caseId)
      state.rowActionMenuCaseId = null
    }
    return true
  }

  if (action === 'close-detail') {
    state.detailCaseId = null
    syncClaimDisputeHandleForm(null)
    syncPickupDisputeHandleForm(null)
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

  if (action === 'submit-claim-dispute-handle') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true
    const dispute = getClaimDisputeByCaseId(caseId)
    if (!dispute) {
      showProgressExceptionsToast('未找到对应的裁片领料数量异议', 'error')
      return true
    }

    const result = updateClaimDisputePlatformHandling(dispute.disputeId, {
      status: state.claimDisputeHandleStatus,
      handledBy: '平台运营',
      handledAt: nowTimestamp(),
      handleConclusion: state.claimDisputeHandleConclusion.trim(),
      handleNote: state.claimDisputeHandleNote.trim(),
    })

    if (!result.record) {
      showProgressExceptionsToast(result.issues.join('；') || '处理失败，请补齐处理结论和说明。', 'error')
      return true
    }

    syncClaimDisputeHandleForm(caseId)
    showProgressExceptionsToast(`已更新异议状态：${result.record.handleConclusion || '已处理'}`)
    return true
  }

  if (action === 'submit-pickup-dispute-handle') {
    const caseId = actionNode.dataset.caseId
    if (!caseId) return true

    const finalResolvedQty =
      state.pickupDisputeHandleStatus === 'RESOLVED' ? Number(state.pickupDisputeHandleResolvedQty) : undefined

    const result = updatePdaPickupDisputePlatformHandling(caseId, {
      status: state.pickupDisputeHandleStatus,
      handledBy: '平台运营',
      handledAt: nowTimestamp(),
      finalResolvedQty,
      handleNote: state.pickupDisputeHandleNote.trim(),
    })

    if (!result.record) {
      showProgressExceptionsToast(result.issues.join('；') || '处理失败，请补齐处理结果。', 'error')
      return true
    }

    syncPickupDisputeHandleForm(caseId)
    showProgressExceptionsToast(
      state.pickupDisputeHandleStatus === 'RESOLVED'
        ? `已完成数量裁定：${result.record.finalResolvedQty ?? 0} ${result.record.qtyUnit}`
        : '已更新为处理中',
    )
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
