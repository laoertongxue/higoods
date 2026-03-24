import type { MaterialPrepRow } from './material-prep-model'
import type { MergeBatchRecord } from './merge-batches-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export const CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY = 'cuttingMarkerSpreadingLedger'

export type MarkerModeKey = 'normal' | 'high-low' | 'folded'
export type SpreadingStatusKey = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'TO_FILL'
export type SpreadingSourceChannel = 'MANUAL' | 'PDA_WRITEBACK' | 'MIXED'
export type SpreadingOperatorActionType = '开始铺布' | '中途交接' | '接手继续' | '完成铺布'
export type SpreadingPricingMode = '按件计价' | '按长度计价' | '按层计价'
export type SpreadingWarningLevel = '低' | '中' | '高'
export type SpreadingSuggestedAction = '无需补料' | '建议补料' | '数据不足，待补录' | '存在异常差异，需人工确认'
export const MARKER_SIZE_KEYS = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'onesize', 'plusonesize'] as const
export type MarkerSizeKey = (typeof MARKER_SIZE_KEYS)[number]
export const DEFAULT_HIGH_LOW_PATTERN_KEYS = ['S*1', 'XL*1', 'L*1+plusonesize', 'M*1+onesize', '2XL'] as const
export type MarkerTemplateKey = 'row-template' | 'matrix-template'

export interface MarkerSpreadingSummaryMeta<Key extends string> {
  key: Key
  label: string
  className: string
  detailText: string
}

export interface MarkerSizeDistributionItem {
  sizeLabel: string
  quantity: number
}

export interface MarkerLineItem {
  lineItemId: string
  markerId: string
  lineNo: number
  layoutCode: string
  layoutDetailText: string
  color: string
  spreadRepeatCount: number
  markerLength: number
  markerPieceCount: number
  singlePieceUsage: number
  spreadTotalLength: number
  widthHint?: string
  note: string
  markerLineItemId?: string
  ratioLabel?: string
  pieceCount?: number
  spreadingTotalLength?: number
}

export interface HighLowCuttingRow {
  rowId: string
  markerId: string
  color: string
  sizeValues: Record<MarkerSizeKey, number>
  total: number
}

export interface HighLowPatternRow {
  rowId: string
  markerId: string
  color: string
  patternValues: Record<string, number>
  total: number
}

export interface HighLowSummary {
  cuttingTotal: number
  patternTotal: number
  warningMessages: string[]
}

export interface MarkerSpreadingPrefilter {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  productionOrderNo?: string
  styleCode?: string
  spuCode?: string
  materialSku?: string
}

export interface MarkerSpreadingContext {
  contextType: 'original-order' | 'merge-batch'
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSkuSummary: string
  materialPrepRows: MaterialPrepRow[]
}

export interface MarkerRecord {
  markerId: string
  markerNo?: string
  contextType: 'original-order' | 'merge-batch'
  originalCutOrderIds: string[]
  originalCutOrderNos?: string[]
  mergeBatchId: string
  mergeBatchNo: string
  styleCode?: string
  spuCode?: string
  materialSkuSummary?: string
  colorSummary?: string
  markerMode: MarkerModeKey
  sizeDistribution: MarkerSizeDistributionItem[]
  totalPieces: number
  netLength: number
  singlePieceUsage: number
  spreadTotalLength?: number
  materialCategory?: string
  materialAttr?: string
  plannedSizeRatioText?: string
  plannedLayerCount?: number
  plannedMarkerCount?: number
  markerLength?: number
  procurementUnitUsage?: number
  actualUnitUsage?: number
  fabricSku?: string
  plannedMaterialMeter?: number
  actualMaterialMeter?: number
  actualCutQty?: number
  lineItems?: MarkerLineItem[]
  highLowPatternKeys?: string[]
  highLowCuttingRows?: HighLowCuttingRow[]
  highLowPatternRows?: HighLowPatternRow[]
  warningMessages?: string[]
  markerImageUrl: string
  markerImageName: string
  adjustmentRequired?: boolean
  adjustmentNote?: string
  replacementDraftFlag?: boolean
  adjustmentSummary?: string
  note: string
  updatedAt: string
  updatedBy?: string
}

export interface SpreadingRollRecord {
  rollRecordId: string
  spreadingSessionId: string
  sortOrder: number
  rollNo: string
  materialSku: string
  color?: string
  width: number
  labeledLength: number
  actualLength: number
  headLength: number
  tailLength: number
  layerCount: number
  totalLength?: number
  remainingLength?: number
  actualCutPieceQty?: number
  occurredAt?: string
  operatorNames: string[]
  handoverNotes: string
  usableLength: number
  note: string
  sourceChannel: SpreadingSourceChannel
  sourceWritebackId: string
  updatedFromPdaAt: string
}

export interface SpreadingOperatorRecord {
  operatorRecordId: string
  spreadingSessionId: string
  sortOrder: number
  rollRecordId: string
  operatorAccountId: string
  operatorName: string
  startAt: string
  endAt: string
  actionType: SpreadingOperatorActionType
  startLayer?: number
  endLayer?: number
  handledLayerCount?: number
  handledLength?: number
  handledPieceQty?: number
  pricingMode?: SpreadingPricingMode
  unitPrice?: number
  calculatedAmount?: number
  manualAmountAdjusted?: boolean
  adjustedAmount?: number
  amountNote?: string
  handoverFlag: boolean
  handoverNotes: string
  previousOperatorName?: string
  nextOperatorName?: string
  handoverAtLayer?: number
  handoverAtLength?: number
  note: string
  sourceChannel: SpreadingSourceChannel
  sourceWritebackId: string
  updatedFromPdaAt: string
}

export interface SpreadingOperatorQuantifiedRecord {
  operator: SpreadingOperatorRecord
  previousOperatorName: string
  nextOperatorName: string
  handledLayerCount: number | null
  handledPieceQty: number | null
  calculatedAmount: number | null
  displayAmount: number | null
  handoverAtLayer: number | null
  handoverAtLength: number | null
}

export interface SpreadingOperatorAmountSummaryRow {
  operatorName: string
  recordCount: number
  handledLayerCountTotal: number
  handledLengthTotal: number
  handledPieceQtyTotal: number
  calculatedAmountTotal: number
  displayAmountTotal: number
  hasManualAdjustedAmount: boolean
}

export interface SpreadingOperatorAmountSummary {
  rows: SpreadingOperatorAmountSummaryRow[]
  totalHandledLayerCount: number
  totalHandledLength: number
  totalHandledPieceQty: number
  totalCalculatedAmount: number
  totalDisplayAmount: number
  hasManualAdjustedAmount: boolean
  hasAnyAllocationData: boolean
}

export interface SpreadingRollHandoverSummary {
  rollRecordId: string
  rollNo: string
  operators: SpreadingOperatorQuantifiedRecord[]
  hasHandover: boolean
  hasWarnings: boolean
  continuityStatus: '连续' | '层数断档' | '层数重叠' | '待补录'
  totalHandledLength: number
  finalHandledLayer: number | null
  overlapDetected: boolean
  gapDetected: boolean
  lengthExceeded: boolean
  incompleteCoverage: boolean
  warnings: string[]
}

export interface SpreadingHandoverListSummary {
  handoverRollCount: number
  abnormalRollCount: number
  hasHandover: boolean
  hasAbnormalHandover: boolean
  statusLabel: string
}

export interface SpreadingImportSource {
  sourceMarkerId: string
  sourceMarkerNo: string
  sourceMarkerMode: MarkerModeKey
  sourceContextType: 'original-order' | 'merge-batch'
  sourceOriginalCutOrderIds: string[]
  sourceOriginalCutOrderNos: string[]
  sourceMergeBatchId: string
  sourceMergeBatchNo: string
  sourceStyleCode: string
  sourceSpuCode: string
  sourceMaterialSkuSummary: string
  sourceColorSummary: string
  importedAt: string
  importedBy: string
  reimported: boolean
  importNote: string
}

export interface SpreadingPlanLineItem {
  planItemId: string
  sourceMarkerLineItemId: string
  layoutCode: string
  layoutDetailText: string
  color: string
  spreadRepeatCount: number
  markerLength: number
  markerPieceCount: number
  singlePieceUsage: number
  plannedSpreadTotalLength: number
  widthHint: string
  note: string
}

export interface SpreadingHighLowPlanSnapshot {
  patternKeys: string[]
  cuttingRows: HighLowCuttingRow[]
  patternRows: HighLowPatternRow[]
  cuttingTotal: number
  patternTotal: number
}

export interface SpreadingReplenishmentWarning {
  warningId: string
  sourceType: 'original-order' | 'merge-batch' | 'spreading-session'
  sourceContextType: 'original-order' | 'merge-batch'
  spreadingSessionId: string
  spreadingSessionNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  materialSku: string
  materialAttr: string
  requiredQty: number
  theoreticalCapacityQty: number
  actualCutQty: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  totalActualLength: number
  totalUsableLength: number
  varianceLength: number
  shortageQty: number
  warningLevel: SpreadingWarningLevel
  suggestedAction: SpreadingSuggestedAction
  handled: boolean
  createdAt: string
  note: string
}

export interface SpreadingCompletionLinkage {
  completedAt: string
  completedBy: string
  linkedOriginalCutOrderIds: string[]
  linkedOriginalCutOrderNos: string[]
  generatedWarningId: string
  generatedWarning: boolean
  note: string
}

export interface SpreadingCompletionValidationResult {
  allowed: boolean
  messages: string[]
}

export interface SpreadingSession {
  spreadingSessionId: string
  sessionNo?: string
  contextType: 'original-order' | 'merge-batch'
  originalCutOrderIds: string[]
  mergeBatchId: string
  mergeBatchNo: string
  markerId?: string
  markerNo?: string
  styleCode?: string
  spuCode?: string
  materialSkuSummary?: string
  colorSummary?: string
  spreadingMode: MarkerModeKey
  status: SpreadingStatusKey
  importedFromMarker: boolean
  plannedLayers: number
  actualLayers: number
  totalActualLength: number
  totalHeadLength: number
  totalTailLength: number
  totalCalculatedUsableLength: number
  totalRemainingLength: number
  operatorCount: number
  rollCount: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  varianceLength: number
  varianceNote: string
  actualCutPieceQty?: number
  unitPrice?: number
  totalAmount?: number
  note: string
  createdAt: string
  updatedAt: string
  warningMessages?: string[]
  importSource?: SpreadingImportSource | null
  planLineItems?: SpreadingPlanLineItem[]
  highLowPlanSnapshot?: SpreadingHighLowPlanSnapshot | null
  theoreticalSpreadTotalLength?: number
  theoreticalActualCutPieceQty?: number
  importAdjustmentRequired?: boolean
  importAdjustmentNote?: string
  replenishmentWarning?: SpreadingReplenishmentWarning | null
  completionLinkage?: SpreadingCompletionLinkage | null
  sourceChannel: SpreadingSourceChannel
  sourceWritebackId: string
  updatedFromPdaAt: string
  rolls: SpreadingRollRecord[]
  operators: SpreadingOperatorRecord[]
}

export interface SpreadingVarianceSummary {
  configuredLengthTotal: number
  claimedLengthTotal: number
  actualLengthTotal: number
  usableLengthTotal: number
  remainingLengthTotal: number
  varianceLength: number
  estimatedPieceCapacity: number
  requiredPieceQty: number
  actualCutPieceQtyTotal: number
  shortageIndicator: boolean
  replenishmentHint: string
}

export interface SpreadingOperatorSummary {
  operatorCount: number
  handoverRollCount: number
  sortedOperators: SpreadingOperatorRecord[]
  operatorsByRollId: Record<string, SpreadingOperatorRecord[]>
  rollParticipantNames: Record<string, string[]>
}

export interface ReplenishmentPreview {
  level: 'OK' | 'WATCH' | 'ALERT' | 'MISSING'
  label: string
  detailText: string
  shortageIndicator: boolean
}

export interface MarkerSpreadingNavigationPayload {
  replenishment: Record<string, string | undefined>
  feiTickets: Record<string, string | undefined>
  originalOrders: Record<string, string | undefined>
  mergeBatches: Record<string, string | undefined>
  summary: Record<string, string | undefined>
}

export interface MarkerImportValidationResult {
  allowed: boolean
  messages: string[]
}

export interface MarkerSpreadingStore {
  markers: MarkerRecord[]
  sessions: SpreadingSession[]
}

export interface MarkerSpreadingStats {
  markerCount: number
  sessionCount: number
  inProgressCount: number
  doneCount: number
  rollCount: number
  warningCount: number
  contextOriginalOrderCount: number
  contextProductionOrderCount: number
}

export interface MarkerSpreadingViewModel {
  context: MarkerSpreadingContext | null
  prefilter: MarkerSpreadingPrefilter | null
  markerRecords: MarkerRecord[]
  spreadingSessions: SpreadingSession[]
  stats: MarkerSpreadingStats
}

