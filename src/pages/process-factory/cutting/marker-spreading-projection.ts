import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import type {
  HighLowCuttingRow,
  HighLowPatternRow,
  MarkerAllocationLine,
  MarkerLineItem,
  MarkerRecord,
  MarkerSpreadingPrefilter,
  MarkerSpreadingContext,
  MarkerModeKey,
  MarkerSpreadingStore,
  SpreadingOrder,
  SpreadingSession,
  SpreadingPlanUnit,
} from './marker-spreading-model.ts'
import {
  buildSpreadingSessionIdentityForMarkerBed,
  buildMarkerSpreadingViewModel,
  buildSpreadingPlanUnitDisplayLabel,
  createSpreadingDraftFromMarker,
  resolveSpreadingOrderStatusFromSession,
} from './marker-spreading-model.ts'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts'
import {
  buildMarkerPlanProjection,
} from './marker-plan-projection.ts'
import { buildMarkerSchemeFromPlan } from './marker-scheme-adapter.ts'
import {
  findMarkerPlanContextForPlan,
  type MarkerPlanContextCandidate,
  type MarkerPlanViewRow,
} from './marker-plan-model.ts'
import { markerPlanModeMeta, type MarkerSchemeBed } from './marker-plan-domain.ts'

export interface SpreadingCreateSourceRow {
  markerId: string
  markerNo: string
  sourceSchemeId: string
  sourceSchemeNo: string
  sourceBedId: string
  sourceBedNo: string
  sourceBedMode: MarkerModeKey
  bedSizeSummaryText: string
  contextType: 'cut-order' | 'marker-plan-ref'
  contextSummary: string
  cutOrderIds: string[]
  cutOrderNos: string[]
  markerPlanId: string
  markerPlanNo: string
  productionOrderNos: string[]
  styleCode: string
  spuCode: string
  styleName: string
  materialSkuSummary: string
  colorSummary: string
  markerMode: MarkerModeKey
  markerModeLabel: string
  plannedCutGarmentQty: number
  plannedCutGarmentQtyFormula: string
  plannedSpreadLengthM: number
  plannedSpreadLengthFormula: string
  markerRecord: MarkerRecord
  spreadingContext: MarkerSpreadingContext
}

export interface MarkerSpreadingProjection {
  snapshot: CuttingDomainSnapshot
  rows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']
  rowsById: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows'][number]>
  rowsByProductionOrderNo: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows'][]>
  markerPlanRefs: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['markerPlanRefs']
  markerPlanRefsById: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['markerPlanRefs'][number]>
  store: MarkerSpreadingStore
  viewModel: ReturnType<typeof buildMarkerSpreadingViewModel>
  createSources: SpreadingCreateSourceRow[]
  spreadingOrders: SpreadingOrder[]
  spreadingOrdersByMarkerPlanId: Record<string, SpreadingOrder[]>
  spreadingOrdersByProductionOrderId: Record<string, SpreadingOrder[]>
}

export function buildSpreadingPlanUnitProjectionLabel(
  planUnit: Pick<SpreadingPlanUnit, 'color' | 'materialSku' | 'garmentQtyPerUnit'>,
): string {
  return buildSpreadingPlanUnitDisplayLabel(planUnit)
}

function buildQtyFormula(total: number, plannedLayers: number, totalPieces: number): string {
  return `${Math.max(Math.round(total), 0)} 件 = ${Math.max(Math.round(plannedLayers), 0)} 层 × ${Math.max(Math.round(totalPieces), 0)} 件/层`
}

