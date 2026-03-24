import type { MaterialPrepRow } from './material-prep-model'
import type { MergeBatchRecord } from './merge-batches-model'

const numberFormatter = new Intl.NumberFormat('zh-CN')

export const CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY = 'cuttingMarkerSpreadingLedger'

export type MarkerModeKey = 'NORMAL' | 'HIGH_LOW' | 'FOLDED'
export type SpreadingStatusKey = 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'TO_FILL'
export type SpreadingSourceChannel = 'MANUAL' | 'PDA_WRITEBACK' | 'MIXED'

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
  contextType: 'original-order' | 'merge-batch'
  originalCutOrderIds: string[]
  mergeBatchId: string
  mergeBatchNo: string
  markerMode: MarkerModeKey
  sizeDistribution: MarkerSizeDistributionItem[]
  totalPieces: number
  netLength: number
  singlePieceUsage: number
  markerImageUrl: string
  markerImageName: string
  note: string
  updatedAt: string
}

export interface SpreadingRollRecord {
  rollRecordId: string
  spreadingSessionId: string
  rollNo: string
  materialSku: string
  width: number
  labeledLength: number
  actualLength: number
  headLength: number
  tailLength: number
  layerCount: number
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
  operatorAccountId: string
  operatorName: string
  startAt: string
  endAt: string
  actionType: string
  handoverFlag: boolean
  note: string
  sourceChannel: SpreadingSourceChannel
  sourceWritebackId: string
  updatedFromPdaAt: string
}

