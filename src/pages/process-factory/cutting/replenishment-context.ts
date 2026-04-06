import type { MergeBatchRecord } from './merge-batches-model'
import {
  buildSpreadingVarianceSummary,
  type MarkerRecord,
  type MarkerSpreadingContext,
  type MarkerSpreadingStore,
  type SpreadingSession,
  type SpreadingVarianceSummary,
} from './marker-spreading-model'
import type { MaterialPrepLineItem, MaterialPrepRow } from './material-prep-model'
import type { OriginalCutOrderRow } from './original-orders-model'

export type ReplenishmentContextBaseSourceType = 'original-order' | 'merge-batch'
export type ReplenishmentContextSourceType = ReplenishmentContextBaseSourceType | 'spreading-session'
export type ReplenishmentPendingPrepDecisionKey = 'YES' | 'NO' | 'UNKNOWN'

export interface ReplenishmentContextRecord {
  contextId: string
  sourceType: ReplenishmentContextSourceType
  baseSourceType: ReplenishmentContextBaseSourceType
  mergeBatchId: string
  mergeBatchNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialRows: MaterialPrepRow[]
  marker: MarkerRecord | null
  session: SpreadingSession | null
  totalRequiredQty: number
  totalConfiguredLength: number
  totalClaimedLength: number
  totalUsableLength: number
  totalShortageLength: number
  varianceSummary: SpreadingVarianceSummary | null
}

export interface ReplenishmentPendingPrepDecision {
  decision: ReplenishmentPendingPrepDecisionKey
  note: string
}

