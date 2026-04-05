import type {
  ReplenishmentFilters,
  ReplenishmentImpactFlag,
  ReplenishmentReviewStatus,
  ReplenishmentRiskLevel,
  ReplenishmentSourceType,
  ReplenishmentSuggestionRecord,
} from '../../../data/fcs/cutting/replenishment'
import type { CuttingMaterialType } from '../../../data/fcs/cutting/types'

export const materialTypeMeta: Record<CuttingMaterialType, { label: string; className: string }> = {
  PRINT: { label: '面料', className: 'bg-slate-100 text-slate-700' },
  DYE: { label: '面料', className: 'bg-slate-100 text-slate-700' },
  SOLID: { label: '面料', className: 'bg-slate-100 text-slate-700' },
  LINING: { label: '里布', className: 'bg-slate-100 text-slate-700' },
}

export const reviewStatusMeta: Record<ReplenishmentReviewStatus, { label: string; className: string }> = {
  PENDING: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  APPROVED: { label: '已通过', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '已驳回', className: 'bg-slate-200 text-slate-700' },
  NEED_MORE_INFO: { label: '待补充说明', className: 'bg-orange-100 text-orange-700' },
}

export const riskLevelMeta: Record<ReplenishmentRiskLevel, { label: string; className: string }> = {
  HIGH: { label: '高风险', className: 'bg-rose-100 text-rose-700' },
  MEDIUM: { label: '中风险', className: 'bg-orange-100 text-orange-700' },
  LOW: { label: '低风险', className: 'bg-sky-100 text-sky-700' },
}

export const sourceTypeMeta: Record<ReplenishmentSourceType, string> = {
  MARKER: '唛架',
  SPREADING: '铺布',
  RECEIVE_DISCREPANCY: '领料差异',
  EXECUTION_RISK: '执行风险',
}

export const reasonTypeMeta = {
  LENGTH_SHORTAGE: '铺布总长度不足',
  YIELD_RISK: '实际裁剪数量存在缺口风险',
  RECEIVE_GAP: '领料差异导致预计不足',
  MANUAL_REVIEW: '需要追加面料准备',
} as const

export const impactFlagMeta: Record<ReplenishmentImpactFlag, { label: string; className: string }> = {
  RECONFIG_REQUIRED: { label: '需重新配料', className: 'bg-blue-100 text-blue-700' },
  RERECEIVE_REQUIRED: { label: '需重新领料', className: 'bg-indigo-100 text-indigo-700' },
  PENDING_PREP_REQUIRED: { label: '需回仓库待配料', className: 'bg-amber-100 text-amber-700' },
}

export const riskTagMeta = {
  HIGH_GAP: { label: '高风险缺口', className: 'bg-rose-100 text-rose-700' },
  RECEIVE_DIFF: { label: '领料差异导致不足', className: 'bg-orange-100 text-orange-700' },
  MARKER_PENDING: { label: '唛架数据待确认', className: 'bg-amber-100 text-amber-700' },
  SPREADING_PENDING: { label: '铺布数据不足', className: 'bg-sky-100 text-sky-700' },
  PENDING_REVIEW: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  NEED_MORE_INFO: { label: '待补充说明', className: 'bg-orange-100 text-orange-700' },
} as const

const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatQty(value: number): string {
  return numberFormatter.format(value)
}

export function formatLength(value: number): string {
  return `${numberFormatter.format(value)} 米`
}

export function filterReplenishmentRecords(records: ReplenishmentSuggestionRecord[], filters: ReplenishmentFilters): ReplenishmentSuggestionRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const keywordMatched =
      keyword.length === 0 ||
      record.replenishmentNo.toLowerCase().includes(keyword) ||
      record.cutPieceOrderNo.toLowerCase().includes(keyword) ||
      record.productionOrderNo.toLowerCase().includes(keyword) ||
      record.materialSku.toLowerCase().includes(keyword)

    const materialMatched = filters.materialType === 'ALL' || record.materialType === filters.materialType
    const reviewMatched = filters.reviewStatus === 'ALL' || record.reviewStatus === filters.reviewStatus
    const riskMatched = filters.riskLevel === 'ALL' || record.riskLevel === filters.riskLevel
    const impactMatched = filters.impactFilter === 'ALL' || record.impactFlags.includes(filters.impactFilter)
    const sourceMatched = filters.sourceType === 'ALL' || record.suggestionSourceTypes.includes(filters.sourceType)

    return keywordMatched && materialMatched && reviewMatched && riskMatched && impactMatched && sourceMatched
  })
}

