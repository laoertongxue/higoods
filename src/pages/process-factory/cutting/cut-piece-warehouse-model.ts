import {
  cutPieceWarehouseRecords,
  type CutPieceHandoverStatus,
  type CutPieceInboundStatus,
  type CutPieceWarehouseRecord,
  type CutPieceZoneCode,
} from '../../../data/fcs/cutting/warehouse-management'
import type { OriginalCutOrderRow } from './original-orders-model'
import { buildWarehouseQueryPayload, type WarehouseNavigationPayload } from './warehouse-shared'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export type CutPieceWarehouseRiskKey = 'UNASSIGNED_ZONE' | 'WAITING_INBOUND' | 'WAITING_HANDOFF'

export interface CutPieceWarehouseRiskTag {
  key: CutPieceWarehouseRiskKey
  label: string
  className: string
}

export interface CutPieceWarehouseStatusMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface CutPieceWarehouseItem {
  warehouseItemId: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderNo: string
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  cuttingGroup: string
  zoneCode: CutPieceZoneCode
  locationCode: string
  quantity: number
  warehouseStatus: CutPieceWarehouseStatusMeta<'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'>
  handoffStatus: CutPieceWarehouseStatusMeta<CutPieceHandoverStatus>
  inWarehouseAt: string
  handoffTarget: string
  note: string
  riskTags: CutPieceWarehouseRiskTag[]
  navigationPayload: WarehouseNavigationPayload
  keywordIndex: string[]
}

export interface CutPieceWarehouseZoneSummary {
  zoneCode: CutPieceZoneCode
  itemCount: number
  quantityTotal: number
  cuttingGroupSummary: string
  occupancyStatus: string
}

export interface CutPieceWarehouseSummary {
  totalItemCount: number
  totalQuantity: number
  waitingInWarehouseCount: number
  inWarehouseCount: number
  waitingHandoffCount: number
  zoneCount: number
}

export interface CutPieceWarehouseFilters {
  keyword: string
  zoneCode: 'ALL' | CutPieceZoneCode
  cuttingGroup: string
  warehouseStatus: 'ALL' | 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'
  handoffOnly: boolean
  risk: 'ALL' | CutPieceWarehouseRiskKey
}

export interface CutPieceWarehousePrefilter {
  originalCutOrderNo?: string
  productionOrderNo?: string
  mergeBatchNo?: string
  cuttingGroup?: string
  zoneCode?: CutPieceZoneCode
  warehouseStatus?: 'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'
}

export interface CutPieceWarehouseViewModel {
  items: CutPieceWarehouseItem[]
  itemsById: Record<string, CutPieceWarehouseItem>
  zoneSummary: CutPieceWarehouseZoneSummary[]
  summary: CutPieceWarehouseSummary
}

