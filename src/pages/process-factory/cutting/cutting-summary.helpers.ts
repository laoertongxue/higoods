import type {
  CuttingSummaryFilters,
  CuttingSummaryIssue,
  CuttingSummaryRecord,
  CuttingSummaryRiskLevel,
  CuttingSummaryStatus,
  CuttingSummaryUpdatedSource,
} from '../../../data/fcs/cutting/cutting-summary.ts'
import type { CuttingUrgencyLevel } from '../../../data/fcs/cutting/types.ts'

export const urgencyMeta: Record<CuttingUrgencyLevel, { label: string; className: string }> = {
  AA: { label: 'AA 紧急', className: 'bg-rose-50 text-rose-700' },
  A: { label: 'A 紧急', className: 'bg-orange-50 text-orange-700' },
  B: { label: 'B 紧急', className: 'bg-amber-50 text-amber-700' },
  C: { label: 'C 优先', className: 'bg-sky-50 text-sky-700' },
  D: { label: 'D 常规', className: 'bg-slate-100 text-slate-700' },
}

export const summaryStatusMeta: Record<CuttingSummaryStatus, { label: string; className: string }> = {
  PENDING_PREP_CLOSURE: { label: '待配料领料', className: 'bg-slate-100 text-slate-700' },
  PENDING_EXECUTION_CLOSURE: { label: '待执行确认', className: 'bg-sky-50 text-sky-700' },
  PENDING_REPLENISHMENT: { label: '待补料处理', className: 'bg-rose-50 text-rose-700' },
  PENDING_WAREHOUSE_HANDOVER: { label: '待入仓交接', className: 'bg-violet-50 text-violet-700' },
  PENDING_SAMPLE_RETURN: { label: '待样衣归还', className: 'bg-amber-50 text-amber-700' },
  DONE_PENDING_REVIEW: { label: '已完成待核查', className: 'bg-emerald-50 text-emerald-700' },
  CLOSED: { label: '已完成', className: 'bg-emerald-50 text-emerald-700' },
}

export const riskLevelMeta: Record<CuttingSummaryRiskLevel, { label: string; className: string }> = {
  HIGH: { label: '高风险', className: 'bg-rose-50 text-rose-700' },
  MEDIUM: { label: '中风险', className: 'bg-amber-50 text-amber-700' },
  LOW: { label: '低风险', className: 'bg-sky-50 text-sky-700' },
}

export const updatedSourceMeta: Record<CuttingSummaryUpdatedSource, string> = {
  PLATFORM: '平台侧',
  PCS: '工艺工厂运营系统',
  FACTORY_APP: '工厂端',
}

export const issueSourceMeta: Record<CuttingSummaryIssue['sourcePage'], { label: string; shortLabel: string }> = {
  MATERIAL_PREP: { label: '仓库配料领料', shortLabel: '配料领料' },
  CUT_PIECE_ORDER: { label: '原始裁片单', shortLabel: '原始单' },
  REPLENISHMENT: { label: '补料管理', shortLabel: '补料' },
  WAREHOUSE: { label: '裁片仓交接', shortLabel: '仓交接' },
  SAMPLE: { label: '样衣仓', shortLabel: '样衣仓' },
}

export function filterCuttingSummaryRecords(
  records: CuttingSummaryRecord[],
  filters: CuttingSummaryFilters,
): CuttingSummaryRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return records.filter((record) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [
        record.productionOrderNo,
        record.cuttingTaskNo,
        ...record.searchKeywords,
        ...record.issues.map((issue) => issue.title),
        ...record.linkedPageSummary.map((item) => item.summaryText),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword)

    const matchesUrgency = filters.urgencyLevel === 'ALL' || record.urgencyLevel === filters.urgencyLevel
    const matchesStatus = filters.summaryStatus === 'ALL' || record.overallSummaryStatus === filters.summaryStatus
    const matchesRisk = filters.riskLevel === 'ALL' || record.overallRiskLevel === filters.riskLevel
    const matchesSource =
      filters.issueSource === 'ALL' ||
      record.issues.some((issue) => {
        if (filters.issueSource === 'PREP') return issue.sourcePage === 'MATERIAL_PREP'
        if (filters.issueSource === 'EXECUTION') return issue.sourcePage === 'CUT_PIECE_ORDER'
        if (filters.issueSource === 'REPLENISHMENT') return issue.sourcePage === 'REPLENISHMENT'
        if (filters.issueSource === 'WAREHOUSE') return issue.sourcePage === 'WAREHOUSE'
        return issue.sourcePage === 'SAMPLE'
      })
    const matchesPending = filters.pendingOnly === 'ALL' || record.pendingIssueCount > 0 || record.overallSummaryStatus === 'DONE_PENDING_REVIEW'

    return matchesKeyword && matchesUrgency && matchesStatus && matchesRisk && matchesSource && matchesPending
  })
}

