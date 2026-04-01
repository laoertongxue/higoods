import type {
  CuttingConfigStatus,
  CuttingMaterialLine,
  CuttingMaterialType,
  CuttingOrderProgressRecord,
  CuttingReceiveStatus,
} from '../../../data/fcs/cutting/types'
import {
  listGeneratedOriginalCutOrderSourceRecords,
  type GeneratedOriginalCutOrderSourceRecord,
} from '../../../data/fcs/cutting/generated-original-cut-orders'
import {
  buildProductionProgressRows,
  configMeta,
  receiveMeta,
  type ProductionProgressRow,
  type ProductionProgressUrgencyKey,
  urgencyMeta,
} from './production-progress-model'
import type { MergeBatchRecord } from './merge-batches-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')
const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export type OriginalCutOrderStageKey =
  | 'WAITING_PREP'
  | 'PREPPING'
  | 'WAITING_CLAIM'
  | 'CUTTING'
  | 'WAITING_INBOUND'
  | 'DONE'

export type OriginalCuttableStateKey =
  | 'CUTTABLE'
  | 'WAITING_PREP'
  | 'WAITING_CLAIM'
  | 'CLAIM_EXCEPTION'
  | 'IN_BATCH'
  | 'INBOUND'
  | 'CUTTING'
  | 'BLOCKED'

export type OriginalCutOrderRiskKey =
  | 'PREP_DELAY'
  | 'CLAIM_EXCEPTION'
  | 'SHIP_URGENT'
  | 'DATE_MISSING'
  | 'STATUS_CONFLICT'
  | 'REPLENISH_PENDING'
  | 'IN_BATCH'

export interface OriginalCutOrderSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface OriginalCutOrderRiskTag {
  key: OriginalCutOrderRiskKey
  label: string
  className: string
}

export interface OriginalCutOrderNavigationPayload {
  productionProgress: Record<string, string | undefined>
  materialPrep: Record<string, string | undefined>
  markerSpreading: Record<string, string | undefined>
  feiTickets: Record<string, string | undefined>
  replenishment: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  sameProductionOrders: Record<string, string | undefined>
}

export interface OriginalCutOrderRow {
  id: string
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  styleName: string
  color: string
  materialSku: string
  materialType: CuttingMaterialType
  materialCategory: string
  materialLabel: string
  orderQty: number
  plannedQty: number
  receivedQty: number
  purchaseDate: string
  actualOrderDate: string
  plannedShipDate: string
  sellingPrice: number | null
  urgencyKey: ProductionProgressUrgencyKey
  urgencyLabel: string
  urgencyClassName: string
  materialPrepStatus: OriginalCutOrderSummaryMeta<CuttingConfigStatus>
  materialClaimStatus: OriginalCutOrderSummaryMeta<CuttingReceiveStatus>
  currentStage: OriginalCutOrderSummaryMeta<OriginalCutOrderStageKey>
  cuttableState: OriginalCutOrderSummaryMeta<OriginalCuttableStateKey> & {
    selectable: boolean
    reasonText: string
  }
  mergeBatchIds: string[]
  mergeBatchNos: string[]
  latestMergeBatchNo: string
  batchParticipationCount: number
  activeBatchId: string
  activeBatchNo: string
  riskTags: OriginalCutOrderRiskTag[]
  statusSummary: string
  relationSummary: string
  latestActionText: string
  navigationPayload: OriginalCutOrderNavigationPayload
  keywordIndex: string[]
}

export interface OriginalCutOrderViewModel {
  rows: OriginalCutOrderRow[]
  rowsById: Record<string, OriginalCutOrderRow>
}

export interface OriginalCutOrderFilters {
  keyword: string
  productionOrderNo: string
  styleKeyword: string
  materialSku: string
  currentStage: 'ALL' | OriginalCutOrderStageKey
  cuttableState: 'ALL' | OriginalCuttableStateKey
  prepStatus: 'ALL' | CuttingConfigStatus
  claimStatus: 'ALL' | CuttingReceiveStatus
  inBatch: 'ALL' | 'IN_BATCH' | 'NOT_IN_BATCH'
  riskOnly: boolean
}

