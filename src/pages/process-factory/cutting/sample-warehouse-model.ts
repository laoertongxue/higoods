import {
  sampleWarehouseRecords,
  type SampleFlowHistoryItem,
  type SampleLocationStage,
  type SampleWarehouseRecord,
} from '../../../data/fcs/cutting/warehouse-management'
import type { OriginalCutOrderRow } from './original-orders-model'
import { buildWarehouseQueryPayload, type WarehouseNavigationPayload } from './warehouse-shared'

export type SampleWarehouseStatusKey = 'AVAILABLE' | 'BORROWED' | 'IN_FACTORY' | 'INSPECTION' | 'PENDING_RETURN'
export type SampleLocationType = 'cutting-room' | 'production-center' | 'factory' | 'inspection'

export interface SampleWarehouseStatusMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface SampleFlowRecord {
  flowRecordId: string
  sampleItemId: string
  fromLocationType: SampleLocationType
  fromLocationName: string
  toLocationType: SampleLocationType
  toLocationName: string
  actionType: string
  operatorName: string
  actionAt: string
  note: string
}

export interface SampleWarehouseItem {
  sampleItemId: string
  sampleNo: string
  styleCode: string
  spuCode: string
  color: string
  size: string
  currentLocationType: SampleLocationType
  currentLocationName: string
  currentHolder: string
  status: SampleWarehouseStatusMeta<SampleWarehouseStatusKey>
  lastMovedAt: string
  note: string
  relatedProductionOrderNo: string
  relatedOriginalCutOrderNo: string
  sampleName: string
  flowRecords: SampleFlowRecord[]
  navigationPayload: WarehouseNavigationPayload
  keywordIndex: string[]
}

export interface SampleWarehouseSummary {
  totalSampleCount: number
  availableCount: number
  borrowedCount: number
  inInspectionCount: number
  flowRecordCount: number
}

export interface SampleWarehouseFilters {
  keyword: string
  status: 'ALL' | SampleWarehouseStatusKey
  locationType: 'ALL' | SampleLocationType
  holder: string
}

export interface SampleWarehousePrefilter {
  styleCode?: string
  sampleNo?: string
  holder?: string
  status?: SampleWarehouseStatusKey
}

export interface SampleWarehouseViewModel {
  items: SampleWarehouseItem[]
  itemsById: Record<string, SampleWarehouseItem>
  summary: SampleWarehouseSummary
}

export const sampleLocationTypeLabel: Record<SampleLocationType, string> = {
  'cutting-room': '裁床现场',
  'production-center': '生产管理中心',
  factory: '工厂',
  inspection: '抽检',
}