export interface ReplenishmentSummary {
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  highRiskCount: number
  reconfigCount: number
  pendingPrepCount: number
}

export function buildReplenishmentSummary(records: ReplenishmentSuggestionRecord[]): ReplenishmentSummary {
  return {
    pendingCount: records.filter((item) => item.reviewStatus === 'PENDING').length,
    approvedCount: records.filter((item) => item.reviewStatus === 'APPROVED').length,
    rejectedCount: records.filter((item) => item.reviewStatus === 'REJECTED').length,
    highRiskCount: records.filter((item) => item.riskLevel === 'HIGH').length,
    reconfigCount: records.filter((item) => item.impactFlags.includes('RECONFIG_REQUIRED')).length,
    pendingPrepCount: records.filter((item) => item.impactFlags.includes('PENDING_PREP_REQUIRED')).length,
  }
}

export function buildPriorityRecords(records: ReplenishmentSuggestionRecord[]): ReplenishmentSuggestionRecord[] {
  return [...records]
    .filter((item) => item.reviewStatus === 'PENDING' || item.reviewStatus === 'NEED_MORE_INFO' || item.riskLevel === 'HIGH')
    .sort((a, b) => {
      const weight = (record: ReplenishmentSuggestionRecord) => {
        let score = 0
        if (record.riskLevel === 'HIGH') score += 30
        if (record.reviewStatus === 'PENDING') score += 20
        if (record.reviewStatus === 'NEED_MORE_INFO') score += 10
        if (record.impactFlags.includes('PENDING_PREP_REQUIRED')) score += 5
        return score
      }
      return weight(b) - weight(a)
    })
    .slice(0, 4)
}

export function buildRiskTags(record: ReplenishmentSuggestionRecord[]): Array<keyof typeof riskTagMeta>
export function buildRiskTags(record: ReplenishmentSuggestionRecord): Array<keyof typeof riskTagMeta>
export function buildRiskTags(record: ReplenishmentSuggestionRecord | ReplenishmentSuggestionRecord[]): Array<keyof typeof riskTagMeta> {
  if (Array.isArray(record)) return []
  const tags = new Set<keyof typeof riskTagMeta>()
  if (record.riskLevel === 'HIGH') tags.add('HIGH_GAP')
  if (record.suggestionSourceTypes.includes('RECEIVE_DISCREPANCY')) tags.add('RECEIVE_DIFF')
  if (!record.hasMarkerImage) tags.add('MARKER_PENDING')
  if (record.spreadingRecordCount === 0) tags.add('SPREADING_PENDING')
  if (record.reviewStatus === 'PENDING') tags.add('PENDING_REVIEW')
  if (record.reviewStatus === 'NEED_MORE_INFO') tags.add('NEED_MORE_INFO')
  return Array.from(tags)
}

export function buildImpactSummary(record: ReplenishmentSuggestionRecord): string {
  if (!record.impactFlags.length) return '当前审核结果不触发额外联动。'
  return Array.from(new Set(record.impactFlags.map((flag) => impactFlagMeta[flag].label))).join(' / ')
}

export function buildGapSummary(record: ReplenishmentSuggestionRecord): string {
  return `缺口 ${formatQty(record.gapQty)} 件 · 建议补 ${formatQty(record.suggestedReplenishRollCount)} 卷 / ${formatLength(record.suggestedReplenishLength)}`
}

export function buildEmptyStateText(filters: ReplenishmentFilters): string {
  if (filters.reviewStatus === 'PENDING') return '当前筛选条件下暂无待审核补料建议。'
  if (filters.riskLevel === 'HIGH') return '当前筛选条件下暂无高风险补料建议。'
  if (filters.impactFilter === 'PENDING_PREP_REQUIRED') return '当前筛选条件下暂无需回仓库待配料的补料建议。'
  return '当前筛选条件下暂无匹配的补料建议。'
}