function distributeBedPlannedQtyByCoverage(bed: MarkerSchemeBed): number[] {
  const total = Math.max(Number(bed.plannedGarmentQty || 0), 0)
  if (!bed.coverageRows.length) return total > 0 ? [total] : []

  const weights = bed.coverageRows.map((row) => Math.max(Number(row.plannedQty || row.demandQty || 0), 0))
  const weightSum = weights.reduce((sum, value) => sum + value, 0)
  const effectiveWeights = weightSum > 0 ? weights : bed.coverageRows.map(() => 1)
  const effectiveSum = effectiveWeights.reduce((sum, value) => sum + value, 0)
  const raw = effectiveWeights.map((weight) => (total * weight) / Math.max(effectiveSum, 1))
  const base = raw.map((value) => Math.floor(value))
  let remainder = Math.round(total) - base.reduce((sum, value) => sum + value, 0)
  const order = raw
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder)

  for (let index = 0; index < order.length && remainder > 0; index += 1, remainder -= 1) {
    base[order[index].index] += 1
  }

  return base
}

function buildSizeDistributionFromBed(bed: MarkerSchemeBed, distributedQty: number[]): MarkerRecord['sizeDistribution'] {
  if (!bed.coverageRows.length) {
    return [{ sizeLabel: bed.sizeSummaryText || '待补', quantity: distributedQty[0] || Math.max(Number(bed.plannedGarmentQty || 0), 0) }]
  }
  return bed.coverageRows.map((row, index) => ({
    sizeLabel: row.sizeName || row.sizeCode,
    quantity: Math.max(Number(distributedQty[index] || 0), 0),
  }))
}

