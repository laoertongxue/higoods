import type {
  CuttingMaterialPrepFilters,
  CuttingMaterialPrepGroup,
  CuttingMaterialPrepLine,
  CuttingDiscrepancyStatus,
  CuttingReceiveResultStatus,
} from '../../../data/fcs/cutting/material-prep'
import type {
  CuttingConfigStatus,
  CuttingMaterialType,
  CuttingPrintSlipStatus,
  CuttingQrStatus,
  CuttingReceiveStatus,
  CuttingReviewStatus,
} from '../../../data/fcs/cutting/types'

export const materialTypeMeta: Record<CuttingMaterialType, { label: string; className: string }> = {
  PRINT: { label: '印花面料', className: 'bg-fuchsia-100 text-fuchsia-700' },
  DYE: { label: '染色面料', className: 'bg-sky-100 text-sky-700' },
  SOLID: { label: '净色面料', className: 'bg-emerald-100 text-emerald-700' },
  LINING: { label: '里布', className: 'bg-slate-100 text-slate-700' },
}

export const reviewMeta: Record<CuttingReviewStatus, { label: string; className: string }> = {
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

export const printMeta: Record<CuttingPrintSlipStatus, { label: string; className: string }> = {
  NOT_PRINTED: { label: '未打印', className: 'bg-slate-100 text-slate-700' },
  PRINTED: { label: '已打印', className: 'bg-blue-100 text-blue-700' },
}

export const qrMeta: Record<CuttingQrStatus, { label: string; className: string }> = {
  NOT_GENERATED: { label: '未生成二维码', className: 'bg-slate-100 text-slate-700' },
  GENERATED: { label: '已生成二维码', className: 'bg-violet-100 text-violet-700' },
}

export const discrepancyMeta: Record<CuttingDiscrepancyStatus, { label: string; className: string }> = {
  NONE: { label: '无差异', className: 'bg-slate-100 text-slate-700' },
  RECHECK_REQUIRED: { label: '待核对', className: 'bg-rose-100 text-rose-700' },
  PHOTO_SUBMITTED: { label: '已提交照片', className: 'bg-cyan-100 text-cyan-700' },
}

export const receiveResultMeta: Record<CuttingReceiveResultStatus, { label: string; className: string }> = {
  MATCHED: { label: '匹配', className: 'bg-emerald-100 text-emerald-700' },
  RECHECK: { label: '驳回核对', className: 'bg-rose-100 text-rose-700' },
  PHOTO_SUBMITTED: { label: '带照片提交', className: 'bg-cyan-100 text-cyan-700' },
}

const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatQty(value: number): string {
  return numberFormatter.format(value)
}

export function formatLength(value: number): string {
  return `${numberFormatter.format(value)} 米`
}

export function buildReviewSummary(line: CuttingMaterialPrepLine): string {
  if (line.reviewStatus === 'NOT_REQUIRED') return '当前面料无需仓库审核。'
  return `已审 ${line.reviewedRollCount}/${line.demandRollCount} 卷 · ${formatLength(line.reviewedLength)}/${formatLength(line.demandLength)}`
}

export function buildConfigSummary(line: CuttingMaterialPrepLine): string {
  return `已配 ${line.configuredRollCount}/${line.demandRollCount} 卷 · 剩余 ${Math.max(line.demandRollCount - line.configuredRollCount, 0)} 卷`
}

export function buildReceiveSummary(line: CuttingMaterialPrepLine): string {
  return `已领 ${line.receivedRollCount}/${line.configuredRollCount || line.demandRollCount} 卷 · ${formatLength(line.receivedLength)}`
}

function matchLineRisk(line: CuttingMaterialPrepLine, riskFilter: CuttingMaterialPrepFilters['riskFilter']): boolean {
  if (riskFilter === 'ALL') return true
  if (riskFilter === 'DIFF_ONLY') return line.discrepancyStatus !== 'NONE'
  if (riskFilter === 'REVIEW_ONLY') return line.reviewStatus === 'PENDING' || line.reviewStatus === 'PARTIAL'
  if (riskFilter === 'RECEIVE_ONLY') return line.receiveStatus !== 'RECEIVED'
  return true
}

function matchLineStatus(line: CuttingMaterialPrepLine, filters: CuttingMaterialPrepFilters): boolean {
  const materialTypeOk = filters.materialType === 'ALL' || line.materialType === filters.materialType
  const reviewOk = filters.reviewStatus === 'ALL' || line.reviewStatus === filters.reviewStatus
  const configOk = filters.configStatus === 'ALL' || line.configStatus === filters.configStatus
  const receiveOk = filters.receiveStatus === 'ALL' || line.receiveStatus === filters.receiveStatus
  const riskOk = matchLineRisk(line, filters.riskFilter)
  return materialTypeOk && reviewOk && configOk && receiveOk && riskOk
}

export function filterMaterialPrepGroups(
  groups: CuttingMaterialPrepGroup[],
  filters: CuttingMaterialPrepFilters,
): CuttingMaterialPrepGroup[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return groups
    .map((group) => {
      const groupMatched =
        keyword.length === 0 ||
        group.productionOrderNo.toLowerCase().includes(keyword) ||
        group.cuttingTaskNo.toLowerCase().includes(keyword) ||
        group.assignedFactoryName.toLowerCase().includes(keyword)

      const lines = group.materialLines.filter((line) => {
        const keywordMatched =
          groupMatched ||
          line.cutPieceOrderNo.toLowerCase().includes(keyword) ||
          line.materialSku.toLowerCase().includes(keyword) ||
          line.materialLabel.toLowerCase().includes(keyword)
        return keywordMatched && matchLineStatus(line, filters)
      })

      return {
        ...group,
        materialLines: lines,
      }
    })
    .filter((group) => group.materialLines.length > 0)
}

export interface MaterialPrepSummary {
  pendingConfigCount: number
  partialConfigCount: number
  qrReadyCount: number
  pendingReceiveCount: number
  receiveDoneCount: number
  discrepancyCount: number
}

export function buildMaterialPrepSummary(groups: CuttingMaterialPrepGroup[]): MaterialPrepSummary {
  const cutPieceMap = new Map<string, CuttingMaterialPrepLine[]>()
  groups.forEach((group) => {
    group.materialLines.forEach((line) => {
      const bucket = cutPieceMap.get(line.cutPieceOrderNo) ?? []
      bucket.push(line)
      cutPieceMap.set(line.cutPieceOrderNo, bucket)
    })
  })

  let pendingConfigCount = 0
  let partialConfigCount = 0
  let qrReadyCount = 0
  let pendingReceiveCount = 0
  let receiveDoneCount = 0
  let discrepancyCount = 0

  cutPieceMap.forEach((lines) => {
    const configStatus = deriveCutPieceConfigStatus(lines)
    const receiveStatus = deriveCutPieceReceiveStatus(lines)
    const hasQr = lines.some((line) => line.qrStatus === 'GENERATED' || line.configuredRollCount > 0 || line.configuredLength > 0)
    const hasDiscrepancy = lines.some((line) => line.discrepancyStatus !== 'NONE')

    if (configStatus === 'NOT_CONFIGURED') pendingConfigCount += 1
    if (configStatus === 'PARTIAL') partialConfigCount += 1
    if (hasQr) qrReadyCount += 1
    if (receiveStatus === 'NOT_RECEIVED') pendingReceiveCount += 1
    if (receiveStatus === 'RECEIVED') receiveDoneCount += 1
    if (hasDiscrepancy) discrepancyCount += 1
  })

  return {
    pendingConfigCount,
    partialConfigCount,
    qrReadyCount,
    pendingReceiveCount,
    receiveDoneCount,
    discrepancyCount,
  }
}

export function deriveCutPieceConfigStatus(lines: CuttingMaterialPrepLine[]): CuttingConfigStatus {
  if (lines.every((line) => line.configuredRollCount >= line.demandRollCount || line.configuredLength >= line.demandLength)) {
    return 'CONFIGURED'
  }
  if (lines.some((line) => line.configuredRollCount > 0 || line.configuredLength > 0)) {
    return 'PARTIAL'
  }
  return 'NOT_CONFIGURED'
}

export function deriveCutPieceReceiveStatus(lines: CuttingMaterialPrepLine[]): CuttingReceiveStatus {
  if (lines.every((line) => line.receivedRollCount >= line.configuredRollCount && line.configuredRollCount > 0)) {
    return 'RECEIVED'
  }
  if (lines.some((line) => line.receivedRollCount > 0 || line.receivedLength > 0)) {
    return 'PARTIAL'
  }
  return 'NOT_RECEIVED'
}

export function buildGroupConfigSummary(group: CuttingMaterialPrepGroup): string {
  const configured = group.materialLines.filter((line) => line.configStatus === 'CONFIGURED').length
  const partial = group.materialLines.filter((line) => line.configStatus === 'PARTIAL').length
  return `已配置 ${configured} 条 · 部分配置 ${partial} 条`
}

export function buildGroupReceiveSummary(group: CuttingMaterialPrepGroup): string {
  const received = group.materialLines.filter((line) => line.receiveStatus === 'RECEIVED').length
  const partial = group.materialLines.filter((line) => line.receiveStatus === 'PARTIAL').length
  return `领料成功 ${received} 条 · 部分领料 ${partial} 条`
}

export function buildGroupRiskFlags(group: CuttingMaterialPrepGroup): string[] {
  const flags = new Set<string>()
  group.materialLines.forEach((line) => {
    if (line.reviewStatus === 'PENDING' || line.reviewStatus === 'PARTIAL') flags.add('待审核')
    if (line.configStatus === 'PARTIAL') flags.add('部分配置')
    if (line.receiveStatus !== 'RECEIVED') flags.add('待领料')
    if (line.discrepancyStatus === 'RECHECK_REQUIRED') flags.add('待核对')
    if (line.discrepancyStatus === 'PHOTO_SUBMITTED') flags.add('已提交照片')
    if (line.issueFlags.includes('待补料')) flags.add('待补料')
    if (line.issueFlags.includes('待入仓')) flags.add('待入仓')
  })
  return Array.from(flags)
}

export function buildBatchCoverageSummary(line: CuttingMaterialPrepLine): string {
  if (!line.configBatches.length) return '尚未生成配料批次。'
  const pending = line.configBatches.filter((batch) => !batch.printIncluded).length
  return pending ? `当前有 ${pending} 笔本次配料待打印。` : `共 ${line.configBatches.length} 笔配料批次，均已进入打印记录。`
}

export function getPendingPrintBatches(line: CuttingMaterialPrepLine) {
  const pending = line.configBatches.filter((batch) => !batch.printIncluded)
  return pending.length ? pending : line.configBatches.slice(-1)
}

export function buildEmptyStateText(filters: CuttingMaterialPrepFilters): string {
  if (filters.riskFilter !== 'ALL') return '当前筛选条件下暂无需要跟进的配料差异或待处理单据。'
  return '当前筛选条件下暂无匹配的仓库配料记录。'
}
