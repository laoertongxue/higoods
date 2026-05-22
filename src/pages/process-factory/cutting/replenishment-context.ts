import type { MarkerPlanRefRecord } from './marker-plan-ref-model.ts'
import {
  buildSpreadingVarianceSummary,
  type MarkerRecord,
  type MarkerSpreadingContext,
  type MarkerSpreadingStore,
  type SpreadingSession,
  type SpreadingVarianceSummary,
} from './marker-spreading-model.ts'
import type { MaterialPrepLineItem, MaterialPrepRow } from './material-prep-model.ts'
import type { CutOrderRow } from './cut-orders-model.ts'

export type ReplenishmentContextBaseSourceType = 'cut-order' | 'marker-plan-ref'
export type ReplenishmentContextSourceType = ReplenishmentContextBaseSourceType | 'spreading-session'
export type ReplenishmentPendingPrepDecisionKey = 'YES' | 'NO' | 'UNKNOWN'

export interface ReplenishmentContextRecord {
  contextId: string
  sourceType: ReplenishmentContextSourceType
  baseSourceType: ReplenishmentContextBaseSourceType
  markerPlanId: string
  markerPlanNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
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
    accumulator[row.cutOrderId] = row
    accumulator[row.cutOrderNo] = row
    return accumulator
  }, {})
}

function buildCutOrderRowsById(rows: CutOrderRow[]): Record<string, CutOrderRow> {
  return rows.reduce<Record<string, CutOrderRow>>((accumulator, row) => {
    accumulator[row.cutOrderId] = row
    accumulator[row.cutOrderNo] = row
    return accumulator
  }, {})
}

function getContextRowsByMarkerPlanRef(batch: MarkerPlanRefRecord, rowsById: Record<string, MaterialPrepRow>): MaterialPrepRow[] {
  return batch.items
    .map((item) => rowsById[item.cutOrderId] || rowsById[item.cutOrderNo])
    .filter((row): row is MaterialPrepRow => Boolean(row))
}

function findMarkerPlanRefForRow(row: MaterialPrepRow, markerPlanRefs: MarkerPlanRefRecord[]): MarkerPlanRefRecord | null {
  return (
    (row.markerPlanIds[0] && markerPlanRefs.find((batch) => batch.markerPlanId === row.markerPlanIds[0])) ||
    (row.latestMarkerPlanNo && markerPlanRefs.find((batch) => batch.markerPlanNo === row.latestMarkerPlanNo)) ||
    null
  )
}

function findRelevantSession(context: {
  baseSourceType: ReplenishmentContextBaseSourceType
  markerPlanId: string
  cutOrderIds: string[]
}, store: MarkerSpreadingStore): SpreadingSession | null {
  const matched = store.sessions
    .filter((session) => {
      if (context.baseSourceType === 'marker-plan-ref' && context.markerPlanId) {
        return session.contextType === 'marker-plan-ref' && session.markerPlanId === context.markerPlanId
      }
      return session.contextType === 'cut-order' && session.cutOrderIds[0] === context.cutOrderIds[0]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))

  return matched[0] || null
}

function findRelevantMarker(context: {
  baseSourceType: ReplenishmentContextBaseSourceType
  markerPlanId: string
  cutOrderIds: string[]
}, store: MarkerSpreadingStore): MarkerRecord | null {
  const matched = store.markers
    .filter((marker) => {
      if (context.baseSourceType === 'marker-plan-ref' && context.markerPlanId) {
        return marker.contextType === 'marker-plan-ref' && marker.markerPlanId === context.markerPlanId
      }
      return marker.contextType === 'cut-order' && marker.cutOrderIds[0] === context.cutOrderIds[0]
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, 'zh-CN'))

  return matched[0] || null
}

