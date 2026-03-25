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
export type ReplenishmentCraftImpactDecisionKey = 'YES' | 'NO' | 'UNKNOWN'

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

export interface ReplenishmentCraftImpactDecision {
  decision: ReplenishmentCraftImpactDecisionKey
  note: string
}

export interface ReplenishmentCraftImpactSignals {
  printing: ReplenishmentCraftImpactDecision
  dyeing: ReplenishmentCraftImpactDecision
  specialProcess: ReplenishmentCraftImpactDecision
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
}): ReplenishmentCraftImpactDecision {
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

export function inferReplenishmentCraftImpacts(context: ReplenishmentContextRecord): ReplenishmentCraftImpactSignals {
  const lineItems = context.materialRows.flatMap((row) => row.materialLineItems)
  const printing = inferExplicitDecision({
    lineItems,
    positiveKeywords: ['印花', 'print'],
    negativeKeywords: ['净色', '里辅料', '辅料', '染色', 'dye'],
    positiveNote: '当前面料行已显式命中印花主料信号，建议同步印花链路。',
    negativeNote: '当前面料行未识别印花主料信号，可不必同步印花。',
    unknownNote: '当前无法明确判断是否影响印花，建议人工确认后再决定是否同步。',
  })
  const dyeing = inferExplicitDecision({
    lineItems,
    positiveKeywords: ['染色', 'dye'],
    negativeKeywords: ['净色', '里辅料', '辅料', '印花', 'print'],
    positiveNote: '当前面料行已显式命中染色主料信号，建议同步染色链路。',
    negativeNote: '当前面料行未识别染色主料信号，可不必同步染色。',
    unknownNote: '当前无法明确判断是否影响染色，建议人工确认后再决定是否同步。',
  })

  if (!lineItems.length) {
    return {
      printing,
      dyeing,
      specialProcess: {
        decision: 'UNKNOWN',
        note: '当前尚未形成可判断的面料行，需人工确认是否影响特殊工艺。',
      },
    }
  }

  if (lineItems.some((item) => lineHasAnyKeyword(item, ['特殊工艺', '捆条', '压褶', '绣', '烫钻', '镭射']))) {
    return {
      printing,
      dyeing,
      specialProcess: {
        decision: 'YES',
        note: '当前面料行已显式命中特殊工艺信号，建议同步特殊工艺链路。',
      },
    }
  }

  return {
    printing,
    dyeing,
    specialProcess: {
      decision: 'UNKNOWN',
      note: '当前未识别明确的特殊工艺信号，若补料涉及后续工艺请人工确认。',
    },
  }
}