function buildMarkerRecordFromPlanBed(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate,
  bed: MarkerSchemeBed,
): MarkerRecord {
  const bedColor = bed.colorName || bed.colorCode || plan.colorSummary
  const bedTotalPieces = Math.max(Number(bed.plannedGarmentQty || 0), 0)
  const bedPieceQtyPerLayer = Math.max(Number(bed.markerPieceQtyPerLayer || 0), 0)
  const distributedQty = distributeBedPlannedQtyByCoverage(bed)
  const bedSpreadLength = Math.max(Number(bed.spreadTotalLength || 0), 0)
  const sourceOrder = context.sourceCutOrderRows[0] || null
  const allocationLines: MarkerAllocationLine[] = bed.coverageRows.map((row, index) => ({
    allocationId: `${bed.bedId}-allocation-${index + 1}`,
    markerId: bed.bedId,
    sourceCutOrderId: row.rowId.split('-coverage-')[0] || context.cutOrderIds[0] || '',
    sourceCutOrderNo: sourceOrder?.cutOrderNo || context.cutOrderNos[0] || '',
    sourceProductionOrderId: sourceOrder?.productionOrderId || context.productionOrderIds[0] || '',
    sourceProductionOrderNo: sourceOrder?.productionOrderNo || context.productionOrderNos[0] || '',
    styleCode: plan.styleCode,
    spuCode: plan.spuCode,
    techPackSpuCode: plan.techPackSpu,
    color: row.colorName || row.colorCode,
    materialSku: bed.materialSku || plan.materialSkuSummary,
    sizeLabel: row.sizeName || row.sizeCode,
    plannedGarmentQty: Math.max(Number(distributedQty[index] || 0), 0),
    note: '来自唛架编号覆盖尺码',
  }))
  const normalLineItems: MarkerLineItem[] =
    bed.bedMode === 'normal' || bed.bedMode === 'fold_normal'
      ? [
          {
            lineItemId: `${bed.bedId}-line-1`,
            markerId: bed.bedId,
            lineNo: 1,
            layoutCode: bed.bedNo,
            layoutDetailText: bed.sizeSummaryText,
            color: bedColor,
            ratioLabel: bed.sizeSummaryText,
            spreadRepeatCount: Math.max(Number(bed.plannedLayerCount || 0), 0),
            markerLength: Math.max(Number(bed.markerLength || 0), 0),
            markerPieceCount: bedPieceQtyPerLayer,
            pieceCount: bedPieceQtyPerLayer,
            singlePieceUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
            spreadTotalLength: bedSpreadLength,
            spreadingTotalLength: bedSpreadLength,
            widthHint: plan.foldConfig?.maxLayoutWidth ? `${plan.foldConfig.maxLayoutWidth}cm` : '',
            note: bed.remark,
          },
        ]
      : []
  const highLowCuttingRows: HighLowCuttingRow[] =
    bed.bedMode === 'high_low' || bed.bedMode === 'fold_high_low'
      ? [
          {
            rowId: `${bed.bedId}-high-low-1`,
            markerId: bed.bedId,
            color: bedColor,
            sizeValues: {
              S: 0,
              M: 0,
              L: 0,
              XL: 0,
              '2XL': 0,
              '3XL': 0,
              '4XL': 0,
              onesize: 0,
              plusonesize: 0,
              ...Object.fromEntries(
                bed.coverageRows.map((row, index) => [
                  row.sizeCode === 'onesizeplus' ? 'plusonesize' : row.sizeCode,
                  Math.max(Number(distributedQty[index] || 0), 0),
                ]),
              ),
            },
            total: bedTotalPieces,
          },
        ]
      : []
  const highLowPatternKeys = bed.bedMode === 'high_low' || bed.bedMode === 'fold_high_low' ? [bed.bedNo] : []
  const highLowPatternRows: HighLowPatternRow[] = highLowPatternKeys.length
    ? [
        {
          rowId: `${bed.bedId}-pattern-1`,
          markerId: bed.bedId,
          color: bedColor,
          patternValues: { [bed.bedNo]: bedTotalPieces },
          total: bedTotalPieces,
        },
      ]
    : []

  return {
    markerId: bed.bedId,
    markerNo: `${plan.markerNo}/${bed.bedNo}`,
    schemeId: plan.id,
    schemeNo: plan.markerNo,
    bedId: bed.bedId,
    bedNo: bed.bedNo,
    bedMode: bed.bedMode,
    contextType: context.contextType === 'marker-plan-ref' ? 'marker-plan-ref' : 'cut-order',
    cutOrderIds: [...plan.cutOrderIds],
    cutOrderNos: [...plan.cutOrderNos],
    markerPlanId: plan.id,
    markerPlanNo: plan.markerNo,
    styleCode: plan.styleCode,
    spuCode: plan.spuCode,
    techPackSpuCode: plan.techPackSpu,
    materialSkuSummary: bed.materialSku || plan.materialSkuSummary,
    markerMode: bed.bedMode,
    colorSummary: bedColor,
    sizeDistribution: buildSizeDistributionFromBed(bed, distributedQty),
    totalPieces: bedTotalPieces,
    netLength: Math.max(Number(bed.markerLength || 0), 0),
    singlePieceUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
    spreadTotalLength: bedSpreadLength,
    sizeRatioPlanText: bed.sizeSummaryText,
    plannedLayerCount: Math.max(Number(bed.plannedLayerCount || 0), 0),
    plannedMarkerCount: Math.max(Number(bed.plannedLayerCount || 0), 0),
    markerLength: Math.max(Number(bed.markerLength || 0), 0),
    procurementUnitUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
    actualUnitUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
    plannedMaterialMeter: bedSpreadLength,
    actualMaterialMeter: bedSpreadLength,
    actualCutQty: bedTotalPieces,
    materialCategory: context.sourceMaterialPrepRows[0]?.materialCategory || '',
    materialAttr: context.sourceMaterialPrepRows[0]?.materialLabel || '',
    allocationLines,
    lineItems: normalLineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    warningMessages: [],
    markerImageUrl: plan.schemeImage?.previewUrl || '',
    markerImageName: plan.schemeImage?.imageName || '',
    adjustmentRequired: plan.hasAdjustment,
    adjustmentNote: plan.adjustmentNote,
    replacementDraftFlag: false,
    adjustmentSummary: plan.hasAdjustment ? plan.adjustmentNote : '',
    note: bed.remark,
    updatedAt: plan.updatedAt,
    updatedBy: plan.updatedBy,
  }
}

