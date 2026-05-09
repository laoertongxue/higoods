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
  SpreadingPlanUnit,
} from './marker-spreading-model.ts'
import {
  buildMarkerSpreadingViewModel,
  buildSpreadingPlanUnitDisplayLabel,
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
  contextType: 'original-order' | 'merge-batch'
  contextSummary: string
  originalCutOrderIds: string[]
  originalCutOrderNos: string[]
  mergeBatchId: string
  mergeBatchNo: string
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
  imageStatusLabel: string
  markerRecord: MarkerRecord
  spreadingContext: MarkerSpreadingContext
}

export interface MarkerSpreadingProjection {
  snapshot: CuttingDomainSnapshot
  rows: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows']
  rowsById: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows'][number]>
  rowsByProductionOrderNo: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['materialPrepRows'][]>
  mergeBatches: ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['mergeBatches']
  mergeBatchesById: Record<string, ReturnType<typeof buildExecutionPrepProjectionContext>['sources']['mergeBatches'][number]>
  store: MarkerSpreadingStore
  viewModel: ReturnType<typeof buildMarkerSpreadingViewModel>
  createSources: SpreadingCreateSourceRow[]
}

export function buildSpreadingPlanUnitProjectionLabel(
  planUnit: Pick<SpreadingPlanUnit, 'color' | 'materialSku' | 'garmentQtyPerUnit'>,
): string {
  return buildSpreadingPlanUnitDisplayLabel(planUnit)
}

function buildQtyFormula(total: number, plannedLayers: number, totalPieces: number): string {
  return `${Math.max(Math.round(total), 0)} = ${Math.max(Math.round(plannedLayers), 0)} × ${Math.max(Math.round(totalPieces), 0)}`
}

function buildSizeDistributionFromBed(bed: MarkerSchemeBed): MarkerRecord['sizeDistribution'] {
  if (!bed.coverageRows.length) {
    return [{ sizeLabel: bed.sizeSummaryText || '待补', quantity: Math.max(Number(bed.markerPieceQtyPerLayer || 0), 0) }]
  }
  return bed.coverageRows.map((row) => ({
    sizeLabel: row.sizeName || row.sizeCode,
    quantity: Math.max(Number(row.plannedQty || row.demandQty || 0), 0),
  }))
}