export interface SpreadingSession {
  spreadingSessionId: string
  contextType: 'original-order' | 'merge-batch'
  originalCutOrderIds: string[]
  mergeBatchId: string
  mergeBatchNo: string
  spreadingMode: MarkerModeKey
  status: SpreadingStatusKey
  importedFromMarker: boolean
  plannedLayers: number
  actualLayers: number
  totalActualLength: number
  totalHeadLength: number
  totalTailLength: number
  totalCalculatedUsableLength: number
  operatorCount: number
  rollCount: number
  note: string
  createdAt: string
  updatedAt: string
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
  varianceLength: number
  estimatedPieceCapacity: number
  requiredPieceQty: number
  shortageIndicator: boolean
  replenishmentHint: string
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
  NORMAL: {
    label: '正常铺布',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
    detailText: '标准顺铺方式，适合常规裁床执行。',
  },
  HIGH_LOW: {
    label: '高低层模式',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
    detailText: '用于高低层组合铺布，便于控制层间差异。',
  },
  FOLDED: {
    label: '对折铺布模式',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
    detailText: '用于对折裁片场景，后续菲票仍回落原始裁片单。',
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

export function deriveMarkerModeMeta(mode: MarkerModeKey): MarkerSpreadingSummaryMeta<MarkerModeKey> {
  const meta = markerModeMeta[mode]
  return createSummaryMeta(mode, meta.label, meta.className, meta.detailText)
}

export function computeMarkerTotalPieces(sizeDistribution: MarkerSizeDistributionItem[]): number {
  return sizeDistribution.reduce((sum, item) => sum + Math.max(item.quantity, 0), 0)
}

export function computeUsableLength(actualLength: number, headLength: number, tailLength: number): number {
  return Math.max(actualLength - headLength - tailLength, 0)
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
  return [
    { sizeLabel: 'S', quantity: baseline * 12 },
    { sizeLabel: 'M', quantity: baseline * 18 },
    { sizeLabel: 'L', quantity: baseline * 16 },
    { sizeLabel: 'XL', quantity: baseline * 10 },
  ]
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

  return {
    markerId: `seed-marker-${context.contextType}-${context.mergeBatchId || context.originalCutOrderIds[0]}`,
    contextType: context.contextType,
    originalCutOrderIds: [...context.originalCutOrderIds],
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    markerMode: 'NORMAL',
    sizeDistribution,
    totalPieces,
    netLength,
    singlePieceUsage,
    markerImageUrl: '',
    markerImageName: '',
    note: '当前为原型默认唛架草稿，可根据现场唛架图与尺码配比继续调整。',
    updatedAt: '',
  }
}

export function createSpreadingDraftFromMarker(
  marker: MarkerRecord,
  context: MarkerSpreadingContext,
  now = new Date(),
): SpreadingSession {
  const timestamp = now.getTime()
  return {
    spreadingSessionId: `spreading-session-${timestamp}`,
    contextType: context.contextType,
    originalCutOrderIds: [...context.originalCutOrderIds],
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    spreadingMode: marker.markerMode,
    status: 'DRAFT',
    importedFromMarker: true,
    plannedLayers: Math.max(Math.ceil(marker.totalPieces / 20), 1),
    actualLayers: 0,
    totalActualLength: 0,
    totalHeadLength: 0,
    totalTailLength: 0,
    totalCalculatedUsableLength: 0,
    operatorCount: 0,
    rollCount: 0,
    note: '铺布草稿已从当前唛架记录导入，可继续补录卷与人员。',
    createdAt: nowText(now),
    updatedAt: nowText(now),
    sourceChannel: 'MANUAL',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
    rolls: [],
    operators: [],
  }
}

export function summarizeSpreadingRolls(rolls: SpreadingRollRecord[]): {
  totalActualLength: number
  totalHeadLength: number
  totalTailLength: number
  totalCalculatedUsableLength: number
  rollCount: number
  totalLayers: number
} {
  return {
    totalActualLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.actualLength, 0), 0).toFixed(2)),
    totalHeadLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.headLength, 0), 0).toFixed(2)),
    totalTailLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.tailLength, 0), 0).toFixed(2)),
    totalCalculatedUsableLength: Number(rolls.reduce((sum, roll) => sum + computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength), 0).toFixed(2)),
    rollCount: rolls.length,
    totalLayers: rolls.reduce((sum, roll) => sum + Math.max(roll.layerCount, 0), 0),
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
  const varianceLength = Number((rollSummary.totalCalculatedUsableLength - claimedLengthTotal).toFixed(2))
  const shortageIndicator = Boolean(marker && marker.singlePieceUsage > 0 && requiredPieceQty > 0 && estimatedPieceCapacity < requiredPieceQty)

  let replenishmentHint = '当前铺布数据与仓库配料数据基本匹配。'
  if (!session || !session.rolls.length) {
    replenishmentHint = '当前尚未录入铺布卷数据，补料判断仍需补录后确认。'
  } else if (shortageIndicator) {
    replenishmentHint = '预计承载件数低于唛架总件数，建议进入补料管理进一步确认。'
  } else if (varianceLength < 0) {
    replenishmentHint = '可用长度低于已领取长度，建议复核铺布损耗与补料可能性。'
  }

  return {
    configuredLengthTotal,
    claimedLengthTotal,
    actualLengthTotal: rollSummary.totalActualLength,
    usableLengthTotal: rollSummary.totalCalculatedUsableLength,
    varianceLength,
    estimatedPieceCapacity,
    requiredPieceQty,
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

export function buildMarkerSpreadingNavigationPayload(
  context: MarkerSpreadingContext | null,
  varianceSummary: SpreadingVarianceSummary | null,
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
  const varianceHint = varianceSummary ? String(varianceSummary.varianceLength) : undefined
  const shortageHint = varianceSummary?.shortageIndicator ? 'true' : undefined

  return {
    replenishment: {
      mergeBatchNo: context.contextType === 'merge-batch' ? context.mergeBatchNo || undefined : undefined,
      originalCutOrderNo: context.contextType === 'original-order' ? baseOriginal || undefined : undefined,
      productionOrderNo: baseProduction || undefined,
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
      markers: Array.isArray(parsed?.markers) ? parsed.markers : [],
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
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

export function createRollRecordDraft(spreadingSessionId: string, materialSku = ''): SpreadingRollRecord {
  return {
    rollRecordId: `roll-${Date.now()}`,
    spreadingSessionId,
    rollNo: '',
    materialSku,
    width: 0,
    labeledLength: 0,
    actualLength: 0,
    headLength: 0,
    tailLength: 0,
    layerCount: 0,
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
    operatorRecordId: `operator-${Date.now()}`,
    spreadingSessionId,
    operatorAccountId: '',
    operatorName: '',
    startAt: '',
    endAt: '',
    actionType: '铺布',
    handoverFlag: false,
    note: '',
    sourceChannel: 'MANUAL',
    sourceWritebackId: '',
    updatedFromPdaAt: '',
  }
}

export function upsertSpreadingSession(session: SpreadingSession, store: MarkerSpreadingStore, now = new Date()): MarkerSpreadingStore {
  const summary = summarizeSpreadingRolls(session.rolls)
  const normalized: SpreadingSession = {
    ...session,
    totalActualLength: summary.totalActualLength,
    totalHeadLength: summary.totalHeadLength,
    totalTailLength: summary.totalTailLength,
    totalCalculatedUsableLength: summary.totalCalculatedUsableLength,
    rollCount: session.rolls.length,
    operatorCount: session.operators.length,
    actualLayers: summary.totalLayers,
    updatedAt: nowText(now),
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
  const normalized: MarkerRecord = {
    ...marker,
    totalPieces: computeMarkerTotalPieces(marker.sizeDistribution),
    updatedAt: nowText(now),
  }

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
