import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress'
import { buildMaterialPrepViewModel, type MaterialPrepRow } from './material-prep-model'
import type { MergeBatchRecord } from './merge-batches-model'
import {
  buildMarkerSeedDraft,
  buildMarkerSpreadingNavigationPayload,
  buildSpreadingReplenishmentWarning,
  buildMarkerWarningMessages,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  computeActualCutQty,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeLengthVariance,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeRemainingLength,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  buildRollHandoverViewModel,
  buildSpreadingHandoverListSummary,
  createEmptyStore,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingModeMeta,
  deserializeMarkerSpreadingStorage,
  MARKER_SIZE_KEYS,
  summarizeSpreadingRolls,
  summarizeSpreadingOperatorAmounts,
  summarizeSpreadingOperators,
  validateMarkerModeShape,
  buildOperatorAmountWarnings,
  type SpreadingReplenishmentWarning,
  type SpreadingSuggestedAction,
  type HighLowCuttingRow,
  type HighLowPatternRow,
  type MarkerLineItem,
  type MarkerRecord,
  type MarkerSpreadingContext,
  type MarkerSpreadingPrefilter,
  type MarkerSpreadingStore,
  type SpreadingOperatorAmountSummary,
  type SpreadingOperatorRecord,
  type SpreadingRollHandoverSummary,
  type SpreadingSession,
} from './marker-spreading-model'
import { readWarehouseMergeBatchLedger } from './warehouse-shared'
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel,
  type MarkerAllocationSizeSummaryRow,
  type MarkerAllocationSourceRow,
  type MarkerExplosionAllocationRow,
  type MarkerExplosionMissingMappingRow,
  type MarkerExplosionPieceDetailRow,
  type MarkerExplosionSkuSummaryRow,
  type MarkerPieceExplosionTotals,
} from './marker-piece-explosion'

export {
  buildMarkerSpreadingNavigationPayload,
  buildSpreadingReplenishmentWarning,
  buildMarkerWarningMessages,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  computeActualCutQty,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeLengthVariance,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeRemainingLength,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  buildRollHandoverViewModel,
  buildSpreadingHandoverListSummary,
  buildOperatorAmountWarnings,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingModeMeta,
  MARKER_SIZE_KEYS,
  summarizeSpreadingRolls,
  summarizeSpreadingOperatorAmounts,
  validateMarkerModeShape,
}

export interface MarkerListRow {
  markerId: string
  markerNo: string
  contextType: 'original-order' | 'merge-batch'
  contextLabel: string
  originalCutOrderCount: number
  originalCutOrderNos: string[]
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  colorSummary: string
  markerMode: MarkerRecord['markerMode']
  markerModeLabel: string
  totalPieces: number
  netLength: number
  singlePieceUsage: number
  spreadTotalLength: number
  markerImageStatus: string
  hasImage: boolean
  hasAdjustment: boolean
  updatedAt: string
  lineItemCount: number
  lineSummary: string
  record: MarkerRecord
  keywordIndex: string[]
}

export interface MarkerDetailViewModel {
  row: MarkerListRow
  lineSummary: MarkerLineItemSummary
  plannedSizeRatioText: string
  totalLineSpreadLength: number
  templateType: 'row-template' | 'matrix-template'
  usageSummary: ReturnType<typeof computeUsageSummary>
  warningMessages: string[]
  highLowPatternKeys: string[]
  highLowCuttingRows: HighLowCuttingRow[]
  highLowPatternRows: HighLowPatternRow[]
  highLowCuttingTotal: number
  highLowPatternTotal: number
  sourceOrderRows: MarkerAllocationSourceRow[]
  allocationRows: MarkerExplosionAllocationRow[]
  allocationSizeSummary: MarkerAllocationSizeSummaryRow[]
  skuSummaryRows: MarkerExplosionSkuSummaryRow[]
  pieceDetailRows: MarkerExplosionPieceDetailRow[]
  mappingWarnings: string[]
  missingMappings: MarkerExplosionMissingMappingRow[]
  totals: MarkerPieceExplosionTotals
}

export interface SpreadingListRow {
  spreadingSessionId: string
  sessionNo: string
  contextType: 'original-order' | 'merge-batch'
  contextLabel: string
  originalCutOrderCount: number
  originalCutOrderNos: string[]
  mergeBatchNo: string
  styleCode: string
  spuCode: string
  materialSkuSummary: string
  colorSummary: string
  spreadingMode: SpreadingSession['spreadingMode']
  spreadingModeLabel: string
  rollCount: number
  operatorCount: number
  totalActualLength: number
  totalCalculatedUsableLength: number
  totalRemainingLength: number
  actualCutPieceQty: number
  configuredLengthTotal: number
  claimedLengthTotal: number
  varianceLength: number
  varianceNote: string
  hasVariance: boolean
  differenceStatusLabel: string
  differenceStatusTone: 'normal' | 'warning'
  completedOriginalOrderCount: number
  hasHandover: boolean
  hasHandoverWarnings: boolean
  handoverStatusLabel: string
  hasOperatorAllocation: boolean
  operatorAllocationAmountTotal: number
  hasManualAdjustedAmount: boolean
  operatorAllocationStatusLabel: string
  hasWarnings: boolean
  warningStatusLabel: string
  hasReplenishmentWarning: boolean
  replenishmentWarningLevel: string
  replenishmentSuggestedAction: SpreadingSuggestedAction
  pendingReplenishmentConfirmation: boolean
  warningMessages: string[]
  replenishmentWarning: SpreadingReplenishmentWarning | null
  replenishmentPayload: Record<string, string | undefined>
  productionOrderNos: string[]
  statusLabel: string
  statusKey: SpreadingSession['status']
  updatedAt: string
  session: SpreadingSession
  keywordIndex: string[]
}

