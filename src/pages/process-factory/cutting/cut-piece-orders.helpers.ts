import type {
  CutPieceMarkerInfo,
  CutPieceOrderFilters,
  CutPieceOrderRecord,
  CutPieceSpreadingRecord,
} from '../../../data/fcs/cutting/cut-piece-orders'
import type { CuttingMaterialType } from '../../../data/fcs/cutting/types'

export const sizeLabelMap: Record<CutPieceMarkerInfo['sizeMix'][number]['size'], string> = {
  S: 'S',
  M: 'M',
  L: 'L',
  XL: 'XL',
  '2XL': '2XL',
  onesize: '均码',
  onesizeplus: '加大均码',
}

export const materialTypeMeta: Record<CuttingMaterialType, { label: string; className: string }> = {
  PRINT: { label: '印花面料', className: 'bg-fuchsia-100 text-fuchsia-700' },
  DYE: { label: '染色面料', className: 'bg-sky-100 text-sky-700' },
  SOLID: { label: '净色面料', className: 'bg-emerald-100 text-emerald-700' },
  LINING: { label: '里布', className: 'bg-slate-100 text-slate-700' },
}

export const configReceiveMeta = {
  NOT_CONFIGURED: { label: '未配置', className: 'bg-slate-100 text-slate-700' },
  PARTIAL: { label: '部分配置', className: 'bg-orange-100 text-orange-700' },
  CONFIGURED: { label: '已配置', className: 'bg-emerald-100 text-emerald-700' },
  NOT_RECEIVED: { label: '未领料', className: 'bg-slate-100 text-slate-700' },
  RECEIVED_PARTIAL: { label: '部分领料', className: 'bg-orange-100 text-orange-700' },
  RECEIVED: { label: '领料成功', className: 'bg-emerald-100 text-emerald-700' },
  NOT_PRINTED: { label: '未打印', className: 'bg-slate-100 text-slate-700' },
  PRINTED: { label: '已打印', className: 'bg-blue-100 text-blue-700' },
  NOT_GENERATED: { label: '未生成裁片单主码', className: 'bg-slate-100 text-slate-700' },
  GENERATED: { label: '已生成裁片单主码', className: 'bg-violet-100 text-violet-700' },
} as const

export const markerStatusMeta = {
  NOT_MAINTAINED: { label: '待维护唛架', className: 'bg-slate-100 text-slate-700' },
  MAINTAINED: { label: '已维护唛架', className: 'bg-sky-100 text-sky-700' },
  UPLOADED: { label: '已上传唛架图', className: 'bg-emerald-100 text-emerald-700' },
} as const

export const spreadingStatusMeta = {
  NOT_SPREAD: { label: '未铺布', className: 'bg-slate-100 text-slate-700' },
  SPREAD: { label: '已铺布', className: 'bg-emerald-100 text-emerald-700' },
} as const

export const inboundStatusMeta = {
  NOT_INBOUND: { label: '未入仓', className: 'bg-slate-100 text-slate-700' },
  INBOUND: { label: '已入仓', className: 'bg-emerald-100 text-emerald-700' },
} as const

export const discrepancyStatusMeta = {
  NONE: { label: '无差异', className: 'bg-slate-100 text-slate-700' },
  RECHECK_REQUIRED: { label: '待核对', className: 'bg-orange-100 text-orange-700' },
  PHOTO_SUBMITTED: { label: '已提交照片', className: 'bg-rose-100 text-rose-700' },
} as const

export const markerImageStatusMeta = {
  NOT_UPLOADED: { label: '待上传唛架图', className: 'bg-slate-100 text-slate-700' },
  UPLOADED: { label: '已上传唛架图', className: 'bg-emerald-100 text-emerald-700' },
} as const

export const riskMeta = {
  REPLENISHMENT: { label: '待补料', className: 'bg-rose-100 text-rose-700' },
  MISSING_MARKER: { label: '待上传唛架图', className: 'bg-amber-100 text-amber-700' },
  RECEIVE_DIFF: { label: '领料差异', className: 'bg-orange-100 text-orange-700' },
  NOT_SPREAD: { label: '待铺布', className: 'bg-sky-100 text-sky-700' },
  NOT_INBOUND: { label: '待入仓', className: 'bg-violet-100 text-violet-700' },
  DATA_PENDING: { label: '数据待回写', className: 'bg-slate-100 text-slate-700' },
} as const

export const linkedDocTypeMeta = {
  PICKUP_SLIP: '领料单',
  CONFIG_BATCH: '配料批次',
  PICKUP_RECORD: '领料记录',
  REPLENISHMENT: '补料单',
  INBOUND: '入仓记录',
} as const

const numberFormatter = new Intl.NumberFormat('zh-CN')

export function formatQty(value: number): string {
  return numberFormatter.format(value)
}

export function formatLength(value: number): string {
  return `${numberFormatter.format(value)} 米`
}

export function calculateMarkerTotalPieces(sizeMix: CutPieceMarkerInfo['sizeMix']): number {
  return sizeMix.reduce((sum, item) => sum + item.qty, 0)
}

