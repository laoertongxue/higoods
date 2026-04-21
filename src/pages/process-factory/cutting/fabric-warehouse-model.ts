import type { CuttingMaterialType } from '../../../data/fcs/cutting/types'
import {
  listFormalFabricWarehouseRecords,
  type CuttingFabricStockRecord,
  type CuttingFabricStockStatus,
} from '../../../data/fcs/cutting/warehouse-runtime'
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
  fabricRollId: string
  fabricRollNo: string
  rollNo: string
  rollBarcode: string
  batchNo: string
  batchSeqNo: string
  materialSku: string
  materialSpuNameCn: string
  fabricColor: string
  width: number
  labeledLength: number
  actualLength: number
  lengthUnit: string
  remainingLength: number
  sourceProcessType: 'RAW' | 'PRINT' | 'DYE'
  sourceProcessOrderNo: string
  currentAreaName: string
  status: 'IN_STOCK' | 'USED'
  locationHint: string
  note: string
  sourceOriginalCutOrderNo: string
  sourceProductionOrderNo: string
}

export interface FabricWarehouseStockItem {
  stockItemId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
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
  originalCutOrderId?: string
  originalCutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
  rollNo?: string
}

export interface FabricWarehouseViewModel {
  items: FabricWarehouseStockItem[]
  itemsById: Record<string, FabricWarehouseStockItem>
  summary: FabricWarehouseSummary
}

export const fabricWarehouseMaterialMeta: Record<CuttingMaterialType, { label: string; className: string; widthHint: number }> = {
  PRINT: { label: '面料', className: 'bg-slate-50 text-slate-700 border border-slate-200', widthHint: 120 },
  DYE: { label: '面料', className: 'bg-slate-50 text-slate-700 border border-slate-200', widthHint: 120 },
  SOLID: { label: '面料', className: 'bg-slate-50 text-slate-700 border border-slate-200', widthHint: 120 },
  LINING: { label: '里布', className: 'bg-amber-50 text-amber-700 border border-amber-200', widthHint: 92 },
}

export const fabricWarehouseStatusMeta: Record<CuttingFabricStockStatus, { label: string; className: string }> = {
  READY: { label: '可用', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  PARTIAL_USED: { label: '已领料', className: 'bg-sky-100 text-sky-700 border border-sky-200' },
  NEED_RECHECK: { label: '待审核', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
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
    const sourceProcessType = record.materialType === 'PRINT' ? 'PRINT' : record.materialType === 'DYE' ? 'DYE' : 'RAW'
    const materialSpuNameCn = materialNameFromLabel(record.materialLabel)
    return {
      rollItemId: `${record.id}-roll-${sequence}`,
      stockItemId: record.id,
      fabricRollId: `${record.id}-roll-${sequence}`,
      fabricRollNo: `${record.materialSku}-R${String(sequence).padStart(2, '0')}`,
      rollNo: `${record.materialSku}-R${String(sequence).padStart(2, '0')}`,
      rollBarcode: `RB-${record.materialSku}-${String(sequence).padStart(3, '0')}`,
      batchNo: record.mergeBatchNo || record.originalCutOrderNo,
      batchSeqNo: String(sequence).padStart(2, '0'),
      materialSku: record.materialSku,
      materialSpuNameCn,
      fabricColor: record.materialLabel.split('·')[1]?.trim() || '待补',
      width,
      labeledLength: avgLength,
      actualLength: inStock ? avgRemaining : avgLength,
      lengthUnit: '米',
      remainingLength: inStock ? avgRemaining : 0,
      sourceProcessType,
      sourceProcessOrderNo: sourceProcessType === 'RAW' ? record.originalCutOrderNo : record.originalCutOrderNo,
      currentAreaName: inStock ? 'A区' : '已领料',
      status: inStock ? 'IN_STOCK' : 'USED',
      locationHint: inStock ? 'A区' : '已领料',
      note: record.note,
      sourceOriginalCutOrderNo: record.originalCutOrderNo,
      sourceProductionOrderNo: record.productionOrderNo,
    }
  })
}