const markerModeMeta: Record<MarkerModeKey, { label: string; className: string; detailText: string }> = {
  normal: {
    label: '正常铺布',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: 'normal：正常模式铺布，适合常规裁床直接平铺执行。',
  },
  'high-low': {
    label: '高低层模式',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: 'high-low：高低层模式，体现台阶式往上铺布的业务差异。',
  },
  folded: {
    label: '对折铺布模式',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: 'folded：对折铺布模式，用于对折裁片场景。',
  },
}

const spreadingStatusMeta: Record<SpreadingStatusKey, { label: string; className: string; detailText: string }> = {
  DRAFT: {
    label: '草稿',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '仅完成铺布草稿录入，尚未进入正式执行。',
  },
  IN_PROGRESS: {
    label: '进行中',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '当前铺布正在执行中，卷和人员记录仍可继续补录。',
  },
  DONE: {
    label: '已完成',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    detailText: '当前铺布记录已完成，可作为补料预警与后续打编号的基础数据。',
  },
  TO_FILL: {
    label: '待补录',
    className: 'bg-rose-100 text-rose-700 border border-rose-200',
    detailText: '当前铺布记录不完整，需要补录卷或人员信息。',
  },
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function parseTimeWeight(value: string): number {
  if (!value) return 0
  const timestamp = new Date(value.replace(' ', 'T')).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function formatQty(value: number): string {
  return numberFormatter.format(Math.max(value, 0))
}

function formatDateTime(value: string): string {
  return value || '待补'
}

function createSummaryMeta<Key extends string>(
  key: Key,
  label: string,
  className: string,
  detailText: string,
): MarkerSpreadingSummaryMeta<Key> {
  return { key, label, className, detailText }
}

function normalizeMarkerMode(mode: string | undefined): MarkerModeKey {
  if (mode === 'NORMAL') return 'normal'
  if (mode === 'HIGH_LOW') return 'high-low'
  if (mode === 'FOLDED') return 'folded'
  if (mode === 'high-low' || mode === 'folded' || mode === 'normal') return mode
  return 'normal'
}

function buildPlannedSizeRatioText(sizeDistribution: MarkerSizeDistributionItem[]): string {
  return sizeDistribution
    .filter((item) => item.quantity > 0)
    .map((item) => `${item.sizeLabel}×${item.quantity}`)
    .join(' / ')
}

function createDefaultSizeValueMap(): Record<MarkerSizeKey, number> {
  return {
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    '2XL': 0,
    '3XL': 0,
    '4XL': 0,
    onesize: 0,
    plusonesize: 0,
  }
}

function normalizeHighLowCuttingRow(item: Partial<HighLowCuttingRow>, markerId: string, index: number): HighLowCuttingRow {
  const sizeValues = createDefaultSizeValueMap()
  MARKER_SIZE_KEYS.forEach((sizeKey) => {
    sizeValues[sizeKey] = Number(item.sizeValues?.[sizeKey] ?? 0)
  })
  const total = MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + Math.max(sizeValues[sizeKey], 0), 0)

  return {
    rowId: item.rowId || `high-low-cutting-${markerId}-${index + 1}`,
    markerId,
    color: item.color || '',
    sizeValues,
    total,
  }
}

function normalizeHighLowPatternRow(
  item: Partial<HighLowPatternRow>,
  markerId: string,
  index: number,
  patternKeys: string[],
): HighLowPatternRow {
  const patternValues = Object.fromEntries(patternKeys.map((key) => [key, Number(item.patternValues?.[key] ?? 0)]))
  const total = patternKeys.reduce((sum, key) => sum + Math.max(patternValues[key] || 0, 0), 0)

  return {
    rowId: item.rowId || `high-low-pattern-${markerId}-${index + 1}`,
    markerId,
    color: item.color || '',
    patternValues,
    total,
  }
}

function normalizeMarkerLineItem(item: Partial<MarkerLineItem>, markerId: string, index: number): MarkerLineItem {
  const markerPieceCount = Number(item.markerPieceCount ?? item.pieceCount ?? 0)
  const markerLength = Number(item.markerLength ?? 0)
  const spreadRepeatCount = Number(item.spreadRepeatCount ?? 1)
  const spreadTotalLength = Number(
    item.spreadTotalLength ??
      item.spreadingTotalLength ??
      Number((((markerLength || 0) + 0.06) * Math.max(spreadRepeatCount, 0)).toFixed(2)),
  )
  return {
    lineItemId: item.lineItemId || item.markerLineItemId || `line-${markerId}-${index + 1}`,
    markerId,
    lineNo: Number(item.lineNo ?? index + 1),
    layoutCode: item.layoutCode || `A-${index + 1}`,
    layoutDetailText: item.layoutDetailText || item.ratioLabel || '',
    color: item.color || '',
    spreadRepeatCount,
    markerLength,
    markerPieceCount,
    singlePieceUsage: Number(item.singlePieceUsage ?? computeSinglePieceUsage(markerLength, markerPieceCount)),
    spreadTotalLength,
    widthHint: item.widthHint || '',
    note: item.note || '',
    markerLineItemId: item.lineItemId || item.markerLineItemId || `line-${markerId}-${index + 1}`,
    ratioLabel: item.layoutDetailText || item.ratioLabel || '',
    pieceCount: markerPieceCount,
    spreadingTotalLength: spreadTotalLength,
  }
}

export function deriveMarkerTemplateByMode(mode: MarkerModeKey | string): MarkerTemplateKey {
  return normalizeMarkerMode(mode) === 'high-low' ? 'matrix-template' : 'row-template'
}

export function computeSinglePieceUsage(markerLength: number, markerPieceCount: number): number {
  if (markerPieceCount <= 0) return 0
  return Number((markerLength / markerPieceCount).toFixed(3))
}

export function computeNormalMarkerSpreadTotalLength(lineItems: MarkerLineItem[] = []): number {
  return Number(
    lineItems
      .reduce(
        (sum, item) =>
          sum +
          Math.max(
            Number((((item.markerLength || 0) + 0.06) * Math.max(item.spreadRepeatCount || 0, 0)).toFixed(2)),
            0,
          ),
        0,
      )
      .toFixed(2),
  )
}

export function computeHighLowCuttingTotals(rows: HighLowCuttingRow[] = []): {
  rows: HighLowCuttingRow[]
  cuttingTotal: number
} {
  const normalizedRows = rows.map((row, index) => normalizeHighLowCuttingRow(row, row.markerId, index))
  return {
    rows: normalizedRows,
    cuttingTotal: normalizedRows.reduce((sum, row) => sum + row.total, 0),
  }
}

export function computeHighLowPatternTotals(rows: HighLowPatternRow[] = [], patternKeys: string[] = []): {
  rows: HighLowPatternRow[]
  patternTotal: number
} {
  const normalizedRows = rows.map((row, index) => normalizeHighLowPatternRow(row, row.markerId, index, patternKeys))
  return {
    rows: normalizedRows,
    patternTotal: normalizedRows.reduce((sum, row) => sum + row.total, 0),
  }
}

export function computeUsageSummary(marker: Partial<MarkerRecord>): {
  procurementUnitUsage: number
  actualUnitUsage: number
  plannedMaterialMeter: number
  actualMaterialMeter: number
  actualCutQty: number
} {
  const matrixActualCutQty =
    normalizeMarkerMode(marker.markerMode as string | undefined) === 'high-low'
      ? computeHighLowCuttingTotals(marker.highLowCuttingRows || []).cuttingTotal
      : 0
  const actualCutQty = Number(marker.actualCutQty ?? (matrixActualCutQty > 0 ? matrixActualCutQty : marker.totalPieces ?? 0))
  const procurementUnitUsage = Number(marker.procurementUnitUsage ?? marker.singlePieceUsage ?? 0)
  const actualUnitUsage = Number(marker.actualUnitUsage ?? marker.singlePieceUsage ?? 0)
  const layerCount = Number(marker.plannedLayerCount ?? 0)
  const totalPieces = Number(marker.totalPieces ?? 0)
  const mode = normalizeMarkerMode(marker.markerMode as string | undefined)
  const plannedMaterialMeter = Number(
    marker.plannedMaterialMeter ??
      (mode === 'folded'
        ? Number(((procurementUnitUsage * Math.max(totalPieces, 0)) / 2).toFixed(2))
        : Number((((procurementUnitUsage || 0) + 0.06) * Math.max(layerCount, 0)).toFixed(2))) ??
      0,
  )
  const actualMaterialMeter = Number(
    marker.actualMaterialMeter ??
      (mode === 'folded'
        ? Number(((actualUnitUsage * Math.max(actualCutQty, 0)) / 2).toFixed(2))
        : Number((((actualUnitUsage || 0) + 0.06) * Math.max(layerCount || actualCutQty, 0)).toFixed(2))) ??
      0,
  )

  return {
    procurementUnitUsage,
    actualUnitUsage,
    plannedMaterialMeter,
    actualMaterialMeter,
    actualCutQty,
  }
}

export function validateMarkerModeShape(marker: Partial<MarkerRecord>): string[] {
  const mode = normalizeMarkerMode(marker.markerMode as string | undefined)
  const template = deriveMarkerTemplateByMode(mode)
  const issues: string[] = []

  if (template === 'row-template' && !(marker.lineItems || []).length) {
    issues.push('当前模式应使用行明细模板，但排版明细为空。')
  }

  if (template === 'matrix-template') {
    if (!(marker.highLowCuttingRows || []).length) {
      issues.push('高低层模式缺少裁剪明细矩阵。')
    }
    if (!(marker.highLowPatternRows || []).length) {
      issues.push('高低层模式缺少唛架模式矩阵。')
    }
  }

  return issues
}

export function buildMarkerWarningMessages(marker: Partial<MarkerRecord>): string[] {
  const warnings: string[] = []
  const usageSummary = computeUsageSummary(marker)

  if ((marker.spreadTotalLength || 0) > 0 && usageSummary.plannedMaterialMeter > 0 && (marker.spreadTotalLength || 0) > usageSummary.plannedMaterialMeter) {
    warnings.push('铺布总长度超过领取布料长度参考值。')
  }
  if (usageSummary.actualMaterialMeter > usageSummary.plannedMaterialMeter && usageSummary.plannedMaterialMeter > 0) {
    warnings.push('实际使用米数超过预算米数。')
  }
  if (usageSummary.actualUnitUsage > usageSummary.procurementUnitUsage && usageSummary.procurementUnitUsage > 0) {
    warnings.push('实际单件用量大于采购单件用量。')
  }

  if (normalizeMarkerMode(marker.markerMode as string | undefined) === 'high-low') {
    const cuttingTotal = computeHighLowCuttingTotals(marker.highLowCuttingRows || []).cuttingTotal
    const patternTotal = computeHighLowPatternTotals(marker.highLowPatternRows || [], marker.highLowPatternKeys || []).patternTotal
    const sizeTotal = computeMarkerTotalPieces(marker.sizeDistribution || [])
    if ((cuttingTotal > 0 || patternTotal > 0) && (cuttingTotal !== sizeTotal || patternTotal !== sizeTotal)) {
      warnings.push('高低层模式矩阵合计与尺码配比总件数不一致。')
    }
  }

  return [...validateMarkerModeShape(marker), ...warnings]
}

function normalizeMarkerRecord(marker: MarkerRecord): MarkerRecord {
  const sizeDistribution = Array.isArray(marker.sizeDistribution) ? marker.sizeDistribution : []
  const normalizedMode = normalizeMarkerMode(marker.markerMode as string | undefined)
  const lineItems = (marker.lineItems || []).map((item, index) => normalizeMarkerLineItem(item, marker.markerId, index))
  const highLowPatternKeys = uniqueStrings([...(marker.highLowPatternKeys || []), ...DEFAULT_HIGH_LOW_PATTERN_KEYS])
  const highLowCuttingRows = (marker.highLowCuttingRows || []).map((item, index) => normalizeHighLowCuttingRow(item, marker.markerId, index))
  const highLowPatternRows = (marker.highLowPatternRows || []).map((item, index) =>
    normalizeHighLowPatternRow(item, marker.markerId, index, highLowPatternKeys),
  )
  const totalPieces = computeMarkerTotalPieces(sizeDistribution)
  const spreadTotalLength =
    marker.spreadTotalLength ??
    (deriveMarkerTemplateByMode(normalizedMode) === 'row-template'
      ? computeNormalMarkerSpreadTotalLength(lineItems)
      : Number(marker.actualMaterialMeter ?? 0))
  const usageSummary = computeUsageSummary(marker)
  const warningMessages = buildMarkerWarningMessages({
    ...marker,
    markerMode: normalizedMode,
    lineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    spreadTotalLength,
    totalPieces,
  })
  return {
    ...marker,
    originalCutOrderNos: marker.originalCutOrderNos || [],
    markerMode: normalizedMode,
    totalPieces,
    spreadTotalLength,
    lineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    colorSummary:
      marker.colorSummary ||
      uniqueStrings([...lineItems.map((item) => item.color), ...highLowCuttingRows.map((item) => item.color), ...highLowPatternRows.map((item) => item.color)]).join(' / '),
    plannedSizeRatioText: marker.plannedSizeRatioText || buildPlannedSizeRatioText(sizeDistribution),
    markerLength: marker.markerLength ?? marker.netLength,
    adjustmentRequired: Boolean(marker.adjustmentRequired),
    adjustmentNote: marker.adjustmentNote || marker.adjustmentSummary || '',
    replacementDraftFlag: Boolean(marker.replacementDraftFlag),
    actualUnitUsage: usageSummary.actualUnitUsage,
    procurementUnitUsage: usageSummary.procurementUnitUsage,
    plannedMaterialMeter: usageSummary.plannedMaterialMeter,
    actualMaterialMeter: usageSummary.actualMaterialMeter,
    actualCutQty: usageSummary.actualCutQty,
    warningMessages,
    updatedBy: marker.updatedBy || '',
  }
}

export function deriveMarkerModeMeta(mode: MarkerModeKey | string): MarkerSpreadingSummaryMeta<MarkerModeKey> {
  const normalized = normalizeMarkerMode(mode)
  const meta = markerModeMeta[normalized]
  return createSummaryMeta(normalized, meta.label, meta.className, meta.detailText)
}

export function deriveSpreadingModeMeta(mode: MarkerModeKey | string): MarkerSpreadingSummaryMeta<MarkerModeKey> {
  return deriveMarkerModeMeta(mode)
}

export function computeMarkerTotalPieces(sizeDistribution: MarkerSizeDistributionItem[]): number {
  return sizeDistribution.reduce((sum, item) => sum + Math.max(item.quantity, 0), 0)
}

export function computeUsableLength(actualLength: number, headLength: number, tailLength: number): number {
  return Number((actualLength - headLength - tailLength).toFixed(2))
}

export function computeRemainingLength(labeledLength: number, actualLength: number): number {
  return Number((labeledLength - actualLength).toFixed(2))
}

export function computeRollActualCutPieceQty(layerCount: number, markerTotalPieces: number): number {
  if (layerCount <= 0 || markerTotalPieces <= 0) return 0
  return Math.max(Math.round(layerCount * markerTotalPieces), 0)
}

export function computeTheoreticalCutQty(session: Partial<SpreadingSession>, markerTotalPieces: number): number {
  const rollLayerTotal = summarizeSpreadingRolls(session.rolls || []).totalLayers
  const actualLayerTotal = Number(session.actualLayers || 0)
  const layerBase = Math.max(rollLayerTotal || actualLayerTotal, 0)
  if (layerBase <= 0 || markerTotalPieces <= 0) return 0
  return Math.max(Math.round(layerBase * markerTotalPieces), 0)
}

export function computeActualCutQty(session: Partial<SpreadingSession>): number {
  const rollSummary = summarizeSpreadingRolls(session.rolls || [])
  return Math.max(Number(session.actualCutPieceQty || rollSummary.totalActualCutPieceQty || 0), 0)
}

export function computeLengthVariance(claimedLengthTotal: number, actualLengthTotal: number): number {
  return Number((Number(claimedLengthTotal || 0) - Number(actualLengthTotal || 0)).toFixed(2))
}

export function computeShortageQty(requiredQty: number, actualCutQty: number): number {
  return Math.max(Number(requiredQty || 0) - Math.max(Number(actualCutQty || 0), 0), 0)
}

export function deriveSpreadingWarningLevel(options: {
  requiredQty: number
  actualCutQty: number
  varianceLength: number
  claimedLengthTotal: number
  actualLengthTotal: number
  warningMessages?: string[]
}): SpreadingWarningLevel {
  const { requiredQty, actualCutQty, varianceLength, claimedLengthTotal, actualLengthTotal, warningMessages = [] } = options

  if (!requiredQty || !claimedLengthTotal || !actualLengthTotal) return '中'
  if (varianceLength < 0 || computeShortageQty(requiredQty, actualCutQty) > 0) return '高'
  if (warningMessages.length > 0 || Math.abs(varianceLength) <= 5) return '中'
  return '低'
}

export function deriveSpreadingSuggestedAction(options: {
  requiredQty: number
  actualCutQty: number
  varianceLength: number
  claimedLengthTotal: number
  actualLengthTotal: number
  warningMessages?: string[]
}): SpreadingSuggestedAction {
  const { requiredQty, actualCutQty, varianceLength, claimedLengthTotal, actualLengthTotal, warningMessages = [] } = options

  if (!requiredQty || !claimedLengthTotal || !actualLengthTotal) return '数据不足，待补录'
  if (computeShortageQty(requiredQty, actualCutQty) > 0 || varianceLength < 0) return '建议补料'
  if (warningMessages.length > 0) return '存在异常差异，需人工确认'
  return '无需补料'
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function defaultSizeDistribution(rowCount: number): MarkerSizeDistributionItem[] {
  const baseline = Math.max(rowCount, 1)
  return MARKER_SIZE_KEYS.map((sizeLabel, index) => ({
    sizeLabel,
    quantity: index < 5 ? [baseline * 12, baseline * 18, baseline * 16, baseline * 10, baseline * 6][index] || 0 : 0,
  }))
}

function createDefaultHighLowCuttingRows(markerId: string, colors: string[], sizeDistribution: MarkerSizeDistributionItem[]): HighLowCuttingRow[] {
  const primaryColor = colors[0] || '主色'
  const secondaryColor = colors[1] || ''
  const distributionMap = Object.fromEntries(sizeDistribution.map((item) => [item.sizeLabel, item.quantity]))
  return [primaryColor, secondaryColor]
    .filter(Boolean)
    .map((color, index) =>
      normalizeHighLowCuttingRow(
        {
          rowId: `seed-high-low-cutting-${markerId}-${index + 1}`,
          markerId,
          color,
          sizeValues: {
            ...createDefaultSizeValueMap(),
            S: Math.max(Math.floor((distributionMap.S || 0) / Math.max(index + 1, 1)), 0),
            M: Math.max(Math.floor((distributionMap.M || 0) / Math.max(index + 1, 1)), 0),
            L: Math.max(Math.floor((distributionMap.L || 0) / Math.max(index + 1, 1)), 0),
            XL: Math.max(Math.floor((distributionMap.XL || 0) / Math.max(index + 1, 1)), 0),
            '2XL': Math.max(Math.floor((distributionMap['2XL'] || 0) / Math.max(index + 1, 1)), 0),
            '3XL': distributionMap['3XL'] || 0,
            '4XL': distributionMap['4XL'] || 0,
            onesize: distributionMap.onesize || 0,
            plusonesize: distributionMap.plusonesize || 0,
          },
        },
        markerId,
        index,
      ),
    )
}

function createDefaultHighLowPatternRows(markerId: string, colors: string[], patternKeys: string[]): HighLowPatternRow[] {
  return (colors.length ? colors : ['主色']).map((color, index) =>
    normalizeHighLowPatternRow(
      {
        rowId: `seed-high-low-pattern-${markerId}-${index + 1}`,
        markerId,
        color,
        patternValues: Object.fromEntries(patternKeys.map((key, patternIndex) => [key, patternIndex === index ? 12 : 0])),
      },
      markerId,
      index,
      patternKeys,
    ),
  )
}

function summarizeMaterialSku(rows: MaterialPrepRow[]): string {
  return uniqueStrings(rows.flatMap((row) => row.materialLineItems.map((item) => item.materialSku))).join(' / ')
}

function getContextRowsByMergeBatch(batch: MergeBatchRecord, rowsById: Record<string, MaterialPrepRow>): MaterialPrepRow[] {
  return batch.items
    .map((item) => rowsById[item.originalCutOrderId] || rowsById[item.originalCutOrderNo])
    .filter((row): row is MaterialPrepRow => Boolean(row))
}

function buildContext(
  rows: MaterialPrepRow[],
  rowsById: Record<string, MaterialPrepRow>,
  mergeBatches: MergeBatchRecord[],
  prefilter: MarkerSpreadingPrefilter | null,
): MarkerSpreadingContext | null {
  if (!prefilter) return null

  const mergeBatch =
    (prefilter.mergeBatchId && mergeBatches.find((batch) => batch.mergeBatchId === prefilter.mergeBatchId)) ||
    (prefilter.mergeBatchNo && mergeBatches.find((batch) => batch.mergeBatchNo === prefilter.mergeBatchNo))

  if (mergeBatch) {
    const batchRows = getContextRowsByMergeBatch(mergeBatch, rowsById)
    if (!batchRows.length) return null

    return {
      contextType: 'merge-batch',
      originalCutOrderIds: batchRows.map((row) => row.originalCutOrderId),
      originalCutOrderNos: batchRows.map((row) => row.originalCutOrderNo),
      mergeBatchId: mergeBatch.mergeBatchId,
      mergeBatchNo: mergeBatch.mergeBatchNo,
      productionOrderNos: uniqueStrings(batchRows.map((row) => row.productionOrderNo)),
      styleCode: mergeBatch.styleCode || batchRows[0]?.styleCode || '',
      spuCode: mergeBatch.spuCode || batchRows[0]?.spuCode || '',
      styleName: mergeBatch.styleName || batchRows[0]?.styleName || '',
      materialSkuSummary: mergeBatch.materialSkuSummary || summarizeMaterialSku(batchRows),
      materialPrepRows: batchRows,
    }
  }

  const matchedRow =
    (prefilter.originalCutOrderId && rowsById[prefilter.originalCutOrderId]) ||
    (prefilter.originalCutOrderNo && rows.find((row) => row.originalCutOrderNo === prefilter.originalCutOrderNo)) ||
    null

  if (!matchedRow) return null

  return {
    contextType: 'original-order',
    originalCutOrderIds: [matchedRow.originalCutOrderId],
    originalCutOrderNos: [matchedRow.originalCutOrderNo],
    mergeBatchId: matchedRow.mergeBatchIds[0] || '',
    mergeBatchNo: matchedRow.latestMergeBatchNo || '',
    productionOrderNos: [matchedRow.productionOrderNo],
    styleCode: matchedRow.styleCode,
    spuCode: matchedRow.spuCode,
    styleName: matchedRow.styleName,
    materialSkuSummary: matchedRow.materialSkuSummary,
    materialPrepRows: [matchedRow],
  }
}

function matchesContext<T extends { contextType: 'original-order' | 'merge-batch'; originalCutOrderIds: string[]; mergeBatchId: string }>(
  record: T,
  context: MarkerSpreadingContext | null,
): boolean {
  if (!context) return false
  if (context.contextType === 'merge-batch') {
    return record.contextType === 'merge-batch' && record.mergeBatchId === context.mergeBatchId
  }
  return record.contextType === 'original-order' && record.originalCutOrderIds[0] === context.originalCutOrderIds[0]
}

function buildSeedMarker(context: MarkerSpreadingContext): MarkerRecord {
  const sizeDistribution = defaultSizeDistribution(context.materialPrepRows.length)
  const totalPieces = computeMarkerTotalPieces(sizeDistribution)
  const configuredLengthTotal = context.materialPrepRows.reduce(
    (sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.configuredQty, 0),
    0,
  )
  const netLength = Number((configuredLengthTotal > 0 ? configuredLengthTotal : totalPieces * 1.2).toFixed(2))
  const singlePieceUsage = totalPieces > 0 ? Number((netLength / totalPieces).toFixed(3)) : 0
  const markerId = `seed-marker-${context.contextType}-${context.mergeBatchId || context.originalCutOrderIds[0]}`
  const markerMode: MarkerModeKey = context.contextType === 'merge-batch' ? 'high-low' : 'normal'
  const highLowPatternKeys = [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const colors = uniqueStrings(context.materialPrepRows.map((row) => row.color))
  const lineItems =
    markerMode === 'high-low'
      ? []
      : context.materialPrepRows.map((row, index) => ({
          lineItemId: `seed-line-${context.contextType}-${context.mergeBatchId || row.originalCutOrderId}-${index}`,
          markerId,
          lineNo: index + 1,
          layoutCode: `A-${index + 1}`,
          layoutDetailText: sizeDistribution.filter((item) => item.quantity > 0).map((item) => `${item.sizeLabel}*${item.quantity}`).join(' + '),
          color: row.color,
          ratioLabel: sizeDistribution.map((item) => `${item.sizeLabel}×${item.quantity}`).join(' / '),
          spreadRepeatCount: Math.max(Math.ceil(totalPieces / 20), 1),
          markerLength: Number((netLength / Math.max(context.materialPrepRows.length, 1)).toFixed(2)),
          markerPieceCount: Math.max(Math.floor(totalPieces / Math.max(context.materialPrepRows.length, 1)), 1),
          pieceCount: Math.max(Math.floor(totalPieces / Math.max(context.materialPrepRows.length, 1)), 1),
          singlePieceUsage,
          spreadTotalLength: Number((netLength * 1.1).toFixed(2)),
          spreadingTotalLength: Number((netLength * 1.1).toFixed(2)),
          widthHint: '默认门幅 160cm',
          note: `${row.materialSkuSummary} · 默认排版明细`,
        }))
  const highLowCuttingRows = markerMode === 'high-low' ? createDefaultHighLowCuttingRows(markerId, colors, sizeDistribution) : []
  const highLowPatternRows = markerMode === 'high-low' ? createDefaultHighLowPatternRows(markerId, colors, highLowPatternKeys) : []

  return {
    markerId,
    markerNo: `MJ-${context.contextType === 'merge-batch' ? 'B' : 'O'}-${(context.mergeBatchNo || context.originalCutOrderNos[0] || '001').slice(-6)}`,
    contextType: context.contextType,
    originalCutOrderIds: [...context.originalCutOrderIds],
    originalCutOrderNos: [...context.originalCutOrderNos],
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    materialSkuSummary: context.materialSkuSummary,
    colorSummary: uniqueStrings(context.materialPrepRows.map((row) => row.color)).join(' / '),
    markerMode,
    sizeDistribution,
    totalPieces,
    netLength,
    singlePieceUsage,
    spreadTotalLength: Number((netLength * 1.1).toFixed(2)),
    materialCategory: context.materialPrepRows[0]?.materialCategory || '',
    materialAttr: context.materialPrepRows[0]?.materialLabel || '',
    plannedSizeRatioText: buildPlannedSizeRatioText(sizeDistribution),
    plannedLayerCount: Math.max(Math.ceil(totalPieces / 20), 1),
    plannedMarkerCount: context.materialPrepRows.length,
    markerLength: netLength,
    procurementUnitUsage: singlePieceUsage,
    actualUnitUsage: Number((singlePieceUsage * 1.02).toFixed(3)),
    fabricSku: context.materialPrepRows[0]?.materialLineItems[0]?.materialSku || '',
    plannedMaterialMeter: Number((configuredLengthTotal || netLength * 1.05).toFixed(2)),
    actualMaterialMeter: Number((netLength * 0.98).toFixed(2)),
    actualCutQty: totalPieces,
    lineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    markerImageUrl: '',
    markerImageName: '',
    adjustmentRequired: false,
    adjustmentNote: '',
    replacementDraftFlag: false,
    adjustmentSummary: '后续可补唛架调整记录 / 换一入口。',
    note: '当前为原型默认唛架草稿，可根据现场唛架图与尺码配比继续调整。',
    updatedAt: '',
    updatedBy: '系统预置',
    warningMessages: buildMarkerWarningMessages({
      markerMode,
      sizeDistribution,
      spreadTotalLength: Number((netLength * 1.1).toFixed(2)),
      procurementUnitUsage: singlePieceUsage,
      actualUnitUsage: Number((singlePieceUsage * 1.02).toFixed(3)),
      plannedMaterialMeter: Number((configuredLengthTotal || netLength * 1.05).toFixed(2)),
      actualMaterialMeter: Number((netLength * 0.98).toFixed(2)),
      actualCutQty: totalPieces,
      lineItems,
      highLowPatternKeys,
      highLowCuttingRows,
      highLowPatternRows,
    }),
  }
}

export function createSpreadingDraftFromMarker(
  marker: MarkerRecord,
  context: MarkerSpreadingContext,
  now = new Date(),
  options?: {
    baseSession?: Partial<SpreadingSession> | null
    reimported?: boolean
    importNote?: string
  },
): SpreadingSession {
  const importSource = buildSpreadingImportSource(marker, context, now, options?.reimported, options?.importNote)
  const planLineItems = buildSpreadingPlanLineItemsFromMarker(marker)
  const highLowPlanSnapshot = buildSpreadingHighLowPlanSnapshotFromMarker(marker)
  const plannedLayers = Math.max(Number(marker.plannedLayerCount || Math.ceil(marker.totalPieces / 20) || 1), 1)
  const theoreticalSpreadTotalLength =
    normalizeMarkerMode(marker.markerMode as string | undefined) === 'high-low'
      ? Number(marker.spreadTotalLength || marker.actualMaterialMeter || 0)
      : Number(marker.spreadTotalLength || computeNormalMarkerSpreadTotalLength(marker.lineItems || []))
  const theoreticalActualCutPieceQty = Math.max(plannedLayers * Math.max(marker.totalPieces || 0, 0), 0)
  const baseSession = options?.baseSession || null
  const timestamp = now.getTime()
  return {
    spreadingSessionId: baseSession?.spreadingSessionId || `spreading-session-${timestamp}`,
    sessionNo: baseSession?.sessionNo || `PB-${String(timestamp).slice(-6)}`,
    contextType: context.contextType,
    originalCutOrderIds: [...context.originalCutOrderIds],
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    markerId: marker.markerId,
    markerNo: marker.markerNo || '',
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    materialSkuSummary: context.materialSkuSummary,
    colorSummary: marker.colorSummary || uniqueStrings(context.materialPrepRows.map((row) => row.color)).join(' / '),
    spreadingMode: normalizeMarkerMode(marker.markerMode as string | undefined),
    status: (baseSession?.status as SpreadingStatusKey) || 'DRAFT',
    importedFromMarker: true,
    plannedLayers,
    actualLayers: baseSession?.actualLayers || 0,
    totalActualLength: baseSession?.totalActualLength || 0,
    totalHeadLength: baseSession?.totalHeadLength || 0,
    totalTailLength: baseSession?.totalTailLength || 0,
    totalCalculatedUsableLength: baseSession?.totalCalculatedUsableLength || 0,
    totalRemainingLength: baseSession?.totalRemainingLength || 0,
    operatorCount: baseSession?.operatorCount || 0,
    rollCount: baseSession?.rollCount || 0,
    configuredLengthTotal: baseSession?.configuredLengthTotal || 0,
    claimedLengthTotal: baseSession?.claimedLengthTotal || 0,
    varianceLength: baseSession?.varianceLength || 0,
    varianceNote: baseSession?.varianceNote || '',
    actualCutPieceQty: baseSession?.actualCutPieceQty || 0,
    unitPrice: baseSession?.unitPrice || 0,
    totalAmount: baseSession?.totalAmount || 0,
    note: baseSession?.note || '铺布草稿已从当前唛架记录导入，可继续补录卷与人员。',
    createdAt: baseSession?.createdAt || nowText(now),
    updatedAt: nowText(now),
    warningMessages: baseSession?.warningMessages || [],
    importSource,
    planLineItems,
    highLowPlanSnapshot,
    theoreticalSpreadTotalLength,
    theoreticalActualCutPieceQty,
    importAdjustmentRequired: baseSession?.importAdjustmentRequired || false,
    importAdjustmentNote: baseSession?.importAdjustmentNote || '',
    replenishmentWarning: baseSession?.replenishmentWarning || null,
    completionLinkage: baseSession?.completionLinkage || null,
    sourceChannel: 'MANUAL',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
    rolls: baseSession?.rolls ? [...baseSession.rolls] : [],
    operators: baseSession?.operators ? [...baseSession.operators] : [],
  }
}

export function validateMarkerForSpreadingImport(marker: Partial<MarkerRecord>): MarkerImportValidationResult {
  const messages: string[] = []
  const mode = marker.markerMode ? normalizeMarkerMode(marker.markerMode as string) : null
  const templateType = mode ? deriveMarkerTemplateByMode(mode) : null

  if (!mode) messages.push('唛架模式不能为空，不能发起铺布导入。')
  if (!marker.contextType) messages.push('上下文类型不能为空，不能发起铺布导入。')
  if (!(marker.originalCutOrderIds || []).length && !marker.mergeBatchId && !marker.mergeBatchNo) {
    messages.push('唛架必须至少关联原始裁片单或合并裁剪批次，才能导入铺布。')
  }
  if (Number(marker.totalPieces || 0) <= 0) messages.push('唛架总件数必须大于 0，才能导入铺布。')
  if (Number(marker.netLength || 0) <= 0) messages.push('唛架净长度不能为空，才能导入铺布。')
  if (Number(marker.singlePieceUsage || 0) <= 0) messages.push('唛架单件用量不能为空，才能导入铺布。')

  if (templateType === 'row-template' && !(marker.lineItems || []).length) {
    messages.push('当前唛架缺少排版明细，不能导入铺布草稿。')
  }

  if (templateType === 'matrix-template') {
    if (!(marker.highLowCuttingRows || []).length) {
      messages.push('高低层模式缺少裁剪明细矩阵，不能导入铺布草稿。')
    }
    if (!(marker.highLowPatternRows || []).length) {
      messages.push('高低层模式缺少模式分布矩阵，不能导入铺布草稿。')
    }
  }

  return {
    allowed: messages.length === 0,
    messages,
  }
}

export function buildSpreadingPlanLineItemsFromMarker(marker: MarkerRecord): SpreadingPlanLineItem[] {
  return (marker.lineItems || []).map((item, index) => ({
    planItemId: `spreading-plan-${marker.markerId}-${index + 1}`,
    sourceMarkerLineItemId: item.lineItemId || item.markerLineItemId || '',
    layoutCode: item.layoutCode || `A-${index + 1}`,
    layoutDetailText: item.layoutDetailText || item.ratioLabel || '',
    color: item.color || '',
    spreadRepeatCount: Number(item.spreadRepeatCount || 0),
    markerLength: Number(item.markerLength || 0),
    markerPieceCount: Number(item.markerPieceCount ?? item.pieceCount ?? 0),
    singlePieceUsage:
      Number(item.singlePieceUsage || 0) ||
      computeSinglePieceUsage(Number(item.markerLength || 0), Number(item.markerPieceCount ?? item.pieceCount ?? 0)),
    plannedSpreadTotalLength:
      Number(item.spreadTotalLength || item.spreadingTotalLength || 0) ||
      Number((((Number(item.markerLength || 0) + 0.06) * Math.max(Number(item.spreadRepeatCount || 0), 0)).toFixed(2))),
    widthHint: item.widthHint || '',
    note: item.note || '',
  }))
}

export function buildSpreadingHighLowPlanSnapshotFromMarker(marker: MarkerRecord): SpreadingHighLowPlanSnapshot | null {
  if (deriveMarkerTemplateByMode(marker.markerMode) !== 'matrix-template') return null
  const patternKeys = marker.highLowPatternKeys?.length ? [...marker.highLowPatternKeys] : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const cuttingTotals = computeHighLowCuttingTotals(marker.highLowCuttingRows || [])
  const patternTotals = computeHighLowPatternTotals(marker.highLowPatternRows || [], patternKeys)
  return {
    patternKeys,
    cuttingRows: cuttingTotals.rows,
    patternRows: patternTotals.rows,
    cuttingTotal: cuttingTotals.cuttingTotal,
    patternTotal: patternTotals.patternTotal,
  }
}

export function buildSpreadingImportSource(
  marker: MarkerRecord,
  context: MarkerSpreadingContext,
  now = new Date(),
  reimported = false,
  importNote = '',
): SpreadingImportSource {
  return {
    sourceMarkerId: marker.markerId,
    sourceMarkerNo: marker.markerNo || marker.markerId,
    sourceMarkerMode: normalizeMarkerMode(marker.markerMode as string | undefined),
    sourceContextType: context.contextType,
    sourceOriginalCutOrderIds: [...context.originalCutOrderIds],
    sourceOriginalCutOrderNos: [...context.originalCutOrderNos],
    sourceMergeBatchId: context.mergeBatchId,
    sourceMergeBatchNo: context.mergeBatchNo,
    sourceStyleCode: marker.styleCode || context.styleCode,
    sourceSpuCode: marker.spuCode || context.spuCode,
    sourceMaterialSkuSummary: marker.materialSkuSummary || context.materialSkuSummary,
    sourceColorSummary: marker.colorSummary || uniqueStrings(context.materialPrepRows.map((row) => row.color)).join(' / '),
    importedAt: nowText(now),
    importedBy: '系统导入',
    reimported,
    importNote: importNote || (reimported ? '已按导入策略重新同步唛架理论数据。' : '由唛架记录生成铺布草稿。'),
  }
}

export function buildSpreadingReplenishmentWarning(options: {
  session: Partial<SpreadingSession>
  markerTotalPieces: number
  originalCutOrderNos: string[]
  productionOrderNos: string[]
  materialAttr?: string
  createdAt?: string
  note?: string
  warningMessages?: string[]
}): SpreadingReplenishmentWarning {
  const session = options.session
  const rollSummary = summarizeSpreadingRolls(session.rolls || [])
  const claimedLengthTotal = Number(session.claimedLengthTotal || 0)
  const configuredLengthTotal = Number(session.configuredLengthTotal || 0)
  const totalActualLength = Number(session.totalActualLength || rollSummary.totalActualLength || 0)
  const totalUsableLength = Number(session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength || 0)
  const requiredQty = Math.max(
    Number(session.theoreticalActualCutPieceQty || 0),
    Number(session.plannedLayers || 0) * Math.max(options.markerTotalPieces, 0),
  )
  const theoreticalCapacityQty = computeTheoreticalCutQty(session, options.markerTotalPieces)
  const actualCutQty = computeActualCutQty(session)
  const varianceLength = computeLengthVariance(claimedLengthTotal, totalActualLength)
  const shortageQty = computeShortageQty(requiredQty, actualCutQty)
  const warningMessages = options.warningMessages || []
  const warningLevel = deriveSpreadingWarningLevel({
    requiredQty,
    actualCutQty,
    varianceLength,
    claimedLengthTotal,
    actualLengthTotal: totalActualLength,
    warningMessages,
  })
  const suggestedAction = deriveSpreadingSuggestedAction({
    requiredQty,
    actualCutQty,
    varianceLength,
    claimedLengthTotal,
    actualLengthTotal: totalActualLength,
    warningMessages,
  })

  return {
    warningId: `spread-warning-${session.spreadingSessionId || Date.now()}`,
    sourceType: 'spreading-session',
    sourceContextType: session.contextType || 'original-order',
    spreadingSessionId: session.spreadingSessionId || '',
    spreadingSessionNo: session.sessionNo || session.spreadingSessionId || '',
    originalCutOrderIds: [...(session.originalCutOrderIds || [])],
    originalCutOrderNos: [...options.originalCutOrderNos],
    mergeBatchId: session.mergeBatchId || '',
    mergeBatchNo: session.mergeBatchNo || '',
    productionOrderNos: [...options.productionOrderNos],
    styleCode: session.styleCode || '',
    spuCode: session.spuCode || '',
    materialSku: session.materialSkuSummary || '',
    materialAttr: options.materialAttr || '',
    requiredQty,
    theoreticalCapacityQty,
    actualCutQty,
    configuredLengthTotal,
    claimedLengthTotal,
    totalActualLength,
    totalUsableLength,
    varianceLength,
    shortageQty,
    warningLevel,
    suggestedAction,
    handled: false,
    createdAt: options.createdAt || nowText(),
    note: options.note || warningMessages[0] || '当前由铺布完成动作生成补料预警基础数据。',
  }
}

export function validateSpreadingCompletion(options: {
  session: Partial<SpreadingSession>
  markerTotalPieces: number
  selectedOriginalCutOrderIds: string[]
}): SpreadingCompletionValidationResult {
  const { session, markerTotalPieces, selectedOriginalCutOrderIds } = options
  const messages: string[] = []
  const rolls = session.rolls || []

  if (!rolls.length) {
    messages.push('必须至少录入一条卷记录后，才能完成铺布。')
  }

  if (rolls.some((roll) => !roll.rollNo.trim() || !roll.occurredAt || Number(roll.actualLength || 0) <= 0)) {
    messages.push('存在卷记录缺少卷号、时间或实际长度，当前不能完成铺布。')
  }

  if (markerTotalPieces <= 0) {
    messages.push('当前缺少唛架总件数，无法准确推导裁剪数量，不能完成铺布。')
  }

  if (session.contextType === 'merge-batch' && !selectedOriginalCutOrderIds.length) {
    messages.push('批次上下文下必须勾选至少一个原始裁片单，才能联动完成铺布。')
  }

  if (session.contextType === 'original-order' && !(session.originalCutOrderIds || []).length) {
    messages.push('当前缺少原始裁片单上下文，不能完成铺布。')
  }

  return {
    allowed: messages.length === 0,
    messages,
  }
}

export function finalizeSpreadingCompletion(options: {
  session: SpreadingSession
  linkedOriginalCutOrderIds: string[]
  linkedOriginalCutOrderNos: string[]
  productionOrderNos: string[]
  markerTotalPieces: number
  materialAttr?: string
  warningMessages?: string[]
  completedBy?: string
  now?: Date
}): SpreadingSession {
  const completedAt = nowText(options.now)
  const replenishmentWarning = buildSpreadingReplenishmentWarning({
    session: options.session,
    markerTotalPieces: options.markerTotalPieces,
    originalCutOrderNos: options.linkedOriginalCutOrderNos,
    productionOrderNos: options.productionOrderNos,
    materialAttr: options.materialAttr,
    createdAt: completedAt,
    warningMessages: options.warningMessages,
  })

  return {
    ...options.session,
    status: 'DONE',
    replenishmentWarning,
    completionLinkage: {
      completedAt,
      completedBy: options.completedBy || '铺布编辑页',
      linkedOriginalCutOrderIds: [...options.linkedOriginalCutOrderIds],
      linkedOriginalCutOrderNos: [...options.linkedOriginalCutOrderNos],
      generatedWarningId: replenishmentWarning.warningId,
      generatedWarning: true,
      note:
        replenishmentWarning.suggestedAction === '无需补料'
          ? '当前铺布已完成，未触发明显补料预警。'
          : `当前铺布已完成，并生成补料预警：${replenishmentWarning.suggestedAction}。`,
    },
    varianceLength: replenishmentWarning.varianceLength,
    varianceNote:
      replenishmentWarning.suggestedAction === '无需补料'
        ? '当前铺布已完成，差异未触发补料建议。'
        : replenishmentWarning.suggestedAction,
  }
}

export function hasSpreadingActualExecution(session: Partial<SpreadingSession> | null | undefined): boolean {
  if (!session) return false
  return Boolean((session.rolls || []).length || (session.operators || []).length)
}

export function summarizeSpreadingRolls(rolls: SpreadingRollRecord[]): {
  totalActualLength: number
  totalHeadLength: number
  totalTailLength: number
  totalCalculatedUsableLength: number
  totalRemainingLength: number
  totalActualCutPieceQty: number
  rollCount: number
  totalLayers: number
} {
  return {
    totalActualLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.actualLength, 0), 0).toFixed(2)),
    totalHeadLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.headLength, 0), 0).toFixed(2)),
    totalTailLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.tailLength, 0), 0).toFixed(2)),
    totalCalculatedUsableLength: Number(rolls.reduce((sum, roll) => sum + computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength), 0).toFixed(2)),
    totalRemainingLength: Number(rolls.reduce((sum, roll) => sum + computeRemainingLength(roll.labeledLength, roll.actualLength), 0).toFixed(2)),
    totalActualCutPieceQty: rolls.reduce((sum, roll) => sum + Math.max(roll.actualCutPieceQty || 0, 0), 0),
    rollCount: rolls.length,
    totalLayers: rolls.reduce((sum, roll) => sum + Math.max(roll.layerCount, 0), 0),
  }
}