function buildMarkerContext(options: {
  baseSourceType: ReplenishmentContextBaseSourceType
  markerPlanId: string
  markerPlanNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialRows: MaterialPrepRow[]
}): MarkerSpreadingContext {
  return {
    contextType: options.baseSourceType,
    cutOrderIds: options.cutOrderIds,
    cutOrderNos: options.cutOrderNos,
    markerPlanId: options.markerPlanId,
    markerPlanNo: options.markerPlanNo,
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
  markerPlanId: string
  markerPlanNo: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialRows: MaterialPrepRow[]
  cutOrderRowsById: Record<string, CutOrderRow>
  markerStore: MarkerSpreadingStore
}): ReplenishmentContextRecord {
  const marker = findRelevantMarker(options, options.markerStore)
  const session = findRelevantSession(options, options.markerStore)
  const markerContext = buildMarkerContext(options)
  const varianceSummary = buildSpreadingVarianceSummary(markerContext, marker, session)
  const totalRequiredQty = options.cutOrderIds.reduce((sum, cutOrderId) => {
    const row = options.cutOrderRowsById[cutOrderId]
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
    markerPlanId: options.markerPlanId,
    markerPlanNo: options.markerPlanNo,
    cutOrderIds: options.cutOrderIds,
    cutOrderNos: options.cutOrderNos,
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
  cutOrderRows: CutOrderRow[]
  markerPlanRefs: MarkerPlanRefRecord[]
  markerStore: MarkerSpreadingStore
}): ReplenishmentContextRecord[] {
  const rowsById = buildRowsById(options.materialPrepRows)
  const cutOrderRowsById = buildCutOrderRowsById(options.cutOrderRows)
  const contexts: ReplenishmentContextRecord[] = []
  const consumedCutOrderIds = new Set<string>()
  const createdMarkerPlanRefIds = new Set<string>()

  for (const row of options.materialPrepRows) {
    if (consumedCutOrderIds.has(row.cutOrderId)) continue

    const markerPlanRef = findMarkerPlanRefForRow(row, options.markerPlanRefs)
    if (markerPlanRef && !createdMarkerPlanRefIds.has(markerPlanRef.markerPlanId)) {
      const batchRows = getContextRowsByMarkerPlanRef(markerPlanRef, rowsById)
      if (batchRows.length) {
        batchRows.forEach((item) => consumedCutOrderIds.add(item.cutOrderId))
        createdMarkerPlanRefIds.add(markerPlanRef.markerPlanId)
        contexts.push(
          buildContextRecord({
            contextId: `merge-${markerPlanRef.markerPlanId}`,
            baseSourceType: 'marker-plan-ref',
            markerPlanId: markerPlanRef.markerPlanId,
            markerPlanNo: markerPlanRef.markerPlanNo,
            cutOrderIds: batchRows.map((item) => item.cutOrderId),
            cutOrderNos: batchRows.map((item) => item.cutOrderNo),
            productionOrderNos: uniqueStrings(batchRows.map((item) => item.productionOrderNo)),
            styleCode: markerPlanRef.styleCode || row.styleCode,
            spuCode: markerPlanRef.spuCode || row.spuCode,
            styleName: markerPlanRef.styleName || row.styleName,
            materialRows: batchRows,
            cutOrderRowsById,
            markerStore: options.markerStore,
          }),
        )
        continue
      }
    }

    consumedCutOrderIds.add(row.cutOrderId)
    contexts.push(
      buildContextRecord({
        contextId: `cut-order-${row.cutOrderId}`,
        baseSourceType: 'cut-order',
        markerPlanId: '',
        markerPlanNo: row.latestMarkerPlanNo || '',
        cutOrderIds: [row.cutOrderId],
        cutOrderNos: [row.cutOrderNo],
        productionOrderNos: [row.productionOrderNo],
        styleCode: row.styleCode,
        spuCode: row.spuCode,
        styleName: row.styleName,
        materialRows: [row],
        cutOrderRowsById,
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
    positiveNote: '当前面料行已命中主料信号，需同步关注中转仓配料。',
    negativeNote: '当前面料行未命中主料信号，可不必追加中转仓配料。',
    unknownNote: '当前无法明确判断是否需要回中转仓配料，建议人工确认。',
  })

  return {
    pendingPrep,
  }
}