export function deriveMarkerStatus(record: CutPieceOrderRecord): keyof typeof markerStatusMeta {
  if (record.markerInfo.markerImageStatus === 'UPLOADED') return 'UPLOADED'
  if (record.markerInfo.totalPieces > 0 || record.markerInfo.netLength > 0 || record.markerInfo.perPieceConsumption > 0) return 'MAINTAINED'
  return 'NOT_MAINTAINED'
}

export function deriveSpreadingStatus(record: CutPieceOrderRecord): keyof typeof spreadingStatusMeta {
  return record.spreadingRecords.length > 0 ? 'SPREAD' : 'NOT_SPREAD'
}

export function deriveInboundStatus(record: CutPieceOrderRecord): keyof typeof inboundStatusMeta {
  return record.hasInboundRecord ? 'INBOUND' : 'NOT_INBOUND'
}

export function buildRiskFlags(record: CutPieceOrderRecord): Array<keyof typeof riskMeta> {
  const flags = new Set<keyof typeof riskMeta>()
  if (record.hasReplenishmentRisk) flags.add('REPLENISHMENT')
  if (record.markerInfo.markerImageStatus !== 'UPLOADED') flags.add('MISSING_MARKER')
  if (record.discrepancyStatus !== 'NONE') flags.add('RECEIVE_DIFF')
  if (record.spreadingRecords.length === 0) flags.add('NOT_SPREAD')
  if (!record.hasInboundRecord) flags.add('NOT_INBOUND')
  if (!record.latestSpreadingAt) flags.add('DATA_PENDING')
  return Array.from(flags)
}

export function totalSpreadingLength(records: CutPieceSpreadingRecord[]): number {
  return records.reduce((sum, item) => sum + item.calculatedRollLength, 0)
}

export function filterCutPieceOrders(records: CutPieceOrderRecord[], filters: CutPieceOrderFilters): CutPieceOrderRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const keywordMatched =
      keyword.length === 0 ||
      record.productionOrderNo.toLowerCase().includes(keyword) ||
      record.cutPieceOrderNo.toLowerCase().includes(keyword) ||
      record.materialSku.toLowerCase().includes(keyword)

    const materialTypeMatched = filters.materialType === 'ALL' || record.materialType === filters.materialType
    const markerMatched = filters.markerStatus === 'ALL' || deriveMarkerStatus(record) === filters.markerStatus
    const spreadingMatched = filters.spreadingStatus === 'ALL' || deriveSpreadingStatus(record) === filters.spreadingStatus
    const replenishmentMatched = filters.replenishmentRisk === 'ALL' || record.hasReplenishmentRisk
    const inboundMatched = filters.inboundStatus === 'ALL' || deriveInboundStatus(record) === filters.inboundStatus

    return keywordMatched && materialTypeMatched && markerMatched && spreadingMatched && replenishmentMatched && inboundMatched
  })
}

export interface CutPieceOrderSummary {
  pendingMarkerCount: number
  uploadedMarkerCount: number
  pendingSpreadCount: number
  spreadDoneCount: number
  replenishmentRiskCount: number
  pendingInboundCount: number
}

export function buildCutPieceOrderSummary(records: CutPieceOrderRecord[]): CutPieceOrderSummary {
  return {
    pendingMarkerCount: records.filter((item) => deriveMarkerStatus(item) === 'NOT_MAINTAINED').length,
    uploadedMarkerCount: records.filter((item) => item.markerInfo.markerImageStatus === 'UPLOADED').length,
    pendingSpreadCount: records.filter((item) => item.spreadingRecords.length === 0).length,
    spreadDoneCount: records.filter((item) => item.spreadingRecords.length > 0).length,
    replenishmentRiskCount: records.filter((item) => item.hasReplenishmentRisk).length,
    pendingInboundCount: records.filter((item) => !item.hasInboundRecord).length,
  }
}

export function buildConfigReceiveSummary(record: CutPieceOrderRecord): string {
  const configLabel = configReceiveMeta[record.configStatus].label
  const receiveLabel = record.receiveStatus === 'PARTIAL' ? configReceiveMeta.RECEIVED_PARTIAL.label : configReceiveMeta[record.receiveStatus].label
  return `${configLabel} / ${receiveLabel}`
}

export function buildMarkerSummary(record: CutPieceOrderRecord): string {
  return `${calculateMarkerTotalPieces(record.markerInfo.sizeMix)} 件 · 净长 ${formatLength(record.markerInfo.netLength)}`
}

export function buildSpreadingSummary(record: CutPieceOrderRecord): string {
  if (!record.spreadingRecords.length) return '暂无铺布记录'
  return `${record.spreadingRecords.length} 条记录 · 汇总 ${formatLength(totalSpreadingLength(record.spreadingRecords))}`
}

export function buildLinkedDocSummary(record: CutPieceOrderRecord): string {
  return `${record.linkedDocuments.length} 个关联单据`
}

export function buildMarkerMixSummary(markerInfo: CutPieceMarkerInfo): string {
  return markerInfo.sizeMix
    .filter((item) => item.qty > 0)
    .map((item) => `${sizeLabelMap[item.size]} × ${formatQty(item.qty)}`)
    .join(' / ')
}

export function buildEmptyStateText(filters: CutPieceOrderFilters): string {
  if (filters.replenishmentRisk === 'RISK_ONLY') return '暂无待补料裁片单'
  return '暂无匹配结果'
}