function parseOptionalNumber(value: number | string | undefined | null): number | null {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function computeOperatorHandledLayerCount(
  startLayer: number | string | undefined | null,
  endLayer: number | string | undefined | null,
): number | null {
  const start = parseOptionalNumber(startLayer)
  const end = parseOptionalNumber(endLayer)
  if (start === null || end === null) return null
  if (end < start) return null
  return end - start + 1
}

export function computeOperatorHandledPieceQty(
  startLayer: number | string | undefined | null,
  endLayer: number | string | undefined | null,
  markerTotalPieces: number,
): number | null {
  const handledLayerCount = computeOperatorHandledLayerCount(startLayer, endLayer)
  if (handledLayerCount === null || markerTotalPieces <= 0) return null
  return handledLayerCount * markerTotalPieces
}

export function computeOperatorCalculatedAmount(options: {
  pricingMode?: SpreadingPricingMode | null
  unitPrice?: number | string | null
  handledLayerCount?: number | string | null
  handledLength?: number | string | null
  handledPieceQty?: number | string | null
}): number | null {
  const pricingMode = options.pricingMode || '按件计价'
  const unitPrice = parseOptionalNumber(options.unitPrice)
  const handledLayerCount = parseOptionalNumber(options.handledLayerCount)
  const handledLength = parseOptionalNumber(options.handledLength)
  const handledPieceQty = parseOptionalNumber(options.handledPieceQty)

  if (unitPrice === null || unitPrice < 0) return null

  if (pricingMode === '按长度计价') {
    if (handledLength === null) return null
    return Number((handledLength * unitPrice).toFixed(2))
  }

  if (pricingMode === '按层计价') {
    if (handledLayerCount === null) return null
    return Number((handledLayerCount * unitPrice).toFixed(2))
  }

  if (handledPieceQty === null) return null
  return Number((handledPieceQty * unitPrice).toFixed(2))
}

export function computeOperatorDisplayAmount(
  operator: Pick<SpreadingOperatorRecord, 'manualAmountAdjusted' | 'adjustedAmount' | 'calculatedAmount'>,
  calculatedAmount?: number | null,
): number | null {
  if (operator.manualAmountAdjusted) {
    return parseOptionalNumber(operator.adjustedAmount)
  }
  return parseOptionalNumber(operator.calculatedAmount) ?? parseOptionalNumber(calculatedAmount)
}

export function validateOperatorManualAmountAdjustment(
  operator: Pick<SpreadingOperatorRecord, 'operatorName' | 'manualAmountAdjusted' | 'adjustedAmount'>,
): string[] {
  const warnings: string[] = []
  const operatorLabel = operator.operatorName || '未命名人员'
  if (!operator.manualAmountAdjusted) return warnings

  const adjustedAmount = parseOptionalNumber(operator.adjustedAmount)
  if (adjustedAmount === null) {
    warnings.push(`${operatorLabel} 已开启人工调整金额，但未填写调整后金额。`)
    return warnings
  }
  if (adjustedAmount < 0) {
    warnings.push(`${operatorLabel} 的调整后金额小于 0，请复核。`)
  }
  return warnings
}

function buildOperatorAmountAggregation(
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
  defaultUnitPrice?: number | null,
): SpreadingOperatorAmountSummary {
  const summaryMap = new Map<string, SpreadingOperatorAmountSummaryRow>()
  let totalHandledLayerCount = 0
  let totalHandledLength = 0
  let totalHandledPieceQty = 0
  let totalCalculatedAmount = 0
  let totalDisplayAmount = 0
  let hasManualAdjustedAmount = false
  let hasAnyAllocationData = false

  operators.forEach((operator) => {
    const operatorName = operator.operatorName || '待补录人员'
    const handledLayerCount =
      parseOptionalNumber(operator.handledLayerCount) ??
      computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer) ??
      0
    const handledLength = parseOptionalNumber(operator.handledLength) ?? 0
    const handledPieceQty =
      parseOptionalNumber(operator.handledPieceQty) ??
      computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces) ??
      0
    const unitPrice = parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice)
    const calculatedAmount =
      parseOptionalNumber(operator.calculatedAmount) ??
      computeOperatorCalculatedAmount({
        pricingMode: operator.pricingMode,
        unitPrice,
        handledLayerCount,
        handledLength,
        handledPieceQty,
      }) ??
      0
    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount) ?? 0

    const current = summaryMap.get(operatorName) || {
      operatorName,
      recordCount: 0,
      handledLayerCountTotal: 0,
      handledLengthTotal: 0,
      handledPieceQtyTotal: 0,
      calculatedAmountTotal: 0,
      displayAmountTotal: 0,
      hasManualAdjustedAmount: false,
    }

    current.recordCount += 1
    current.handledLayerCountTotal += handledLayerCount
    current.handledLengthTotal = Number((current.handledLengthTotal + handledLength).toFixed(2))
    current.handledPieceQtyTotal += handledPieceQty
    current.calculatedAmountTotal = Number((current.calculatedAmountTotal + calculatedAmount).toFixed(2))
    current.displayAmountTotal = Number((current.displayAmountTotal + displayAmount).toFixed(2))
    current.hasManualAdjustedAmount = current.hasManualAdjustedAmount || Boolean(operator.manualAmountAdjusted)

    summaryMap.set(operatorName, current)

    totalHandledLayerCount += handledLayerCount
    totalHandledLength = Number((totalHandledLength + handledLength).toFixed(2))
    totalHandledPieceQty += handledPieceQty
    totalCalculatedAmount = Number((totalCalculatedAmount + calculatedAmount).toFixed(2))
    totalDisplayAmount = Number((totalDisplayAmount + displayAmount).toFixed(2))
    hasManualAdjustedAmount = hasManualAdjustedAmount || Boolean(operator.manualAmountAdjusted)
    hasAnyAllocationData =
      hasAnyAllocationData ||
      Boolean(handledLayerCount || handledLength || handledPieceQty || displayAmount || unitPrice !== null)
  })

  return {
    rows: Array.from(summaryMap.values()).sort((left, right) => left.operatorName.localeCompare(right.operatorName, 'zh-CN')),
    totalHandledLayerCount,
    totalHandledLength,
    totalHandledPieceQty,
    totalCalculatedAmount,
    totalDisplayAmount,
    hasManualAdjustedAmount,
    hasAnyAllocationData,
  }
}