function buildSpreadingContextFromPlanContext(
  context: MarkerPlanContextCandidate,
  plan?: Pick<MarkerPlanViewRow, 'id' | 'markerNo'>,
): MarkerSpreadingContext {
  return {
    contextType: context.contextType === 'marker-plan-ref' ? 'marker-plan-ref' : 'cut-order',
    cutOrderIds: [...context.cutOrderIds],
    cutOrderNos: [...context.cutOrderNos],
    markerPlanId: plan?.id || context.markerPlanId,
    markerPlanNo: plan?.markerNo || context.markerPlanNo,
    productionOrderNos: [...context.productionOrderNos],
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    techPackSpuCode: context.techPackSpu,
    styleName: context.styleName,
    materialSkuSummary: context.materialSkuSummary,
    materialAliasSummary: context.materialAliasSummary,
    materialImageUrl: context.materialImageUrl,
    materialPrepRows: context.sourceMaterialPrepRows,
  }
}

function buildCreateSourceRowsFromPlan(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate | null,
): SpreadingCreateSourceRow[] {
  if (!context) return []
  const scheme = buildMarkerSchemeFromPlan(plan)
  const spreadingContext = buildSpreadingContextFromPlanContext(context, plan)
  const contextSummary =
    spreadingContext.contextType === 'marker-plan-ref'
      ? `唛架方案 ${context.markerPlanNo || '待补'} / 裁片单 ${context.cutOrderNos.length} 张 / 生产单 ${context.productionOrderNos.join(' / ') || '待补'}`
      : `裁片单 ${context.cutOrderNos.join(' / ') || '待补'} / 生产单 ${context.productionOrderNos.join(' / ') || '待补'}`

  return scheme.beds
    .filter((bed) => bed.readyForSpreading && !bed.lockedBySpreading)
    .map((bed) => {
      const markerRecord = buildMarkerRecordFromPlanBed(plan, context, bed)
      const plannedCutGarmentQty = Math.max(Number(bed.plannedLayerCount || 0) * Number(bed.markerPieceQtyPerLayer || 0), 0)
      return {
        markerId: bed.bedId,
        markerNo: `${plan.markerNo}/${bed.bedNo}`,
        sourceSchemeId: plan.id,
        sourceSchemeNo: plan.markerNo,
        sourceBedId: bed.bedId,
        sourceBedNo: bed.bedNo,
        sourceBedMode: bed.bedMode,
        bedSizeSummaryText: bed.sizeSummaryText,
        contextType: spreadingContext.contextType,
        contextSummary,
        cutOrderIds: [...plan.cutOrderIds],
        cutOrderNos: [...plan.cutOrderNos],
        markerPlanId: plan.id,
        markerPlanNo: plan.markerNo,
        productionOrderNos: [...plan.productionOrderNos],
        styleCode: plan.styleCode,
        spuCode: plan.spuCode,
        styleName: plan.styleName,
        materialSkuSummary: bed.materialSku || plan.materialSkuSummary,
        colorSummary: bed.colorName || bed.colorCode || plan.colorSummary,
        markerMode: bed.bedMode,
        markerModeLabel: markerPlanModeMeta[bed.bedMode]?.label || plan.modeMeta.label,
        plannedCutGarmentQty,
        plannedCutGarmentQtyFormula: buildQtyFormula(plannedCutGarmentQty, bed.plannedLayerCount, bed.markerPieceQtyPerLayer),
        plannedSpreadLengthM: bed.spreadTotalLength,
        plannedSpreadLengthFormula: `${Number(bed.spreadTotalLength || 0).toFixed(2)} 米 = ${bed.bedNo} 铺布总长度`,
        markerRecord,
        spreadingContext,
      }
    })
}

