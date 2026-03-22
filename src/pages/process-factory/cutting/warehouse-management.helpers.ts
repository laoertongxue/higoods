import type {
  CutPieceHandoverStatus,
  CutPieceInboundStatus,
  CutPieceWarehouseRecord,
  CuttingFabricStockRecord,
  CuttingFabricStockStatus,
  CutPieceZoneCode,
  SampleLocationStage,
  SampleWarehouseRecord,
  SampleWarehouseStatus,
  WarehouseAlertLevel,
  WarehouseAlertRecord,
  WarehouseManagementFilters,
} from '../../../data/fcs/cutting/warehouse-management'
import type { CuttingMaterialType } from '../../../data/fcs/cutting/types'

export const materialTypeMeta: Record<CuttingMaterialType, { label: string; className: string }> = {
  PRINT: { label: '印花面料', className: 'bg-fuchsia-50 text-fuchsia-700' },
  DYE: { label: '染色面料', className: 'bg-sky-50 text-sky-700' },
  SOLID: { label: '净色面料', className: 'bg-emerald-50 text-emerald-700' },
  LINING: { label: '里布', className: 'bg-amber-50 text-amber-700' },
}

export const stockStatusMeta: Record<CuttingFabricStockStatus, { label: string; className: string }> = {
  READY: { label: '库存正常', className: 'bg-emerald-50 text-emerald-700' },
  PARTIAL_USED: { label: '部分已用', className: 'bg-sky-50 text-sky-700' },
  NEED_RECHECK: { label: '待核对', className: 'bg-rose-50 text-rose-700' },
}

export const zoneMeta: Record<CutPieceZoneCode, { label: string; className: string }> = {
  A: { label: 'A 区', className: 'bg-blue-50 text-blue-700' },
  B: { label: 'B 区', className: 'bg-violet-50 text-violet-700' },
  C: { label: 'C 区', className: 'bg-amber-50 text-amber-700' },
  UNASSIGNED: { label: '未分配', className: 'bg-rose-50 text-rose-700' },
}

export const inboundStatusMeta: Record<CutPieceInboundStatus, { label: string; className: string }> = {
  PENDING_INBOUND: { label: '待入仓', className: 'bg-slate-100 text-slate-700' },
  INBOUNDED: { label: '已入仓', className: 'bg-emerald-50 text-emerald-700' },
  WAITING_HANDOVER: { label: '待发后道', className: 'bg-amber-50 text-amber-700' },
  HANDED_OVER: { label: '已交接后道', className: 'bg-sky-50 text-sky-700' },
}

export const handoverStatusMeta: Record<CutPieceHandoverStatus, { label: string; className: string }> = {
  WAITING_HANDOVER: { label: '待发后道', className: 'bg-amber-50 text-amber-700' },
  HANDED_OVER: { label: '已交接后道', className: 'bg-sky-50 text-sky-700' },
}

export const sampleStageMeta: Record<SampleLocationStage, string> = {
  DESIGN_CENTER: '设计中心',
  CUTTING: '裁床现场',
  PMC_WAREHOUSE: 'PMC 仓库',
  FACTORY_CHECK: '工厂核价',
  RETURN_CHECK: '回货抽检',
  BACK_TO_PMC: '回 PMC 仓库',
}

export const sampleStatusMeta: Record<SampleWarehouseStatus, { label: string; className: string }> = {
  IN_USE: { label: '使用中', className: 'bg-sky-50 text-sky-700' },
  WAITING_RETURN: { label: '待归还', className: 'bg-amber-50 text-amber-700' },
  AVAILABLE: { label: '可调用', className: 'bg-emerald-50 text-emerald-700' },
  CHECKING: { label: '抽检中', className: 'bg-violet-50 text-violet-700' },
}

export const alertLevelMeta: Record<WarehouseAlertLevel, { label: string; className: string }> = {
  HIGH: { label: '高优先', className: 'bg-rose-50 text-rose-700' },
  MEDIUM: { label: '中优先', className: 'bg-amber-50 text-amber-700' },
  LOW: { label: '低优先', className: 'bg-sky-50 text-sky-700' },
}

export function formatQty(value: number): string {
  return `${value.toLocaleString('zh-CN')} 卷`
}

export function formatLength(value: number): string {
  return `${value.toLocaleString('zh-CN')} m`
}

export function filterCuttingFabricStocks(
  records: CuttingFabricStockRecord[],
  filters: WarehouseManagementFilters['cuttingFabric'],
): CuttingFabricStockRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [record.productionOrderNo, record.cutPieceOrderNo, record.materialSku, record.materialLabel]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    const matchesType = filters.materialType === 'ALL' || record.materialType === filters.materialType
    const matchesStatus = filters.stockStatus === 'ALL' || record.stockStatus === filters.stockStatus
    return matchesKeyword && matchesType && matchesStatus
  })
}