export interface SpreadingDetailViewModel {
  row: SpreadingListRow
  markerRecord: MarkerRecord | null
  warningMessages: string[]
  varianceSummary: NonNullable<ReturnType<typeof buildSpreadingVarianceSummary>> | null
  replenishmentWarning: SpreadingReplenishmentWarning | null
  navigationPayload: ReturnType<typeof buildMarkerSpreadingNavigationPayload>
  linkedRollNos: Record<string, string>
  linkedOriginalCutOrderNos: string[]
  sortedOperators: SpreadingOperatorRecord[]
  operatorsByRollId: Record<string, SpreadingOperatorRecord[]>
  handoverSummaryByRollId: Record<string, SpreadingRollHandoverSummary>
  rollParticipantSummary: Record<string, string>
  operatorAmountSummary: SpreadingOperatorAmountSummary
  amountWarnings: string[]
}

export interface MarkerLineItemSummary {
  lineCount: number
  colorSummary: string
  totalLength: number
  totalPieces: number
  summaryText: string
}

export interface MarkerSpreadingPrototypeData {
  rows: MaterialPrepRow[]
  rowsById: Record<string, MaterialPrepRow>
  mergeBatches: MergeBatchRecord[]
  store: MarkerSpreadingStore
}

function buildSessionContext(
  session: SpreadingSession,
  originalRows: MaterialPrepRow[],
  batch: MergeBatchRecord | null,
): MarkerSpreadingContext | null {
  if (!originalRows.length && !session.mergeBatchId && !session.originalCutOrderIds.length) return null

  return {
    contextType: session.contextType,
    originalCutOrderIds: [...session.originalCutOrderIds],
    originalCutOrderNos: originalRows.map((row) => row.originalCutOrderNo),
    mergeBatchId: session.mergeBatchId || batch?.mergeBatchId || '',
    mergeBatchNo: session.mergeBatchNo || batch?.mergeBatchNo || '',
    productionOrderNos: uniqueStrings(originalRows.map((row) => row.productionOrderNo)),
    styleCode: session.styleCode || originalRows[0]?.styleCode || batch?.styleCode || '',
    spuCode: session.spuCode || originalRows[0]?.spuCode || batch?.spuCode || '',
    techPackSpuCode:
      uniqueStrings(originalRows.map((row) => row.techPackSpuCode)).length === 1
        ? uniqueStrings(originalRows.map((row) => row.techPackSpuCode))[0]
        : '',
    styleName: batch?.styleName || originalRows[0]?.styleName || '',
    materialSkuSummary:
      session.materialSkuSummary ||
      batch?.materialSkuSummary ||
      uniqueStrings(originalRows.map((row) => row.materialSkuSummary)).join(' / '),
    materialPrepRows: originalRows,
  }
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function getCompletedLinkedOriginalCutOrderIds(session: SpreadingSession): string[] {
  if (session.completionLinkage?.linkedOriginalCutOrderIds?.length) {
    return session.completionLinkage.linkedOriginalCutOrderIds
  }
  if (session.status === 'DONE' && session.contextType === 'original-order') {
    return [...session.originalCutOrderIds]
  }
  return []
}

function nowText(input = new Date()): string {
  const year = input.getFullYear()
  const month = `${input.getMonth() + 1}`.padStart(2, '0')
  const day = `${input.getDate()}`.padStart(2, '0')
  const hours = `${input.getHours()}`.padStart(2, '0')
  const minutes = `${input.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

function buildOriginalContext(row: MaterialPrepRow): MarkerSpreadingContext {
  return {
    contextType: 'original-order',
    originalCutOrderIds: [row.originalCutOrderId],
    originalCutOrderNos: [row.originalCutOrderNo],
    mergeBatchId: row.mergeBatchIds[0] || '',
    mergeBatchNo: row.latestMergeBatchNo || row.mergeBatchNos[0] || '',
    productionOrderNos: [row.productionOrderNo],
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpuCode || '',
    styleName: row.styleName,
    materialSkuSummary: row.materialSkuSummary,
    materialPrepRows: [row],
  }
}

function buildMergeBatchContext(batch: MergeBatchRecord, rowsById: Record<string, MaterialPrepRow>): MarkerSpreadingContext | null {
  const materialPrepRows = batch.items
    .map((item) => rowsById[item.originalCutOrderId])
    .filter((row): row is MaterialPrepRow => Boolean(row))

  if (!materialPrepRows.length) return null

  return {
    contextType: 'merge-batch',
    originalCutOrderIds: materialPrepRows.map((row) => row.originalCutOrderId),
    originalCutOrderNos: materialPrepRows.map((row) => row.originalCutOrderNo),
    mergeBatchId: batch.mergeBatchId,
    mergeBatchNo: batch.mergeBatchNo,
    productionOrderNos: uniqueStrings(materialPrepRows.map((row) => row.productionOrderNo)),
    styleCode: batch.styleCode || materialPrepRows[0]?.styleCode || '',
    spuCode: batch.spuCode || materialPrepRows[0]?.spuCode || '',
    techPackSpuCode:
      uniqueStrings(materialPrepRows.map((row) => row.techPackSpuCode)).length === 1
        ? uniqueStrings(materialPrepRows.map((row) => row.techPackSpuCode))[0]
        : '',
    styleName: batch.styleName || materialPrepRows[0]?.styleName || '',
    materialSkuSummary: batch.materialSkuSummary || uniqueStrings(materialPrepRows.map((row) => row.materialSkuSummary)).join(' / '),
    materialPrepRows,
  }
}

function createSeedSession(marker: MarkerRecord, context: MarkerSpreadingContext, index: number): SpreadingSession {
  const session = createSpreadingDraftFromMarker(marker, context, new Date(`2026-03-${String(10 + index).padStart(2, '0')}T09:00:00`))
  const primaryMaterial = context.materialPrepRows[0]?.materialLineItems[0]
  const colors = uniqueStrings(context.materialPrepRows.map((row) => row.color))

  const rollA = createRollRecordDraft(session.spreadingSessionId, primaryMaterial?.materialSku || '')
  rollA.sortOrder = 1
  rollA.rollNo = `ROLL-${String(index + 1).padStart(2, '0')}A`
  rollA.color = colors[0] || ''
  rollA.width = 160
  rollA.labeledLength = 28 + index * 2
  rollA.actualLength = 27 + index * 2
  rollA.headLength = 0.6
  rollA.tailLength = 0.4
  rollA.layerCount = 18 + index
  rollA.totalLength = Number((rollA.actualLength + rollA.headLength + rollA.tailLength).toFixed(2))
  rollA.remainingLength = Number(Math.max(rollA.labeledLength - rollA.actualLength, 0).toFixed(2))
  rollA.actualCutPieceQty = Math.max(Math.floor(marker.totalPieces * 0.5), 20)
  rollA.occurredAt = nowText(new Date(`2026-03-${String(10 + index).padStart(2, '0')}T10:00:00`))
  rollA.operatorNames = ['张师傅']
  rollA.usableLength = computeUsableLength(rollA.actualLength, rollA.headLength, rollA.tailLength)

  const rollB = createRollRecordDraft(session.spreadingSessionId, primaryMaterial?.materialSku || '')
  rollB.sortOrder = 2
  rollB.rollNo = `ROLL-${String(index + 1).padStart(2, '0')}B`
  rollB.color = colors[1] || colors[0] || ''
  rollB.width = 160
  rollB.labeledLength = 16 + index
  rollB.actualLength = 15 + index
  rollB.headLength = 0.5
  rollB.tailLength = 0.3
  rollB.layerCount = 10 + index
  rollB.totalLength = Number((rollB.actualLength + rollB.headLength + rollB.tailLength).toFixed(2))
  rollB.remainingLength = Number(Math.max(rollB.labeledLength - rollB.actualLength, 0).toFixed(2))
  rollB.actualCutPieceQty = Math.max(marker.totalPieces - (rollA.actualCutPieceQty || 0), 10)
  rollB.occurredAt = nowText(new Date(`2026-03-${String(10 + index).padStart(2, '0')}T13:30:00`))
  rollB.operatorNames = ['李师傅', '王师傅']
  rollB.usableLength = computeUsableLength(rollB.actualLength, rollB.headLength, rollB.tailLength)
  rollB.handoverNotes = '同卷未铺完，午后换班继续完成。'

  const operatorA = createOperatorRecordDraft(session.spreadingSessionId)
  operatorA.sortOrder = 1
  operatorA.rollRecordId = rollA.rollRecordId
  operatorA.operatorName = '张师傅'
  operatorA.operatorAccountId = 'CUT001'
  operatorA.startAt = `2026-03-${String(10 + index).padStart(2, '0')} 09:00`
  operatorA.endAt = `2026-03-${String(10 + index).padStart(2, '0')} 12:00`
  operatorA.actionType = '完成铺布'
  operatorA.startLayer = 1
  operatorA.endLayer = rollA.layerCount
  operatorA.handledLength = rollA.actualLength

  const operatorB = createOperatorRecordDraft(session.spreadingSessionId)
  operatorB.sortOrder = 2
  operatorB.rollRecordId = rollB.rollRecordId
  operatorB.operatorName = '李师傅'
  operatorB.operatorAccountId = 'CUT002'
  operatorB.startAt = `2026-03-${String(10 + index).padStart(2, '0')} 13:00`
  operatorB.endAt = `2026-03-${String(10 + index).padStart(2, '0')} 15:00`
  operatorB.actionType = '中途交接'
  operatorB.handoverFlag = true
  operatorB.startLayer = 1
  operatorB.endLayer = Math.max(Math.floor(rollB.layerCount / 2), 1)
  operatorB.handledLength = Number((rollB.actualLength * 0.45).toFixed(2))
  operatorB.note = '先完成本卷前半段铺布。'
  operatorB.handoverNotes = '午后换班，将该卷交接给王师傅继续铺。'

  const operatorC = createOperatorRecordDraft(session.spreadingSessionId)
  operatorC.sortOrder = 3
  operatorC.rollRecordId = rollB.rollRecordId
  operatorC.operatorName = '王师傅'
  operatorC.operatorAccountId = 'CUT003'
  operatorC.startAt = `2026-03-${String(10 + index).padStart(2, '0')} 15:00`
  operatorC.endAt = `2026-03-${String(10 + index).padStart(2, '0')} 17:30`
  operatorC.actionType = '完成铺布'
  operatorC.handoverFlag = true
  operatorC.startLayer = operatorB.endLayer + 1
  operatorC.endLayer = rollB.layerCount
  operatorC.handledLength = Number((rollB.actualLength - (operatorB.handledLength || 0)).toFixed(2))
  operatorC.previousOperatorName = operatorB.operatorName
  operatorC.handoverAtLayer = operatorB.endLayer
  operatorC.handoverAtLength = operatorB.handledLength
  operatorC.note = '接手完成本卷剩余铺布。'
  operatorC.handoverNotes = '承接李师傅交接，继续铺至本卷结束。'

  session.sessionNo = session.sessionNo || `PB-${String(2000 + index).padStart(4, '0')}`
  session.rolls = index % 2 === 0 ? [rollA, rollB] : [rollA]
  session.operators = index % 2 === 0 ? [operatorA, operatorB, operatorC] : [operatorA]
  session.status = index % 2 === 0 ? 'IN_PROGRESS' : 'DONE'
  session.actualCutPieceQty = session.rolls.reduce((sum, roll) => sum + Math.max(roll.actualCutPieceQty || 0, 0), 0)
  session.unitPrice = 0.46 + index * 0.04
  session.note = index % 2 === 0 ? '当前仍可继续补录剩余卷与人员交接。' : '当前铺布记录已完成，可用于后续补料与打票。'
  session.updatedAt = nowText(new Date(`2026-03-${String(10 + index).padStart(2, '0')}T18:00:00`))
  return session
}

function hasMarkerForContext(store: MarkerSpreadingStore, context: MarkerSpreadingContext): boolean {
  if (context.contextType === 'merge-batch') {
    return store.markers.some((item) => item.contextType === 'merge-batch' && item.mergeBatchId === context.mergeBatchId)
  }
  return store.markers.some(
    (item) => item.contextType === 'original-order' && item.originalCutOrderIds[0] === context.originalCutOrderIds[0],
  )
}

function hasSessionForContext(store: MarkerSpreadingStore, context: MarkerSpreadingContext): boolean {
  if (context.contextType === 'merge-batch') {
    return store.sessions.some((item) => item.contextType === 'merge-batch' && item.mergeBatchId === context.mergeBatchId)
  }
  return store.sessions.some(
    (item) => item.contextType === 'original-order' && item.originalCutOrderIds[0] === context.originalCutOrderIds[0],
  )
}

export function summarizeMarkerLineItems(lineItems: MarkerLineItem[] = []): MarkerLineItemSummary {
  const totalLength = Number(lineItems.reduce((sum, item) => sum + Math.max(item.markerLength, 0), 0).toFixed(2))
  const totalPieces = lineItems.reduce((sum, item) => sum + Math.max(item.markerPieceCount ?? item.pieceCount ?? 0, 0), 0)
  const colorSummary = uniqueStrings(lineItems.map((item) => item.color)).join(' / ')
  return {
    lineCount: lineItems.length,
    colorSummary,
    totalLength,
    totalPieces,
    summaryText: lineItems.length
      ? `${lineItems.length} 行 · ${colorSummary || '颜色待补'} · ${totalPieces} 件`
      : '当前尚未补录排版明细。',
  }
}

export function buildMarkerSpreadingPrototypeStore(options: {
  rows: MaterialPrepRow[]
  mergeBatches: MergeBatchRecord[]
  stored?: MarkerSpreadingStore
}): MarkerSpreadingStore {
  let nextStore = options.stored ? deserializeMarkerSpreadingStorage(JSON.stringify(options.stored)) : createEmptyStore()
  const rowsById = Object.fromEntries(options.rows.map((row) => [row.originalCutOrderId, row]))

  const seedContexts: MarkerSpreadingContext[] = []
  if (options.rows[0]) seedContexts.push(buildOriginalContext(options.rows[0]))
  if (options.rows[1] && options.rows[1].originalCutOrderId !== options.rows[0]?.originalCutOrderId) {
    seedContexts.push(buildOriginalContext(options.rows[1]))
  }
  const firstBatchContext = options.mergeBatches[0] ? buildMergeBatchContext(options.mergeBatches[0], rowsById) : null
  if (firstBatchContext) seedContexts.push(firstBatchContext)

  seedContexts.forEach((context, index) => {
    if (!hasMarkerForContext(nextStore, context)) {
      const markerDraft = buildMarkerSeedDraft(context, null)
      if (!markerDraft) return
      markerDraft.markerNo = markerDraft.markerNo || `MJ-${String(index + 1).padStart(4, '0')}`
      markerDraft.updatedAt = nowText(new Date(`2026-03-${String(10 + index).padStart(2, '0')}T08:30:00`))
      nextStore = {
        ...nextStore,
        markers: [...nextStore.markers, markerDraft],
      }
    }

    if (!hasSessionForContext(nextStore, context)) {
      const marker =
        nextStore.markers.find((item) =>
          context.contextType === 'merge-batch'
            ? item.contextType === 'merge-batch' && item.mergeBatchId === context.mergeBatchId
            : item.contextType === 'original-order' && item.originalCutOrderIds[0] === context.originalCutOrderIds[0],
        ) || null

      if (!marker) return
      nextStore = {
        ...nextStore,
        sessions: [...nextStore.sessions, createSeedSession(marker, context, index)],
      }
    }
  })

  return {
    markers: [...nextStore.markers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN')),
    sessions: [...nextStore.sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN')),
  }
}

export function readMarkerSpreadingPrototypeData(): MarkerSpreadingPrototypeData {
  const mergeBatches = readWarehouseMergeBatchLedger()
  const rows = buildMaterialPrepViewModel(cuttingOrderProgressRecords, mergeBatches).rows
  const rowsById = Object.fromEntries(rows.map((row) => [row.originalCutOrderId, row]))
  const stored = deserializeMarkerSpreadingStorage(localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY))
  const store = buildMarkerSpreadingPrototypeStore({ rows, mergeBatches, stored })

  return {
    rows,
    rowsById,
    mergeBatches,
    store,
  }
}

export function buildMarkerListViewModel(options: {
  markerRecords: MarkerRecord[]
  rowsById: Record<string, MaterialPrepRow>
  mergeBatches: MergeBatchRecord[]
}): MarkerListRow[] {
  const batchById = Object.fromEntries(options.mergeBatches.map((batch) => [batch.mergeBatchId, batch]))

  return options.markerRecords
    .map((record) => {
      const originalRows = record.originalCutOrderIds.map((id) => options.rowsById[id]).filter((row): row is MaterialPrepRow => Boolean(row))
      const originalCutOrderNos = originalRows.map((row) => row.originalCutOrderNo)
      const lineSummary = summarizeMarkerLineItems(record.lineItems)
      const batch = record.mergeBatchId ? batchById[record.mergeBatchId] : null
      const modeMeta = deriveMarkerModeMeta(record.markerMode)
      const templateType = deriveMarkerTemplateByMode(record.markerMode)
      const highLowCuttingTotal = computeHighLowCuttingTotals(record.highLowCuttingRows || []).cuttingTotal

      return {
        markerId: record.markerId,
        markerNo: record.markerNo || record.markerId,
        contextType: record.contextType,
        contextLabel: record.contextType === 'merge-batch' ? '合并裁剪批次上下文' : '原始裁片单上下文',
        originalCutOrderCount: record.originalCutOrderIds.length,
        originalCutOrderNos,
        mergeBatchNo: record.mergeBatchNo || batch?.mergeBatchNo || '',
        styleCode: record.styleCode || originalRows[0]?.styleCode || '',
        spuCode: record.spuCode || originalRows[0]?.spuCode || '',
        materialSkuSummary:
          record.materialSkuSummary ||
          uniqueStrings(originalRows.map((row) => row.materialSkuSummary)).join(' / '),
        colorSummary: record.colorSummary || lineSummary.colorSummary || uniqueStrings(originalRows.map((row) => row.color)).join(' / '),
        markerMode: record.markerMode,
        markerModeLabel: modeMeta.label,
        totalPieces: record.totalPieces || computeMarkerTotalPieces(record.sizeDistribution),
        netLength: record.netLength,
        singlePieceUsage: record.singlePieceUsage,
        spreadTotalLength:
          record.spreadTotalLength ||
          (templateType === 'row-template'
            ? computeNormalMarkerSpreadTotalLength(record.lineItems || [])
            : Number(record.actualMaterialMeter || 0)),
        markerImageStatus: record.markerImageName ? '已上传' : '未上传',
        hasImage: Boolean(record.markerImageName),
        hasAdjustment: Boolean(record.adjustmentRequired || record.adjustmentNote),
        updatedAt: record.updatedAt,
        lineItemCount: lineSummary.lineCount,
        lineSummary:
          templateType === 'row-template'
            ? lineSummary.summaryText
            : `高低层矩阵 · ${(record.highLowCuttingRows || []).length} 色 · ${highLowCuttingTotal} 件`,
        record,
        keywordIndex: uniqueStrings([
          record.markerNo,
          record.mergeBatchNo,
          ...originalCutOrderNos,
          record.styleCode,
          record.spuCode,
          record.materialSkuSummary,
          record.colorSummary,
          modeMeta.label,
          record.adjustmentNote,
          ...(record.lineItems || []).flatMap((item) => [item.layoutCode, item.layoutDetailText]),
        ]),
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

export function buildSpreadingListViewModel(options: {
  spreadingSessions: SpreadingSession[]
  rowsById: Record<string, MaterialPrepRow>
  mergeBatches: MergeBatchRecord[]
  markerRecords?: MarkerRecord[]
}): SpreadingListRow[] {
  const batchById = Object.fromEntries(options.mergeBatches.map((batch) => [batch.mergeBatchId, batch]))
  const markerById = Object.fromEntries((options.markerRecords || []).map((marker) => [marker.markerId, marker]))

  return options.spreadingSessions
    .map((session) => {
      const originalRows = session.originalCutOrderIds.map((id) => options.rowsById[id]).filter((row): row is MaterialPrepRow => Boolean(row))
      const rollSummary = summarizeSpreadingRolls(session.rolls)
      const operatorSummary = summarizeSpreadingOperators(session.operators)
      const originalCutOrderNos = originalRows.map((row) => row.originalCutOrderNo)
      const modeMeta = deriveSpreadingModeMeta(session.spreadingMode)
      const batch = session.mergeBatchId ? batchById[session.mergeBatchId] : null
      const markerRecord = session.markerId ? markerById[session.markerId] || null : null
      const context = buildSessionContext(session, originalRows, batch)
      const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session)
      const handoverSummary = buildSpreadingHandoverListSummary(session.rolls, session.operators, markerRecord?.totalPieces || 0)
      const operatorAmountSummary = summarizeSpreadingOperatorAmounts(
        session.operators,
        markerRecord?.totalPieces || 0,
        session.unitPrice,
      )
      const warningMessages = buildSpreadingWarningMessages({
        session,
        markerTotalPieces: markerRecord?.totalPieces || 0,
        claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
      })
      const replenishmentWarning =
        session.replenishmentWarning ||
        buildSpreadingReplenishmentWarning({
          session,
          markerTotalPieces: markerRecord?.totalPieces || 0,
          originalCutOrderNos,
          productionOrderNos: context?.productionOrderNos || uniqueStrings(originalRows.map((row) => row.productionOrderNo)),
          materialAttr: originalRows[0]?.materialLabel || originalRows[0]?.materialCategory || '',
          warningMessages,
        })
      const navigationPayload = buildMarkerSpreadingNavigationPayload(context, varianceSummary, replenishmentWarning)
      const completedOriginalOrderCount = getCompletedLinkedOriginalCutOrderIds(session).length

      return {
        spreadingSessionId: session.spreadingSessionId,
        sessionNo: session.sessionNo || session.spreadingSessionId,
        contextType: session.contextType,
        contextLabel: session.contextType === 'merge-batch' ? '合并裁剪批次上下文' : '原始裁片单上下文',
        originalCutOrderCount: session.originalCutOrderIds.length,
        originalCutOrderNos,
        mergeBatchNo: session.mergeBatchNo || batch?.mergeBatchNo || '',
        styleCode: session.styleCode || originalRows[0]?.styleCode || '',
        spuCode: session.spuCode || originalRows[0]?.spuCode || '',
        materialSkuSummary:
          session.materialSkuSummary || uniqueStrings(originalRows.map((row) => row.materialSkuSummary)).join(' / '),
        colorSummary: session.colorSummary || uniqueStrings(originalRows.map((row) => row.color)).join(' / '),
        spreadingMode: session.spreadingMode,
        spreadingModeLabel: modeMeta.label,
        rollCount: session.rollCount || session.rolls.length,
        operatorCount: session.operatorCount || session.operators.length,
        totalActualLength: session.totalActualLength || rollSummary.totalActualLength,
        totalCalculatedUsableLength: session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
        totalRemainingLength: session.totalRemainingLength ?? rollSummary.totalRemainingLength,
        actualCutPieceQty: session.actualCutPieceQty || rollSummary.totalActualCutPieceQty,
        configuredLengthTotal: varianceSummary?.configuredLengthTotal || session.configuredLengthTotal || 0,
        claimedLengthTotal: varianceSummary?.claimedLengthTotal || session.claimedLengthTotal || 0,
        varianceLength: varianceSummary?.varianceLength || session.varianceLength || 0,
        varianceNote: varianceSummary?.replenishmentHint || session.varianceNote || '当前未识别明显差异。',
        hasVariance: Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01,
        differenceStatusLabel:
          Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01
            ? `存在差异 ${(varianceSummary?.varianceLength || session.varianceLength || 0).toFixed(2)} 米`
            : '无明显差异',
        differenceStatusTone:
          Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01 ? 'warning' : 'normal',
        completedOriginalOrderCount,
        hasHandover: handoverSummary.hasHandover,
        hasHandoverWarnings: handoverSummary.hasAbnormalHandover,
        handoverStatusLabel: handoverSummary.statusLabel,
        hasOperatorAllocation: operatorAmountSummary.hasAnyAllocationData,
        operatorAllocationAmountTotal: operatorAmountSummary.totalDisplayAmount,
        hasManualAdjustedAmount: operatorAmountSummary.hasManualAdjustedAmount,
        operatorAllocationStatusLabel: operatorAmountSummary.hasAnyAllocationData
          ? operatorAmountSummary.hasManualAdjustedAmount
            ? '已生成人员分摊，含人工调价'
            : '已生成人员分摊'
          : '待补录人员分摊',
        hasWarnings: warningMessages.length > 0,
        warningStatusLabel:
          warningMessages.length > 0
            ? `有 ${warningMessages.length} 条提醒`
            : operatorSummary.handoverRollCount > 0
              ? `已记录 ${operatorSummary.handoverRollCount} 卷交接`
              : '无提醒',
        hasReplenishmentWarning:
          replenishmentWarning.suggestedAction === '建议补料' || replenishmentWarning.suggestedAction === '存在异常差异，需人工确认',
        replenishmentWarningLevel: replenishmentWarning.warningLevel,
        replenishmentSuggestedAction: replenishmentWarning.suggestedAction,
        pendingReplenishmentConfirmation:
          !replenishmentWarning.handled && replenishmentWarning.suggestedAction !== '无需补料',
        warningMessages,
        replenishmentWarning,
        replenishmentPayload: navigationPayload.replenishment,
        productionOrderNos: context?.productionOrderNos || uniqueStrings(originalRows.map((row) => row.productionOrderNo)),
        statusLabel: session.status === 'DRAFT' ? '草稿' : session.status === 'IN_PROGRESS' ? '进行中' : session.status === 'DONE' ? '已完成' : '待补录',
        statusKey: session.status,
        updatedAt: session.updatedAt,
        session,
        keywordIndex: uniqueStrings([
          session.sessionNo,
          session.markerNo,
          session.mergeBatchNo,
          ...originalCutOrderNos,
          ...(context?.productionOrderNos || []),
          session.styleCode,
          session.spuCode,
          session.materialSkuSummary,
          ...session.rolls.map((roll) => roll.rollNo),
          ...session.rolls.map((roll) => roll.materialSku),
          ...session.operators.map((operator) => operator.operatorName),
        ]),
      }
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))
}

export function buildSpreadingDetailViewModel(options: {
  row: SpreadingListRow
  rowsById: Record<string, MaterialPrepRow>
  mergeBatches: MergeBatchRecord[]
  markerRecords: MarkerRecord[]
}): SpreadingDetailViewModel {
  const batchById = Object.fromEntries(options.mergeBatches.map((batch) => [batch.mergeBatchId, batch]))
  const markerById = Object.fromEntries(options.markerRecords.map((marker) => [marker.markerId, marker]))
  const session = options.row.session
  const batch = session.mergeBatchId ? batchById[session.mergeBatchId] || null : null
  const originalRows = session.originalCutOrderIds.map((id) => options.rowsById[id]).filter((row): row is MaterialPrepRow => Boolean(row))
  const markerRecord = session.markerId ? markerById[session.markerId] || null : null
  const context = buildSessionContext(session, originalRows, batch)
  const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session)
  const warningMessages = buildSpreadingWarningMessages({
    session,
    markerTotalPieces: markerRecord?.totalPieces || 0,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0,
  })
  const operatorSummary = summarizeSpreadingOperators(session.operators)
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(session.operators, markerRecord?.totalPieces || 0, session.unitPrice)
  const amountWarnings = buildOperatorAmountWarnings(session.operators, markerRecord?.totalPieces || 0, session.unitPrice)
  const handoverSummaryByRollId = Object.fromEntries(
    session.rolls.map((roll) => [
      roll.rollRecordId,
      buildRollHandoverViewModel(roll, operatorSummary.operatorsByRollId[roll.rollRecordId] || [], markerRecord?.totalPieces || 0),
    ]),
  )
  const replenishmentWarning =
    session.replenishmentWarning ||
    buildSpreadingReplenishmentWarning({
      session,
      markerTotalPieces: markerRecord?.totalPieces || 0,
      originalCutOrderNos: originalRows.map((item) => item.originalCutOrderNo),
      productionOrderNos: context?.productionOrderNos || uniqueStrings(originalRows.map((row) => row.productionOrderNo)),
      materialAttr: originalRows[0]?.materialLabel || originalRows[0]?.materialCategory || '',
      warningMessages,
    })
  return {
    row: options.row,
    markerRecord,
    warningMessages,
    varianceSummary,
    replenishmentWarning,
    navigationPayload: buildMarkerSpreadingNavigationPayload(context, varianceSummary, replenishmentWarning),
    linkedRollNos: Object.fromEntries(session.rolls.map((roll) => [roll.rollRecordId, roll.rollNo])),
    linkedOriginalCutOrderNos: originalRows.map((item) => item.originalCutOrderNo),
    sortedOperators: operatorSummary.sortedOperators,
    operatorsByRollId: operatorSummary.operatorsByRollId,
    handoverSummaryByRollId,
    rollParticipantSummary: Object.fromEntries(
      Object.entries(operatorSummary.rollParticipantNames).map(([rollId, names]) => [rollId, names.join(' → ') || '待补录']),
    ),
    operatorAmountSummary,
    amountWarnings,
  }
}

export function buildMarkerDetailViewModel(row: MarkerListRow): MarkerDetailViewModel {
  const lineSummary = summarizeMarkerLineItems(row.record.lineItems)
  const templateType = deriveMarkerTemplateByMode(row.record.markerMode)
  const usageSummary = computeUsageSummary(row.record)
  const highLowPatternKeys = row.record.highLowPatternKeys?.length ? row.record.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const highLowCuttingTotals = computeHighLowCuttingTotals(row.record.highLowCuttingRows || [])
  const highLowPatternTotals = computeHighLowPatternTotals(row.record.highLowPatternRows || [], highLowPatternKeys)
  const prototypeData = readMarkerSpreadingPrototypeData()
  const sourceRows = buildMarkerAllocationSourceRows(row.record, prototypeData.rowsById)
  const pieceExplosion = buildMarkerPieceExplosionViewModel({
    marker: row.record,
    sourceRows,
  })
  const warningMessages = uniqueStrings([...buildMarkerWarningMessages(row.record), ...pieceExplosion.mappingWarnings])
  return {
    row,
    lineSummary,
    plannedSizeRatioText:
      row.record.plannedSizeRatioText ||
      row.record.sizeDistribution
        .filter((item) => item.quantity > 0)
        .map((item) => `${item.sizeLabel}×${item.quantity}`)
        .join(' / '),
    totalLineSpreadLength: computeNormalMarkerSpreadTotalLength(row.record.lineItems || []),
    templateType,
    usageSummary,
    warningMessages,
    highLowPatternKeys,
    highLowCuttingRows: highLowCuttingTotals.rows,
    highLowPatternRows: highLowPatternTotals.rows,
    highLowCuttingTotal: highLowCuttingTotals.cuttingTotal,
    highLowPatternTotal: highLowPatternTotals.patternTotal,
    sourceOrderRows: pieceExplosion.sourceOrderRows,
    allocationRows: pieceExplosion.allocationRows,
    allocationSizeSummary: pieceExplosion.allocationSizeSummary,
    skuSummaryRows: pieceExplosion.skuSummaryRows,
    pieceDetailRows: pieceExplosion.pieceDetailRows,
    mappingWarnings: pieceExplosion.mappingWarnings,
    missingMappings: pieceExplosion.missingMappings,
    totals: pieceExplosion.totals,
  }
}

export function buildMarkerNavigationPayload(row: MarkerListRow): Record<string, string | undefined> {
  return {
    markerId: row.markerId,
    originalCutOrderId: row.contextType === 'original-order' ? row.record.originalCutOrderIds[0] : undefined,
    originalCutOrderNo: row.contextType === 'original-order' ? row.originalCutOrderNos[0] : undefined,
    mergeBatchId: row.contextType === 'merge-batch' ? row.record.mergeBatchId || undefined : undefined,
    mergeBatchNo: row.contextType === 'merge-batch' ? row.mergeBatchNo || undefined : undefined,
    styleCode: row.styleCode || undefined,
    materialSku: row.materialSkuSummary?.split(' / ')[0] || undefined,
  }
}

export function getDefaultMarkerSpreadingContext(
  rows: MaterialPrepRow[],
  mergeBatches: MergeBatchRecord[],
  prefilter: MarkerSpreadingPrefilter | null,
): MarkerSpreadingContext | null {
  if (prefilter?.mergeBatchId || prefilter?.mergeBatchNo) {
    const rowsById = Object.fromEntries(rows.map((row) => [row.originalCutOrderId, row]))
    const batch =
      (prefilter.mergeBatchId && mergeBatches.find((item) => item.mergeBatchId === prefilter.mergeBatchId)) ||
      (prefilter.mergeBatchNo && mergeBatches.find((item) => item.mergeBatchNo === prefilter.mergeBatchNo)) ||
      null
    if (batch) return buildMergeBatchContext(batch, rowsById)
  }

  if (prefilter?.originalCutOrderId || prefilter?.originalCutOrderNo) {
    const row =
      rows.find(
        (item) =>
          item.originalCutOrderId === prefilter.originalCutOrderId || item.originalCutOrderNo === prefilter.originalCutOrderNo,
      ) || null
    if (row) return buildOriginalContext(row)
  }

  return rows[0] ? buildOriginalContext(rows[0]) : null
}

export function buildMarkerSpreadingCountsByOriginalOrder(originalCutOrderId: string): {
  markerCount: number
  sessionCount: number
  rollCount: number
  operatorCount: number
  statusSummary: string
  spreadingStatusLabel: string
  latestSessionNo: string
  hasReplenishmentWarning: boolean
  warningLevelLabel: string
  suggestedAction: string
  hasOperatorAllocation: boolean
  operatorAmountTotal: number
  hasManualAdjustedAmount: boolean
} {
  const { store } = readMarkerSpreadingPrototypeData()
  const linkedSessions = store.sessions.filter((item) => item.originalCutOrderIds.includes(originalCutOrderId))
  const markersById = Object.fromEntries(store.markers.map((marker) => [marker.markerId, marker]))
  const doneCount = linkedSessions.filter((item) => item.status === 'DONE').length
  const inProgressCount = linkedSessions.filter((item) => item.status === 'IN_PROGRESS').length
  const latestSession = [...linkedSessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))[0] || null
  const latestWarning = latestSession?.replenishmentWarning || null
  const latestMarkerTotalPieces = latestSession?.markerId ? markersById[latestSession.markerId]?.totalPieces || 0 : 0
  const latestAmountSummary = latestSession
    ? summarizeSpreadingOperatorAmounts(latestSession.operators, latestMarkerTotalPieces, latestSession.unitPrice)
    : null
  const completedForCurrentOrder = linkedSessions.some((item) => getCompletedLinkedOriginalCutOrderIds(item).includes(originalCutOrderId))
  const spreadingStatusLabel = latestWarning && latestWarning.suggestedAction !== '无需补料'
    ? '待补料确认'
    : completedForCurrentOrder
      ? '铺布完成'
      : inProgressCount > 0
        ? '铺布中'
        : doneCount > 0
          ? '铺布完成'
          : '待铺布'

  return {
    markerCount: store.markers.filter((item) => item.originalCutOrderIds.includes(originalCutOrderId)).length,
    sessionCount: linkedSessions.length,
    rollCount: linkedSessions.reduce((sum, item) => sum + item.rolls.length, 0),
    operatorCount: linkedSessions.reduce((sum, item) => sum + item.operators.length, 0),
    statusSummary:
      doneCount > 0
        ? `已完成 ${doneCount} 条`
        : inProgressCount > 0
          ? `进行中 ${inProgressCount} 条`
          : linkedSessions.length > 0
            ? '以草稿为主'
            : '暂无铺布记录',
    spreadingStatusLabel,
    latestSessionNo: latestSession?.sessionNo || '暂无',
    hasReplenishmentWarning: Boolean(latestWarning && latestWarning.suggestedAction !== '无需补料'),
    warningLevelLabel: latestWarning?.warningLevel || '低',
    suggestedAction: latestWarning?.suggestedAction || '无需补料',
    hasOperatorAllocation: Boolean(latestAmountSummary?.hasAnyAllocationData),
    operatorAmountTotal: latestAmountSummary?.totalDisplayAmount || 0,
    hasManualAdjustedAmount: Boolean(latestAmountSummary?.hasManualAdjustedAmount),
  }
}
