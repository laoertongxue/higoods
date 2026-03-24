import type { CuttingMaterialType } from '../../../data/fcs/cutting/types'
import {
  cuttingFabricStockRecords,
  type CuttingFabricStockRecord,
  type CuttingFabricStockStatus,
} from '../../../data/fcs/cutting/warehouse-management'
import type { OriginalCutOrderRow } from './original-orders-model'
import { buildWarehouseQueryPayload, type WarehouseNavigationPayload } from './warehouse-shared'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type FabricWarehouseRiskKey = 'LOW_REMAINING' | 'STOCK_RECHECK' | 'WAITING_RECEIVE'

export interface FabricWarehouseRiskTag {
  key: FabricWarehouseRiskKey
  label: string
  className: string
}

export interface FabricWarehouseRollItem {
  rollItemId: string
  stockItemId: string
  rollNo: string
  width: number
  labeledLength: number
  remainingLength: number
  status: 'IN_STOCK' | 'USED'
  locationHint: string
  note: string
  sourceOriginalCutOrderNo: string
  sourceProductionOrderNo: string
}

export interface FabricWarehouseStockItem {
  stockItemId: string
  materialSku: string
  materialName: string
  materialCategory: string
  materialAttr: string
  status: CuttingFabricStockStatus
  rollCount: number
  configuredLengthTotal: number
  remainingLengthTotal: number
  widthSummary: string
  sourceOriginalCutOrderIds: string[]
  sourceOriginalCutOrderNos: string[]
  sourceProductionOrderNos: string[]
  lastUpdatedAt: string
  riskTags: FabricWarehouseRiskTag[]
  rolls: FabricWarehouseRollItem[]
  navigationPayload: WarehouseNavigationPayload
  keywordIndex: string[]
}

export interface FabricWarehouseSummary {
  stockItemCount: number
  rollCount: number
  configuredLengthTotal: number
  remainingLengthTotal: number
  lowRemainingItemCount: number
  abnormalItemCount: number
}

export interface FabricWarehouseFilters {
  keyword: string
  materialCategory: 'ALL' | CuttingMaterialType
  status: 'ALL' | CuttingFabricStockStatus
  risk: 'ALL' | FabricWarehouseRiskKey
  lowRemainingOnly: boolean
}

export interface FabricWarehousePrefilter {
  materialSku?: string
  originalCutOrderNo?: string
  productionOrderNo?: string
  rollNo?: string
}

export interface FabricWarehouseViewModel {
  items: FabricWarehouseStockItem[]
  itemsById: Record<string, FabricWarehouseStockItem>
  summary: FabricWarehouseSummary
}