export function filterCutPieceWarehouseRecords(
  records: CutPieceWarehouseRecord[],
  filters: WarehouseManagementFilters['cutPiece'],
): CutPieceWarehouseRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [record.productionOrderNo, record.cutPieceOrderNo, record.groupNo, record.locationLabel]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    const matchesZone = filters.zoneCode === 'ALL' || record.zoneCode === filters.zoneCode
    const matchesInbound = filters.inboundStatus === 'ALL' || record.inboundStatus === filters.inboundStatus
    const matchesHandover = filters.handoverStatus === 'ALL' || record.handoverStatus === filters.handoverStatus
    return matchesKeyword && matchesZone && matchesInbound && matchesHandover
  })
}

export function filterSampleWarehouseRecords(
  records: SampleWarehouseRecord[],
  filters: WarehouseManagementFilters['sample'],
): SampleWarehouseRecord[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const matchesKeyword =
      keyword.length === 0 ||
      [record.sampleNo, record.sampleName, record.relatedProductionOrderNo, record.relatedCutPieceOrderNo]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    const matchesStage = filters.stage === 'ALL' || record.currentLocationStage === filters.stage
    const matchesStatus = filters.status === 'ALL' || record.currentStatus === filters.status
    return matchesKeyword && matchesStage && matchesStatus
  })
}

export function buildWarehouseSummary(
  fabricStocks: CuttingFabricStockRecord[],
  cutPieceRecords: CutPieceWarehouseRecord[],
  sampleRecords: SampleWarehouseRecord[],
) {
  return {
    fabricRecheckCount: fabricStocks.filter((item) => item.stockStatus === 'NEED_RECHECK').length,
    pendingInboundCount: cutPieceRecords.filter((item) => item.inboundStatus === 'PENDING_INBOUND').length,
    inboundedCount: cutPieceRecords.filter((item) => item.inboundStatus !== 'PENDING_INBOUND').length,
    unassignedZoneCount: cutPieceRecords.filter((item) => item.zoneCode === 'UNASSIGNED').length,
    waitingReturnCount: sampleRecords.filter((item) => item.currentStatus === 'WAITING_RETURN').length,
    waitingHandoverCount: cutPieceRecords.filter((item) => item.handoverStatus === 'WAITING_HANDOVER').length,
  }
}

export function buildFabricSummary(records: CuttingFabricStockRecord[]) {
  const totalConfiguredLength = records.reduce((sum, item) => sum + item.configuredLength, 0)
  const totalRemainingLength = records.reduce((sum, item) => sum + item.remainingLength, 0)
  const recheckCount = records.filter((item) => item.stockStatus === 'NEED_RECHECK').length
  return { totalConfiguredLength, totalRemainingLength, recheckCount }
}

export function buildCutPieceSummary(records: CutPieceWarehouseRecord[]) {
  return {
    zoneACount: records.filter((item) => item.zoneCode === 'A').length,
    zoneBCount: records.filter((item) => item.zoneCode === 'B').length,
    zoneCCount: records.filter((item) => item.zoneCode === 'C').length,
    unassignedCount: records.filter((item) => item.zoneCode === 'UNASSIGNED').length,
  }
}

export function buildSampleSummary(records: SampleWarehouseRecord[]) {
  return {
    availableCount: records.filter((item) => item.currentStatus === 'AVAILABLE').length,
    inUseCount: records.filter((item) => item.currentStatus === 'IN_USE').length,
    waitingReturnCount: records.filter((item) => item.currentStatus === 'WAITING_RETURN').length,
    checkingCount: records.filter((item) => item.currentStatus === 'CHECKING').length,
  }
}

export function buildWarehouseEmptyText(view: 'fabric' | 'cutPiece' | 'sample', filtersApplied: boolean): string {
  if (!filtersApplied) {
    if (view === 'fabric') return '当前裁床仓没有待展示的库存记录。'
    if (view === 'cutPiece') return '当前裁片仓没有待展示的入仓记录。'
    return '当前样衣仓没有待展示的流转记录。'
  }

  if (view === 'fabric') return '未找到符合筛选条件的裁床仓库存记录。'
  if (view === 'cutPiece') return '未找到符合筛选条件的裁片仓记录。'
  return '未找到符合筛选条件的样衣流转记录。'
}

export function hasFabricFilters(filters: WarehouseManagementFilters['cuttingFabric']): boolean {
  return filters.keyword.trim().length > 0 || filters.materialType !== 'ALL' || filters.stockStatus !== 'ALL'
}

export function hasCutPieceFilters(filters: WarehouseManagementFilters['cutPiece']): boolean {
  return (
    filters.keyword.trim().length > 0 ||
    filters.zoneCode !== 'ALL' ||
    filters.inboundStatus !== 'ALL' ||
    filters.handoverStatus !== 'ALL'
  )
}

export function hasSampleFilters(filters: WarehouseManagementFilters['sample']): boolean {
  return filters.keyword.trim().length > 0 || filters.stage !== 'ALL' || filters.status !== 'ALL'
}

export function sortAlerts(records: WarehouseAlertRecord[]): WarehouseAlertRecord[] {
  const levelWeight: Record<WarehouseAlertLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return [...records].sort((a, b) => levelWeight[a.level] - levelWeight[b.level])
}
