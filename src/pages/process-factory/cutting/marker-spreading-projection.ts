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
import {
  findMarkerPlanContextForPlan,
  type MarkerPlanContextCandidate,
  type MarkerPlanViewRow,
} from './marker-plan-model.ts'

export interface SpreadingCreateSourceRow {
  markerId: string
  markerNo: string
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

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)))
}

function buildQtyFormula(total: number, plannedLayers: number, totalPieces: number): string {
  return `${Math.max(Math.round(total), 0)} = ${Math.max(Math.round(plannedLayers), 0)} × ${Math.max(Math.round(totalPieces), 0)}`
}

function buildMarkerLineItemsFromPlan(plan: MarkerPlanViewRow): MarkerLineItem[] {
  return plan.layoutLines.map((line, index) => ({
    lineItemId: `${plan.id}-line-${index + 1}`,
    markerId: plan.id,
    lineNo: line.lineNo || index + 1,
    layoutCode: line.layoutCode,
    layoutDetailText: line.ratioNote,
    color: line.colorCode,
    ratioLabel: line.ratioNote,
    spreadRepeatCount: line.repeatCount,
    markerLength: line.markerLength,
    markerPieceCount: line.markerPieceQty,
    pieceCount: line.markerPieceQty,
    singlePieceUsage: line.systemUnitUsage,
    spreadTotalLength: line.spreadLength,
    spreadingTotalLength: line.spreadLength,
    widthHint: line.widthCode,
    note: line.note,
  }))
}

function buildHighLowCuttingRowsFromPlan(plan: MarkerPlanViewRow): HighLowCuttingRow[] {
  const grouped = new Map<string, Record<string, number>>()
  plan.highLowMatrixCells.forEach((cell) => {
    const sectionName = cell.sectionName || '默认分区'
    const bucket = grouped.get(sectionName) || {}
    bucket[cell.sizeCode] = Number(cell.qty || 0)
    grouped.set(sectionName, bucket)
  })
  return Array.from(grouped.entries()).map(([sectionName, values], index) => {
    const sizeValues = {
      S: Number(values.S || 0),
      M: Number(values.M || 0),
      L: Number(values.L || 0),
      XL: Number(values.XL || 0),
      '2XL': Number(values['2XL'] || 0),
      '3XL': Number(values['3XL'] || 0),
      '4XL': Number(values['4XL'] || 0),
      onesize: Number(values.onesize || 0),
      plusonesize: Number(values.onesizeplus || values.plusonesize || 0),
    }
    const total = Object.values(sizeValues).reduce((sum, qty) => sum + Math.max(Number(qty || 0), 0), 0)
    return {
      rowId: `${plan.id}-high-low-${index + 1}`,
      markerId: plan.id,
      color: sectionName,
      sizeValues,
      total,
    }
  })
}

function buildHighLowPatternRowsFromPlan(plan: MarkerPlanViewRow, patternKeys: string[]): HighLowPatternRow[] {
  return plan.modeDetailLines.map((line, index) => ({
    rowId: `${plan.id}-pattern-${index + 1}`,
    markerId: plan.id,
    color: line.colorCode,
    patternValues: Object.fromEntries(patternKeys.map((patternKey) => [patternKey, patternKey === line.modeName ? Number(line.repeatCount || 0) : 0])),
    total: Number(line.repeatCount || 0),
  }))
}