function buildSpreadingCreateSourceRows(
  planProjection: ReturnType<typeof buildMarkerPlanProjection>,
): SpreadingCreateSourceRow[] {
  return planProjection.viewModel.plans
    .filter((plan) => plan.readyForSpreading && plan.status !== 'CANCELED')
    .flatMap((plan) => buildCreateSourceRowsFromPlan(plan, findMarkerPlanContextForPlan(planProjection.viewModel.contexts, plan)))
}

function findExistingSpreadingSession(
  store: MarkerSpreadingStore,
  identity: { spreadingSessionId: string; sessionNo: string },
  plan: MarkerPlanViewRow,
  bed: MarkerSchemeBed,
): SpreadingSession | null {
  return (
    store.sessions.find((session) => session.spreadingSessionId === identity.spreadingSessionId) ||
    store.sessions.find((session) => session.sessionNo === identity.sessionNo) ||
    store.sessions.find(
      (session) =>
        (session.sourceSchemeId === plan.id || session.markerPlanId === plan.id) &&
        (session.sourceBedId === bed.bedId || session.sourceBedNo === bed.bedNo),
    ) ||
    null
  )
}

function parseEffectiveWidthText(value: string): { value: number; unit: string; text: string } {
  const text = String(value || '').trim()
  const match = text.match(/(\d+(?:\.\d+)?)\s*([A-Za-z\u4e00-\u9fa5]+)?/)
  return {
    value: match ? Number(match[1]) : 0,
    unit: match?.[2] || (text ? '' : 'cm'),
    text,
  }
}

function buildSpreadingOrderFromPlanBed(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate,
  bed: MarkerSchemeBed,
  session: SpreadingSession,
  index: number,
): SpreadingOrder {
  const sourceOrder = context.sourceCutOrderRows[0] || null
  const effectiveWidth = parseEffectiveWidthText(sourceOrder?.effectiveWidthText || '')
  const plannedLayerCount = Math.max(Number(bed.plannedLayerCount || 0), 0)
  const plannedGarmentQty = Math.max(Number(bed.plannedGarmentQty || 0), 0)
  const plannedPieceQty = Math.max(Number(bed.markerPieceQtyPerLayer || 0) * plannedLayerCount, plannedGarmentQty)
  const markerImageUrl =
    plan.schemeImage?.previewUrl ||
    plan.detailImage?.previewUrl ||
    (plan.imageRecords || []).find((image) => image.previewUrl)?.previewUrl ||
    ''

  return {
    spreadingOrderId: session.spreadingSessionId,
    spreadingOrderNo: session.sessionNo,
    markerPlanId: plan.id,
    markerPlanNo: plan.markerNo,
    markerNumberId: bed.bedId || `${plan.id}-bed-${index + 1}`,
    markerNumber: bed.bedNo || String(index + 1),
    bedNo: bed.bedNo || String(index + 1),
    sourceCutOrderIds: [...plan.cutOrderIds],
    sourceCutOrderNos: [...plan.cutOrderNos],
    productionOrderIds: [...plan.productionOrderIds],
    productionOrderNos: [...plan.productionOrderNos],
    spuId: plan.spuCode,
    spuCode: plan.spuCode,
    styleId: plan.styleCode,
    styleName: plan.styleName,
    materialIdentity: {
      materialSku: bed.materialSku || plan.materialSkuSummary || sourceOrder?.materialSku || '',
      materialName: sourceOrder?.materialName || context.sourceMaterialPrepRows[0]?.materialLabel || '',
      materialColor: bed.colorName || bed.colorCode || plan.colorSummary || sourceOrder?.materialColor || sourceOrder?.color || '',
      materialAlias: sourceOrder?.materialAlias || context.materialAliasSummary || '',
      materialImageUrl: sourceOrder?.materialImageUrl || context.materialImageUrl || plan.materialImageUrl || '',
      materialUnit: sourceOrder?.materialUnit || 'yard',
    },
    patternIdentity: {
      patternFileId: sourceOrder?.patternFileId || '',
      patternFileName: sourceOrder?.patternFileName || '',
      patternVersion: sourceOrder?.patternVersion || '',
      patternKind: sourceOrder?.patternKind || '',
      effectiveWidthValue: effectiveWidth.value,
      effectiveWidthUnit: effectiveWidth.unit,
      effectiveWidthText: effectiveWidth.text,
      piecePartCodes: [],
      piecePartNames: [...(sourceOrder?.piecePartNames || [])],
    },
    effectiveWidth: effectiveWidth.text,
    plannedLayerCount,
    plannedGarmentQty,
    plannedPieceQty,
    plannedMaterialUsage: Math.max(Number(bed.spreadTotalLength || 0), 0),
    plannedMaterialUsageUnit: '米',
    sizeRatio: bed.sizeSummaryText || '',
    markerMode: bed.bedMode,
    markerModeLabel: markerPlanModeMeta[bed.bedMode]?.label || plan.modeMeta.label,
    markerImageUrl,
    status: resolveSpreadingOrderStatusFromSession(session),
    createdAt: plan.confirmedAt || plan.updatedAt || plan.createdAt,
    createdBy: plan.confirmedBy || plan.updatedBy || plan.createdBy,
    confirmedAt: plan.confirmedAt,
    linkedPdaTaskId: session.sourceWritebackId || '',
  }
}