export const sampleWarehouseStatusMeta: Record<SampleWarehouseStatusKey, { label: string; className: string; detailText: string }> = {
  AVAILABLE: { label: '在仓', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', detailText: '当前样衣在仓，可被裁床或生产管理中心调用。' },
  BORROWED: { label: '借出中', className: 'bg-sky-100 text-sky-700 border border-sky-200', detailText: '当前样衣已借出，等待归还。' },
  IN_FACTORY: { label: '在工厂', className: 'bg-violet-100 text-violet-700 border border-violet-200', detailText: '当前样衣在工厂侧使用或核价。' },
  INSPECTION: { label: '抽检中', className: 'bg-amber-100 text-amber-700 border border-amber-200', detailText: '当前样衣正处于抽检或回流检查状态。' },
  PENDING_RETURN: { label: '待归还', className: 'bg-rose-100 text-rose-700 border border-rose-200', detailText: '当前样衣超过建议归还时间，需尽快回仓。' },
}

function createSummaryMeta<Key extends string>(key: Key, label: string, className: string, detailText: string): SampleWarehouseStatusMeta<Key> {
  return { key, label, className, detailText }
}

function deriveLocationType(stage: SampleLocationStage): SampleLocationType {
  if (stage === 'CUTTING') return 'cutting-room'
  if (stage === 'FACTORY_CHECK') return 'factory'
  if (stage === 'RETURN_CHECK') return 'inspection'
  return 'production-center'
}

export function deriveSampleWarehouseStatus(record: SampleWarehouseRecord): SampleWarehouseStatusMeta<SampleWarehouseStatusKey> {
  if (record.currentLocationStage === 'FACTORY_CHECK') return createSummaryMeta('IN_FACTORY', sampleWarehouseStatusMeta.IN_FACTORY.label, sampleWarehouseStatusMeta.IN_FACTORY.className, sampleWarehouseStatusMeta.IN_FACTORY.detailText)
  if (record.currentLocationStage === 'RETURN_CHECK' || record.currentStatus === 'CHECKING') return createSummaryMeta('INSPECTION', sampleWarehouseStatusMeta.INSPECTION.label, sampleWarehouseStatusMeta.INSPECTION.className, sampleWarehouseStatusMeta.INSPECTION.detailText)
  if (record.currentStatus === 'WAITING_RETURN') return createSummaryMeta('PENDING_RETURN', sampleWarehouseStatusMeta.PENDING_RETURN.label, sampleWarehouseStatusMeta.PENDING_RETURN.className, sampleWarehouseStatusMeta.PENDING_RETURN.detailText)
  if (record.currentStatus === 'IN_USE') return createSummaryMeta('BORROWED', sampleWarehouseStatusMeta.BORROWED.label, sampleWarehouseStatusMeta.BORROWED.className, sampleWarehouseStatusMeta.BORROWED.detailText)
  return createSummaryMeta('AVAILABLE', sampleWarehouseStatusMeta.AVAILABLE.label, sampleWarehouseStatusMeta.AVAILABLE.className, sampleWarehouseStatusMeta.AVAILABLE.detailText)
}

function mapFlowRecord(
  sampleItemId: string,
  item: SampleFlowHistoryItem,
  index: number,
  previous: SampleFlowHistoryItem | null,
): SampleFlowRecord {
  const fromType = previous ? deriveLocationType(previous.stage) : deriveLocationType(item.stage)
  const toType = deriveLocationType(item.stage)
  return {
    flowRecordId: `${sampleItemId}-flow-${index + 1}`,
    sampleItemId,
    fromLocationType: fromType,
    fromLocationName: sampleLocationTypeLabel[fromType],
    toLocationType: toType,
    toLocationName: sampleLocationTypeLabel[toType],
    actionType: item.actionText,
    operatorName: item.operatedBy,
    actionAt: item.operatedAt,
    note: item.note,
  }
}

export function buildSampleFlowTimeline(record: SampleWarehouseRecord): SampleFlowRecord[] {
  return record.flowHistory.map((item, index) => mapFlowRecord(record.id, item, index, index > 0 ? record.flowHistory[index - 1] : null))
}

export function buildSampleWarehouseNavigationPayload(item: Pick<SampleWarehouseItem, 'relatedOriginalCutOrderNo' | 'relatedProductionOrderNo' | 'styleCode' | 'sampleNo' | 'currentHolder' | 'status'>): WarehouseNavigationPayload {
  return buildWarehouseQueryPayload({
    originalCutOrderNo: item.relatedOriginalCutOrderNo,
    productionOrderNo: item.relatedProductionOrderNo,
    styleCode: item.styleCode,
    sampleNo: item.sampleNo,
    holder: item.currentHolder,
    warehouseStatus: item.status.key,
  })
}

export function buildSampleWarehouseViewModel(originalRows: OriginalCutOrderRow[], records = sampleWarehouseRecords): SampleWarehouseViewModel {
  const rowByOrderNo = Object.fromEntries(originalRows.map((row) => [row.originalCutOrderNo, row]))
  const items = records
    .map((record) => {
      const row = rowByOrderNo[record.relatedCutPieceOrderNo]
      const status = deriveSampleWarehouseStatus(record)
      const item: SampleWarehouseItem = {
        sampleItemId: record.id,
        sampleNo: record.sampleNo,
        styleCode: row?.styleCode || '',
        spuCode: row?.spuCode || '',
        color: row?.color || '待补颜色',
        size: '均码',
        currentLocationType: deriveLocationType(record.currentLocationStage),
        currentLocationName: sampleLocationTypeLabel[deriveLocationType(record.currentLocationStage)],
        currentHolder: record.currentHolder,
        status,
        lastMovedAt: record.latestActionAt,
        note: record.nextSuggestedAction,
        relatedProductionOrderNo: record.relatedProductionOrderNo,
        relatedOriginalCutOrderNo: record.relatedCutPieceOrderNo,
        sampleName: record.sampleName,
        flowRecords: buildSampleFlowTimeline(record),
        navigationPayload: buildSampleWarehouseNavigationPayload({
          relatedOriginalCutOrderNo: record.relatedCutPieceOrderNo,
          relatedProductionOrderNo: record.relatedProductionOrderNo,
          styleCode: row?.styleCode || '',
          sampleNo: record.sampleNo,
          currentHolder: record.currentHolder,
          status,
        }),
        keywordIndex: [record.sampleNo, row?.styleCode, row?.spuCode, record.currentHolder, record.relatedProductionOrderNo, record.sampleName].filter(Boolean).map((value) => String(value).toLowerCase()),
      }
      return item
    })
    .sort((left, right) => right.lastMovedAt.localeCompare(left.lastMovedAt, 'zh-CN'))

  return {
    items,
    itemsById: Object.fromEntries(items.map((item) => [item.sampleItemId, item])),
    summary: {
      totalSampleCount: items.length,
      availableCount: items.filter((item) => item.status.key === 'AVAILABLE').length,
      borrowedCount: items.filter((item) => item.status.key === 'BORROWED' || item.status.key === 'PENDING_RETURN' || item.status.key === 'IN_FACTORY').length,
      inInspectionCount: items.filter((item) => item.status.key === 'INSPECTION').length,
      flowRecordCount: items.reduce((sum, item) => sum + item.flowRecords.length, 0),
    },
  }
}

export function filterSampleWarehouseItems(
  items: SampleWarehouseItem[],
  filters: SampleWarehouseFilters,
  prefilter: SampleWarehousePrefilter | null,
): SampleWarehouseItem[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return items.filter((item) => {
    if (prefilter?.styleCode && item.styleCode !== prefilter.styleCode) return false
    if (prefilter?.sampleNo && item.sampleNo !== prefilter.sampleNo) return false
    if (prefilter?.holder && !item.currentHolder.includes(prefilter.holder)) return false
    if (prefilter?.status && item.status.key !== prefilter.status) return false
    if (filters.status !== 'ALL' && item.status.key !== filters.status) return false
    if (filters.locationType !== 'ALL' && item.currentLocationType !== filters.locationType) return false
    if (filters.holder && !item.currentHolder.toLowerCase().includes(filters.holder.toLowerCase())) return false
    if (!keyword) return true
    return item.keywordIndex.some((value) => value.includes(keyword))
  })
}

export function findSampleWarehouseByPrefilter(items: SampleWarehouseItem[], prefilter: SampleWarehousePrefilter | null): SampleWarehouseItem | null {
  if (!prefilter) return null
  return (
    (prefilter.sampleNo && items.find((item) => item.sampleNo === prefilter.sampleNo)) ||
    (prefilter.styleCode && items.find((item) => item.styleCode === prefilter.styleCode)) ||
    null
  )
}
