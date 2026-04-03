import type { CuttingOrderProgressRecord } from '../../../data/fcs/cutting/types'
import {
  buildProductionPieceTruth,
  resolveTechPackForProduction,
  type PieceGapRow,
  type PieceTruthMappingStatus,
  type PieceTruthOverlaySignal,
  type ProductionPieceTruthResult,
  type ProductionResolvedTechPackLink,
} from '../../../domain/fcs-cutting-piece-truth/index.ts'

export type ProductionPieceMappingStatus = PieceTruthMappingStatus
export type { ProductionResolvedTechPackLink }

export interface ProductionPieceRequirementRow {
  productionOrderId: string
  productionOrderNo: string
  sourceCutOrderNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  patternName: string
  pieceCountPerUnit: number
  requiredGarmentQty: number
  requiredPieceQty: number
  mappingStatus: ProductionPieceMappingStatus
  mappingStatusLabel: string
}

export interface ProductionPieceActualRow {
  sourceCutOrderNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partName: string
  actualCutQty: number
  inboundQty: number
  latestUpdatedAt: string
  latestOperatorName: string
}

export interface ProductionPieceGapRow extends ProductionPieceRequirementRow {
  actualCutQty: number
  inboundQty: number
  gapQty: number
  inboundGapQty: number
  latestUpdatedAt: string
  latestOperatorName: string
}

export interface ProductionSkuSummaryRow {
  skuCode: string
  color: string
  size: string
  requiredGarmentQty: number
  requiredPieceQty: number
  actualCutQty: number
  inboundQty: number
  gapQty: number
  inboundGapQty: number
  sourceCutOrderCount: number
  mappingStatus: ProductionPieceMappingStatus
  mappingStatusLabel: string
  completionLabel: string
}

export interface ProductionIncompleteOriginalOrderRow {
  sourceCutOrderNo: string
  materialSkuSummary: string
  skuSummaryText: string
  gapPartCount: number
  gapPieceQty: number
  mappingWarningCount: number
}

export interface ProductionPieceProgressTotals {
  requiredGarmentQtyTotal: number
  requiredPieceQtyTotal: number
  actualCutQtyTotal: number
  inboundQtyTotal: number
  gapQtyTotal: number
  inboundGapQtyTotal: number
  incompleteSkuCount: number
  incompleteOriginalOrderCount: number
}

export interface ProductionPieceProgressViewModel {
  techPackLink: ProductionResolvedTechPackLink
  skuSummaryRows: ProductionSkuSummaryRow[]
  pieceDetailRows: ProductionPieceGapRow[]
  gapRows: ProductionPieceGapRow[]
  incompleteSkuRows: ProductionSkuSummaryRow[]
  incompleteOriginalOrderRows: ProductionIncompleteOriginalOrderRow[]
  mappingWarnings: string[]
  totals: ProductionPieceProgressTotals
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
}

function toGapRow(row: PieceGapRow): ProductionPieceGapRow {
  return {
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    sourceCutOrderNo: row.originalCutOrderNo,
    materialSku: row.materialSku,
    skuCode: row.skuCode,
    color: row.color,
    size: row.size,
    partCode: row.partCode,
    partName: row.partName,
    patternName: row.patternName,
    pieceCountPerUnit: row.pieceCountPerUnit,
    requiredGarmentQty: row.requiredGarmentQty,
    requiredPieceQty: row.requiredPieceQty,
    mappingStatus: row.mappingStatus,
    mappingStatusLabel: row.mappingStatusLabel,
    actualCutQty: row.actualCutQty,
    inboundQty: row.inboundQty,
    gapQty: row.gapCutQty,
    inboundGapQty: row.gapInboundQty,
    latestUpdatedAt: row.latestUpdatedAt,
    latestOperatorName: row.latestOperatorName,
  }
}

export function buildProductionPieceProgressViewModelFromTruth(
  truth: ProductionPieceTruthResult,
): ProductionPieceProgressViewModel {
  const pieceDetailRows = truth.gapRows.map(toGapRow)
  const skuSummaryRows: ProductionSkuSummaryRow[] = truth.skuRows.map((row) => ({
    skuCode: row.skuCode,
    color: row.color,
    size: row.size,
    requiredGarmentQty: row.requiredGarmentQty,
    requiredPieceQty: row.requiredPieceQty,
    actualCutQty: row.actualCutQty,
    inboundQty: row.inboundQty,
    gapQty: row.gapCutQty,
    inboundGapQty: row.gapInboundQty,
    sourceCutOrderCount: row.originalCutOrderCount,
    mappingStatus: row.mappingStatus,
    mappingStatusLabel: row.mappingStatusLabel,
    completionLabel: row.currentStateLabel,
  }))
  const incompleteSkuRows = skuSummaryRows.filter(
    (row) => row.mappingStatus !== 'MATCHED' || row.gapQty > 0 || row.inboundGapQty > 0,
  )
  const incompleteOriginalOrderRows = truth.originalCutOrderRows
    .filter((row) => row.gapPartCount > 0 || row.currentStateLabel !== '已齐套')
    .map((row) => ({
      sourceCutOrderNo: row.originalCutOrderNo,
      materialSkuSummary: row.materialSku,
      skuSummaryText: '',
      gapPartCount: row.gapPartCount,
      gapPieceQty: Math.max(row.gapCutQty, row.gapInboundQty),
      mappingWarningCount: truth.mappingIssues.filter((issue) => issue.originalCutOrderNo === row.originalCutOrderNo).length,
    }))

  return {
    techPackLink: truth.techPackLink,
    skuSummaryRows,
    pieceDetailRows,
    gapRows: pieceDetailRows.filter((row) => row.gapQty > 0 || row.inboundGapQty > 0 || row.mappingStatus !== 'MATCHED'),
    incompleteSkuRows,
    incompleteOriginalOrderRows,
    mappingWarnings: uniqueStrings([
      ...truth.mappingIssues.map((issue) => issue.message),
      ...truth.dataIssues.map((issue) => issue.message),
    ]),
    totals: {
      requiredGarmentQtyTotal: skuSummaryRows.reduce((sum, row) => sum + row.requiredGarmentQty, 0),
      requiredPieceQtyTotal: truth.counts.requiredPieceQtyTotal,
      actualCutQtyTotal: truth.counts.actualCutQtyTotal,
      inboundQtyTotal: truth.counts.inboundQtyTotal,
      gapQtyTotal: truth.counts.gapCutQtyTotal,
      inboundGapQtyTotal: truth.counts.gapInboundQtyTotal,
      incompleteSkuCount: truth.counts.pendingSkuCount,
      incompleteOriginalOrderCount: truth.originalCutOrderRows.filter((row) => row.gapPartCount > 0 || row.currentStateLabel !== '已齐套').length,
    },
  }
}

export function buildProductionPieceProgressViewModel(
  record: CuttingOrderProgressRecord,
  options: { overlaySignals?: PieceTruthOverlaySignal[] } = {},
): ProductionPieceProgressViewModel {
  const truth = buildProductionPieceTruth(record, { overlaySignals: options.overlaySignals })
  return buildProductionPieceProgressViewModelFromTruth(truth)
}

export { buildProductionPieceTruth, resolveTechPackForProduction }
