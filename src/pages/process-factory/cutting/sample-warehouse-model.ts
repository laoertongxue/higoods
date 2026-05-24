import {
  listFormalSampleWarehouseRecords,
  type SampleFlowHistoryItem,
  type SampleLocationStage,
  type SampleWarehouseRecord,
} from '../../../data/fcs/cutting/warehouse-runtime.ts'
import {
  listSampleWarehouseWritebacks,
  type SampleWarehouseActionType,
  type SampleWarehouseWritebackLocationType,
  type SampleWarehouseWritebackRecord,
} from '../../../data/fcs/cutting/warehouse-writeback-ledger.ts'
import type { CutOrderRow } from './cut-orders-model.ts'
import { buildWarehouseQueryPayload, type WarehouseNavigationPayload } from './warehouse-shared.ts'
import { getBrowserLocalStorage } from '../../../data/browser-storage.ts'

export type SampleWarehouseStatusKey = 'AVAILABLE' | 'BORROWED' | 'IN_FACTORY' | 'INSPECTION' | 'PENDING_RETURN'
export type SampleLocationType = 'cutting-room' | 'production-center' | 'factory' | 'inspection'
export type CuttingSampleStatusLabel = '在库' | '裁剪中使用' | '待归还' | '已归还' | '异常' | '已停用'
export type CuttingSampleUsageType = '裁床裁剪依据' | '工厂核价比对' | '回货抽检' | '其他'
export type SampleFlowType = '调入裁床' | '裁床使用' | '调出裁床' | '归还' | '异常登记'
export type SampleFlowStatus = '已完成' | '进行中' | '待确认'
export type SampleAbnormalType =
  | '样衣未到裁床'
  | '样衣版本不一致'
  | '样衣破损'
  | '样衣丢失'
  | '样衣未归还'
  | '样衣与纸样不一致'
  | '样衣与唛架方案不一致'
  | '其他异常'

export interface SampleWarehouseStatusMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface SampleFlowRecord {
  flowRecordId: string
  sampleItemId: string
  sampleId: string
  sampleNo: string
  fromLocationType: SampleLocationType
  fromLocationName: string
  fromHolder: string
  toLocationType: SampleLocationType
  toLocationName: string
  toHolder: string
  actionType: string
  flowType: SampleFlowType
  flowStatus: SampleFlowStatus
  operatorName: string
  actionAt: string
  handedOverAt: string
  receivedAt: string
  returnedAt: string
  relatedProductionOrderId: string
  relatedCutOrderId: string
  relatedMarkerPlanId: string
  relatedSpreadingOrderId: string
  note: string
  remark: string
}

export interface SampleAbnormalItem {
  abnormalId: string
  sampleId: string
  abnormalType: SampleAbnormalType
  relatedProductionOrderId: string
  relatedCutOrderId: string
  relatedPatternFileId: string
  description: string
  evidencePhotos: string[]
  reportedAt: string
  reportedBy: string
  handlingStatus: '待处理' | '处理中' | '已处理'
  handledAt: string
  handledBy: string
}

export interface SampleWarehouseItem {
  sampleId: string
  sampleItemId: string
  sampleNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  materialAlias: string
  materialImageUrl: string
  color: string
  size: string
  sampleVersion: string
  currentStatus: CuttingSampleStatusLabel
  currentLocation: string
  currentUsageType: CuttingSampleUsageType
  expectedReturnAt: string
  abnormalFlag: boolean
  abnormalItems: SampleAbnormalItem[]
  relatedProductionOrderIds: string[]
  relatedCutOrderIds: string[]
  relatedPatternFileIds: string[]
  relatedPatternFileNames: string[]
  relatedPatternVersions: string[]
  relatedMarkerPlanIds: string[]
  relatedMarkerPlanNos: string[]
  relatedSpreadingOrderIds: string[]
  relatedSpreadingOrderNos: string[]
  currentLocationType: SampleLocationType
  currentLocationName: string
  currentHolder: string
  status: SampleWarehouseStatusMeta<SampleWarehouseStatusKey>
  lastMovedAt: string
  latestActionBy: string
  note: string
  relatedProductionOrderId: string
  relatedProductionOrderNo: string
  relatedCutOrderId: string
  relatedCutOrderNo: string
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
  inCuttingUseCount: number
  pendingReturnCount: number
  abnormalCount: number
  flowRecordCount: number
}