export const cutPieceWarehouseZoneMeta: Record<CutPieceZoneCode, { label: string; className: string }> = {
  A: { label: 'A 区', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  B: { label: 'B 区', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  C: { label: 'C 区', className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  UNASSIGNED: { label: '未分配', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
}

export const cutPieceWarehouseStatusMeta: Record<'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER', { label: string; className: string; detailText: string }> = {
  PENDING_INBOUND: { label: '待入仓', className: 'bg-slate-100 text-slate-700 border border-slate-200', detailText: '当前裁片仍待入仓整理。' },
  INBOUNDED: { label: '已入仓', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', detailText: '当前裁片已进入裁片仓。' },
  WAITING_HANDOVER: { label: '待交接', className: 'bg-amber-100 text-amber-700 border border-amber-200', detailText: '当前裁片已入仓，待发后道。' },
  HANDED_OVER: { label: '已交接', className: 'bg-sky-100 text-sky-700 border border-sky-200', detailText: '当前裁片已完成后道交接。' },
}

export const cutPieceHandoverStatusMeta: Record<CutPieceHandoverStatus, { label: string; className: string; detailText: string }> = {
  WAITING_HANDOVER: { label: '待交接', className: 'bg-amber-100 text-amber-700 border border-amber-200', detailText: '待交接给后道或后续口袋流程。' },
  HANDED_OVER: { label: '已交接', className: 'bg-sky-100 text-sky-700 border border-sky-200', detailText: '已完成当前交接。' },
}

function parseQuantity(pieceSummary: string): number {
  const matched = pieceSummary.match(/(\d+)/)
  return matched ? Number(matched[1]) : 0
}

function createStatusMeta<Key extends string>(key: Key, label: string, className: string, detailText: string): CutPieceWarehouseStatusMeta<Key> {
  return { key, label, className, detailText }
}

export function deriveCutPieceWarehouseStatus(record: Pick<CutPieceWarehouseRecord, 'inboundStatus'>): CutPieceWarehouseStatusMeta<'PENDING_INBOUND' | 'INBOUNDED' | 'WAITING_HANDOVER' | 'HANDED_OVER'> {
  const meta = cutPieceWarehouseStatusMeta[record.inboundStatus]
  return createStatusMeta(record.inboundStatus, meta.label, meta.className, meta.detailText)
}

function deriveCutPieceHandoverStatus(record: Pick<CutPieceWarehouseRecord, 'handoverStatus'>): CutPieceWarehouseStatusMeta<CutPieceHandoverStatus> {
  const meta = cutPieceHandoverStatusMeta[record.handoverStatus]
  return createStatusMeta(record.handoverStatus, meta.label, meta.className, meta.detailText)
}

function deriveCutPieceRiskTags(record: CutPieceWarehouseRecord): CutPieceWarehouseRiskTag[] {
  const tags: CutPieceWarehouseRiskTag[] = []
  if (record.zoneCode === 'UNASSIGNED') tags.push({ key: 'UNASSIGNED_ZONE', label: '未分区', className: 'bg-rose-100 text-rose-700 border border-rose-200' })
  if (record.inboundStatus === 'PENDING_INBOUND') tags.push({ key: 'WAITING_INBOUND', label: '待入仓', className: 'bg-slate-100 text-slate-700 border border-slate-200' })
  if (record.handoverStatus === 'WAITING_HANDOVER') tags.push({ key: 'WAITING_HANDOFF', label: '待交接', className: 'bg-amber-100 text-amber-700 border border-amber-200' })
  return tags
}

export function buildCutPieceWarehouseNavigationPayload(item: Pick<CutPieceWarehouseItem, 'originalCutOrderNo' | 'productionOrderNo' | 'mergeBatchNo' | 'cuttingGroup' | 'zoneCode' | 'warehouseStatus' | 'styleCode'>): WarehouseNavigationPayload {
  return buildWarehouseQueryPayload({
    originalCutOrderNo: item.originalCutOrderNo,
    productionOrderNo: item.productionOrderNo,
    mergeBatchNo: item.mergeBatchNo || undefined,
    cuttingGroup: item.cuttingGroup,
    zoneCode: item.zoneCode,
    warehouseStatus: item.warehouseStatus.key,
    styleCode: item.styleCode,
  })
}

export function buildCutPieceWarehouseViewModel(originalRows: OriginalCutOrderRow[], records = cutPieceWarehouseRecords): CutPieceWarehouseViewModel {
  const rowByOrderNo = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderNo, row]))
  const items = records
    .map((record) => {
      const row = rowByOrderNo[record.cutPieceOrderNo]
      const item: CutPieceWarehouseItem = {
        warehouseItemId: record.id,
        originalCutOrderId: row?.originalCutOrderId || record.cutPieceOrderNo,
        originalCutOrderNo: record.cutPieceOrderNo,
        productionOrderNo: record.productionOrderNo,
        mergeBatchNo: row?.latestMergeBatchNo || '',
        styleCode: row?.styleCode || '',
        spuCode: row?.spuCode || '',
        cuttingGroup: record.groupNo,
        zoneCode: record.zoneCode,
        locationCode: record.locationLabel,
        quantity: parseQuantity(record.pieceSummary),
        warehouseStatus: deriveCutPieceWarehouseStatus(record),
        handoffStatus: deriveCutPieceHandoverStatus(record),
        inWarehouseAt: record.inboundAt,
        handoffTarget: record.handoverTarget,
        note: record.note,
        riskTags: deriveCutPieceRiskTags(record),
        navigationPayload: buildCutPieceWarehouseNavigationPayload({
          originalCutOrderNo: record.cutPieceOrderNo,
          productionOrderNo: record.productionOrderNo,
          mergeBatchNo: row?.latestMergeBatchNo || '',
          cuttingGroup: record.groupNo,
          zoneCode: record.zoneCode,
          warehouseStatus: record.inboundStatus,
          styleCode: row?.styleCode || '',
        }),
        keywordIndex: [record.cutPieceOrderNo, record.productionOrderNo, row?.styleCode, row?.spuCode, record.groupNo, record.locationLabel, row?.latestMergeBatchNo].filter(Boolean).map((value) => String(value).toLowerCase()),
      }
      return item
    })
    .sort((left, right) => left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN'))

  return {
    items,
    itemsById: Object.fromEntries(items.map((item) => [item.warehouseItemId, item])),
    zoneSummary: summarizeCutPieceWarehouseZones(items),
    summary: {
      totalItemCount: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      waitingInWarehouseCount: items.filter((item) => item.warehouseStatus.key === 'PENDING_INBOUND').length,
      inWarehouseCount: items.filter((item) => item.warehouseStatus.key !== 'PENDING_INBOUND').length,
      waitingHandoffCount: items.filter((item) => item.handoffStatus.key === 'WAITING_HANDOVER').length,
      zoneCount: new Set(items.map((item) => item.zoneCode)).size,
    },
  }
}

export function summarizeCutPieceWarehouseZones(items: CutPieceWarehouseItem[]): CutPieceWarehouseZoneSummary[] {
  return (['A', 'B', 'C', 'UNASSIGNED'] as CutPieceZoneCode[])
    .map((zoneCode) => {
      const zoneItems = items.filter((item) => item.zoneCode === zoneCode)
      return {
        zoneCode,
        itemCount: zoneItems.length,
        quantityTotal: zoneItems.reduce((sum, item) => sum + item.quantity, 0),
        cuttingGroupSummary: Array.from(new Set(zoneItems.map((item) => item.cuttingGroup))).slice(0, 3).join(' / ') || '待补',
        occupancyStatus: zoneItems.length ? (zoneCode === 'UNASSIGNED' ? '待整理' : '已使用') : '空位充足',
      }
    })
    .filter((zone) => zone.itemCount > 0 || zone.zoneCode !== 'UNASSIGNED')
}

export function filterCutPieceWarehouseItems(
  items: CutPieceWarehouseItem[],
  filters: CutPieceWarehouseFilters,
  prefilter: CutPieceWarehousePrefilter | null,
): CutPieceWarehouseItem[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return items.filter((item) => {
    if (prefilter?.originalCutOrderNo && item.originalCutOrderNo !== prefilter.originalCutOrderNo) return false
    if (prefilter?.productionOrderNo && item.productionOrderNo !== prefilter.productionOrderNo) return false
    if (prefilter?.mergeBatchNo && item.mergeBatchNo !== prefilter.mergeBatchNo) return false
    if (prefilter?.cuttingGroup && item.cuttingGroup !== prefilter.cuttingGroup) return false
    if (prefilter?.zoneCode && item.zoneCode !== prefilter.zoneCode) return false
    if (prefilter?.warehouseStatus && item.warehouseStatus.key !== prefilter.warehouseStatus) return false
    if (filters.zoneCode !== 'ALL' && item.zoneCode !== filters.zoneCode) return false
    if (filters.cuttingGroup && item.cuttingGroup !== filters.cuttingGroup) return false
    if (filters.warehouseStatus !== 'ALL' && item.warehouseStatus.key !== filters.warehouseStatus) return false
    if (filters.handoffOnly && item.handoffStatus.key !== 'WAITING_HANDOVER') return false
    if (filters.risk !== 'ALL' && !item.riskTags.some((tag) => tag.key === filters.risk)) return false
    if (!keyword) return true
    return item.keywordIndex.some((value) => value.includes(keyword))
  })
}

export function findCutPieceWarehouseByPrefilter(items: CutPieceWarehouseItem[], prefilter: CutPieceWarehousePrefilter | null): CutPieceWarehouseItem | null {
  if (!prefilter) return null
  return (
    (prefilter.originalCutOrderNo && items.find((item) => item.originalCutOrderNo === prefilter.originalCutOrderNo)) ||
    (prefilter.mergeBatchNo && items.find((item) => item.mergeBatchNo === prefilter.mergeBatchNo)) ||
    (prefilter.productionOrderNo && items.find((item) => item.productionOrderNo === prefilter.productionOrderNo)) ||
    null
  )
}

export function formatCutPieceQuantity(value: number): string {
  return `${numberFormatter.format(Math.max(value, 0))} 件`
}