function buildMarkerRecordFromPlanBed(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate,
  bed: MarkerSchemeBed,
): MarkerRecord {
  const bedColor = bed.colorName || bed.colorCode || plan.colorSummary
  const bedTotalPieces = Math.max(Number(bed.markerPieceQtyPerLayer || bed.plannedGarmentQty || 0), 0)
  const bedSpreadLength = Math.max(Number(bed.spreadTotalLength || 0), 0)
  const sourceOrder = context.sourceOriginalRows[0] || null
  const allocationLines: MarkerAllocationLine[] = bed.coverageRows.map((row, index) => ({
    allocationId: `${bed.bedId}-allocation-${index + 1}`,
    markerId: bed.bedId,
    sourceCutOrderId: row.rowId.split('-coverage-')[0] || context.originalCutOrderIds[0] || '',
    sourceCutOrderNo: sourceOrder?.originalCutOrderNo || context.originalCutOrderNos[0] || '',
    sourceProductionOrderId: sourceOrder?.productionOrderId || context.productionOrderIds[0] || '',
    sourceProductionOrderNo: sourceOrder?.productionOrderNo || context.productionOrderNos[0] || '',
    styleCode: plan.styleCode,
    spuCode: plan.spuCode,
    techPackSpuCode: plan.techPackSpu,
    color: row.colorName || row.colorCode,
    materialSku: bed.materialSku || plan.materialSkuSummary,
    sizeLabel: row.sizeName || row.sizeCode,
    plannedGarmentQty: Math.max(Number(row.plannedQty || row.demandQty || 0), 0),
    note: '来自唛架床次覆盖尺码',
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
            spreadRepeatCount: Math.max(Number(bed.repeatCount || 0), 0),
            markerLength: Math.max(Number(bed.markerLength || 0), 0),
            markerPieceCount: bedTotalPieces,
            pieceCount: bedTotalPieces,
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
                bed.coverageRows.map((row) => [
                  row.sizeCode === 'onesizeplus' ? 'plusonesize' : row.sizeCode,
                  Math.max(Number(row.plannedQty || row.demandQty || 0), 0),
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
          patternValues: { [bed.bedNo]: Math.max(Number(bed.repeatCount || 0), 0) },
          total: Math.max(Number(bed.repeatCount || 0), 0),
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
    contextType: context.contextType === 'merge-batch' ? 'merge-batch' : 'original-order',
    originalCutOrderIds: [...plan.originalCutOrderIds],
    originalCutOrderNos: [...plan.originalCutOrderNos],
    mergeBatchId: plan.mergeBatchId,
    mergeBatchNo: plan.mergeBatchNo,
    styleCode: plan.styleCode,
    spuCode: plan.spuCode,
    techPackSpuCode: plan.techPackSpu,
    materialSkuSummary: bed.materialSku || plan.materialSkuSummary,
    markerMode: bed.bedMode,
    colorSummary: bedColor,
    sizeDistribution: buildSizeDistributionFromBed(bed),
    totalPieces: bedTotalPieces,
    netLength: Math.max(Number(bed.markerLength || 0), 0),
    singlePieceUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
    spreadTotalLength: bedSpreadLength,
    sizeRatioPlanText: bed.sizeSummaryText,
    plannedLayerCount: Math.max(Number(bed.plannedLayerCount || 0), 0),
    plannedMarkerCount: Math.max(Number(bed.repeatCount || 0), 0),
    markerLength: Math.max(Number(bed.markerLength || 0), 0),
    procurementUnitUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
    actualUnitUsage: Math.max(Number(bed.unitFabricUsage || 0), 0),
    plannedMaterialMeter: bedSpreadLength,
    actualMaterialMeter: bedSpreadLength,
    actualCutQty: Math.max(Number(bed.plannedLayerCount || 0), 0) * bedTotalPieces,
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

function buildSpreadingContextFromPlanContext(context: MarkerPlanContextCandidate): MarkerSpreadingContext {
  return {
    contextType: context.contextType === 'merge-batch' ? 'merge-batch' : 'original-order',
    originalCutOrderIds: [...context.originalCutOrderIds],
    originalCutOrderNos: [...context.originalCutOrderNos],
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    productionOrderNos: [...context.productionOrderNos],
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    techPackSpuCode: context.techPackSpu,
    styleName: context.styleName,
    materialSkuSummary: context.materialSkuSummary,
    materialPrepRows: context.sourceMaterialPrepRows,
  }
}

function buildCreateSourceRowsFromPlan(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate | null,
): SpreadingCreateSourceRow[] {
  if (!context) return []
  const scheme = buildMarkerSchemeFromPlan(plan)
  const spreadingContext = buildSpreadingContextFromPlanContext(context)
  const contextSummary =
    spreadingContext.contextType === 'merge-batch'
      ? `合并裁剪批次 ${context.mergeBatchNo || '待补'} / 原始裁片单 ${context.originalCutOrderNos.length} 张 / 生产单 ${context.productionOrderNos.join(' / ') || '待补'}`
      : `原始裁片单 ${context.originalCutOrderNos.join(' / ') || '待补'} / 生产单 ${context.productionOrderNos.join(' / ') || '待补'}`

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
        originalCutOrderIds: [...plan.originalCutOrderIds],
        originalCutOrderNos: [...plan.originalCutOrderNos],
        mergeBatchId: plan.mergeBatchId,
        mergeBatchNo: plan.mergeBatchNo,
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
        imageStatusLabel: plan.imageStatusMeta.label,
        markerRecord,
        spreadingContext,
      }
    })
}

function buildSpreadingCreateSourceRows(): SpreadingCreateSourceRow[] {
  const projection = buildMarkerPlanProjection()
  return projection.viewModel.plans
    .filter((plan) => plan.readyForSpreading && plan.status !== 'CANCELED')
    .flatMap((plan) => buildCreateSourceRowsFromPlan(plan, findMarkerPlanContextForPlan(projection.viewModel.contexts, plan)))
}

export function buildMarkerSpreadingProjection(options: {
  snapshot?: CuttingDomainSnapshot
  prefilter?: MarkerSpreadingPrefilter | null
  store?: MarkerSpreadingStore
} = {}): MarkerSpreadingProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const store =
    options.store ??
    (context.snapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore)
  const viewModel = buildMarkerSpreadingViewModel({
    rows: context.sources.materialPrepRows,
    mergeBatches: context.sources.mergeBatches,
    store,
    prefilter: options.prefilter ?? null,
  })

  return {
    snapshot: context.snapshot,
    rows: context.sources.materialPrepRows,
    rowsById: Object.fromEntries(
      context.sources.materialPrepRows.map((row) => [row.originalCutOrderId, row]),
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
    mergeBatches: context.sources.mergeBatches,
    mergeBatchesById: Object.fromEntries(context.sources.mergeBatches.map((batch) => [batch.mergeBatchId, batch])),
    store,
    viewModel,
    createSources: buildSpreadingCreateSourceRows(),
  }
}