function buildConfirmedPlanSpreadingArtifacts(
  planProjection: ReturnType<typeof buildMarkerPlanProjection>,
  baseStore: MarkerSpreadingStore,
): { store: MarkerSpreadingStore; spreadingOrders: SpreadingOrder[] } {
  const generatedSessions = new Map<string, SpreadingSession>()
  const replacedSessionIds = new Set<string>()
  const spreadingOrders = new Map<string, SpreadingOrder>()

  planProjection.viewModel.plans
    .filter((plan) => plan.confirmationStatus === '已确认' && plan.status !== 'CANCELED')
    .forEach((plan) => {
      const context = findMarkerPlanContextForPlan(planProjection.viewModel.contexts, plan)
      if (!context) return
      const spreadingContext = buildSpreadingContextFromPlanContext(context, plan)
      const scheme = buildMarkerSchemeFromPlan(plan)
      scheme.beds
        .filter((bed) => bed.readyForSpreading)
        .forEach((bed, index) => {
          const identity = buildSpreadingSessionIdentityForMarkerBed({
            markerPlanId: plan.id,
            markerPlanNo: plan.markerNo,
            markerId: bed.bedId,
            markerNo: bed.bedNo,
            sourceSchemeId: plan.id,
            sourceSchemeNo: plan.markerNo,
            sourceBedId: bed.bedId,
            sourceBedNo: bed.bedNo,
          }, index)
          const existingSession = findExistingSpreadingSession(baseStore, identity, plan, bed)
          if (existingSession) replacedSessionIds.add(existingSession.spreadingSessionId)
          const markerRecord = buildMarkerRecordFromPlanBed(plan, context, bed)
          const timestamp = new Date((plan.confirmedAt || plan.updatedAt || plan.createdAt || '').replace(' ', 'T'))
          const safeTimestamp = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
          const session = createSpreadingDraftFromMarker(markerRecord, spreadingContext, safeTimestamp, {
            baseSession: {
              ...existingSession,
              spreadingSessionId: identity.spreadingSessionId,
              sessionNo: identity.sessionNo,
              status: existingSession?.status || 'DRAFT',
              createdAt: existingSession?.createdAt || plan.confirmedAt || plan.updatedAt || plan.createdAt,
              updatedAt: existingSession?.updatedAt || plan.confirmedAt || plan.updatedAt || plan.createdAt,
              sourceChannel: existingSession?.sourceChannel || 'MANUAL',
            },
            importNote: '由已确认唛架方案按唛架编号生成铺布单。',
          })
          generatedSessions.set(session.spreadingSessionId, session)
          const order = buildSpreadingOrderFromPlanBed(plan, context, bed, session, index)
          spreadingOrders.set(`${order.markerPlanId}::${order.markerNumberId}::${order.bedNo}`, order)
        })
    })

  const generatedSessionIds = new Set(generatedSessions.keys())
  return {
    store: {
      markers: [...baseStore.markers],
      sessions: [
        ...baseStore.sessions.filter((session) => !generatedSessionIds.has(session.spreadingSessionId) && !replacedSessionIds.has(session.spreadingSessionId)),
        ...generatedSessions.values(),
      ],
    },
    spreadingOrders: Array.from(spreadingOrders.values()).sort((left, right) =>
      `${right.confirmedAt || right.createdAt}::${right.spreadingOrderNo}`.localeCompare(
        `${left.confirmedAt || left.createdAt}::${left.spreadingOrderNo}`,
        'zh-CN',
      ),
    ),
  }
}