export function summarizeRollOperatorAmounts(
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
  defaultUnitPrice?: number | null,
): SpreadingOperatorAmountSummary {
  return buildOperatorAmountAggregation(operators, markerTotalPieces, defaultUnitPrice)
}

export function summarizeSpreadingOperatorAmounts(
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
  defaultUnitPrice?: number | null,
): SpreadingOperatorAmountSummary {
  return buildOperatorAmountAggregation(operators, markerTotalPieces, defaultUnitPrice)
}

export function buildOperatorAmountWarnings(
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
  defaultUnitPrice?: number | null,
): string[] {
  const warnings: string[] = []
  const positivePieceRows = operators
    .map((operator) => ({
      operator,
      handledPieceQty:
        parseOptionalNumber(operator.handledPieceQty) ??
        computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces),
      unitPrice: parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice),
      displayAmount:
        computeOperatorDisplayAmount(operator) ??
        computeOperatorCalculatedAmount({
          pricingMode: operator.pricingMode,
          unitPrice: parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice),
          handledLayerCount: operator.handledLayerCount,
          handledLength: operator.handledLength,
          handledPieceQty:
            parseOptionalNumber(operator.handledPieceQty) ??
            computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces),
        }),
    }))
    .filter((item) => (item.handledPieceQty ?? 0) > 0)

  const pieceAverage =
    positivePieceRows.length > 1
      ? positivePieceRows.reduce((sum, item) => sum + Math.max(item.handledPieceQty || 0, 0), 0) / positivePieceRows.length
      : 0
  const amountAverage =
    positivePieceRows.length > 1
      ? positivePieceRows.reduce((sum, item) => sum + Math.max(item.displayAmount || 0, 0), 0) / positivePieceRows.length
      : 0

  operators.forEach((operator, index) => {
    const operatorLabel = operator.operatorName || `第 ${index + 1} 条人员记录`
    const handledLayerCount =
      parseOptionalNumber(operator.handledLayerCount) ??
      computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
    const handledPieceQty =
      parseOptionalNumber(operator.handledPieceQty) ??
      computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces)
    const pricingMode = operator.pricingMode || '按件计价'
    const unitPrice = parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice)
    const calculatedAmount =
      parseOptionalNumber(operator.calculatedAmount) ??
      computeOperatorCalculatedAmount({
        pricingMode,
        unitPrice,
        handledLayerCount,
        handledLength: operator.handledLength,
        handledPieceQty,
      })
    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount)

    if (unitPrice === null) {
      warnings.push(`${operatorLabel} 缺少单价，当前无法形成完整金额。`)
    }
    if (handledPieceQty === null) {
      warnings.push(`${operatorLabel} 缺少开始层 / 结束层或唛架总件数，当前无法计算负责件数。`)
    }
    if (parseOptionalNumber(operator.handledLength) === null) {
      warnings.push(`${operatorLabel} 缺少负责长度。`)
    }
    validateOperatorManualAmountAdjustment(operator).forEach((message) => warnings.push(message))

    if (pieceAverage > 0 && (handledPieceQty || 0) > pieceAverage * 2) {
      warnings.push(`${operatorLabel} 的负责件数明显高于当前平均值，请复核层数区间。`)
    }
    if (amountAverage > 0 && (displayAmount || 0) > amountAverage * 2) {
      warnings.push(`${operatorLabel} 的金额明显高于当前平均值，请复核单价或人工调整。`)
    }
  })

  return Array.from(new Set(warnings))
}