export interface OriginalCutOrderPrefilter {
  productionOrderId?: string
  productionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  styleCode?: string
  spuCode?: string
  materialSku?: string
}

export interface OriginalCutOrderStats {
  totalCount: number
  cuttableCount: number
  inBatchCount: number
  prepExceptionCount: number
  claimExceptionCount: number
  feiPendingCount: number
}

export const originalOrderStageMeta: Record<OriginalCutOrderStageKey, { label: string; className: string }> = {
  WAITING_PREP: { label: '待配料', className: 'bg-slate-100 text-slate-700' },
  PREPPING: { label: '配料中', className: 'bg-orange-100 text-orange-700' },
  WAITING_CLAIM: { label: '待领料', className: 'bg-blue-100 text-blue-700' },
  CUTTING: { label: '裁剪中', className: 'bg-violet-100 text-violet-700' },
  WAITING_INBOUND: { label: '待入仓', className: 'bg-sky-100 text-sky-700' },
  DONE: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
}

export const originalOrderCuttableMeta: Record<OriginalCuttableStateKey, { label: string; className: string }> = {
  CUTTABLE: { label: '可裁', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  WAITING_PREP: { label: '待配料', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  WAITING_CLAIM: { label: '待领料', className: 'bg-blue-100 text-blue-700 border border-blue-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  IN_BATCH: { label: '已入批次', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
  INBOUND: { label: '已入仓', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  CUTTING: { label: '裁剪中', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  BLOCKED: { label: '暂不可裁', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
}

export const originalOrderRiskMeta: Record<OriginalCutOrderRiskKey, { label: string; className: string }> = {
  PREP_DELAY: { label: '配料异常', className: 'bg-orange-100 text-orange-700 border border-orange-200' },
  CLAIM_EXCEPTION: { label: '领料异常', className: 'bg-rose-100 text-rose-700 border border-rose-200' },
  SHIP_URGENT: { label: '临近发货', className: 'bg-red-100 text-red-700 border border-red-200' },
  DATE_MISSING: { label: '日期缺失', className: 'bg-slate-100 text-slate-700 border border-slate-200' },
  STATUS_CONFLICT: { label: '状态不一致', className: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200' },
  REPLENISH_PENDING: { label: '待补料', className: 'bg-purple-100 text-purple-700 border border-purple-200' },
  IN_BATCH: { label: '已入批次', className: 'bg-violet-100 text-violet-700 border border-violet-200' },
}

function materialCategoryLabel(materialType: CuttingMaterialType): string {
  if (materialType === 'PRINT') return '印花主料'
  if (materialType === 'DYE') return '染色主料'
  if (materialType === 'LINING') return '里辅料'
  return '净色 / 拼接主料'
}

function formatQty(value: number): string {
  return numberFormatter.format(value)
}

export function formatOriginalOrderCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '待补'
  return currencyFormatter.format(value)
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildProgressLineFallback(source: GeneratedOriginalCutOrderSourceRecord): CuttingMaterialLine {
  return {
    originalCutOrderId: source.originalCutOrderId,
    originalCutOrderNo: source.originalCutOrderNo,
    cutPieceOrderNo: source.originalCutOrderNo,
    mergeBatchId: source.mergeBatchId,
    mergeBatchNo: source.mergeBatchNo,
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialLabel: source.materialLabel,
    color: source.colorScope[0] || '待补',
    materialCategory: source.materialCategory,
    reviewStatus: 'NOT_REQUIRED',
    configStatus: 'NOT_CONFIGURED',
    receiveStatus: 'NOT_RECEIVED',
    configuredRollCount: 0,
    configuredLength: 0,
    receivedRollCount: 0,
    receivedLength: 0,
    printSlipStatus: 'NOT_PRINTED',
    qrStatus: 'NOT_GENERATED',
    batchOccupancyStatus: source.mergeBatchNo ? 'IN_BATCH' : 'AVAILABLE',
    skuScopeLines: source.skuScopeLines.map((line) => ({ ...line })),
    issueFlags: [],
    latestActionText: `原始裁片单 ${source.originalCutOrderNo} 已从生产单生成，待进入执行准备。`,
  }
}

function createSummaryMeta<Key extends string>(
  key: Key,
  label: string,
  className: string,
  detailText: string,
): OriginalCutOrderSummaryMeta<Key> {
  return { key, label, className, detailText }
}

function getBatchSortTime(batch: MergeBatchRecord): string {
  return batch.updatedAt || batch.createdAt || ''
}

export function summarizeMergeBatchParticipation(
  originalCutOrderId: string,
  ledger: MergeBatchRecord[],
): {
  mergeBatchIds: string[]
  mergeBatchNos: string[]
  latestMergeBatchNo: string
  batchParticipationCount: number
  activeBatchId: string
  activeBatchNo: string
} {
  const matched = ledger
    .filter((batch) => batch.items.some((item) => item.originalCutOrderId === originalCutOrderId || item.originalCutOrderNo === originalCutOrderId))
    .sort((left, right) => getBatchSortTime(right).localeCompare(getBatchSortTime(left), 'zh-CN'))

  return {
    mergeBatchIds: matched.map((batch) => batch.mergeBatchId),
    mergeBatchNos: matched.map((batch) => batch.mergeBatchNo),
    latestMergeBatchNo: matched[0]?.mergeBatchNo ?? '',
    batchParticipationCount: matched.length,
    activeBatchId: matched.find((batch) => batch.status !== 'CANCELLED')?.mergeBatchId ?? '',
    activeBatchNo: matched.find((batch) => batch.status !== 'CANCELLED')?.mergeBatchNo ?? '',
  }
}

export function deriveOriginalCutOrderStage(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
): OriginalCutOrderSummaryMeta<OriginalCutOrderStageKey> {
  if (record.hasInboundRecord || /已完成|已入仓/.test(record.cuttingStage)) {
    return createSummaryMeta('DONE', originalOrderStageMeta.DONE.label, originalOrderStageMeta.DONE.className, '该原始裁片单已进入裁片完成 / 入仓后续。')
  }

  if (/待入仓/.test(record.cuttingStage)) {
    return createSummaryMeta('WAITING_INBOUND', originalOrderStageMeta.WAITING_INBOUND.label, originalOrderStageMeta.WAITING_INBOUND.className, '裁片已完成当前执行，等待入仓确认。')
  }

  if (line.configStatus === 'NOT_CONFIGURED') {
    return createSummaryMeta('WAITING_PREP', originalOrderStageMeta.WAITING_PREP.label, originalOrderStageMeta.WAITING_PREP.className, '仓库配料未开始，当前仍待进入配料。')
  }

  if (line.configStatus === 'PARTIAL') {
    return createSummaryMeta('PREPPING', originalOrderStageMeta.PREPPING.label, originalOrderStageMeta.PREPPING.className, '当前仅完成部分配料，仍在执行准备阶段。')
  }

  if (line.receiveStatus === 'NOT_RECEIVED' || line.receiveStatus === 'PARTIAL') {
    return createSummaryMeta('WAITING_CLAIM', originalOrderStageMeta.WAITING_CLAIM.label, originalOrderStageMeta.WAITING_CLAIM.className, '当前待完成领料回写后再进入裁床执行。')
  }

  return createSummaryMeta('CUTTING', record.cuttingStage || originalOrderStageMeta.CUTTING.label, originalOrderStageMeta.CUTTING.className, '当前原始裁片单已进入裁剪执行上下文。')
}

export function deriveOriginalCutOrderCuttableState(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  ledger: MergeBatchRecord[],
): OriginalCutOrderSummaryMeta<OriginalCuttableStateKey> & {
  selectable: boolean
  reasonText: string
} {
  const participation = summarizeMergeBatchParticipation(line.originalCutOrderId || line.originalCutOrderNo || line.cutPieceOrderNo, ledger)
  if (participation.activeBatchNo || line.batchOccupancyStatus === 'IN_BATCH') {
    return {
      ...createSummaryMeta('IN_BATCH', originalOrderCuttableMeta.IN_BATCH.label, originalOrderCuttableMeta.IN_BATCH.className, `当前原始裁片单已进入批次 ${participation.activeBatchNo || line.mergeBatchNo || '当前批次'}。`),
      selectable: false,
      reasonText: '当前原始裁片单已被合并裁剪批次占用。',
    }
  }

  if (record.hasInboundRecord || /已完成|已入仓/.test(record.cuttingStage)) {
    return {
      ...createSummaryMeta('INBOUND', originalOrderCuttableMeta.INBOUND.label, originalOrderCuttableMeta.INBOUND.className, '该原始裁片单已进入入仓 / 完成后续。'),
      selectable: false,
      reasonText: '当前原始裁片单已进入入仓后续，不能再作为可裁池对象。',
    }
  }

  if (/裁片执行中|裁剪中|待入仓/.test(record.cuttingStage) || record.hasSpreadingRecord) {
    return {
      ...createSummaryMeta('CUTTING', originalOrderCuttableMeta.CUTTING.label, originalOrderCuttableMeta.CUTTING.className, '该原始裁片单已在执行或待入仓阶段。'),
      selectable: false,
      reasonText: '当前原始裁片单已进入裁剪执行阶段。',
    }
  }

  if (line.configStatus === 'NOT_CONFIGURED' || line.configStatus === 'PARTIAL') {
    return {
      ...createSummaryMeta('WAITING_PREP', originalOrderCuttableMeta.WAITING_PREP.label, originalOrderCuttableMeta.WAITING_PREP.className, '配料未齐，需先完成执行准备。'),
      selectable: false,
      reasonText: line.configStatus === 'PARTIAL' ? '当前仅完成部分配料，暂不可裁。' : '仓库配料未完成，暂不可裁。',
    }
  }

  if (line.issueFlags.includes('RECEIVE_DIFF')) {
    return {
      ...createSummaryMeta('CLAIM_EXCEPTION', originalOrderCuttableMeta.CLAIM_EXCEPTION.label, originalOrderCuttableMeta.CLAIM_EXCEPTION.className, '领料存在差异，需复核后再裁。'),
      selectable: false,
      reasonText: '领料存在差异，需复核后再裁。',
    }
  }

  if (line.receiveStatus === 'NOT_RECEIVED' || line.receiveStatus === 'PARTIAL') {
    return {
      ...createSummaryMeta('WAITING_CLAIM', originalOrderCuttableMeta.WAITING_CLAIM.label, originalOrderCuttableMeta.WAITING_CLAIM.className, '领料未齐，尚不能进入本次裁床安排。'),
      selectable: false,
      reasonText: line.receiveStatus === 'PARTIAL' ? '当前仅完成部分领料。' : '尚未完成领料。',
    }
  }

  return {
    ...createSummaryMeta('CUTTABLE', originalOrderCuttableMeta.CUTTABLE.label, originalOrderCuttableMeta.CUTTABLE.className, '配料 / 领料已到位，可作为原始裁片单进入后续排产。'),
    selectable: true,
    reasonText: '当前原始裁片单满足可裁条件。',
  }
}

export function summarizeOriginalCutOrderRisks(
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  cuttableState: OriginalCutOrderRow['cuttableState'],
  batchParticipationCount: number,
): OriginalCutOrderRiskTag[] {
  const keys = new Set<OriginalCutOrderRiskKey>()

  if (line.configStatus === 'NOT_CONFIGURED' || line.configStatus === 'PARTIAL') keys.add('PREP_DELAY')
  if (line.issueFlags.includes('RECEIVE_DIFF') || cuttableState.key === 'CLAIM_EXCEPTION') keys.add('CLAIM_EXCEPTION')
  if (!record.plannedShipDate) keys.add('DATE_MISSING')
  if (record.urgencyLevel === 'AA' || record.urgencyLevel === 'A') keys.add('SHIP_URGENT')
  if (line.issueFlags.includes('REPLENISH_PENDING') || record.riskFlags.includes('REPLENISH_PENDING')) keys.add('REPLENISH_PENDING')
  if (batchParticipationCount > 0) keys.add('IN_BATCH')
  if (/已完成/.test(record.cuttingStage) && !record.hasInboundRecord) keys.add('STATUS_CONFLICT')

  return Array.from(keys).map((key) => ({
    key,
    label: originalOrderRiskMeta[key].label,
    className: originalOrderRiskMeta[key].className,
  }))
}

export function buildOriginalOrderNavigationPayload(row: {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  styleCode: string
  spuCode: string
  materialSku: string
  activeMergeBatchId: string
  latestMergeBatchNo: string
}): OriginalCutOrderNavigationPayload {
  return {
    productionProgress: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    },
    materialPrep: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      materialSku: row.materialSku,
    },
    markerSpreading: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      mergeBatchNo: row.latestMergeBatchNo || undefined,
      tab: 'spreadings',
    },
    feiTickets: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
    },
    replenishment: {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      productionOrderNo: row.productionOrderNo,
    },
    mergeBatches: {
      mergeBatchId: row.activeMergeBatchId || undefined,
      mergeBatchNo: row.latestMergeBatchNo || undefined,
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
    },
    sameProductionOrders: {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
    },
  }
}

function buildKeywordIndex(values: Array<string | undefined | number | null>): string[] {
  return values
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => String(value).toLowerCase())
}

function buildPrepSummary(line: CuttingMaterialLine): OriginalCutOrderSummaryMeta<CuttingConfigStatus> {
  const meta = configMeta[line.configStatus]
  const detailText =
    line.configStatus === 'CONFIGURED'
      ? `已配置 ${formatQty(line.configuredRollCount)} 卷 / ${formatQty(line.configuredLength)} 米。`
      : line.configStatus === 'PARTIAL'
        ? `已配置 ${formatQty(line.configuredRollCount)} 卷，仍有剩余待补齐。`
        : '当前尚未开始配料。'

  return createSummaryMeta(line.configStatus, meta.label, meta.className, detailText)
}

function buildClaimSummary(line: CuttingMaterialLine): OriginalCutOrderSummaryMeta<CuttingReceiveStatus> {
  const meta = receiveMeta[line.receiveStatus]
  const detailText =
    line.receiveStatus === 'RECEIVED'
      ? `已领 ${formatQty(line.receivedRollCount)} 卷 / ${formatQty(line.receivedLength)} 米。`
      : line.receiveStatus === 'PARTIAL'
        ? `已领 ${formatQty(line.receivedRollCount)} 卷，仍有余量待领取。`
        : '当前尚未完成领料。'

  return createSummaryMeta(line.receiveStatus, meta.label, meta.className, detailText)
}

function createRow(
  source: GeneratedOriginalCutOrderSourceRecord,
  record: CuttingOrderProgressRecord,
  line: CuttingMaterialLine,
  progressRow: ProductionProgressRow | undefined,
  ledger: MergeBatchRecord[],
): OriginalCutOrderRow {
  const batchSummary = summarizeMergeBatchParticipation(source.originalCutOrderId, ledger)
  const cuttableState = deriveOriginalCutOrderCuttableState(record, line, ledger)
  const currentStage = deriveOriginalCutOrderStage(record, line)
  const materialPrepStatus = buildPrepSummary(line)
  const materialClaimStatus = buildClaimSummary(line)
  const riskTags = summarizeOriginalCutOrderRisks(record, line, cuttableState, batchSummary.batchParticipationCount)
  const urgencyKey = progressRow?.urgency.key ?? 'UNKNOWN'
  const urgency = urgencyMeta[urgencyKey]

  const row: OriginalCutOrderRow = {
    id: source.originalCutOrderId,
    originalCutOrderId: source.originalCutOrderId,
    originalCutOrderNo: source.originalCutOrderNo,
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    styleCode: record.styleCode,
    spuCode: record.spuCode,
    styleName: record.styleName,
    color: line.color || source.colorScope[0] || '待补',
    materialSku: source.materialSku,
    materialType: source.materialType,
    materialCategory: source.materialCategory || materialCategoryLabel(source.materialType),
    materialLabel: source.materialLabel,
    orderQty: record.orderQty,
    plannedQty: source.requiredQty,
    receivedQty: line.receivedLength,
    purchaseDate: record.purchaseDate,
    actualOrderDate: record.actualOrderDate,
    plannedShipDate: record.plannedShipDate,
    sellingPrice: record.sellingPrice ?? null,
    urgencyKey,
    urgencyLabel: urgency.label,
    urgencyClassName: urgency.className,
    materialPrepStatus,
    materialClaimStatus,
    currentStage,
    cuttableState,
    mergeBatchIds: batchSummary.mergeBatchIds,
    mergeBatchNos: batchSummary.mergeBatchNos,
    latestMergeBatchNo: batchSummary.latestMergeBatchNo,
    batchParticipationCount: batchSummary.batchParticipationCount,
    activeBatchId: batchSummary.activeBatchId,
    activeBatchNo: batchSummary.activeBatchNo,
    riskTags,
    statusSummary: [currentStage.label, cuttableState.label, materialPrepStatus.label, materialClaimStatus.label].join(' / '),
    relationSummary: batchSummary.batchParticipationCount
      ? `来源 ${source.productionOrderNo}，已参与 ${batchSummary.batchParticipationCount} 个批次`
      : `来源 ${source.productionOrderNo}，当前尚未进入批次`,
    latestActionText: line.latestActionText || record.lastFieldUpdateAt || '暂无最近执行痕迹。',
    navigationPayload: buildOriginalOrderNavigationPayload({
      originalCutOrderId: source.originalCutOrderId,
      originalCutOrderNo: source.originalCutOrderNo,
      productionOrderId: source.productionOrderId,
      productionOrderNo: source.productionOrderNo,
      styleCode: record.styleCode,
      spuCode: record.spuCode,
      materialSku: source.materialSku,
      activeMergeBatchId: batchSummary.activeBatchId,
      latestMergeBatchNo: batchSummary.latestMergeBatchNo,
    }),
    keywordIndex: buildKeywordIndex([
      source.originalCutOrderNo,
      source.productionOrderId,
      source.productionOrderNo,
      record.styleCode,
      record.spuCode,
      record.styleName,
      source.materialSku,
      source.materialLabel,
      source.materialType,
      source.materialCategory,
      line.color,
      batchSummary.latestMergeBatchNo,
    ]),
  }

  return row
}

export function buildOriginalCutOrderViewModel(
  records: CuttingOrderProgressRecord[],
  ledger: MergeBatchRecord[] = [],
  options: {
    progressRows?: ProductionProgressRow[]
  } = {},
): OriginalCutOrderViewModel {
  const progressRowMap = new Map(
    (options.progressRows ?? buildProductionProgressRows(records)).map((row) => [row.productionOrderId, row] as const),
  )
  const recordMap = new Map(records.map((record) => [record.productionOrderId, record] as const))
  const lineMap = new Map<string, CuttingMaterialLine>()
  records.forEach((record) => {
    record.materialLines.forEach((line) => {
      const key = line.originalCutOrderId || line.originalCutOrderNo || line.cutPieceOrderNo
      if (key) lineMap.set(key, line)
    })
  })

  const rows = listGeneratedOriginalCutOrderSourceRecords()
    .map((source) => {
      const record = recordMap.get(source.productionOrderId)
      if (!record) return null
      const line = lineMap.get(source.originalCutOrderId) || buildProgressLineFallback(source)
      return createRow(source, record, line, progressRowMap.get(source.productionOrderId), ledger)
    })
    .filter((row): row is OriginalCutOrderRow => row !== null)
    .sort((left, right) => {
      const leftWeight = urgencyMeta[left.urgencyKey].sortWeight
      const rightWeight = urgencyMeta[right.urgencyKey].sortWeight
      return (
        rightWeight - leftWeight ||
        left.plannedShipDate.localeCompare(right.plannedShipDate, 'zh-CN') ||
        left.productionOrderNo.localeCompare(right.productionOrderNo, 'zh-CN') ||
        left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN')
      )
    })

  return {
    rows,
    rowsById: Object.fromEntries(rows.map((row) => [row.id, row])),
  }
}

function matchText(value: string, search: string): boolean {
  return value.toLowerCase().includes(search.trim().toLowerCase())
}

function applyPrefilter(rows: OriginalCutOrderRow[], prefilter: OriginalCutOrderPrefilter | null): OriginalCutOrderRow[] {
  if (!prefilter) return rows

  return rows.filter((row) => {
    if (prefilter.productionOrderId && row.productionOrderId !== prefilter.productionOrderId) return false
    if (prefilter.productionOrderNo && row.productionOrderNo !== prefilter.productionOrderNo) return false
    if (prefilter.originalCutOrderId && row.originalCutOrderId !== prefilter.originalCutOrderId) return false
    if (prefilter.originalCutOrderNo && row.originalCutOrderNo !== prefilter.originalCutOrderNo) return false
    if (prefilter.mergeBatchId && !row.mergeBatchIds.includes(prefilter.mergeBatchId)) return false
    if (prefilter.mergeBatchNo && !row.mergeBatchNos.includes(prefilter.mergeBatchNo)) return false
    if (prefilter.styleCode && row.styleCode !== prefilter.styleCode) return false
    if (prefilter.spuCode && row.spuCode !== prefilter.spuCode) return false
    if (prefilter.materialSku && row.materialSku !== prefilter.materialSku) return false
    return true
  })
}

export function filterOriginalCutOrderRows(
  rows: OriginalCutOrderRow[],
  filters: OriginalCutOrderFilters,
  prefilter: OriginalCutOrderPrefilter | null,
): OriginalCutOrderRow[] {
  const prefilteredRows = applyPrefilter(rows, prefilter)

  return prefilteredRows.filter((row) => {
    if (filters.keyword && !row.keywordIndex.some((value) => value.includes(filters.keyword.trim().toLowerCase()))) return false
    if (filters.productionOrderNo && !matchText(row.productionOrderNo, filters.productionOrderNo)) return false
    if (filters.styleKeyword) {
      const styleNeedle = filters.styleKeyword.trim().toLowerCase()
      if (![row.styleCode, row.spuCode, row.styleName].some((value) => value.toLowerCase().includes(styleNeedle))) return false
    }
    if (filters.materialSku) {
      const materialNeedle = filters.materialSku.trim().toLowerCase()
      if (![row.materialSku, row.materialCategory, row.materialLabel].some((value) => value.toLowerCase().includes(materialNeedle))) return false
    }
    if (filters.currentStage !== 'ALL' && row.currentStage.key !== filters.currentStage) return false
    if (filters.cuttableState !== 'ALL' && row.cuttableState.key !== filters.cuttableState) return false
    if (filters.prepStatus !== 'ALL' && row.materialPrepStatus.key !== filters.prepStatus) return false
    if (filters.claimStatus !== 'ALL' && row.materialClaimStatus.key !== filters.claimStatus) return false
    if (filters.inBatch === 'IN_BATCH' && row.batchParticipationCount === 0) return false
    if (filters.inBatch === 'NOT_IN_BATCH' && row.batchParticipationCount > 0) return false
    if (filters.riskOnly && row.riskTags.length === 0) return false
    return true
  })
}

export function buildOriginalCutOrderStats(rows: OriginalCutOrderRow[]): OriginalCutOrderStats {
  return {
    totalCount: rows.length,
    cuttableCount: rows.filter((row) => row.cuttableState.key === 'CUTTABLE').length,
    inBatchCount: rows.filter((row) => row.batchParticipationCount > 0).length,
    prepExceptionCount: rows.filter((row) => row.materialPrepStatus.key !== 'CONFIGURED').length,
    claimExceptionCount: rows.filter((row) => row.materialClaimStatus.key !== 'RECEIVED' || row.cuttableState.key === 'CLAIM_EXCEPTION').length,
    feiPendingCount: rows.filter((row) => row.cuttableState.key !== 'INBOUND' && row.cuttableState.key !== 'CUTTING').length,
  }
}

export function findOriginalCutOrderByPrefilter(
  rows: OriginalCutOrderRow[],
  prefilter: OriginalCutOrderPrefilter | null,
): OriginalCutOrderRow | null {
  if (!prefilter) return null
  if (prefilter.originalCutOrderId) return rows.find((row) => row.originalCutOrderId === prefilter.originalCutOrderId) ?? null
  if (prefilter.originalCutOrderNo) return rows.find((row) => row.originalCutOrderNo === prefilter.originalCutOrderNo) ?? null
  return null
}
