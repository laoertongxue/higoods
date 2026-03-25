import {
  appStore,
  listState,
  showQcRecordsToast,
  getCurrentDetailRouteId,
  ensureDetailState,
  parseNumberField,
  parseAmountField,
  nowTimestamp,
  getQcById,
  syncDetailFromQc,
  type ResultFilter,
  type StatusFilter,
  type DispositionFilter,
  type LiabilityFilter,
  type FactoryResponseFilter,
  type DisputeFilter,
  type SettlementImpactFilter,
  type QcResult,
  type QcRecordsListState,
} from './context'
import { adjudicateDisputeCase } from '../../data/fcs/quality-deduction-lifecycle'
import {
  updateQcDispositionBreakdown,
  saveDraft,
  submitDetail,
  updateFormField,
  setResult,
  isDetailReadOnly,
} from './actions'

export function handleQcRecordsEvent(target: HTMLElement): boolean {
  const listFilterNode = target.closest<HTMLElement>('[data-qcr-filter]')
  if (listFilterNode instanceof HTMLInputElement || listFilterNode instanceof HTMLSelectElement) {
    const field = listFilterNode.dataset.qcrFilter
    if (field === 'keyword') {
      listState.keyword = listFilterNode.value
      return true
    }
    if (field === 'showLegacy' && listFilterNode instanceof HTMLInputElement) {
      listState.showLegacy = listFilterNode.checked
      return true
    }
    if (field === 'processType') {
      listState.filterProcessType = listFilterNode.value as QcRecordsListState['filterProcessType']
      return true
    }
    if (field === 'policy') {
      listState.filterPolicy = listFilterNode.value as QcRecordsListState['filterPolicy']
      return true
    }
    if (field === 'result') {
      listState.filterResult = listFilterNode.value as ResultFilter
      return true
    }
    if (field === 'status') {
      listState.filterStatus = listFilterNode.value as StatusFilter
      return true
    }
    if (field === 'disposition') {
      listState.filterDisposition = listFilterNode.value as DispositionFilter
      return true
    }
    if (field === 'liabilityStatus') {
      listState.filterLiabilityStatus = listFilterNode.value as LiabilityFilter
      return true
    }
    if (field === 'factoryResponseStatus') {
      listState.filterFactoryResponseStatus = listFilterNode.value as FactoryResponseFilter
      return true
    }
    if (field === 'disputeStatus') {
      listState.filterDisputeStatus = listFilterNode.value as DisputeFilter
      return true
    }
    if (field === 'settlementImpactStatus') {
      listState.filterSettlementImpactStatus = listFilterNode.value as SettlementImpactFilter
      return true
    }
    if (field === 'inspector') {
      listState.filterInspector = listFilterNode.value
      return true
    }
    if (field === 'factory') {
      listState.filterFactory = listFilterNode.value
      return true
    }
    if (field === 'warehouse') {
      listState.filterWarehouse = listFilterNode.value
      return true
    }
    return true
  }

  const detailFieldNode = target.closest<HTMLElement>('[data-qcd-field]')
  if (
    detailFieldNode instanceof HTMLInputElement ||
    detailFieldNode instanceof HTMLSelectElement ||
    detailFieldNode instanceof HTMLTextAreaElement
  ) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false

    const detail = ensureDetailState(routeQcId)
    const field = detailFieldNode.dataset.qcdField
    if (!field) return true

    if (!isDetailReadOnly(detail)) {
      updateFormField(detail, field, detailFieldNode.value)
    }
    return true
  }

  const defectNode = target.closest<HTMLElement>('[data-qcd-defect-field]')
  if (defectNode instanceof HTMLInputElement) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false

    const detail = ensureDetailState(routeQcId)
    if (isDetailReadOnly(detail)) return true

    const field = defectNode.dataset.qcdDefectField
    const index = Number(defectNode.dataset.qcdDefectIndex)
    if (!field || Number.isNaN(index)) return true

    const defect = detail.form.defectItems[index]
    if (!defect) return true

    if (field === 'name') {
      defect.defectName = defectNode.value
      return true
    }
    if (field === 'qty') {
      const value = parseNumberField(defectNode.value)
      defect.qty = value === '' ? 0 : Math.max(0, value)
      return true
    }

    return true
  }

  const breakdownNode = target.closest<HTMLElement>('[data-qcd-breakdown]')
  if (breakdownNode instanceof HTMLInputElement) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false
    const detail = ensureDetailState(routeQcId)

    const key = breakdownNode.dataset.qcdBreakdown
    const value = parseNumberField(breakdownNode.value)
    const normalized = value === '' ? '' : Math.max(0, value)

    if (key === 'defect') {
      detail.bdAcceptDefect = normalized
      return true
    }
    if (key === 'scrap') {
      detail.bdScrap = normalized
      return true
    }
    if (key === 'nodeduct') {
      detail.bdNoDeduct = normalized
      return true
    }

    return true
  }

  const adjudicationFieldNode = target.closest<HTMLElement>('[data-qcd-adjudication-field]')
  if (
    adjudicationFieldNode instanceof HTMLInputElement ||
    adjudicationFieldNode instanceof HTMLSelectElement ||
    adjudicationFieldNode instanceof HTMLTextAreaElement
  ) {
    const routeQcId = getCurrentDetailRouteId()
    if (!routeQcId) return false

    const detail = ensureDetailState(routeQcId)
    const field = adjudicationFieldNode.dataset.qcdAdjudicationField
    if (!field) return true

    if (field === 'result' && adjudicationFieldNode instanceof HTMLSelectElement) {
      detail.adjudication.result = adjudicationFieldNode.value as typeof detail.adjudication.result
      detail.adjudication.errorText = ''
      return true
    }

    if (field === 'comment' && adjudicationFieldNode instanceof HTMLTextAreaElement) {
      detail.adjudication.comment = adjudicationFieldNode.value
      detail.adjudication.errorText = ''
      return true
    }

    if (field === 'adjustmentReasonSummary' && adjudicationFieldNode instanceof HTMLTextAreaElement) {
      detail.adjudication.adjustmentReasonSummary = adjudicationFieldNode.value
      detail.adjudication.errorText = ''
      return true
    }

    if (field === 'adjustedLiableQty' && adjudicationFieldNode instanceof HTMLInputElement) {
      detail.adjudication.adjustedLiableQty = parseNumberField(adjudicationFieldNode.value)
      detail.adjudication.errorText = ''
      return true
    }

    if (field === 'adjustedBlockedProcessingFeeAmount' && adjudicationFieldNode instanceof HTMLInputElement) {
      detail.adjudication.adjustedBlockedProcessingFeeAmount = parseAmountField(adjudicationFieldNode.value)
      detail.adjudication.errorText = ''
      return true
    }

    if (field === 'adjustedEffectiveQualityDeductionAmount' && adjudicationFieldNode instanceof HTMLInputElement) {
      detail.adjudication.adjustedEffectiveQualityDeductionAmount = parseAmountField(adjudicationFieldNode.value)
      detail.adjudication.errorText = ''
      return true
    }

    return true
  }

  const listActionNode = target.closest<HTMLElement>('[data-qcr-action]')
  if (listActionNode) {
    const action = listActionNode.dataset.qcrAction
    if (!action) return true

    if (action === 'reset-filters') {
      listState.activeView = 'ALL'
      listState.keyword = ''
      listState.filterProcessType = 'ALL'
      listState.filterPolicy = 'ALL'
      listState.filterResult = 'ALL'
      listState.filterStatus = 'ALL'
      listState.filterDisposition = 'ALL'
      listState.filterLiabilityStatus = 'ALL'
      listState.filterFactoryResponseStatus = 'ALL'
      listState.filterDisputeStatus = 'ALL'
      listState.filterSettlementImpactStatus = 'ALL'
      listState.filterInspector = 'ALL'
      listState.filterFactory = 'ALL'
      listState.filterWarehouse = 'ALL'
      listState.showLegacy = false
      return true
    }

    if (action === 'set-view') {
      listState.activeView =
        (listActionNode.dataset.qcrView as QcRecordsListState['activeView'] | undefined) ?? 'ALL'
      return true
    }

    if (action === 'handle-dispute') {
      const href = listActionNode.dataset.qcrHref
      if (href) {
        appStore.navigate(href)
      }
      return true
    }

    return true
  }

  const detailActionNode = target.closest<HTMLElement>('[data-qcd-action]')
  if (!detailActionNode) return false

  const action = detailActionNode.dataset.qcdAction
  if (!action) return false

  const routeQcId = getCurrentDetailRouteId()
  const detail = routeQcId ? ensureDetailState(routeQcId) : null

  if (action === 'back-list') {
    const pathname = appStore.getState().pathname
    appStore.navigate(
      pathname.startsWith('/fcs/pda/qc-records/')
        ? '/fcs/pda/settlement'
        : '/fcs/quality/qc-records',
    )
    return true
  }

  if (!detail) return true

  if (action === 'set-result') {
    if (isDetailReadOnly(detail)) return true
    const result = detailActionNode.dataset.qcdResult as QcResult | undefined
    if (result === 'PASS' || result === 'FAIL') {
      setResult(detail, result)
    }
    return true
  }

  if (action === 'add-defect') {
    if (isDetailReadOnly(detail)) return true
    detail.form.defectItems.push({ defectCode: '', defectName: '', qty: 1 })
    return true
  }

  if (action === 'remove-defect') {
    if (isDetailReadOnly(detail)) return true
    const index = Number(detailActionNode.dataset.qcdIndex)
    if (!Number.isNaN(index)) {
      detail.form.defectItems = detail.form.defectItems.filter((_, itemIndex) => itemIndex !== index)
    }
    return true
  }

  if (action === 'save-draft') {
    if (isDetailReadOnly(detail)) return true
    saveDraft(detail)
    return true
  }

  if (action === 'submit') {
    if (isDetailReadOnly(detail)) return true
    submitDetail(detail)
    return true
  }

  if (action === 'quick-fill') {
    const existing = detail.currentQcId ? getQcById(detail.currentQcId) : null
    const targetQty = existing?.affectedQty ?? 0
    const fill = detailActionNode.dataset.qcdFill

    detail.bdAcceptDefect = fill === 'defect' ? targetQty : 0
    detail.bdScrap = fill === 'scrap' ? targetQty : 0
    detail.bdNoDeduct = fill === 'nodeduct' ? targetQty : 0
    return true
  }

  if (action === 'save-breakdown') {
    if (!detail.currentQcId) {
      showQcRecordsToast('请先保存草稿再填写处置拆分', 'error')
      return true
    }

    const result = updateQcDispositionBreakdown(
      detail.currentQcId,
      {
        acceptAsDefectQty: Number(detail.bdAcceptDefect) || 0,
        scrapQty: Number(detail.bdScrap) || 0,
        acceptNoDeductQty: Number(detail.bdNoDeduct) || 0,
      },
      '管理员',
    )

    if (!result.ok) {
      showQcRecordsToast(result.message ?? '保存失败', 'error')
      return true
    }

    const latest = getQcById(detail.currentQcId)
    if (latest) {
      syncDetailFromQc(detail, latest)
    }
    showQcRecordsToast('处置数量拆分已保存，可扣款数量已同步')
    return true
  }

  if (action === 'submit-adjudication') {
    if (!detail.currentQcId) return true
    if (!detail.adjudication.result) {
      detail.adjudication.errorText = '请先选择裁决结果'
      return true
    }
    if (!detail.adjudication.comment.trim()) {
      detail.adjudication.errorText = '请填写裁决意见'
      return true
    }

    const adjudicationResult = adjudicateDisputeCase({
      qcId: detail.currentQcId,
      reviewerUserName: '平台运营-裁决',
      adjudicatedAt: nowTimestamp(),
      adjudicationResult: detail.adjudication.result,
      adjudicationComment: detail.adjudication.comment.trim(),
      adjustedLiableQty:
        detail.adjudication.result === 'PARTIALLY_ADJUSTED' && detail.adjudication.adjustedLiableQty !== ''
          ? Number(detail.adjudication.adjustedLiableQty)
          : undefined,
      adjustedBlockedProcessingFeeAmount:
        detail.adjudication.result === 'PARTIALLY_ADJUSTED' && detail.adjudication.adjustedBlockedProcessingFeeAmount !== ''
          ? Number(detail.adjudication.adjustedBlockedProcessingFeeAmount)
          : undefined,
      adjustedEffectiveQualityDeductionAmount:
        detail.adjudication.result === 'PARTIALLY_ADJUSTED' && detail.adjudication.adjustedEffectiveQualityDeductionAmount !== ''
          ? Number(detail.adjudication.adjustedEffectiveQualityDeductionAmount)
          : undefined,
      adjustmentReasonSummary:
        detail.adjudication.result === 'PARTIALLY_ADJUSTED'
          ? detail.adjudication.adjustmentReasonSummary.trim()
          : undefined,
    })

    if (!adjudicationResult.ok) {
      detail.adjudication.errorText = adjudicationResult.message
      showQcRecordsToast(adjudicationResult.message, 'error')
      return true
    }

    detail.adjudication = {
      result: '',
      comment: '',
      adjustedLiableQty: '',
      adjustedBlockedProcessingFeeAmount: '',
      adjustedEffectiveQualityDeductionAmount: '',
      adjustmentReasonSummary: '',
      errorText: '',
    }
    showQcRecordsToast('异议裁决已写回共享链路，平台端与工厂端状态已同步')
    return true
  }

  return true
}