export function validateRollHandoverContinuity(
  operators: SpreadingOperatorRecord[],
): {
  continuityStatus: '连续' | '层数断档' | '层数重叠' | '待补录'
  overlapDetected: boolean
  gapDetected: boolean
  warnings: string[]
} {
  const warnings: string[] = []
  let overlapDetected = false
  let gapDetected = false
  let previousEndLayer: number | null = null

  operators.forEach((operator) => {
    const startLayer = parseOptionalNumber(operator.startLayer)
    const endLayer = parseOptionalNumber(operator.endLayer)
    const operatorLabel = operator.operatorName || '未命名人员'

    if (startLayer === null || endLayer === null) {
      warnings.push(`${operatorLabel} 缺少开始层或结束层，当前交接区间待补录。`)
      return
    }

    if (endLayer < startLayer) {
      warnings.push(`${operatorLabel} 的结束层小于开始层，请复核交接区间。`)
      return
    }

    if (previousEndLayer !== null) {
      if (startLayer <= previousEndLayer) {
        overlapDetected = true
        warnings.push(`${operatorLabel} 的开始层与上一条记录重叠，请检查同卷交接层数。`)
      } else if (startLayer > previousEndLayer + 1) {
        gapDetected = true
        warnings.push(`${operatorLabel} 的开始层与上一条记录之间存在断档，请补齐中间层数。`)
      }
    }

    previousEndLayer = endLayer
  })

  return {
    continuityStatus: overlapDetected ? '层数重叠' : gapDetected ? '层数断档' : warnings.length ? '待补录' : '连续',
    overlapDetected,
    gapDetected,
    warnings,
  }
}