export interface ReplenishmentPendingPrepSignal {
  pendingPrep: ReplenishmentPendingPrepDecision
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function buildRowsById(rows: MaterialPrepRow[]): Record<string, MaterialPrepRow> {
  return rows.reduce<Record<string, MaterialPrepRow>>((accumulator, row) => {
    accumulator[row.originalCutOrderId] = row
    accumulator[row.originalCutOrderNo] = row
    return accumulator
  }, {})
}

function buildOriginalRowsById(rows: OriginalCutOrderRow[]): Record<string, OriginalCutOrderRow> {
  return rows.reduce<Record<string, OriginalCutOrderRow>>((accumulator, row) => {
    accumulator[row.originalCutOrderId] = row
    accumulator[row.originalCutOrderNo] = row
    return accumulator
  }, {})
}

function getContextRowsByMergeBatch(batch: MergeBatchRecord, rowsById: Record<string, MaterialPrepRow>): MaterialPrepRow[] {
  return batch.items
    .map((item) => rowsById[item.originalCutOrderId] || rowsById[item.originalCutOrderNo])
    .filter((row): row is MaterialPrepRow => Boolean(row))
}

function findMergeBatchForRow(row: MaterialPrepRow, mergeBatches: MergeBatchRecord[]): MergeBatchRecord | null {
  return (
    (row.mergeBatchIds[0] && mergeBatches.find((batch) => batch.mergeBatchId === row.mergeBatchIds[0])) ||
    (row.latestMergeBatchNo && mergeBatches.find((batch) => batch.mergeBatchNo === row.latestMergeBatchNo)) ||
    null
  )
}

function findRelevantSession(context: {
  baseSourceType: ReplenishmentContextBaseSourceType
  mergeBatchId: string
  originalCutOrderIds: string[]
}, store: MarkerSpreadingStore): SpreadingSession | null {
  const matched = store.sessions
    .filter((session) => {
      if (context.baseSourceType === 'merge-batch' && context.mergeBatchId) {
        return session.contextType === 'merge-batch' && session.mergeBatchId === context.mergeBatchId
      }
      return session.contextType === 'original-order' && session.originalCutOrderIds[0] === context.originalCutOrderIds[0]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))

  return matched[0] || null
}

function findRelevantMarker(context: {
  baseSourceType: ReplenishmentContextBaseSourceType
  mergeBatchId: string
  originalCutOrderIds: string[]
}, store: MarkerSpreadingStore): MarkerRecord | null {
  const matched = store.markers
    .filter((marker) => {
      if (context.baseSourceType === 'merge-batch' && context.mergeBatchId) {
        return marker.contextType === 'merge-batch' && marker.mergeBatchId === context.mergeBatchId
      }
      return marker.contextType === 'original-order' && marker.originalCutOrderIds[0] === context.originalCutOrderIds[0]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))

  return matched[0] || null
}

function buildMarkerContext(options: {
  baseSourceType: ReplenishmentContextBaseSourceType
  mergeBatchId: string
  mergeBatchNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialRows: MaterialPrepRow[]
}): MarkerSpreadingContext {
  return {
    contextType: options.baseSourceType,
    originalCutOrderIds: options.originalCutOrderIds,
    originalCutOrderNos: options.originalCutOrderNos,
    mergeBatchId: options.mergeBatchId,
    mergeBatchNo: options.mergeBatchNo,
    productionOrderNos: options.productionOrderNos,
    styleCode: options.styleCode,
    spuCode: options.spuCode,
    styleName: options.styleName,
    materialSkuSummary: uniqueStrings(options.materialRows.map((row) => row.materialSkuSummary)).join(' / '),
    materialPrepRows: options.materialRows,
  }
}

function buildContextRecord(options: {
  contextId: string
  baseSourceType: ReplenishmentContextBaseSourceType
  mergeBatchId: string
  mergeBatchNo: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialRows: MaterialPrepRow[]
  originalRowsById: Record<string, OriginalCutOrderRow>
  markerStore: MarkerSpreadingStore
}): ReplenishmentContextRecord {
  const marker = findRelevantMarker(options, options.markerStore)
  const session = findRelevantSession(options, options.markerStore)
  const markerContext = buildMarkerContext(options)
  const varianceSummary = buildSpreadingVarianceSummary(markerContext, marker, session)
  const totalRequiredQty = options.originalCutOrderIds.reduce((sum, originalCutOrderId) => {
    const row = options.originalRowsById[originalCutOrderId]
    return sum + (row?.plannedQty || row?.orderQty || 0)
  }, 0)
  const totalConfiguredLength = Number(
    options.materialRows.reduce(
      (sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.configuredQty, 0),
      0,
    ).toFixed(2),
  )
  const totalClaimedLength = Number(
    options.materialRows.reduce(
      (sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.claimedQty, 0),
      0,
    ).toFixed(2),
  )
  const totalShortageLength = Number(
    options.materialRows.reduce(
      (sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.shortageQty, 0),
      0,
    ).toFixed(2),
  )

  return {
    contextId: options.contextId,
    sourceType: session ? 'spreading-session' : options.baseSourceType,
    baseSourceType: options.baseSourceType,
    mergeBatchId: options.mergeBatchId,
    mergeBatchNo: options.mergeBatchNo,
    originalCutOrderIds: options.originalCutOrderIds,
    originalCutOrderNos: options.originalCutOrderNos,
    productionOrderNos: options.productionOrderNos,
    styleCode: options.styleCode,
    spuCode: options.spuCode,
    styleName: options.styleName,
    materialRows: options.materialRows,
    marker,
    session,
    totalRequiredQty,
    totalConfiguredLength,
    totalClaimedLength,
    totalUsableLength: Number((varianceSummary?.usableLengthTotal || 0).toFixed(2)),
    totalShortageLength,
    varianceSummary,
  }
}

export function buildReplenishmentContextRecords(options: {
  materialPrepRows: MaterialPrepRow[]
  originalRows: OriginalCutOrderRow[]
  mergeBatches: MergeBatchRecord[]
  markerStore: MarkerSpreadingStore
}): ReplenishmentContextRecord[] {
  const rowsById = buildRowsById(options.materialPrepRows)
  const originalRowsById = buildOriginalRowsById(options.originalRows)
  const contexts: ReplenishmentContextRecord[] = []
  const consumedOriginalCutOrderIds = new Set<string>()
  const createdMergeBatchIds = new Set<string>()

  for (const row of options.materialPrepRows) {
    if (consumedOriginalCutOrderIds.has(row.originalCutOrderId)) continue

    const mergeBatch = findMergeBatchForRow(row, options.mergeBatches)
    if (mergeBatch && !createdMergeBatchIds.has(mergeBatch.mergeBatchId)) {
      const batchRows = getContextRowsByMergeBatch(mergeBatch, rowsById)
      if (batchRows.length) {
        batchRows.forEach((item) => consumedOriginalCutOrderIds.add(item.originalCutOrderId))
        createdMergeBatchIds.add(mergeBatch.mergeBatchId)
        contexts.push(
          buildContextRecord({
            contextId: `merge-${mergeBatch.mergeBatchId}`,
            baseSourceType: 'merge-batch',
            mergeBatchId: mergeBatch.mergeBatchId,
            mergeBatchNo: mergeBatch.mergeBatchNo,
            originalCutOrderIds: batchRows.map((item) => item.originalCutOrderId),
            originalCutOrderNos: batchRows.map((item) => item.originalCutOrderNo),
            productionOrderNos: uniqueStrings(batchRows.map((item) => item.productionOrderNo)),
            styleCode: mergeBatch.styleCode || row.styleCode,
            spuCode: mergeBatch.spuCode || row.spuCode,
            styleName: mergeBatch.styleName || row.styleName,
            materialRows: batchRows,
            originalRowsById,
            markerStore: options.markerStore,
          }),
        )
        continue
      }
    }

    consumedOriginalCutOrderIds.add(row.originalCutOrderId)
    contexts.push(
      buildContextRecord({
        contextId: `original-${row.originalCutOrderId}`,
        baseSourceType: 'original-order',
        mergeBatchId: '',
        mergeBatchNo: row.latestMergeBatchNo || '',
        originalCutOrderIds: [row.originalCutOrderId],
        originalCutOrderNos: [row.originalCutOrderNo],
        productionOrderNos: [row.productionOrderNo],
        styleCode: row.styleCode,
        spuCode: row.spuCode,
        styleName: row.styleName,
        materialRows: [row],
        originalRowsById,
        markerStore: options.markerStore,
      }),
    )
  }

  return contexts
}

function normalizeText(value: string | undefined): string {
  return (value || '').trim().toLowerCase()
}

function lineHasAnyKeyword(line: MaterialPrepLineItem, keywords: string[]): boolean {
  const haystack = [
    line.materialCategory,
    line.materialAttr,
    line.materialName,
    line.materialSku,
  ]
    .map(normalizeText)
    .join(' ')

  return keywords.some((keyword) => haystack.includes(keyword))
}

function inferExplicitDecision(options: {
  lineItems: MaterialPrepLineItem[]
  positiveKeywords: string[]
  negativeKeywords: string[]
  positiveNote: string
  negativeNote: string
  unknownNote: string
}): ReplenishmentPendingPrepDecision {
  if (!options.lineItems.length) {
    return { decision: 'UNKNOWN', note: options.unknownNote }
  }

  if (options.lineItems.some((item) => lineHasAnyKeyword(item, options.positiveKeywords))) {
    return { decision: 'YES', note: options.positiveNote }
  }

  if (options.lineItems.every((item) => lineHasAnyKeyword(item, options.negativeKeywords))) {
    return { decision: 'NO', note: options.negativeNote }
  }

  return { decision: 'UNKNOWN', note: options.unknownNote }
}

export function inferReplenishmentPendingPrepDecision(context: ReplenishmentContextRecord): ReplenishmentPendingPrepSignal {
  const lineItems = context.materialRows.flatMap((row) => row.materialLineItems)
  const pendingPrep = inferExplicitDecision({
    lineItems,
    positiveKeywords: ['主料', '面料主料'],
    negativeKeywords: ['里辅料', '辅料'],
    positiveNote: '当前面料行已命中主料信号，需同步关注仓库待配料。',
    negativeNote: '当前面料行未命中主料信号，可不必追加仓库待配料。',
    unknownNote: '当前无法明确判断是否需要回仓库待配料，建议人工确认。',
  })

  return {
    pendingPrep,
  }
}
