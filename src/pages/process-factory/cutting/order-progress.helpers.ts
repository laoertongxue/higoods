import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingOrderProgressFilters,
  CuttingOrderProgressRecord,
  CuttingPrintSlipStatus,
  CuttingQrStatus,
  CuttingReceiveStatus,
  CuttingReviewStatus,
  CuttingRiskFlag,
  CuttingUrgencyLevel,
} from '../../../data/fcs/cutting/types'

export interface CuttingOrderProgressSummary {
  pendingAuditCount: number
  partialConfigCount: number
  pendingReceiveCount: number
  receiveDoneCount: number
  replenishmentPendingCount: number
  urgentCount: number
}

export const urgencyMeta: Record<CuttingUrgencyLevel, { label: string; className: string }> = {
  AA: { label: 'AA 紧急', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  A: { label: 'A 紧急', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  B: { label: 'B 紧急', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  C: { label: 'C 优先', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
  D: { label: 'D 常规', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

export const reviewMeta: Record<CuttingReviewStatus | 'PENDING' | 'PARTIAL', { label: string; className: string }> = {
  NOT_REQUIRED: { label: '无需审核', className: 'bg-slate-100 text-slate-700' },
  PENDING: { label: '待审核', className: 'bg-amber-100 text-amber-700' },
  PARTIAL: { label: '部分审核', className: 'bg-orange-100 text-orange-700' },
  APPROVED: { label: '已审核', className: 'bg-emerald-100 text-emerald-700' },
}

export const configMeta: Record<CuttingConfigStatus, { label: string; className: string }> = {
  NOT_CONFIGURED: { label: '未配置', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分配置', className: 'bg-orange-100 text-orange-700' },
  CONFIGURED: { label: '已配置', className: 'bg-emerald-100 text-emerald-700' },
}

export const receiveMeta: Record<CuttingReceiveStatus, { label: string; className: string }> = {
  NOT_RECEIVED: { label: '未领料', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分领料', className: 'bg-orange-100 text-orange-700' },
  RECEIVED: { label: '领料成功', className: 'bg-emerald-100 text-emerald-700' },
}

export const printSlipMeta: Record<CuttingPrintSlipStatus, { label: string; className: string }> = {
  NOT_PRINTED: { label: '未打印', className: 'bg-slate-100 text-slate-700' },
  PRINTED: { label: '已打印', className: 'bg-blue-100 text-blue-700' },
}

export const qrMeta: Record<CuttingQrStatus, { label: string; className: string }> = {
  NOT_GENERATED: { label: '未生成', className: 'bg-slate-100 text-slate-700' },
  GENERATED: { label: '已生成', className: 'bg-violet-100 text-violet-700' },
}

export const materialTypeMeta = {
  PRINT: '印花布',
  DYE: '染色布',
  SOLID: '素色布',
  LINING: '里布',
} satisfies Record<CuttingMaterialLine['materialType'], string>

export const riskMeta: Record<CuttingRiskFlag, { label: string; className: string }> = {
  PENDING_REVIEW: { label: '待审核', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  PARTIAL_CONFIG: { label: '部分配置', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  RECEIVE_DIFF: { label: '领料差异', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  REPLENISH_PENDING: { label: '待补料', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  INBOUND_PENDING: { label: '待入仓', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
  SHIP_URGENT: { label: '交期紧急', className: 'bg-red-100 text-red-700 border border-red-200' },
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatQty(value: number): string {
  return numberFormatter.format(value)
}

export function formatLength(value: number): string {
  return `${numberFormatter.format(value)} 米`
}

export function deriveAuditStatus(lines: CuttingMaterialLine[]): 'PENDING' | 'PARTIAL' | 'APPROVED' {
  const effective = lines.filter((line) => line.reviewStatus !== 'NOT_REQUIRED')
  if (effective.length === 0) return 'APPROVED'
  const hasApproved = effective.some((line) => line.reviewStatus === 'APPROVED')
  const hasPendingLike = effective.some((line) => line.reviewStatus === 'PENDING' || line.reviewStatus === 'PARTIAL')
  if (hasApproved && hasPendingLike) return 'PARTIAL'
  if (hasPendingLike) return 'PENDING'
  return 'APPROVED'
}

export function deriveConfigStatus(lines: CuttingMaterialLine[]): CuttingConfigStatus {
  if (lines.every((line) => line.configStatus === 'CONFIGURED')) return 'CONFIGURED'
  if (lines.some((line) => line.configStatus === 'CONFIGURED' || line.configStatus === 'PARTIAL')) return 'PARTIAL'
  return 'NOT_CONFIGURED'
}

export function deriveReceiveStatus(lines: CuttingMaterialLine[]): CuttingReceiveStatus {
  if (lines.every((line) => line.receiveStatus === 'RECEIVED')) return 'RECEIVED'
  if (lines.some((line) => line.receiveStatus === 'RECEIVED' || line.receiveStatus === 'PARTIAL')) return 'PARTIAL'
  return 'NOT_RECEIVED'
}

export function buildAuditSummaryText(lines: CuttingMaterialLine[]): string {
  const approvedCount = lines.filter((line) => line.reviewStatus === 'APPROVED' || line.reviewStatus === 'NOT_REQUIRED').length
  return `${approvedCount}/${lines.length} 已审`
}

export function buildConfigSummaryText(lines: CuttingMaterialLine[]): string {
  const configuredRolls = lines.reduce((sum, line) => sum + line.configuredRollCount, 0)
  return `${configuredRolls} 卷 / ${formatLength(lines.reduce((sum, line) => sum + line.configuredLength, 0))}`
}

export function buildReceiveSummaryText(lines: CuttingMaterialLine[]): string {
  const receivedRolls = lines.reduce((sum, line) => sum + line.receivedRollCount, 0)
  return `${receivedRolls} 卷 / ${formatLength(lines.reduce((sum, line) => sum + line.receivedLength, 0))}`
}

export function filterCuttingOrderProgressRecords(
  records: CuttingOrderProgressRecord[],
  filters: CuttingOrderProgressFilters,
): CuttingOrderProgressRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return records.filter((record) => {
    const auditStatus = deriveAuditStatus(record.materialLines)
    const configStatus = deriveConfigStatus(record.materialLines)
    const receiveStatus = deriveReceiveStatus(record.materialLines)

    const matchesKeyword =
      keyword.length === 0 ||
      record.productionOrderNo.toLowerCase().includes(keyword) ||
      record.cuttingTaskNo.toLowerCase().includes(keyword) ||
      record.materialLines.some((line) => line.materialSku.toLowerCase().includes(keyword))

    const matchesUrgency = filters.urgencyLevel === 'ALL' || record.urgencyLevel === filters.urgencyLevel
    const matchesAudit = filters.auditStatus === 'ALL' || auditStatus === filters.auditStatus
    const matchesConfig = filters.configStatus === 'ALL' || configStatus === filters.configStatus
    const matchesReceive = filters.receiveStatus === 'ALL' || receiveStatus === filters.receiveStatus
    const matchesRisk = filters.riskFilter === 'ALL' || record.riskFlags.length > 0

    return matchesKeyword && matchesUrgency && matchesAudit && matchesConfig && matchesReceive && matchesRisk
  })
}

export function buildCuttingOrderProgressSummary(
  records: CuttingOrderProgressRecord[],
): CuttingOrderProgressSummary {
  return {
    pendingAuditCount: records.filter((record) => deriveAuditStatus(record.materialLines) === 'PENDING').length,
    partialConfigCount: records.filter((record) => deriveConfigStatus(record.materialLines) === 'PARTIAL').length,
    pendingReceiveCount: records.filter((record) => deriveReceiveStatus(record.materialLines) !== 'RECEIVED').length,
    receiveDoneCount: records.filter((record) => deriveReceiveStatus(record.materialLines) === 'RECEIVED').length,
    replenishmentPendingCount: records.filter((record) => record.riskFlags.includes('REPLENISH_PENDING')).length,
    urgentCount: records.filter((record) => record.urgencyLevel === 'AA' || record.urgencyLevel === 'A').length,
  }
}

export function getTopRiskRecords(records: CuttingOrderProgressRecord[]): CuttingOrderProgressRecord[] {
  return [...records]
    .filter((record) => record.riskFlags.length > 0)
    .sort((a, b) => {
      const urgencyWeight = { AA: 5, A: 4, B: 3, C: 2, D: 1 }
      return urgencyWeight[b.urgencyLevel] - urgencyWeight[a.urgencyLevel]
    })
    .slice(0, 4)
}

export function getPrepFocusRecords(records: CuttingOrderProgressRecord[]): CuttingOrderProgressRecord[] {
  return [...records]
    .filter((record) => deriveConfigStatus(record.materialLines) !== 'CONFIGURED' || deriveReceiveStatus(record.materialLines) !== 'RECEIVED')
    .slice(0, 4)
}