export function validateRollHandledLength(
  roll: SpreadingRollRecord,
  operators: SpreadingOperatorRecord[],
): {
  totalHandledLength: number
  lengthExceeded: boolean
  warnings: string[]
} {
  const totalHandledLength = Number(
    operators.reduce((sum, operator) => sum + Math.max(parseOptionalNumber(operator.handledLength) || 0, 0), 0).toFixed(2),
  )
  const lengthExceeded = roll.actualLength > 0 && totalHandledLength - roll.actualLength > 0.0001
  return {
    totalHandledLength,
    lengthExceeded,
    warnings: lengthExceeded ? [`卷 ${roll.rollNo || '未命名卷'} 的人员负责长度合计已超过该卷实际长度。`] : [],
  }
}

export function buildRollHandoverWarnings(
  roll: SpreadingRollRecord,
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
): string[] {
  const warnings: string[] = []
  const rollLabel = roll.rollNo || '未命名卷'
  const continuity = validateRollHandoverContinuity(operators)
  const handledLength = validateRollHandledLength(roll, operators)
  const sortedOperators = [...operators].sort((left, right) => {
    const sortGap = (left.sortOrder || 0) - (right.sortOrder || 0)
    if (sortGap !== 0) return sortGap
    const startGap = parseTimeWeight(left.startAt) - parseTimeWeight(right.startAt)
    if (startGap !== 0) return startGap
    return 0
  })
  const lastOperator = sortedOperators[sortedOperators.length - 1] || null
  const finalHandledLayer = lastOperator ? parseOptionalNumber(lastOperator.endLayer) : null

  continuity.warnings.forEach((message) => warnings.push(message))
  handledLength.warnings.forEach((message) => warnings.push(message))

  sortedOperators.forEach((operator, index) => {
    const operatorLabel = operator.operatorName || `第 ${index + 1} 条人员记录`
    const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
    const handledPieceQty = computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces)

    if (handledLayerCount === null) {
      warnings.push(`${rollLabel} / ${operatorLabel} 缺少有效层数区间。`)
    }
    if (handledPieceQty === null) {
      warnings.push(`${rollLabel} / ${operatorLabel} 无法计算负责件数，请补录层数或唛架总件数。`)
    }
    if (parseOptionalNumber(operator.handledLength) === null) {
      warnings.push(`${rollLabel} / ${operatorLabel} 缺少负责长度。`)
    }
    if ((operator.actionType === '中途交接' || operator.actionType === '接手继续') && !operator.handoverNotes.trim()) {
      warnings.push(`${rollLabel} / ${operatorLabel} 已标记交接动作，但缺少交接说明。`)
    }
  })

  if (roll.layerCount > 0 && finalHandledLayer !== null && finalHandledLayer < roll.layerCount) {
    warnings.push(`${rollLabel} 当前最后一条人员记录只铺到第 ${finalHandledLayer} 层，尚未完整铺完至第 ${roll.layerCount} 层。`)
  }

  return Array.from(new Set(warnings))
}

export function buildRollHandoverViewModel(
  roll: SpreadingRollRecord,
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
): SpreadingRollHandoverSummary {
  const sortedOperators = [...operators].sort((left, right) => {
    const sortGap = (left.sortOrder || 0) - (right.sortOrder || 0)
    if (sortGap !== 0) return sortGap
    const startGap = parseTimeWeight(left.startAt) - parseTimeWeight(right.startAt)
    if (startGap !== 0) return startGap
    const endGap = parseTimeWeight(left.endAt) - parseTimeWeight(right.endAt)
    if (endGap !== 0) return endGap
    return 0
  })
  const continuity = validateRollHandoverContinuity(sortedOperators)
  const handledLength = validateRollHandledLength(roll, sortedOperators)
  const quantifiedOperators = sortedOperators.map((operator, index) => {
    const previousOperator = sortedOperators[index - 1]
    const nextOperator = sortedOperators[index + 1]
    const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer)
    const handledPieceQty = computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces)
    const calculatedAmount =
      parseOptionalNumber(operator.calculatedAmount) ??
      computeOperatorCalculatedAmount({
        pricingMode: operator.pricingMode,
        unitPrice: operator.unitPrice,
        handledLayerCount,
        handledLength: operator.handledLength,
        handledPieceQty,
      })
    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount)
    return {
      operator,
      previousOperatorName: operator.previousOperatorName || previousOperator?.operatorName || '',
      nextOperatorName: operator.nextOperatorName || nextOperator?.operatorName || '',
      handledLayerCount,
      handledPieceQty,
      calculatedAmount,
      displayAmount,
      handoverAtLayer:
        parseOptionalNumber(operator.handoverAtLayer) ??
        (operator.actionType === '接手继续'
          ? parseOptionalNumber(operator.startLayer)
          : parseOptionalNumber(operator.endLayer)),
      handoverAtLength: parseOptionalNumber(operator.handoverAtLength) ?? parseOptionalNumber(operator.handledLength),
    }
  })
  const lastOperator = quantifiedOperators[quantifiedOperators.length - 1] || null
  const finalHandledLayer = lastOperator ? parseOptionalNumber(lastOperator.operator.endLayer) : null
  const incompleteCoverage = roll.layerCount > 0 && finalHandledLayer !== null && finalHandledLayer < roll.layerCount
  const warnings = buildRollHandoverWarnings(roll, sortedOperators, markerTotalPieces)

  return {
    rollRecordId: roll.rollRecordId,
    rollNo: roll.rollNo,
    operators: quantifiedOperators,
    hasHandover: quantifiedOperators.length > 1,
    hasWarnings: warnings.length > 0,
    continuityStatus: continuity.continuityStatus,
    totalHandledLength: handledLength.totalHandledLength,
    finalHandledLayer,
    overlapDetected: continuity.overlapDetected,
    gapDetected: continuity.gapDetected,
    lengthExceeded: handledLength.lengthExceeded,
    incompleteCoverage,
    warnings,
  }
}

export function buildSpreadingHandoverListSummary(
  rolls: SpreadingRollRecord[],
  operators: SpreadingOperatorRecord[],
  markerTotalPieces: number,
): SpreadingHandoverListSummary {
  const summaries = rolls.map((roll) =>
    buildRollHandoverViewModel(
      roll,
      operators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
      markerTotalPieces,
    ),
  )
  const handoverRollCount = summaries.filter((item) => item.hasHandover).length
  const abnormalRollCount = summaries.filter((item) => item.hasWarnings).length

  return {
    handoverRollCount,
    abnormalRollCount,
    hasHandover: handoverRollCount > 0,
    hasAbnormalHandover: abnormalRollCount > 0,
    statusLabel:
      abnormalRollCount > 0
        ? `有 ${abnormalRollCount} 卷存在交接异常`
        : handoverRollCount > 0
          ? `已记录 ${handoverRollCount} 卷交接班`
          : '无交接班',
  }
}

export function summarizeSpreadingOperators(operators: SpreadingOperatorRecord[]): SpreadingOperatorSummary {
  const sortedOperators = [...operators].sort((left, right) => {
    const sortGap = (left.sortOrder || 0) - (right.sortOrder || 0)
    if (sortGap !== 0) return sortGap
    const startGap = parseTimeWeight(left.startAt) - parseTimeWeight(right.startAt)
    if (startGap !== 0) return startGap
    const endGap = parseTimeWeight(left.endAt) - parseTimeWeight(right.endAt)
    if (endGap !== 0) return endGap
    return 0
  })
  const operatorsByRollId = sortedOperators.reduce<Record<string, SpreadingOperatorRecord[]>>((accumulator, operator) => {
    const key = operator.rollRecordId || '__UNBOUND__'
    accumulator[key] = accumulator[key] || []
    accumulator[key].push(operator)
    return accumulator
  }, {})
  const handoverRollCount = Object.entries(operatorsByRollId).filter(([rollId, rows]) => rollId !== '__UNBOUND__' && rows.length > 1).length
  const rollParticipantNames = Object.fromEntries(
    Object.entries(operatorsByRollId).map(([rollId, rows]) => [rollId, uniqueStrings(rows.map((row) => row.operatorName))]),
  )

  return {
    operatorCount: sortedOperators.length,
    handoverRollCount,
    sortedOperators,
    operatorsByRollId,
    rollParticipantNames,
  }
}

export function deriveSpreadingStatus(status: SpreadingStatusKey): MarkerSpreadingSummaryMeta<SpreadingStatusKey> {
  const meta = spreadingStatusMeta[status]
  return createSummaryMeta(status, meta.label, meta.className, meta.detailText)
}