export interface SampleWarehouseFilters {
  keyword: string
  status: 'ALL' | SampleWarehouseStatusKey
  locationType: 'ALL' | SampleLocationType
  holder: string
}

export interface SampleWarehousePrefilter {
  cutOrderId?: string
  productionOrderId?: string
  materialSku?: string
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
  AVAILABLE: { label: '在库', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200', detailText: '当前样衣在库，可被裁床或生产管理中心调用。' },
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

function deriveStageFromWriteback(
  locationType: SampleWarehouseWritebackLocationType,
  actionType: SampleWarehouseActionType,
): SampleLocationStage {
  if (actionType === 'SAMPLE_WAREHOUSE_RETURN') return 'BACK_TO_PMC'
  if (actionType === 'SAMPLE_WAREHOUSE_MARK_INSPECTION') return 'RETURN_CHECK'
  if (locationType === 'cutting-room') return 'CUTTING'
  if (locationType === 'factory') return 'FACTORY_CHECK'
  if (locationType === 'inspection') return 'RETURN_CHECK'
  return 'PMC_WAREHOUSE'
}

function deriveActionText(actionType: SampleWarehouseActionType): string {
  if (actionType === 'SAMPLE_WAREHOUSE_BORROW') return '样衣借出'
  if (actionType === 'SAMPLE_WAREHOUSE_RETURN') return '样衣归还'
  if (actionType === 'SAMPLE_WAREHOUSE_MARK_INSPECTION') return '样衣进入抽检'
  return '样衣调拨位置'
}

function addDays(isoTime: string, days: number): string {
  const base = new Date(isoTime)
  if (Number.isNaN(base.getTime())) return ''
  base.setDate(base.getDate() + days)
  return base.toISOString().slice(0, 10)
}

function deriveSampleUsageType(record: SampleWarehouseRecord): CuttingSampleUsageType {
  if (record.currentLocationStage === 'CUTTING') return '裁床裁剪依据'
  if (record.currentLocationStage === 'FACTORY_CHECK') return '工厂核价比对'
  if (record.currentLocationStage === 'RETURN_CHECK') return '回货抽检'
  return '其他'
}

function deriveCurrentStatusLabel(record: SampleWarehouseRecord, abnormalItems: SampleAbnormalItem[]): CuttingSampleStatusLabel {
  if (record.currentLocationStage === 'CUTTING' || record.currentStatus === 'IN_USE') return '裁剪中使用'
  if (record.currentStatus === 'WAITING_RETURN') return '待归还'
  if (abnormalItems.length) return '异常'
  if (record.currentLocationStage === 'BACK_TO_PMC') return '已归还'
  if (record.currentStatus === 'AVAILABLE') return '在库'
  return '异常'
}

function deriveExpectedReturnAt(record: SampleWarehouseRecord): string {
  if (record.currentLocationStage === 'CUTTING') return addDays(record.latestActionAt, 2)
  if (record.currentLocationStage === 'FACTORY_CHECK' || record.currentStatus === 'WAITING_RETURN') return addDays(record.latestActionAt, 3)
  if (record.currentLocationStage === 'RETURN_CHECK') return addDays(record.latestActionAt, 1)
  return ''
}

function deriveFlowType(item: SampleFlowHistoryItem, record: SampleWarehouseRecord): SampleFlowType {
  if (item.actionText.includes('裁床')) return '调入裁床'
  if (item.actionText.includes('归还')) return '归还'
  if (item.actionText.includes('抽检') || item.actionText.includes('检查')) return '异常登记'
  if (record.currentLocationStage === 'CUTTING') return '裁床使用'
  return '调出裁床'
}

function deriveSampleAbnormalItems(record: SampleWarehouseRecord, row: CutOrderRow | undefined, index: number): SampleAbnormalItem[] {
  const base = {
    sampleId: record.id,
    relatedProductionOrderId: record.productionOrderId,
    relatedCutOrderId: record.cutOrderId,
    relatedPatternFileId: row?.patternFileId || '',
    evidencePhotos: [] as string[],
    reportedAt: record.latestActionAt,
    reportedBy: record.latestActionBy || record.currentHolder,
    handlingStatus: '待处理' as const,
    handledAt: '',
    handledBy: '',
  }
  if (record.currentStatus === 'WAITING_RETURN') {
    return [{
      ...base,
      abnormalId: `${record.id}-abnormal-return`,
      abnormalType: '样衣未归还',
      description: '样衣已超过建议归还时间，需要确认裁床或工厂是否仍在使用。',
    }]
  }
  if (record.currentLocationStage === 'RETURN_CHECK' || record.currentStatus === 'CHECKING') {
    const abnormalType: SampleAbnormalType = index % 2 === 0 ? '样衣版本不一致' : '样衣破损'
    return [{
      ...base,
      abnormalId: `${record.id}-abnormal-check`,
      abnormalType,
      description:
        abnormalType === '样衣版本不一致'
          ? '样衣版本与当前纸样版本不一致，需要裁床核对后再继续引用。'
          : '样衣回流抽检发现破损，需要确认是否影响裁剪依据。',
    }]
  }
  return []
}

function buildOverlaySampleRecord(writeback: SampleWarehouseWritebackRecord): SampleWarehouseRecord {
  return {
    id: writeback.sampleRecordId,
    warehouseType: 'SAMPLE',
    bindingState: writeback.cutOrderId ? 'BOUND_FORMAL_SAMPLE_RECORD' : 'UNBOUND_FORMAL_SAMPLE_RECORD',
    cutOrderId: writeback.cutOrderId,
    cutOrderNo: writeback.cutOrderNo,
    productionOrderId: writeback.productionOrderId,
    productionOrderNo: writeback.productionOrderNo,
    sampleNo: writeback.sampleRecordId,
    sampleName: '待补样衣',
    relatedProductionOrderNo: writeback.productionOrderNo,
    relatedCutPieceOrderNo: writeback.cutOrderNo,
    currentLocationStage: deriveStageFromWriteback(writeback.locationType, writeback.actionType),
    currentHolder: writeback.holder || 'PMC 样衣仓',
    currentStatus: 'AVAILABLE',
    latestActionAt: writeback.submittedAt,
    latestActionBy: writeback.operatorName,
    nextSuggestedAction: writeback.note || '待补正式流转建议。',
    flowHistory: [],
  }
}

export function deriveSampleWarehouseStatus(record: SampleWarehouseRecord): SampleWarehouseStatusMeta<SampleWarehouseStatusKey> {
  if (record.currentLocationStage === 'FACTORY_CHECK') return createSummaryMeta('IN_FACTORY', sampleWarehouseStatusMeta.IN_FACTORY.label, sampleWarehouseStatusMeta.IN_FACTORY.className, sampleWarehouseStatusMeta.IN_FACTORY.detailText)
  if (record.currentLocationStage === 'RETURN_CHECK' || record.currentStatus === 'CHECKING') return createSummaryMeta('INSPECTION', sampleWarehouseStatusMeta.INSPECTION.label, sampleWarehouseStatusMeta.INSPECTION.className, sampleWarehouseStatusMeta.INSPECTION.detailText)
  if (record.currentStatus === 'WAITING_RETURN') return createSummaryMeta('PENDING_RETURN', sampleWarehouseStatusMeta.PENDING_RETURN.label, sampleWarehouseStatusMeta.PENDING_RETURN.className, sampleWarehouseStatusMeta.PENDING_RETURN.detailText)
  if (record.currentStatus === 'IN_USE') return createSummaryMeta('BORROWED', sampleWarehouseStatusMeta.BORROWED.label, sampleWarehouseStatusMeta.BORROWED.className, sampleWarehouseStatusMeta.BORROWED.detailText)
  return createSummaryMeta('AVAILABLE', sampleWarehouseStatusMeta.AVAILABLE.label, sampleWarehouseStatusMeta.AVAILABLE.className, sampleWarehouseStatusMeta.AVAILABLE.detailText)
}

function mapFlowRecord(
  record: SampleWarehouseRecord,
  sampleItemId: string,
  item: SampleFlowHistoryItem,
  index: number,
  previous: SampleFlowHistoryItem | null,
  row?: CutOrderRow,
): SampleFlowRecord {
  const fromType = previous ? deriveLocationType(previous.stage) : deriveLocationType(item.stage)
  const toType = deriveLocationType(item.stage)
  const flowType = deriveFlowType(item, record)
  return {
    flowRecordId: `${sampleItemId}-flow-${index + 1}`,
    sampleItemId,
    sampleId: sampleItemId,
    sampleNo: record.sampleNo,
    fromLocationType: fromType,
    fromLocationName: sampleLocationTypeLabel[fromType],
    fromHolder: previous?.operatedBy || 'PMC 样衣仓',
    toLocationType: toType,
    toLocationName: sampleLocationTypeLabel[toType],
    toHolder: item.operatedBy,
    actionType: item.actionText,
    flowType,
    flowStatus: '已完成',
    operatorName: item.operatedBy,
    actionAt: item.operatedAt,
    handedOverAt: item.operatedAt,
    receivedAt: item.operatedAt,
    returnedAt: flowType === '归还' ? item.operatedAt : '',
    relatedProductionOrderId: record.productionOrderId,
    relatedCutOrderId: record.cutOrderId,
    relatedMarkerPlanId: row?.activeMarkerPlanId || row?.markerPlanIds[0] || '',
    relatedSpreadingOrderId: '',
    note: item.note,
    remark: item.note,
  }
}

export function buildSampleFlowTimeline(record: SampleWarehouseRecord, row?: CutOrderRow): SampleFlowRecord[] {
  return record.flowHistory.map((item, index) => mapFlowRecord(record, record.id, item, index, index > 0 ? record.flowHistory[index - 1] : null, row))
}

function applySampleWarehouseWritebackOverlay(
  records: SampleWarehouseRecord[],
  options: {
    sampleWritebacks?: SampleWarehouseWritebackRecord[]
  } = {},
): SampleWarehouseRecord[] {
  const storage = getBrowserLocalStorage() || undefined
  const sampleWritebacks = [...(options.sampleWritebacks ?? listSampleWarehouseWritebacks(storage))]
    .sort((left, right) => left.submittedAt.localeCompare(right.submittedAt, 'zh-CN'))
  const runtimeMap = new Map<string, SampleWarehouseRecord>(
    records.map((record) => [
      record.id,
      {
        ...record,
        flowHistory: record.flowHistory.map((item) => ({ ...item })),
      },
    ]),
  )

  sampleWritebacks.forEach((writeback) => {
    const current = runtimeMap.get(writeback.sampleRecordId) || buildOverlaySampleRecord(writeback)
    const next: SampleWarehouseRecord = {
      ...current,
      id: writeback.sampleRecordId,
      bindingState: writeback.cutOrderId ? 'BOUND_FORMAL_SAMPLE_RECORD' : 'UNBOUND_FORMAL_SAMPLE_RECORD',
      cutOrderId: writeback.cutOrderId,
      cutOrderNo: writeback.cutOrderNo,
      productionOrderId: writeback.productionOrderId,
      productionOrderNo: writeback.productionOrderNo,
      relatedProductionOrderNo: writeback.productionOrderNo,
      relatedCutPieceOrderNo: writeback.cutOrderNo,
      latestActionAt: writeback.submittedAt,
      latestActionBy: writeback.operatorName,
      flowHistory: current.flowHistory.map((item) => ({ ...item })),
    }

    if (writeback.actionType === 'SAMPLE_WAREHOUSE_BORROW') {
      next.currentLocationStage = deriveStageFromWriteback(writeback.locationType, writeback.actionType)
      next.currentHolder = writeback.holder || current.currentHolder
      next.currentStatus = 'IN_USE'
      next.nextSuggestedAction = '当前为借出中样衣，使用完成后需归还样衣仓。'
    } else if (writeback.actionType === 'SAMPLE_WAREHOUSE_RETURN') {
      next.currentLocationStage = 'BACK_TO_PMC'
      next.currentHolder = writeback.holder || 'PMC 样衣仓'
      next.currentStatus = 'AVAILABLE'
      next.nextSuggestedAction = '样衣已归还，可再次调用。'
    } else if (writeback.actionType === 'SAMPLE_WAREHOUSE_MARK_INSPECTION') {
      next.currentLocationStage = 'RETURN_CHECK'
      next.currentHolder = writeback.holder || '抽检组'
      next.currentStatus = 'CHECKING'
      next.nextSuggestedAction = '抽检完成后归还样衣仓。'
    } else {
      next.currentLocationStage = deriveStageFromWriteback(writeback.locationType, writeback.actionType)
      next.currentHolder = writeback.holder || current.currentHolder
      if (writeback.locationType === 'factory') {
        next.currentStatus = 'WAITING_RETURN'
        next.nextSuggestedAction = '工厂使用完成后需归还样衣仓。'
      } else if (writeback.locationType === 'inspection') {
        next.currentStatus = 'CHECKING'
        next.nextSuggestedAction = '当前样衣在抽检流程中。'
      } else {
        next.currentStatus = 'AVAILABLE'
        next.nextSuggestedAction = '当前样衣位置已调拨，可继续调用。'
      }
    }

    next.flowHistory.push({
      stage: next.currentLocationStage,
      actionText: deriveActionText(writeback.actionType),
      operatedBy: writeback.operatorName,
      operatedAt: writeback.submittedAt,
      note: writeback.note,
    })
    runtimeMap.set(writeback.sampleRecordId, next)
  })

  return Array.from(runtimeMap.values())
}

export function buildSampleWarehouseNavigationPayload(
  item: Pick<
    SampleWarehouseItem,
    | 'relatedCutOrderId'
    | 'relatedCutOrderNo'
    | 'relatedProductionOrderId'
    | 'relatedProductionOrderNo'
    | 'materialSku'
    | 'styleCode'
    | 'sampleNo'
    | 'currentHolder'
    | 'status'
  >,
): WarehouseNavigationPayload {
  return buildWarehouseQueryPayload({
    cutOrderId: item.relatedCutOrderId,
    cutOrderNo: item.relatedCutOrderNo,
    productionOrderId: item.relatedProductionOrderId,
    productionOrderNo: item.relatedProductionOrderNo,
    materialSku: item.materialSku || undefined,
    styleCode: item.styleCode,
    sampleNo: item.sampleNo,
    holder: item.currentHolder,
    warehouseStatus: item.status.key,
  })
}

export function buildSampleWarehouseViewModel(
  cutOrderRows: CutOrderRow[],
  records = listFormalSampleWarehouseRecords(),
  options: {
    sampleWritebacks?: SampleWarehouseWritebackRecord[]
  } = {},
): SampleWarehouseViewModel {
  const runtimeRecords = applySampleWarehouseWritebackOverlay(records, options)
  const rowById = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderId, row]))
  const rowByOrderNo = Object.fromEntries(cutOrderRows.map((row) => [row.cutOrderNo, row]))
  const findBoundCutOrderRow = (record: SampleWarehouseRecord): CutOrderRow | undefined =>
    rowById[record.cutOrderId] ||
    rowByOrderNo[record.cutOrderNo]
  const items = runtimeRecords
    .map((record, index) => {
      const row = findBoundCutOrderRow(record)
      const status = deriveSampleWarehouseStatus(record)
      const abnormalItems = deriveSampleAbnormalItems(record, row, index)
      const relatedMarkerPlanIds = row?.markerPlanIds || []
      const relatedMarkerPlanNos = row?.markerPlanNos || []
      const relatedPatternFileIds = row?.patternFileId ? [row.patternFileId] : []
      const relatedPatternFileNames = row?.patternFileName ? [row.patternFileName] : []
      const relatedPatternVersions = row?.patternVersion ? [row.patternVersion] : []
      const relatedSpreadingOrderIds = row?.activeMarkerPlanId ? [`spread-${row.activeMarkerPlanId}`] : []
      const relatedSpreadingOrderNos = row?.activeMarkerPlanNo ? [`铺布单-${row.activeMarkerPlanNo}`] : []
      const item: SampleWarehouseItem = {
        sampleId: record.id,
        sampleItemId: record.id,
        sampleNo: record.sampleNo,
        styleCode: row?.styleCode || '',
        spuCode: row?.spuCode || '',
        materialSku: row?.materialSku || '',
        materialAlias: row?.materialAlias || '',
        materialImageUrl: row?.materialImageUrl || '',
        color: row?.color || '待补颜色',
        size: '均码',
        sampleVersion: `样衣版 ${row?.patternVersion || 'v1.0'}`,
        currentStatus: deriveCurrentStatusLabel(record, abnormalItems),
        currentLocation: sampleLocationTypeLabel[deriveLocationType(record.currentLocationStage)],
        currentUsageType: deriveSampleUsageType(record),
        expectedReturnAt: deriveExpectedReturnAt(record),
        abnormalFlag: abnormalItems.length > 0,
        abnormalItems,
        relatedProductionOrderIds: record.productionOrderId ? [record.productionOrderId] : [],
        relatedCutOrderIds: record.cutOrderId ? [record.cutOrderId] : [],
        relatedPatternFileIds,
        relatedPatternFileNames,
        relatedPatternVersions,
        relatedMarkerPlanIds,
        relatedMarkerPlanNos,
        relatedSpreadingOrderIds,
        relatedSpreadingOrderNos,
        currentLocationType: deriveLocationType(record.currentLocationStage),
        currentLocationName: sampleLocationTypeLabel[deriveLocationType(record.currentLocationStage)],
        currentHolder: record.currentHolder,
        status,
        lastMovedAt: record.latestActionAt,
        latestActionBy: record.latestActionBy,
        note: record.nextSuggestedAction,
        relatedProductionOrderId: record.productionOrderId,
        relatedProductionOrderNo: record.productionOrderNo,
        relatedCutOrderId: record.cutOrderId,
        relatedCutOrderNo: record.cutOrderNo,
        sampleName: record.sampleName,
        flowRecords: buildSampleFlowTimeline(record, row),
        navigationPayload: buildSampleWarehouseNavigationPayload({
          relatedCutOrderId: record.cutOrderId,
          relatedCutOrderNo: record.cutOrderNo,
          relatedProductionOrderId: record.productionOrderId,
          relatedProductionOrderNo: record.productionOrderNo,
          materialSku: row?.materialSku || '',
          styleCode: row?.styleCode || '',
          sampleNo: record.sampleNo,
          currentHolder: record.currentHolder,
          status,
        }),
        keywordIndex: [
          record.sampleNo,
          row?.styleCode,
          row?.spuCode,
          row?.materialSku,
          row?.materialAlias,
          row?.cutOrderId,
          row?.cutOrderNo,
          row?.productionOrderId || record.productionOrderId,
          row?.productionOrderNo || record.productionOrderNo,
          record.currentHolder,
          record.sampleName,
          relatedPatternFileNames.join(' '),
          relatedMarkerPlanNos.join(' '),
          ...abnormalItems.map((item) => item.abnormalType),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase()),
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
      inCuttingUseCount: items.filter((item) => item.currentStatus === '裁剪中使用').length,
      pendingReturnCount: items.filter((item) => item.currentStatus === '待归还' || item.status.key === 'PENDING_RETURN').length,
      abnormalCount: items.filter((item) => item.abnormalFlag).length,
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
    if (prefilter?.cutOrderId && item.relatedCutOrderId !== prefilter.cutOrderId) return false
    if (prefilter?.productionOrderId && item.relatedProductionOrderId !== prefilter.productionOrderId) return false
    if (prefilter?.materialSku && item.materialSku !== prefilter.materialSku) return false
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
    (prefilter.cutOrderId && items.find((item) => item.relatedCutOrderId === prefilter.cutOrderId)) ||
    (prefilter.productionOrderId && items.find((item) => item.relatedProductionOrderId === prefilter.productionOrderId)) ||
    (prefilter.materialSku && items.find((item) => item.materialSku === prefilter.materialSku)) ||
    (prefilter.sampleNo && items.find((item) => item.sampleNo === prefilter.sampleNo)) ||
    (prefilter.styleCode && items.find((item) => item.styleCode === prefilter.styleCode)) ||
    null
  )
}
