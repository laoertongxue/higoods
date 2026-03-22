import type {
  CuttingInputReviewStatus,
  CuttingRecommendedScoreBand,
  CuttingScoreFocusLevel,
  CuttingSettlementFocusLevel,
  CuttingSettlementInputView,
} from './types'

export interface CuttingSettlementInputFilters {
  keyword: string
  attentionType: 'ALL' | 'SETTLEMENT' | 'SCORE' | 'BOTH'
  settlementFocusLevel: 'ALL' | CuttingSettlementFocusLevel
  scoreFocusLevel: 'ALL' | CuttingScoreFocusLevel
  reviewStatus: 'ALL' | CuttingInputReviewStatus
  exceptionImpact: 'ALL' | 'IMPACTED' | 'MULTI_RECHECK' | 'MISSING_EVIDENCE'
  pendingOnly: 'ALL' | 'PENDING_ONLY'
}

export const cuttingSettlementFocusMeta: Record<CuttingSettlementFocusLevel, { label: string; className: string }> = {
  NORMAL: { label: '普通', className: 'bg-slate-100 text-slate-700' },
  FOCUS: { label: '关注', className: 'bg-amber-50 text-amber-700' },
  HIGH_FOCUS: { label: '高关注', className: 'bg-rose-50 text-rose-700' },
}

export const cuttingScoreFocusMeta: Record<CuttingScoreFocusLevel, { label: string; className: string }> = {
  NORMAL: { label: '普通', className: 'bg-slate-100 text-slate-700' },
  WATCH: { label: '观察', className: 'bg-sky-50 text-sky-700' },
  LOW_SCORE_RISK: { label: '低评分风险', className: 'bg-amber-50 text-amber-700' },
  HIGH_ATTENTION: { label: '高关注', className: 'bg-rose-50 text-rose-700' },
}

export const cuttingInputReviewStatusMeta: Record<CuttingInputReviewStatus, { label: string; className: string }> = {
  PENDING: { label: '待确认', className: 'bg-slate-100 text-slate-700' },
  REVIEWING: { label: '复核中', className: 'bg-sky-50 text-sky-700' },
  CONFIRMED: { label: '已确认', className: 'bg-emerald-50 text-emerald-700' },
  NEED_MORE_INFO: { label: '待补充说明', className: 'bg-amber-50 text-amber-700' },
}

export const cuttingRecommendedScoreBandMeta: Record<
  CuttingRecommendedScoreBand,
  { label: string; className: string }
> = {
  EXCELLENT: { label: '优秀建议', className: 'bg-emerald-50 text-emerald-700' },
  GOOD: { label: '良好建议', className: 'bg-sky-50 text-sky-700' },
  WATCH: { label: '观察建议', className: 'bg-amber-50 text-amber-700' },
  LIMIT: { label: '限制合作建议', className: 'bg-rose-50 text-rose-700' },
}

export function filterCuttingSettlementInputViews(
  rows: CuttingSettlementInputView[],
  filters: CuttingSettlementInputFilters,
): CuttingSettlementInputView[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return rows.filter((row) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [
        row.settlementInput.settlementInputNo,
        row.scoreInput.scoreInputNo,
        row.productionOrderNo,
        row.cuttingTaskNo,
        row.factoryName,
        row.settlementInput.pickupSummary.pickupSlipNo,
        row.suggestedActionText,
        row.exceptionImpactText,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    const matchesSettlementFocus =
      filters.settlementFocusLevel === 'ALL' || row.settlementInput.settlementFocusLevel === filters.settlementFocusLevel
    const matchesScoreFocus =
      filters.scoreFocusLevel === 'ALL' || row.scoreInput.scoreFocusLevel === filters.scoreFocusLevel
    const matchesReview = filters.reviewStatus === 'ALL' || row.reviewStatus === filters.reviewStatus
    const matchesPending = filters.pendingOnly === 'ALL' || row.isPending

    const matchesAttentionType =
      filters.attentionType === 'ALL' ||
      (filters.attentionType === 'SETTLEMENT' && row.requiresSettlementAttention && !row.requiresScoreAttention) ||
      (filters.attentionType === 'SCORE' && !row.requiresSettlementAttention && row.requiresScoreAttention) ||
      (filters.attentionType === 'BOTH' && row.requiresSettlementAttention && row.requiresScoreAttention)

    const matchesExceptionImpact =
      filters.exceptionImpact === 'ALL' ||
      (filters.exceptionImpact === 'IMPACTED' && row.hasExceptionImpact) ||
      (filters.exceptionImpact === 'MULTI_RECHECK' && row.settlementInput.exceptionImpactSummary.repeatedRecheckCount > 0) ||
      (filters.exceptionImpact === 'MISSING_EVIDENCE' && row.settlementInput.exceptionImpactSummary.insufficientEvidenceCount > 0)

    return (
      matchesKeyword &&
      matchesSettlementFocus &&
      matchesScoreFocus &&
      matchesReview &&
      matchesPending &&
      matchesAttentionType &&
      matchesExceptionImpact
    )
  })
}