export function buildSpreadingVarianceSummary(
  context: MarkerSpreadingContext | null,
  marker: MarkerRecord | null,
  session: SpreadingSession | null,
): SpreadingVarianceSummary | null {
  if (!context) return null

  const configuredLengthTotal = Number(
    context.materialPrepRows.reduce((sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.configuredQty, 0), 0).toFixed(2),
  )
  const claimedLengthTotal = Number(
    context.materialPrepRows.reduce((sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.claimedQty, 0), 0).toFixed(2),
  )

  const rollSummary = summarizeSpreadingRolls(session?.rolls ?? [])
  const requiredPieceQty = marker?.totalPieces || 0
  const estimatedPieceCapacity = marker && marker.singlePieceUsage > 0 ? Math.floor(rollSummary.totalCalculatedUsableLength / marker.singlePieceUsage) : 0
  const varianceLength = Number((claimedLengthTotal - rollSummary.totalActualLength).toFixed(2))
  const shortageIndicator = Boolean(marker && marker.singlePieceUsage > 0 && requiredPieceQty > 0 && estimatedPieceCapacity < requiredPieceQty)

  let replenishmentHint = '当前铺布数据与仓库配料数据基本匹配。'
  if (!session || !session.rolls.length) {
    replenishmentHint = '当前尚未录入铺布卷数据，补料判断仍需补录后确认。'
  } else if (shortageIndicator) {
    replenishmentHint = '预计承载件数低于唛架总件数，建议进入补料管理进一步确认。'
  } else if (varianceLength < 0) {
    replenishmentHint = '总实际铺布长度超过已领取长度，建议复核差异并关注补料可能性。'
  }

  return {
    configuredLengthTotal,
    claimedLengthTotal,
    actualLengthTotal: rollSummary.totalActualLength,
    usableLengthTotal: rollSummary.totalCalculatedUsableLength,
    remainingLengthTotal: rollSummary.totalRemainingLength,
    varianceLength,
    estimatedPieceCapacity,
    requiredPieceQty,
    actualCutPieceQtyTotal: rollSummary.totalActualCutPieceQty,
    shortageIndicator,
    replenishmentHint,
  }
}

export function buildReplenishmentPreview(summary: SpreadingVarianceSummary | null): ReplenishmentPreview {
  if (!summary) {
    return {
      level: 'MISSING',
      label: '数据待补录',
      detailText: '当前尚未形成上下文或铺布记录，无法生成补料预警。',
      shortageIndicator: false,
    }
  }

  if (summary.requiredPieceQty <= 0 || summary.actualLengthTotal <= 0) {
    return {
      level: 'MISSING',
      label: '数据待补录',
      detailText: '当前唛架件数或铺布长度不足，需继续补录后再判断补料需求。',
      shortageIndicator: false,
    }
  }

  if (summary.shortageIndicator || summary.varianceLength < 0) {
    return {
      level: 'ALERT',
      label: '可能需要补料',
      detailText: summary.replenishmentHint,
      shortageIndicator: true,
    }
  }

  if (summary.varianceLength <= 5) {
    return {
      level: 'WATCH',
      label: '建议继续观察',
      detailText: '当前可用长度与仓库领料长度接近，建议在进入补料前复核后续损耗。',
      shortageIndicator: false,
    }
  }

  return {
    level: 'OK',
    label: '无明显缺口',
    detailText: '当前铺布数据未识别明显长度缺口，可继续流向后续打编号链路。',
    shortageIndicator: false,
  }
}

export function buildSpreadingWarningMessages(options: {
  session: Partial<SpreadingSession>
  markerTotalPieces: number
  claimedLengthTotal: number
}): string[] {
  const warnings: string[] = []
  const rolls = options.session.rolls || []
  const operators = options.session.operators || []
  const rollSummary = summarizeSpreadingRolls(rolls)
  const operatorSummary = summarizeSpreadingOperators(operators)
  const normalizedRollNos = rolls
    .map((roll) => roll.rollNo.trim())
    .filter(Boolean)
  const duplicateRollNos = normalizedRollNos.filter((rollNo, index) => normalizedRollNos.indexOf(rollNo) !== index)

  duplicateRollNos.forEach((rollNo) => {
    warnings.push(`卷号 ${rollNo} 在同一条铺布记录下重复，请调整卷记录。`)
  })

  if (!rolls.length) {
    warnings.push('当前缺少卷记录，请至少录入一卷实际铺布数据。')
  }

  rolls.forEach((roll, index) => {
    const rollLabel = roll.rollNo || `第 ${index + 1} 卷`
    const usableLength = computeUsableLength(Number(roll.actualLength || 0), Number(roll.headLength || 0), Number(roll.tailLength || 0))
    const remainingLength = computeRemainingLength(Number(roll.labeledLength || 0), Number(roll.actualLength || 0))
    const linkedOperators = operatorSummary.operatorsByRollId[roll.rollRecordId] || []
    const handoverSummary = buildRollHandoverViewModel(roll, linkedOperators, options.markerTotalPieces)

    if (usableLength < 0) {
      warnings.push(`${rollLabel} 的单卷可用长度小于 0，请复核布头 / 布尾与实际长度。`)
    }
    if (remainingLength < 0) {
      warnings.push(`${rollLabel} 的单卷剩余长度小于 0，说明实际使用已超过标注长度。`)
    }
    if (!roll.rollNo || !roll.occurredAt) {
      warnings.push(`${rollLabel} 缺少卷号或时间，铺布记录仍不完整。`)
    }
    if (Number(roll.layerCount || 0) <= 0 || options.markerTotalPieces <= 0) {
      warnings.push(`${rollLabel} 缺少层数或唛架总件数，实际裁剪件数暂无法准确推导。`)
    }
    if (!linkedOperators.length) {
      warnings.push(`${rollLabel} 缺少人员记录，无法追溯开始、交接与完成情况。`)
    }
    handoverSummary.warnings.forEach((message) => warnings.push(message))
  })

  if (options.claimedLengthTotal > 0 && rollSummary.totalActualLength > options.claimedLengthTotal) {
    warnings.push('总实际铺布长度超过已领取总长度，可能需要补料。')
  }

  if (!operators.length) {
    warnings.push('当前缺少铺布人员记录，请补录开始 / 交接 / 完成信息。')
  }

  operators.forEach((operator, index) => {
    const operatorLabel = operator.operatorName || `第 ${index + 1} 条人员记录`
    if (!operator.rollRecordId) {
      warnings.push(`${operatorLabel} 尚未关联卷记录，同卷换班关系不可追溯。`)
    }
    if (!operator.operatorName) {
      warnings.push(`第 ${index + 1} 条人员记录缺少人员姓名。`)
    }
    if (!operator.startAt || !operator.endAt) {
      warnings.push(`${operatorLabel} 缺少开始或结束时间。`)
    }
  })

  buildOperatorAmountWarnings(operators, options.markerTotalPieces, options.session.unitPrice).forEach((message) => warnings.push(message))

  return Array.from(new Set(warnings))
}

export function buildMarkerSpreadingNavigationPayload(
  context: MarkerSpreadingContext | null,
  varianceSummary: SpreadingVarianceSummary | null,
  warning?: SpreadingReplenishmentWarning | null,
): MarkerSpreadingNavigationPayload {
  if (!context) {
    return {
      replenishment: {},
      feiTickets: {},
      originalOrders: {},
      mergeBatches: {},
      summary: {},
    }
  }

  const baseOriginal = context.originalCutOrderNos[0]
  const baseProduction = context.productionOrderNos[0]
  const varianceHint = warning ? String(warning.varianceLength) : varianceSummary ? String(varianceSummary.varianceLength) : undefined
  const shortageHint =
    warning ? (warning.shortageQty > 0 ? 'true' : undefined) : varianceSummary?.shortageIndicator ? 'true' : undefined
  const riskLevel =
    warning?.warningLevel === '高' ? 'high' : warning?.warningLevel === '中' ? 'medium' : warning?.warningLevel === '低' ? 'low' : undefined

  return {
    replenishment: {
      spreadingSessionId: warning?.spreadingSessionId,
      warningId: warning?.warningId,
      mergeBatchNo: context.contextType === 'merge-batch' ? context.mergeBatchNo || undefined : undefined,
      originalCutOrderNo: context.contextType === 'original-order' ? baseOriginal || undefined : undefined,
      productionOrderNo: baseProduction || undefined,
      materialSku: context.materialSkuSummary?.split(' / ')[0] || undefined,
      riskLevel,
      varianceLength: varianceHint,
      shortageHint,
    },
    feiTickets: {
      mergeBatchNo: context.contextType === 'merge-batch' ? context.mergeBatchNo || undefined : undefined,
      originalCutOrderNo: baseOriginal || undefined,
    },
    originalOrders: {
      mergeBatchNo: context.contextType === 'merge-batch' ? context.mergeBatchNo || undefined : undefined,
      originalCutOrderNo: baseOriginal || undefined,
      productionOrderNo: baseProduction || undefined,
    },
    mergeBatches: {
      mergeBatchId: context.mergeBatchId || undefined,
      mergeBatchNo: context.mergeBatchNo || undefined,
      originalCutOrderNo: context.contextType === 'original-order' ? baseOriginal || undefined : undefined,
    },
    summary: {
      mergeBatchNo: context.contextType === 'merge-batch' ? context.mergeBatchNo || undefined : undefined,
      originalCutOrderNo: context.contextType === 'original-order' ? baseOriginal || undefined : undefined,
      productionOrderNo: baseProduction || undefined,
    },
  }
}

export function serializeMarkerSpreadingStorage(store: MarkerSpreadingStore): string {
  return JSON.stringify(store)
}

export function deserializeMarkerSpreadingStorage(raw: string | null): MarkerSpreadingStore {
  if (!raw) return { markers: [], sessions: [] }
  try {
    const parsed = JSON.parse(raw)
    return {
      markers: Array.isArray(parsed?.markers) ? parsed.markers.map((item: MarkerRecord) => normalizeMarkerRecord(item)) : [],
      sessions: Array.isArray(parsed?.sessions)
        ? parsed.sessions.map((session: SpreadingSession) => {
            const rolls = Array.isArray(session.rolls)
              ? session.rolls.map((roll) => ({
                  ...roll,
                  sortOrder: Number(roll.sortOrder ?? 0),
                  totalLength: Number(((Number(roll.actualLength || 0) + Number(roll.headLength || 0) + Number(roll.tailLength || 0))).toFixed(2)),
                  remainingLength:
                    roll.remainingLength ??
                    computeRemainingLength(Number(roll.labeledLength || 0), Number(roll.actualLength || 0)),
                  usableLength:
                    roll.usableLength ??
                    computeUsableLength(Number(roll.actualLength || 0), Number(roll.headLength || 0), Number(roll.tailLength || 0)),
                }))
              : []
            const rollSummary = summarizeSpreadingRolls(rolls)
            return {
              ...session,
              spreadingMode: normalizeMarkerMode(session.spreadingMode as string | undefined),
              rolls,
              operators: Array.isArray(session.operators)
                ? session.operators.map((operator) => ({
                    ...operator,
                    sortOrder: Number(operator.sortOrder ?? 0),
                    rollRecordId: operator.rollRecordId || '',
                    actionType: (operator.actionType || '开始铺布') as SpreadingOperatorActionType,
                    startLayer: operator.startLayer !== undefined && operator.startLayer !== null ? Number(operator.startLayer) : undefined,
                    endLayer: operator.endLayer !== undefined && operator.endLayer !== null ? Number(operator.endLayer) : undefined,
                    handledLayerCount:
                      operator.handledLayerCount !== undefined && operator.handledLayerCount !== null
                        ? Number(operator.handledLayerCount)
                        : undefined,
                    handledLength: operator.handledLength !== undefined && operator.handledLength !== null ? Number(operator.handledLength) : undefined,
                    handledPieceQty:
                      operator.handledPieceQty !== undefined && operator.handledPieceQty !== null
                        ? Number(operator.handledPieceQty)
                        : undefined,
                    pricingMode: operator.pricingMode || '按件计价',
                    unitPrice: operator.unitPrice !== undefined && operator.unitPrice !== null ? Number(operator.unitPrice) : undefined,
                    calculatedAmount:
                      operator.calculatedAmount !== undefined && operator.calculatedAmount !== null
                        ? Number(operator.calculatedAmount)
                        : undefined,
                    manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
                    adjustedAmount:
                      operator.adjustedAmount !== undefined && operator.adjustedAmount !== null
                        ? Number(operator.adjustedAmount)
                        : undefined,
                    amountNote: operator.amountNote || '',
                    handoverNotes: operator.handoverNotes || '',
                    previousOperatorName: operator.previousOperatorName || '',
                    nextOperatorName: operator.nextOperatorName || '',
                    handoverAtLayer:
                      operator.handoverAtLayer !== undefined && operator.handoverAtLayer !== null
                        ? Number(operator.handoverAtLayer)
                        : undefined,
                    handoverAtLength:
                      operator.handoverAtLength !== undefined && operator.handoverAtLength !== null
                        ? Number(operator.handoverAtLength)
                        : undefined,
                  }))
                : [],
              totalActualLength: session.totalActualLength || rollSummary.totalActualLength,
              totalHeadLength: session.totalHeadLength || rollSummary.totalHeadLength,
              totalTailLength: session.totalTailLength || rollSummary.totalTailLength,
              totalCalculatedUsableLength: session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
              totalRemainingLength: session.totalRemainingLength ?? rollSummary.totalRemainingLength,
              actualCutPieceQty: session.actualCutPieceQty ?? rollSummary.totalActualCutPieceQty,
              configuredLengthTotal: session.configuredLengthTotal || 0,
              claimedLengthTotal: session.claimedLengthTotal || 0,
              varianceLength: session.varianceLength || 0,
              varianceNote: session.varianceNote || '',
              warningMessages: session.warningMessages || [],
              importSource: session.importSource || null,
              planLineItems: Array.isArray(session.planLineItems) ? session.planLineItems : [],
              highLowPlanSnapshot: session.highLowPlanSnapshot || null,
              theoreticalSpreadTotalLength: session.theoreticalSpreadTotalLength ?? 0,
              theoreticalActualCutPieceQty: session.theoreticalActualCutPieceQty ?? 0,
              importAdjustmentRequired: Boolean(session.importAdjustmentRequired),
              importAdjustmentNote: session.importAdjustmentNote || '',
            }
          })
        : [],
    }
  } catch {
    return { markers: [], sessions: [] }
  }
}