function groupSpreadingOrdersByMarkerPlanId(spreadingOrders: SpreadingOrder[]): Record<string, SpreadingOrder[]> {
  return spreadingOrders.reduce<Record<string, SpreadingOrder[]>>((accumulator, order) => {
    accumulator[order.markerPlanId] = accumulator[order.markerPlanId] || []
    accumulator[order.markerPlanId].push(order)
    return accumulator
  }, {})
}

function groupSpreadingOrdersByProductionOrderId(spreadingOrders: SpreadingOrder[]): Record<string, SpreadingOrder[]> {
  return spreadingOrders.reduce<Record<string, SpreadingOrder[]>>((accumulator, order) => {
    order.productionOrderIds.forEach((productionOrderId) => {
      if (!productionOrderId) return
      accumulator[productionOrderId] = accumulator[productionOrderId] || []
      accumulator[productionOrderId].push(order)
    })
    return accumulator
  }, {})
}

export function buildMarkerSpreadingProjection(options: {
  snapshot?: CuttingDomainSnapshot
  prefilter?: MarkerSpreadingPrefilter | null
  store?: MarkerSpreadingStore
} = {}): MarkerSpreadingProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const markerPlanProjection = buildMarkerPlanProjection()
  const baseStore =
    options.store ??
    (context.snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore)
  const spreadingArtifacts = buildConfirmedPlanSpreadingArtifacts(markerPlanProjection, baseStore)
  const store = spreadingArtifacts.store
  const viewModel = buildMarkerSpreadingViewModel({
    rows: context.sources.materialPrepRows,
    markerPlanRefs: context.sources.markerPlanRefs,
    store,
    prefilter: options.prefilter ?? null,
  })

  return {
    snapshot: context.snapshot,
    rows: context.sources.materialPrepRows,
    rowsById: Object.fromEntries(
      context.sources.materialPrepRows.map((row) => [row.cutOrderId, row]),
    ),
    rowsByProductionOrderNo: context.sources.materialPrepRows.reduce<
      Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']>
    >((accumulator, row) => {
      const key = row.productionOrderNo || ''
      if (!key) return accumulator
      accumulator[key] = accumulator[key] || []
      accumulator[key].push(row)
      return accumulator
    }, {}),
    markerPlanRefs: context.sources.markerPlanRefs,
    markerPlanRefsById: Object.fromEntries(context.sources.markerPlanRefs.map((batch) => [batch.markerPlanId, batch])),
    store,
    viewModel,
    createSources: buildSpreadingCreateSourceRows(markerPlanProjection),
    spreadingOrders: spreadingArtifacts.spreadingOrders,
    spreadingOrdersByMarkerPlanId: groupSpreadingOrdersByMarkerPlanId(spreadingArtifacts.spreadingOrders),
    spreadingOrdersByProductionOrderId: groupSpreadingOrdersByProductionOrderId(spreadingArtifacts.spreadingOrders),
  }
}