export function buildSummaryOverview(records: CuttingSummaryRecord[]) {
  return {
    pendingClosureCount: records.filter((item) => !['DONE_PENDING_REVIEW', 'CLOSED'].includes(item.overallSummaryStatus)).length,
    donePendingReviewCount: records.filter((item) => item.overallSummaryStatus === 'DONE_PENDING_REVIEW').length,
    closedCount: records.filter((item) => item.overallSummaryStatus === 'CLOSED').length,
    highRiskCount: records.filter((item) => item.overallRiskLevel === 'HIGH').length,
    pendingReplenishmentCount: records.filter((item) => item.overallSummaryStatus === 'PENDING_REPLENISHMENT').length,
    pendingWarehouseCount: records.filter((item) => item.overallSummaryStatus === 'PENDING_WAREHOUSE_HANDOVER').length,
  }
}

export function buildPriorityRecords(records: CuttingSummaryRecord[]): CuttingSummaryRecord[] {
  const statusWeight: Record<CuttingSummaryStatus, number> = {
    PENDING_REPLENISHMENT: 0,
    PENDING_SAMPLE_RETURN: 1,
    PENDING_WAREHOUSE_HANDOVER: 2,
    PENDING_EXECUTION_CLOSURE: 3,
    PENDING_PREP_CLOSURE: 4,
    DONE_PENDING_REVIEW: 5,
    CLOSED: 6,
  }
  const riskWeight: Record<CuttingSummaryRiskLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

  return [...records]
    .sort((a, b) => {
      const riskDiff = riskWeight[a.overallRiskLevel] - riskWeight[b.overallRiskLevel]
      if (riskDiff !== 0) return riskDiff
      const statusDiff = statusWeight[a.overallSummaryStatus] - statusWeight[b.overallSummaryStatus]
      if (statusDiff !== 0) return statusDiff
      return b.pendingIssueCount - a.pendingIssueCount
    })
    .slice(0, 4)
}

export function buildEmptyStateText(hasFilters: boolean, mode: 'records' | 'priority'): string {
  if (mode === 'priority') return '当前没有需要优先处理的重点问题生产单。'
  return hasFilters ? '未找到符合筛选条件的裁剪总表记录。' : '当前没有可展示的裁剪总表记录。'
}

export function hasSummaryFilters(filters: CuttingSummaryFilters): boolean {
  return (
    filters.keyword.trim().length > 0 ||
    filters.urgencyLevel !== 'ALL' ||
    filters.summaryStatus !== 'ALL' ||
    filters.riskLevel !== 'ALL' ||
    filters.issueSource !== 'ALL' ||
    filters.pendingOnly !== 'ALL'
  )
}

export function buildMaterialReceiveText(record: CuttingSummaryRecord): string {
  return `已配置 ${record.materialSummary.fullyConfiguredCount} / ${record.cutPieceOrderCount} · 领料成功 ${record.receiveSummary.receivedSuccessCount}`
}

export function buildExecutionText(record: CuttingSummaryRecord): string {
  return `唛架 ${record.markerSummary.markerMaintainedCount} 已维护 · 铺布 ${record.spreadingSummary.spreadingRecordCount} 条`
}

export function buildReplenishmentText(record: CuttingSummaryRecord): string {
  return `建议 ${record.replenishmentSummary.suggestionCount} · 待审 ${record.replenishmentSummary.pendingReviewCount}`
}

export function buildWarehouseSampleText(record: CuttingSummaryRecord): string {
  return `待入仓 ${record.warehouseSummary.cutPiecePendingInboundCount} · 样衣待归还 ${record.sampleSummary.sampleWaitingReturnCount}`
}

export function buildIssueSummaryText(record: CuttingSummaryRecord): string {
  if (record.pendingIssueCount === 0) return '当前无待核查问题'
  return `${record.pendingIssueCount} 项问题，含 ${record.highRiskIssueCount} 项高风险`
}