export function buildMarkerSpreadingViewModel(options: {
  rows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  store: MarkerSpreadingStore
  prefilter: MarkerSpreadingPrefilter | null
}): MarkerSpreadingViewModel {
  const rowsById = Object.fromEntries(options.rows.map((row) => [row.originalCutOrderId, row]))
  const context = buildContext(options.rows, rowsById, options.mergeBatches, options.prefilter)
  const markerRecords = context ? options.store.markers.filter((record) => matchesContext(record, context)) : options.store.markers
  const spreadingSessions = context ? options.store.sessions.filter((record) => matchesContext(record, context)) : options.store.sessions

  const warningCount = spreadingSessions.filter((session) => {
    const summary = buildSpreadingVarianceSummary(context, markerRecords[0] || null, session)
    return summary?.shortageIndicator || (summary?.varianceLength || 0) < 0
  }).length

  return {
    context,
    prefilter: options.prefilter,
    markerRecords,
    spreadingSessions,
    stats: {
      markerCount: markerRecords.length,
      sessionCount: spreadingSessions.length,
      inProgressCount: spreadingSessions.filter((session) => session.status === 'IN_PROGRESS').length,
      doneCount: spreadingSessions.filter((session) => session.status === 'DONE').length,
      rollCount: spreadingSessions.reduce((sum, session) => sum + session.rolls.length, 0),
      warningCount,
      contextOriginalOrderCount: context?.originalCutOrderIds.length ?? 0,
      contextProductionOrderCount: context?.productionOrderNos.length ?? 0,
    },
  }
}

export function buildMarkerSeedDraft(context: MarkerSpreadingContext | null, existing: MarkerRecord | null): MarkerRecord | null {
  if (!context) return null
  return existing ? existing : buildSeedMarker(context)
}

export function formatSpreadingLength(value: number): string {
  return `${formatQty(Number(value.toFixed(2)))} 米`
}

export function summarizeContextHint(context: MarkerSpreadingContext | null): string {
  if (!context) return '当前尚未收到原始裁片单或合并裁剪批次上下文，请从上游页面进入。'
  if (context.contextType === 'merge-batch') {
    return `当前以合并裁剪批次 ${context.mergeBatchNo || '待补批次号'} 作为执行上下文，底层追溯仍回落 ${context.originalCutOrderNos.length} 个原始裁片单。`
  }
  return `当前以原始裁片单 ${context.originalCutOrderNos[0]} 作为上下文，后续若进入菲票 / 打编号，归属仍回落该原始裁片单。`
}

export function createEmptyStore(): MarkerSpreadingStore {
  return { markers: [], sessions: [] }
}

function createDraftId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createRollRecordDraft(spreadingSessionId: string, materialSku = ''): SpreadingRollRecord {
  return {
    rollRecordId: createDraftId('roll'),
    spreadingSessionId,
    sortOrder: 0,
    rollNo: '',
    materialSku,
    color: '',
    width: 0,
    labeledLength: 0,
    actualLength: 0,
    headLength: 0,
    tailLength: 0,
    layerCount: 0,
    totalLength: 0,
    remainingLength: 0,
    actualCutPieceQty: 0,
    occurredAt: '',
    operatorNames: [],
    handoverNotes: '',
    usableLength: 0,
    note: '',
    sourceChannel: 'MANUAL',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
  }
}

export function createOperatorRecordDraft(spreadingSessionId: string): SpreadingOperatorRecord {
  return {
    operatorRecordId: createDraftId('operator'),
    spreadingSessionId,
    sortOrder: 0,
    rollRecordId: '',
    operatorAccountId: '',
    operatorName: '',
    startAt: '',
    endAt: '',
    actionType: '开始铺布',
    startLayer: undefined,
    endLayer: undefined,
    handledLayerCount: undefined,
    handledLength: undefined,
    handledPieceQty: undefined,
    pricingMode: '按件计价',
    unitPrice: undefined,
    calculatedAmount: undefined,
    manualAmountAdjusted: false,
    adjustedAmount: undefined,
    amountNote: '',
    handoverFlag: false,
    handoverNotes: '',
    previousOperatorName: '',
    nextOperatorName: '',
    handoverAtLayer: undefined,
    handoverAtLength: undefined,
    note: '',
    sourceChannel: 'MANUAL',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
  }
}

export function upsertSpreadingSession(session: SpreadingSession, store: MarkerSpreadingStore, now = new Date()): MarkerSpreadingStore {
  const normalizedRolls = session.rolls.map((roll, index) => ({
    ...roll,
    sortOrder: Number(roll.sortOrder ?? index + 1),
  }))
  const markerTotalPieces = session.markerId
    ? store.markers.find((item) => item.markerId === session.markerId)?.totalPieces || 0
    : 0
  const baseOperators = summarizeSpreadingOperators(
    session.operators.map((operator, index) => ({
      ...operator,
      sortOrder: Number(operator.sortOrder ?? index + 1),
      startLayer: operator.startLayer !== undefined && operator.startLayer !== null ? Number(operator.startLayer) : undefined,
      endLayer: operator.endLayer !== undefined && operator.endLayer !== null ? Number(operator.endLayer) : undefined,
      handledLength: operator.handledLength !== undefined && operator.handledLength !== null ? Number(operator.handledLength) : undefined,
      pricingMode: operator.pricingMode || '按件计价',
      unitPrice: operator.unitPrice !== undefined && operator.unitPrice !== null ? Number(operator.unitPrice) : undefined,
      calculatedAmount:
        operator.calculatedAmount !== undefined && operator.calculatedAmount !== null ? Number(operator.calculatedAmount) : undefined,
      manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
      adjustedAmount: operator.adjustedAmount !== undefined && operator.adjustedAmount !== null ? Number(operator.adjustedAmount) : undefined,
      amountNote: operator.amountNote || '',
      handoverAtLayer:
        operator.handoverAtLayer !== undefined && operator.handoverAtLayer !== null ? Number(operator.handoverAtLayer) : undefined,
      handoverAtLength:
        operator.handoverAtLength !== undefined && operator.handoverAtLength !== null ? Number(operator.handoverAtLength) : undefined,
    })),
  ).sortedOperators
  const quantifiedOperatorsById = new Map<string, SpreadingOperatorRecord>()
  normalizedRolls.forEach((roll) => {
    const handoverSummary = buildRollHandoverViewModel(
      roll,
      baseOperators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
      markerTotalPieces,
    )
    handoverSummary.operators.forEach((item) => {
      quantifiedOperatorsById.set(item.operator.operatorRecordId, {
        ...item.operator,
        handledLayerCount: item.handledLayerCount ?? undefined,
        handledPieceQty: item.handledPieceQty ?? undefined,
        unitPrice: item.operator.unitPrice ?? session.unitPrice ?? undefined,
        pricingMode: item.operator.pricingMode || '按件计价',
        calculatedAmount:
          computeOperatorCalculatedAmount({
            pricingMode: item.operator.pricingMode || '按件计价',
            unitPrice: item.operator.unitPrice ?? session.unitPrice ?? undefined,
            handledLayerCount: item.handledLayerCount,
            handledLength: item.operator.handledLength,
            handledPieceQty: item.handledPieceQty,
          }) ?? undefined,
        manualAmountAdjusted: Boolean(item.operator.manualAmountAdjusted),
        adjustedAmount: item.operator.adjustedAmount ?? undefined,
        amountNote: item.operator.amountNote || '',
        previousOperatorName: item.previousOperatorName,
        nextOperatorName: item.nextOperatorName,
        handoverAtLayer: item.handoverAtLayer ?? undefined,
        handoverAtLength: item.handoverAtLength ?? undefined,
      })
    })
  })
  const normalizedOperators = baseOperators.map((operator) => {
    const quantified = quantifiedOperatorsById.get(operator.operatorRecordId)
    if (quantified) return quantified
    return {
      ...operator,
      handledLayerCount: computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer) ?? undefined,
      handledPieceQty: computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces) ?? undefined,
      pricingMode: operator.pricingMode || '按件计价',
      unitPrice: operator.unitPrice ?? session.unitPrice ?? undefined,
      calculatedAmount:
        computeOperatorCalculatedAmount({
          pricingMode: operator.pricingMode || '按件计价',
          unitPrice: operator.unitPrice ?? session.unitPrice ?? undefined,
          handledLayerCount: computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer),
          handledLength: operator.handledLength,
          handledPieceQty: computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces),
        }) ?? undefined,
      manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
      adjustedAmount: operator.adjustedAmount ?? undefined,
      amountNote: operator.amountNote || '',
      previousOperatorName: operator.previousOperatorName || '',
      nextOperatorName: operator.nextOperatorName || '',
    }
  })
  const operatorNamesByRollId = Object.fromEntries(
    Object.entries(summarizeSpreadingOperators(normalizedOperators).rollParticipantNames).map(([rollId, names]) => [rollId, names]),
  )
  const rollsWithOperatorNames = normalizedRolls.map((roll) => ({
    ...roll,
    operatorNames: operatorNamesByRollId[roll.rollRecordId] || [],
  }))
  const summary = summarizeSpreadingRolls(rollsWithOperatorNames)
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(normalizedOperators, markerTotalPieces, session.unitPrice)
  const normalized: SpreadingSession = {
    ...session,
    rolls: rollsWithOperatorNames,
    operators: normalizedOperators,
    totalActualLength: summary.totalActualLength,
    totalHeadLength: summary.totalHeadLength,
    totalTailLength: summary.totalTailLength,
    totalCalculatedUsableLength: summary.totalCalculatedUsableLength,
    totalRemainingLength: session.totalRemainingLength ?? summary.totalRemainingLength,
    rollCount: rollsWithOperatorNames.length,
    operatorCount: normalizedOperators.length,
    actualLayers: summary.totalLayers,
    actualCutPieceQty:
      session.actualCutPieceQty ?? summary.totalActualCutPieceQty,
    configuredLengthTotal: session.configuredLengthTotal ?? 0,
    claimedLengthTotal: session.claimedLengthTotal ?? 0,
    varianceLength: session.varianceLength ?? 0,
    varianceNote: session.varianceNote || '',
    totalAmount:
      operatorAmountSummary.hasAnyAllocationData
        ? operatorAmountSummary.totalDisplayAmount
        : session.totalAmount ??
          Number((((session.unitPrice ?? 0) * (session.actualCutPieceQty ?? 0))).toFixed(2)),
    updatedAt: nowText(now),
    warningMessages: session.warningMessages || [],
    sourceChannel: session.sourceChannel || 'MANUAL',
    sourceWritebackId: session.sourceWritebackId || '',
    updatedFromPdaAt: session.updatedFromPdaAt || '',
  }

  return {
    ...store,
    sessions: [...store.sessions.filter((item) => item.spreadingSessionId !== normalized.spreadingSessionId), normalized].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'),
    ),
  }
}

export function upsertMarkerRecord(marker: MarkerRecord, store: MarkerSpreadingStore, now = new Date()): MarkerSpreadingStore {
  const normalized = normalizeMarkerRecord({
    ...marker,
    totalPieces: computeMarkerTotalPieces(marker.sizeDistribution),
    spreadTotalLength:
      marker.spreadTotalLength ??
      (deriveMarkerTemplateByMode(marker.markerMode) === 'row-template'
        ? computeNormalMarkerSpreadTotalLength(marker.lineItems || [])
        : Number(marker.actualMaterialMeter ?? 0)),
    plannedSizeRatioText: marker.plannedSizeRatioText || buildPlannedSizeRatioText(marker.sizeDistribution),
    updatedAt: nowText(now),
    updatedBy: marker.updatedBy || '唛架编辑页',
  })

  return {
    ...store,
    markers: [...store.markers.filter((item) => item.markerId !== normalized.markerId), normalized].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'),
    ),
  }
}

export function updateSessionStatus(session: SpreadingSession, status: SpreadingStatusKey): SpreadingSession {
  return {
    ...session,
    status,
  }
}