export function deriveFabricWarehouseRiskTags(records: CuttingFabricStockRecord[]): FabricWarehouseRiskTag[] {
  const tags: FabricWarehouseRiskTag[] = []
  if (records.some((record) => record.fabricState === 'NEED_RECHECK')) {
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

function buildStockStatus(record: CuttingFabricStockRecord): CuttingFabricStockStatus {
  return record.fabricState
}

function findBoundOriginalRow(
  record: CuttingFabricStockRecord,
  originalRows: OriginalCutOrderRow[],
): OriginalCutOrderRow | null {
  return (
    originalRows.find((row) => row.originalCutOrderId === record.originalCutOrderId) ||
    originalRows.find((row) => row.originalCutOrderNo === record.originalCutOrderNo) ||
    null
  )
}

export function buildFabricWarehouseNavigationPayload(
  item: Pick<
    FabricWarehouseStockItem,
    | 'materialSku'
    | 'originalCutOrderId'
    | 'originalCutOrderNo'
    | 'productionOrderId'
    | 'productionOrderNo'
    | 'mergeBatchId'
    | 'mergeBatchNo'
  >,
): WarehouseNavigationPayload {
  return buildWarehouseQueryPayload({
    materialSku: item.materialSku,
    originalCutOrderId: item.originalCutOrderId || undefined,
    originalCutOrderNo: item.originalCutOrderNo || undefined,
    productionOrderId: item.productionOrderId || undefined,
    productionOrderNo: item.productionOrderNo || undefined,
    mergeBatchId: item.mergeBatchId || undefined,
    mergeBatchNo: item.mergeBatchNo || undefined,
  })
}

export function buildFabricWarehouseViewModel(
  originalRows: OriginalCutOrderRow[],
  records = listFormalFabricWarehouseRecords(),
): FabricWarehouseViewModel {
  const items = records
    .map((record) => {
      const row = findBoundOriginalRow(record, originalRows)
      const rolls = buildRolls(record)
      const sourceOriginalCutOrderIds = [record.originalCutOrderId].filter(Boolean)
      const sourceOriginalCutOrderNos = [record.originalCutOrderNo].filter(Boolean)
      const sourceProductionOrderNos = [record.productionOrderNo].filter(Boolean)
      const item: FabricWarehouseStockItem = {
        stockItemId: record.id,
        originalCutOrderId: record.originalCutOrderId,
        originalCutOrderNo: record.originalCutOrderNo,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        mergeBatchId: row?.activeBatchId || record.mergeBatchId,
        mergeBatchNo: row?.activeBatchNo || record.mergeBatchNo,
        materialSku: record.materialSku,
        materialName: materialNameFromLabel(record.materialLabel),
        materialCategory: record.materialType,
        materialAttr: fabricWarehouseMaterialMeta[record.materialType].label,
        status: buildStockStatus(record),
        rollCount: rolls.length,
        configuredLengthTotal: record.configuredLength,
        remainingLengthTotal: record.remainingLength,
        widthSummary: buildWidthSummary([record]),
        sourceOriginalCutOrderIds,
        sourceOriginalCutOrderNos,
        sourceProductionOrderNos,
        lastUpdatedAt: record.latestReceiveAt || record.latestConfigAt,
        riskTags: deriveFabricWarehouseRiskTags([record]),
        rolls,
        navigationPayload: buildFabricWarehouseNavigationPayload({
          materialSku: record.materialSku,
          originalCutOrderId: record.originalCutOrderId,
          originalCutOrderNo: record.originalCutOrderNo,
          productionOrderId: record.productionOrderId,
          productionOrderNo: record.productionOrderNo,
          mergeBatchId: row?.activeBatchId || record.mergeBatchId,
          mergeBatchNo: row?.activeBatchNo || record.mergeBatchNo,
        }),
        keywordIndex: [
          record.materialSku,
          record.materialLabel,
          record.originalCutOrderId,
          record.originalCutOrderNo,
          record.productionOrderId,
          record.productionOrderNo,
          ...rolls.map((roll) => roll.rollNo),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase()),
      }
      return item
    })
    .sort(
      (left, right) =>
        right.remainingLengthTotal - left.remainingLengthTotal ||
        left.materialSku.localeCompare(right.materialSku, 'zh-CN') ||
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN'),
    )

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
    if (prefilter?.originalCutOrderId && item.originalCutOrderId !== prefilter.originalCutOrderId) return false
    if (prefilter?.originalCutOrderNo && item.originalCutOrderNo !== prefilter.originalCutOrderNo) return false
    if (prefilter?.productionOrderId && item.productionOrderId !== prefilter.productionOrderId) return false
    if (prefilter?.productionOrderNo && item.productionOrderNo !== prefilter.productionOrderNo) return false
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
    (prefilter.originalCutOrderId && items.find((item) => item.originalCutOrderId === prefilter.originalCutOrderId)) ||
    (prefilter.originalCutOrderNo && items.find((item) => item.originalCutOrderNo === prefilter.originalCutOrderNo)) ||
    (prefilter.productionOrderId && items.find((item) => item.productionOrderId === prefilter.productionOrderId)) ||
    (prefilter.productionOrderNo && items.find((item) => item.productionOrderNo === prefilter.productionOrderNo)) ||
    (prefilter.rollNo && items.find((item) => item.rolls.some((roll) => roll.rollNo === prefilter.rollNo))) ||
    null
  )
}