export function hasCuttingSettlementInputFilters(filters: CuttingSettlementInputFilters): boolean {
  return (
    filters.keyword.trim().length > 0 ||
    filters.attentionType !== 'ALL' ||
    filters.settlementFocusLevel !== 'ALL' ||
    filters.scoreFocusLevel !== 'ALL' ||
    filters.reviewStatus !== 'ALL' ||
    filters.exceptionImpact !== 'ALL' ||
    filters.pendingOnly !== 'ALL'
  )
}

export function buildCuttingSettlementInputStats(rows: CuttingSettlementInputView[]) {
  return {
    pendingConfirmCount: rows.filter((row) => row.reviewStatus === 'PENDING').length,
    highSettlementFocusCount: rows.filter((row) => row.settlementInput.settlementFocusLevel === 'HIGH_FOCUS').length,
    highScoreFocusCount: rows.filter((row) => row.scoreInput.scoreFocusLevel === 'HIGH_ATTENTION').length,
    exceptionImpactedCount: rows.filter((row) => row.hasExceptionImpact).length,
    manualReviewCount: rows.filter((row) => row.settlementInput.needsManualReview || row.scoreInput.needsManualReview).length,
    lowScoreRiskFactoryCount: rows.filter((row) => row.scoreInput.recommendedScoreBand === 'WATCH' || row.scoreInput.recommendedScoreBand === 'LIMIT').length,
  }
}

export function buildCuttingSettlementFocusBuckets(rows: CuttingSettlementInputView[]) {
  const pendingRows = rows.filter((row) => row.isPending)
  return {
    settlementRows: pendingRows.filter((row) => row.settlementInput.settlementFocusLevel === 'HIGH_FOCUS').slice(0, 3),
    scoreRows: pendingRows
      .filter((row) => row.scoreInput.scoreFocusLevel === 'HIGH_ATTENTION' || row.scoreInput.scoreFocusLevel === 'LOW_SCORE_RISK')
      .slice(0, 3),
    reviewRows: pendingRows
      .filter(
        (row) =>
          row.settlementInput.exceptionImpactSummary.repeatedRecheckCount > 0 ||
          row.settlementInput.exceptionImpactSummary.insufficientEvidenceCount > 0,
      )
      .slice(0, 3),
    executionRows: pendingRows
      .filter(
        (row) =>
          row.settlementInput.replenishmentSummary.highRiskCount > 0 ||
          row.settlementInput.warehouseSummary.pendingInboundCount > 0 ||
          row.settlementInput.warehouseSummary.waitingHandoverCount > 0,
      )
      .slice(0, 3),
  }
}

export function buildCuttingSettlementInputEmptyStateText(
  hasFilters: boolean,
  mode: 'records' | 'focus',
): string {
  if (mode === 'focus') return '当前没有需要平台优先确认的裁片结算与评分输入。'
  return hasFilters ? '未找到符合筛选条件的裁片结算与评分输入。' : '当前没有可展示的裁片结算与评分输入。'
}

export function buildOperatorContributionHeadline(view: CuttingSettlementInputView): string {
  if (view.settlementInput.operatorSummary.length === 0) return '当前没有可展示的个人执行留痕。'
  const topOperator = [...view.settlementInput.operatorSummary].sort((left, right) => right.actionCount - left.actionCount)[0]
  return `${topOperator.operatorName} · 动作 ${topOperator.actionCount} 次 · ${topOperator.latestActionSummary}`
}

export function buildGroupContributionHeadline(view: CuttingSettlementInputView): string {
  if (view.settlementInput.groupSummary.length === 0) return '当前没有可展示的小组执行留痕。'
  const topGroup = [...view.settlementInput.groupSummary].sort((left, right) => right.actionCount - left.actionCount)[0]
  return `${topGroup.groupName} · 成员 ${topGroup.memberCount} 人 · 动作 ${topGroup.actionCount} 次`
}

export function buildSettlementReviewText(view: CuttingSettlementInputView): string {
  const reviewMeta = cuttingInputReviewStatusMeta[view.reviewStatus]
  return `${reviewMeta.label} · ${view.settlementInput.needsManualReview ? '需人工复核' : '可直接归档'}`
}