export const fabricWarehouseMaterialMeta: Record<CuttingMaterialType, { label: string; className: string; widthHint: number }> = {
  PRINT: { label: '印花面料', className: 'bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200', widthHint: 148 },
  DYE: { label: '染色面料', className: 'bg-sky-50 text-sky-700 border border-sky-200', widthHint: 152 },
  SOLID: { label: '净色面料', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', widthHint: 160 },
  LINING: { label: '里布', className: 'bg-amber-50 text-amber-700 border border-amber-200', widthHint: 92 },
}

export const fabricWarehouseStatusMeta: Record<CuttingFabricStockStatus, { label: string; className: string }> = {
  READY: { label: '库存正常', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  PARTIAL_USED: { label: '部分已用', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
  NEED_RECHECK: { label: '待核对', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
}

export function formatFabricWarehouseLength(value: number): string {
  return `${numberFormatter.format(Math.max(value, 0))} m`
}

function materialNameFromLabel(label: string): string {
  const [, name] = label.split('·')
  return name?.trim() || label
}

function buildWidthSummary(records: CuttingFabricStockRecord[]): string {
  const widths = Array.from(new Set(records.map((record) => fabricWarehouseMaterialMeta[record.materialType].widthHint)))
  return widths.map((width) => `${width} cm`).join(' / ')
}

function buildRolls(record: CuttingFabricStockRecord): FabricWarehouseRollItem[] {
  const totalRolls = Math.max(record.configuredRollCount, 1)
  const remainingRollCount = Math.max(record.remainingRollCount, 0)
  const width = fabricWarehouseMaterialMeta[record.materialType].widthHint
  const avgLength = Number((record.configuredLength / totalRolls).toFixed(1))
  const avgRemaining = remainingRollCount > 0 ? Number((record.remainingLength / remainingRollCount).toFixed(1)) : 0

  return Array.from({ length: totalRolls }, (_, index) => {
    const sequence = index + 1
    const inStock = sequence <= remainingRollCount
    return {
      rollItemId: `${record.id}-roll-${sequence}`,
      stockItemId: record.materialSku,
      rollNo: `${record.materialSku}-R${String(sequence).padStart(2, '0')}`,
      width,
      labeledLength: avgLength,
      remainingLength: inStock ? avgRemaining : 0,
      status: inStock ? 'IN_STOCK' : 'USED',
      locationHint: inStock ? '裁床仓主架位' : '已领用 / 待回收位',
      note: record.note,
      sourceOriginalCutOrderNo: record.cutPieceOrderNo,
      sourceProductionOrderNo: record.productionOrderNo,
    }
  })
}

export function deriveFabricWarehouseRiskTags(records: CuttingFabricStockRecord[]): FabricWarehouseRiskTag[] {
  const tags: FabricWarehouseRiskTag[] = []
  if (records.some((record) => record.stockStatus === 'NEED_RECHECK')) {
    tags.push({ key: 'STOCK_RECHECK', label: '待核对', className: 'bg-rose-100 text-rose-700 border border-rose-200' })
  }
  if (records.some((record) => record.remainingLength > 0 && record.remainingLength <= 60)) {
    tags.push({ key: 'LOW_REMAINING', label: '低余量', className: 'bg-amber-100 text-amber-700 border border-amber-200' })
  }
  if (records.some((record) => !record.latestReceiveAt)) {
    tags.push({ key: 'WAITING_RECEIVE', label: '待领用', className: 'bg-sky-100 text-sky-700 border border-sky-200' })
  }
  return tags
}

function buildStockStatus(records: CuttingFabricStockRecord[]): CuttingFabricStockStatus {
  if (records.some((record) => record.stockStatus === 'NEED_RECHECK')) return 'NEED_RECHECK'
  if (records.some((record) => record.stockStatus === 'PARTIAL_USED')) return 'PARTIAL_USED'
  return 'READY'
}

export function buildFabricWarehouseNavigationPayload(item: Pick<FabricWarehouseStockItem, 'materialSku' | 'sourceOriginalCutOrderNos' | 'sourceProductionOrderNos'>): WarehouseNavigationPayload {
  return buildWarehouseQueryPayload({
    materialSku: item.materialSku,
    originalCutOrderNo: item.sourceOriginalCutOrderNos[0],
    productionOrderNo: item.sourceProductionOrderNos[0],
  })
}

export function buildFabricWarehouseViewModel(
  originalRows: OriginalCutOrderRow[],
  records = cuttingFabricStockRecords,
): FabricWarehouseViewModel {
  const originalRowsByNo = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderNo, row]))
  const grouped = new Map<string, CuttingFabricStockRecord[]>()

  records.forEach((record) => {
    const list = grouped.get(record.materialSku) || []
    list.push(record)
    grouped.set(record.materialSku, list)
  })

  const items = Array.from(grouped.entries())
    .map(([materialSku, records]) => {
      const representative = records[0]
      const mappedRows = records
        .map((record) => originalRowsByNo[record.cutPieceOrderNo])
        .filter((row): row is OriginalCutOrderRow => Boolean(row))
      const rolls = records.flatMap((record) => buildRolls(record))
      const riskTags = deriveFabricWarehouseRiskTags(records)
      const sourceOriginalCutOrderIds = mappedRows.map((row) => row.originalCutOrderId)
      const sourceOriginalCutOrderNos = Array.from(new Set(records.map((record) => record.cutPieceOrderNo)))
      const sourceProductionOrderNos = Array.from(new Set(records.map((record) => record.productionOrderNo)))
      const item: FabricWarehouseStockItem = {
        stockItemId: materialSku,
        materialSku,
        materialName: materialNameFromLabel(representative.materialLabel),
        materialCategory: representative.materialType,
        materialAttr: fabricWarehouseMaterialMeta[representative.materialType].label,
        status: buildStockStatus(records),
        rollCount: rolls.length,
        configuredLengthTotal: records.reduce((sum, record) => sum + record.configuredLength, 0),
        remainingLengthTotal: records.reduce((sum, record) => sum + record.remainingLength, 0),
        widthSummary: buildWidthSummary(records),
        sourceOriginalCutOrderIds,
        sourceOriginalCutOrderNos,
        sourceProductionOrderNos,
        lastUpdatedAt: records.map((record) => record.latestReceiveAt || record.latestConfigAt).sort().reverse()[0] || '',
        riskTags,
        rolls,
        navigationPayload: buildFabricWarehouseNavigationPayload({ materialSku, sourceOriginalCutOrderNos, sourceProductionOrderNos }),
        keywordIndex: [
          materialSku,
          representative.materialLabel,
          ...sourceOriginalCutOrderNos,
          ...sourceProductionOrderNos,
          ...rolls.map((roll) => roll.rollNo),
        ].map((value) => value.toLowerCase()),
      }
      return item
    })
    .sort((left, right) => right.remainingLengthTotal - left.remainingLengthTotal || left.materialSku.localeCompare(right.materialSku, 'zh-CN'))

  return {
    items,
    itemsById: Object.fromEntries(items.map((item) => [item.stockItemId, item])),
    summary: summarizeFabricWarehouseStocks(items),
  }
}

export function summarizeFabricWarehouseStocks(items: FabricWarehouseStockItem[]): FabricWarehouseSummary {
  return {
    stockItemCount: items.length,
    rollCount: items.reduce((sum, item) => sum + item.rollCount, 0),
    configuredLengthTotal: items.reduce((sum, item) => sum + item.configuredLengthTotal, 0),
    remainingLengthTotal: items.reduce((sum, item) => sum + item.remainingLengthTotal, 0),
    lowRemainingItemCount: items.filter((item) => item.riskTags.some((tag) => tag.key === 'LOW_REMAINING')).length,
    abnormalItemCount: items.filter((item) => item.riskTags.length > 0).length,
  }
}

export function filterFabricWarehouseItems(
  items: FabricWarehouseStockItem[],
  filters: FabricWarehouseFilters,
  prefilter: FabricWarehousePrefilter | null,
): FabricWarehouseStockItem[] {
  const keyword = filters.keyword.trim().toLowerCase()

  return items.filter((item) => {
    if (prefilter?.materialSku && item.materialSku !== prefilter.materialSku) return false
    if (prefilter?.originalCutOrderNo && !item.sourceOriginalCutOrderNos.includes(prefilter.originalCutOrderNo)) return false
    if (prefilter?.productionOrderNo && !item.sourceProductionOrderNos.includes(prefilter.productionOrderNo)) return false
    if (prefilter?.rollNo && !item.rolls.some((roll) => roll.rollNo === prefilter.rollNo)) return false
    if (filters.materialCategory !== 'ALL' && item.materialCategory !== filters.materialCategory) return false
    if (filters.status !== 'ALL' && item.status !== filters.status) return false
    if (filters.risk !== 'ALL' && !item.riskTags.some((tag) => tag.key === filters.risk)) return false
    if (filters.lowRemainingOnly && item.remainingLengthTotal > 60) return false
    if (!keyword) return true
    return item.keywordIndex.some((value) => value.includes(keyword))
  })
}

export function findFabricWarehouseByPrefilter(
  items: FabricWarehouseStockItem[],
  prefilter: FabricWarehousePrefilter | null,
): FabricWarehouseStockItem | null {
  if (!prefilter) return null
  return (
    (prefilter.materialSku && items.find((item) => item.materialSku === prefilter.materialSku)) ||
    (prefilter.originalCutOrderNo && items.find((item) => item.sourceOriginalCutOrderNos.includes(prefilter.originalCutOrderNo!))) ||
    (prefilter.productionOrderNo && items.find((item) => item.sourceProductionOrderNos.includes(prefilter.productionOrderNo!))) ||
    (prefilter.rollNo && items.find((item) => item.rolls.some((roll) => roll.rollNo === prefilter.rollNo))) ||
    null
  )
}