function buildMarkerRecordFromPlan(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate,
): MarkerRecord {
  const patternKeys = uniqueStrings(plan.modeDetailLines.map((line) => line.modeName))
  const primaryImage = plan.imageRecords.find((record) => record.isPrimary) || plan.imageRecords[0] || null
  const allocationLines: MarkerAllocationLine[] = plan.allocationRows.map((row) => ({
    allocationId: row.id,
    markerId: plan.id,
    sourceCutOrderId: row.sourceCutOrderId,
    sourceCutOrderNo:
      context.sourceOriginalRows.find((originalRow) => originalRow.originalCutOrderId === row.sourceCutOrderId)?.originalCutOrderNo || '',
    sourceProductionOrderId: row.sourceProductionOrderId,
    sourceProductionOrderNo:
      context.sourceOriginalRows.find((originalRow) => originalRow.productionOrderId === row.sourceProductionOrderId)?.productionOrderNo || '',
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpu,
    color: row.colorCode,
    materialSku: row.materialSku,
    sizeLabel: row.sizeCode,
    plannedGarmentQty: row.garmentQty,
    note: row.note,
  }))
  const highLowPatternKeys = patternKeys.length ? patternKeys : undefined
  const highLowCuttingRows = plan.highLowMatrixCells.length ? buildHighLowCuttingRowsFromPlan(plan) : []
  const highLowPatternRows = highLowPatternKeys?.length ? buildHighLowPatternRowsFromPlan(plan, highLowPatternKeys) : []

  return {
    markerId: plan.id,
    markerNo: plan.markerNo,
    contextType: plan.contextType === 'merge-batch' ? 'merge-batch' : 'original-order',
    originalCutOrderIds: [...plan.originalCutOrderIds],
    originalCutOrderNos: [...plan.originalCutOrderNos],
    mergeBatchId: plan.mergeBatchId,
    mergeBatchNo: plan.mergeBatchNo,
    styleCode: plan.styleCode,
    spuCode: plan.spuCode,
    techPackSpuCode: plan.techPackSpu,
    materialSkuSummary: plan.materialSkuSummary,
    colorSummary: plan.colorSummary,
    markerMode: plan.markerMode,
    sizeDistribution: plan.sizeRatioRows.map((row) => ({ sizeLabel: row.sizeCode, quantity: row.qty })),
    totalPieces: plan.totalPieces,
    netLength: plan.netLength,
    singlePieceUsage: plan.systemUnitUsage,
    spreadTotalLength: plan.plannedSpreadLength,
    materialCategory: context.sourceMaterialPrepRows[0]?.materialCategory || '',
    materialAttr: context.sourceMaterialPrepRows[0]?.materialLabel || '',
    plannedSizeRatioText: plan.sizeRatioRows.filter((row) => row.qty > 0).map((row) => `${row.sizeCode}×${row.qty}`).join(' / '),
    plannedLayerCount: plan.plannedLayerCount,
    plannedMarkerCount: Math.max(plan.layoutLines.length, plan.modeDetailLines.length, 1),
    markerLength: plan.netLength,
    procurementUnitUsage: plan.systemUnitUsage,
    actualUnitUsage: plan.finalUnitUsage,
    fabricSku: plan.sourceMaterialSku,
    plannedMaterialMeter: plan.plannedSpreadLength,
    actualMaterialMeter: plan.plannedSpreadLength,
    actualCutQty: plan.totalPieces,
    allocationLines,
    lineItems: buildMarkerLineItemsFromPlan(plan),
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    warningMessages: [],
    markerImageUrl: primaryImage?.previewUrl || '',
    markerImageName: primaryImage?.fileName || '',
    adjustmentRequired: plan.hasAdjustment,
    adjustmentNote: plan.adjustmentNote,
    replacementDraftFlag: false,
    adjustmentSummary: plan.hasAdjustment ? plan.adjustmentNote : '',
    note: plan.remark,
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

function buildCreateSourceRow(
  plan: MarkerPlanViewRow,
  context: MarkerPlanContextCandidate | null,
): SpreadingCreateSourceRow | null {
  if (!context) return null
  const plannedCutGarmentQty = Math.max(Number(plan.plannedLayerCount || 0) * Number(plan.totalPieces || 0), 0)
  const spreadingContext = buildSpreadingContextFromPlanContext(context)
  const markerRecord = buildMarkerRecordFromPlan(plan, context)
  const contextSummary =
    spreadingContext.contextType === 'merge-batch'
      ? `合并裁剪批次 ${context.mergeBatchNo || '待补'} / 原始裁片单 ${context.originalCutOrderNos.length} 张 / 生产单 ${context.productionOrderNos.join(' / ') || '待补'}`
      : `原始裁片单 ${context.originalCutOrderNos.join(' / ') || '待补'} / 生产单 ${context.productionOrderNos.join(' / ') || '待补'}`

  return {
    markerId: plan.id,
    markerNo: plan.markerNo,
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
    materialSkuSummary: plan.materialSkuSummary,
    colorSummary: plan.colorSummary,
    markerMode: plan.markerMode,
    markerModeLabel: plan.modeMeta.label,
    plannedCutGarmentQty,
    plannedCutGarmentQtyFormula: buildQtyFormula(plannedCutGarmentQty, plan.plannedLayerCount, plan.totalPieces),
    plannedSpreadLengthM: plan.plannedSpreadLength,
    plannedSpreadLengthFormula: plan.plannedSpreadLengthFormula,
    imageStatusLabel: plan.imageStatusMeta.label,
    markerRecord,
    spreadingContext,
  }
}

function buildSpreadingCreateSourceRows(): SpreadingCreateSourceRow[] {
  const projection = buildMarkerPlanProjection()
  return projection.viewModel.plans
    .filter((plan) => plan.readyForSpreading && plan.status !== 'CANCELED')
    .map((plan) => buildCreateSourceRow(plan, findMarkerPlanContextForPlan(projection.viewModel.contexts, plan)))
    .filter((row): row is SpreadingCreateSourceRow => Boolean(row))
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
