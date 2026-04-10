import { getCompatTechPackBySpuCode as getTechPackBySpuCode, type TechPack } from '../../../data/pcs-technical-data-runtime-source.ts'
import type { MaterialPrepRow } from './material-prep-model.ts'
import type {
  MarkerPlanAllocationLike,
  MarkerPlanExplosionInput,
  MarkerPlanLike,
} from './marker-plan-domain.ts'

export type MarkerPieceMappingStatus =
  | 'MATCHED'
  | 'MISSING_TECH_PACK'
  | 'MISSING_SKU'
  | 'MISSING_COLOR_MAPPING'
  | 'MISSING_PIECE_MAPPING'
  | 'MATERIAL_PENDING_CONFIRM'

export interface MarkerResolvedTechPackLink {
  status: 'MATCHED' | 'MISSING'
  resolvedSpuCode: string
  sourceKey: 'source-tech-pack' | 'marker-tech-pack' | 'source-spu' | 'marker-spu' | 'missing'
  techPack: TechPack | null
}

export interface MarkerAllocationSourceRow {
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  styleCode: string
  spuCode: string
  techPackSpuCode: string
  color: string
  materialSku: string
  allocationSummaryText: string
  allocationTotalQty: number
}

export interface MarkerAllocationSizeSummaryRow {
  sizeLabel: string
  requiredQty: number
  allocatedQty: number
  differenceQty: number
}

export interface MarkerExplosionAllocationRow {
  allocationId: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceProductionOrderNo: string
  color: string
  sizeLabel: string
  materialSku: string
  plannedGarmentQty: number
  techPackSpuCode: string
  skuCode: string
  mappingStatus: MarkerPieceMappingStatus
  mappingStatusLabel: string
  exceptionText: string
}

export interface MarkerExplosionSkuSummaryRow {
  sourceCutOrderId: string
  sourceCutOrderNo: string
  color: string
  sizeLabel: string
  skuCode: string
  plannedGarmentQty: number
  explodedPieceTotal: number
  involvedPartCount: number
  mappingStatus: MarkerPieceMappingStatus
  mappingStatusLabel: string
}

export interface MarkerExplosionPieceDetailRow {
  sourceCutOrderId: string
  sourceCutOrderNo: string
  color: string
  sizeLabel: string
  skuCode: string
  materialSku: string
  patternName: string
  pieceName: string
  pieceCountPerUnit: number
  plannedGarmentQty: number
  explodedPieceQty: number
  mappingStatus: MarkerPieceMappingStatus
  mappingStatusLabel: string
}

export interface MarkerExplosionMissingMappingRow {
  sourceCutOrderNo: string
  color: string
  sizeLabel: string
  materialSku: string
  reason: string
  mappingStatus: MarkerPieceMappingStatus
  mappingStatusLabel: string
}

export interface MarkerPieceExplosionTotals {
  sourceOrderCount: number
  allocationLineCount: number
  skuRowCount: number
  pieceRowCount: number
  plannedGarmentQtyTotal: number
  explodedPieceQtyTotal: number
}

export interface MarkerPieceExplosionViewModel {
  sourceOrderRows: MarkerAllocationSourceRow[]
  allocationRows: MarkerExplosionAllocationRow[]
  allocationSizeSummary: MarkerAllocationSizeSummaryRow[]
  skuSummaryRows: MarkerExplosionSkuSummaryRow[]
  pieceDetailRows: MarkerExplosionPieceDetailRow[]
  mappingWarnings: string[]
  missingMappings: MarkerExplosionMissingMappingRow[]
  totals: MarkerPieceExplosionTotals
}

type MarkerPieceExplosionSourceRow = Pick<
  MaterialPrepRow,
  | 'originalCutOrderId'
  | 'originalCutOrderNo'
  | 'productionOrderId'
  | 'productionOrderNo'
  | 'styleCode'
  | 'spuCode'
  | 'techPackSpuCode'
  | 'color'
  | 'materialSkuSummary'
>

function normalizeText(value: string | undefined | null): string {
  return String(value || '').trim()
}

function equalsLoose(left: string | undefined | null, right: string | undefined | null): boolean {
  const normalizedLeft = normalizeText(left).toLowerCase()
  const normalizedRight = normalizeText(right).toLowerCase()
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)))
}

const mappingStatusLabels: Record<MarkerPieceMappingStatus, string> = {
  MATCHED: '已匹配',
  MISSING_TECH_PACK: '未关联技术资料',
  MISSING_SKU: '未匹配 SKU',
  MISSING_COLOR_MAPPING: '未匹配颜色映射',
  MISSING_PIECE_MAPPING: '未匹配裁片映射',
  MATERIAL_PENDING_CONFIRM: '面料待确认',
}

function getMappingStatusLabel(status: MarkerPieceMappingStatus): string {
  return mappingStatusLabels[status]
}

function buildAllocationSummaryText(lines: MarkerPlanAllocationLike[]): string {
  if (!lines.length) return '待补分配'
  return lines
    .filter((line) => line.plannedGarmentQty > 0)
    .map((line) => `${line.sizeLabel}×${line.plannedGarmentQty}`)
    .join(' / ') || '待补分配'
}

export function resolveMarkerTechPackLink(options: {
  marker: Pick<MarkerPlanLike, 'techPackSpuCode' | 'spuCode'>
  sourceRow?: Pick<MaterialPrepRow, 'techPackSpuCode' | 'spuCode'> | null
}): MarkerResolvedTechPackLink {
  const candidates: Array<{ value: string; sourceKey: MarkerResolvedTechPackLink['sourceKey'] }> = [
    { value: normalizeText(options.sourceRow?.techPackSpuCode), sourceKey: 'source-tech-pack' },
    { value: normalizeText(options.marker.techPackSpuCode), sourceKey: 'marker-tech-pack' },
    { value: normalizeText(options.sourceRow?.spuCode), sourceKey: 'source-spu' },
    { value: normalizeText(options.marker.spuCode), sourceKey: 'marker-spu' },
  ]

  for (const candidate of candidates) {
    if (!candidate.value) continue
    const techPack = getTechPackBySpuCode(candidate.value)
    if (techPack) {
      return {
        status: 'MATCHED',
        resolvedSpuCode: candidate.value,
        sourceKey: candidate.sourceKey,
        techPack,
      }
    }
  }

  return {
    status: 'MISSING',
    resolvedSpuCode: candidates.find((candidate) => candidate.value)?.value || '',
    sourceKey: 'missing',
    techPack: null,
  }
}

export function buildMarkerAllocationSourceRows(
  marker: Pick<MarkerPlanLike, 'originalCutOrderIds' | 'allocationLines'>,
  rowsById: Record<string, MarkerPieceExplosionSourceRow>,
): MarkerPieceExplosionSourceRow[] {
  return marker.originalCutOrderIds
    .map((id) => rowsById[id])
    .filter((row): row is MarkerPieceExplosionSourceRow => Boolean(row))
}

function resolveSkuCode(techPack: TechPack, color: string, sizeLabel: string): string {
  const skuLine =
    (techPack.skuCatalog || []).find((item) => equalsLoose(item.color, color) && equalsLoose(item.size, sizeLabel)) || null
  return skuLine?.skuCode || ''
}

function resolveColorMapping(techPack: TechPack, color: string) {
  return (
    (techPack.colorMaterialMappings || []).find(
      (mapping) => equalsLoose(mapping.colorName, color) || equalsLoose(mapping.colorCode, color),
    ) || null
  )
}

function resolveMappingLinesForSku(techPack: TechPack, color: string, skuCode: string) {
  const colorMapping = resolveColorMapping(techPack, color)
  if (!colorMapping) return { colorMapping: null, mappingLines: [] as NonNullable<typeof colorMapping>['lines'] }
  const mappingLines = colorMapping.lines.filter(
    (line) => !(line.applicableSkuCodes || []).length || line.applicableSkuCodes?.includes(skuCode),
  )
  return { colorMapping, mappingLines }
}

function lineMatchesMaterial(line: NonNullable<TechPack['colorMaterialMappings']>[number]['lines'][number], materialSku: string): boolean {
  if (!normalizeText(materialSku)) return false
  return equalsLoose(line.materialCode, materialSku) || equalsLoose(line.materialName, materialSku)
}

function buildPieceRowsFromPatternFallback(
  techPack: TechPack,
  line: NonNullable<TechPack['colorMaterialMappings']>[number]['lines'][number],
  skuCode: string,
) {
  if (!line.patternId) return []
  const pattern = (techPack.patternFiles || []).find((item) => item.id === line.patternId) || null
  if (!pattern?.pieceRows?.length) return []
  return pattern.pieceRows
    .filter((pieceRow) => !(pieceRow.applicableSkuCodes || []).length || pieceRow.applicableSkuCodes?.includes(skuCode))
    .map((pieceRow) => ({
      patternName: line.patternName || pattern.fileName || '',
      pieceName: pieceRow.name,
      pieceCountPerUnit: Number(pieceRow.count || 0),
    }))
    .filter((item) => item.pieceName && item.pieceCountPerUnit > 0)
}

export function buildMarkerPieceExplosionViewModel(
  options: MarkerPlanExplosionInput & {
    sourceRows: MarkerPieceExplosionSourceRow[]
  },
): MarkerPieceExplosionViewModel {
  const sourceRowsById = Object.fromEntries(options.sourceRows.map((row) => [row.originalCutOrderId, row]))
  const allocationLines = options.marker.allocationLines || []
  const allocationSizeMap = new Map<string, number>()
  const sourceOrderRows = options.sourceRows.map((row) => {
    const linkedLines = allocationLines.filter((line) => line.sourceCutOrderId === row.originalCutOrderId)
    return {
      sourceCutOrderId: row.originalCutOrderId,
      sourceCutOrderNo: row.originalCutOrderNo,
      sourceProductionOrderId: row.productionOrderId,
      sourceProductionOrderNo: row.productionOrderNo,
      styleCode: row.styleCode,
      spuCode: row.spuCode,
      techPackSpuCode: row.techPackSpuCode || '',
      color: row.color,
      materialSku: row.materialSkuSummary,
      allocationSummaryText: buildAllocationSummaryText(linkedLines),
      allocationTotalQty: linkedLines.reduce((sum, line) => sum + Math.max(line.plannedGarmentQty || 0, 0), 0),
    }
  })

  const allocationRows: MarkerExplosionAllocationRow[] = []
  const skuSummaryRows: MarkerExplosionSkuSummaryRow[] = []
  const pieceDetailRows: MarkerExplosionPieceDetailRow[] = []
  const mappingWarnings: string[] = []
  const missingMappings: MarkerExplosionMissingMappingRow[] = []

  allocationLines.forEach((allocationLine) => {
    const sourceRow = sourceRowsById[allocationLine.sourceCutOrderId] || null
    const plannedGarmentQty = Math.max(Number(allocationLine.plannedGarmentQty || 0), 0)
    allocationSizeMap.set(
      allocationLine.sizeLabel,
      (allocationSizeMap.get(allocationLine.sizeLabel) || 0) + plannedGarmentQty,
    )

    const techPackLink = resolveMarkerTechPackLink({
      marker: options.marker,
      sourceRow,
    })

    const baseAllocationRow: MarkerExplosionAllocationRow = {
      allocationId: allocationLine.allocationId,
      sourceCutOrderId: allocationLine.sourceCutOrderId,
      sourceCutOrderNo: allocationLine.sourceCutOrderNo,
      sourceProductionOrderNo: allocationLine.sourceProductionOrderNo,
      color: allocationLine.color,
      sizeLabel: allocationLine.sizeLabel,
      materialSku: allocationLine.materialSku,
      plannedGarmentQty,
      techPackSpuCode: techPackLink.resolvedSpuCode,
      skuCode: '',
      mappingStatus: 'MATCHED',
      mappingStatusLabel: getMappingStatusLabel('MATCHED'),
      exceptionText: '',
    }

    if (techPackLink.status === 'MISSING' || !techPackLink.techPack) {
      const reason = `${allocationLine.sourceCutOrderNo} 未关联技术资料快照，无法拆解 SKU / 部位。`
      allocationRows.push({
        ...baseAllocationRow,
        mappingStatus: 'MISSING_TECH_PACK',
        mappingStatusLabel: getMappingStatusLabel('MISSING_TECH_PACK'),
        exceptionText: reason,
      })
      skuSummaryRows.push({
        sourceCutOrderId: allocationLine.sourceCutOrderId,
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        skuCode: '',
        plannedGarmentQty,
        explodedPieceTotal: 0,
        involvedPartCount: 0,
        mappingStatus: 'MISSING_TECH_PACK',
        mappingStatusLabel: getMappingStatusLabel('MISSING_TECH_PACK'),
      })
      missingMappings.push({
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        materialSku: allocationLine.materialSku,
        reason,
        mappingStatus: 'MISSING_TECH_PACK',
        mappingStatusLabel: getMappingStatusLabel('MISSING_TECH_PACK'),
      })
      mappingWarnings.push(reason)
      return
    }

    const skuCode = resolveSkuCode(techPackLink.techPack, allocationLine.color, allocationLine.sizeLabel)
    if (!skuCode) {
      const reason = `${allocationLine.sourceCutOrderNo} ${allocationLine.color}/${allocationLine.sizeLabel} 未匹配到技术资料 SKU。`
      allocationRows.push({
        ...baseAllocationRow,
        mappingStatus: 'MISSING_SKU',
        mappingStatusLabel: getMappingStatusLabel('MISSING_SKU'),
        exceptionText: reason,
      })
      skuSummaryRows.push({
        sourceCutOrderId: allocationLine.sourceCutOrderId,
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        skuCode: '',
        plannedGarmentQty,
        explodedPieceTotal: 0,
        involvedPartCount: 0,
        mappingStatus: 'MISSING_SKU',
        mappingStatusLabel: getMappingStatusLabel('MISSING_SKU'),
      })
      missingMappings.push({
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        materialSku: allocationLine.materialSku,
        reason,
        mappingStatus: 'MISSING_SKU',
        mappingStatusLabel: getMappingStatusLabel('MISSING_SKU'),
      })
      mappingWarnings.push(reason)
      return
    }

    const { colorMapping, mappingLines } = resolveMappingLinesForSku(techPackLink.techPack, allocationLine.color, skuCode)
    if (!colorMapping) {
      const reason = `${allocationLine.sourceCutOrderNo} ${allocationLine.color} 未匹配到技术资料颜色映射。`
      allocationRows.push({
        ...baseAllocationRow,
        skuCode,
        mappingStatus: 'MISSING_COLOR_MAPPING',
        mappingStatusLabel: getMappingStatusLabel('MISSING_COLOR_MAPPING'),
        exceptionText: reason,
      })
      skuSummaryRows.push({
        sourceCutOrderId: allocationLine.sourceCutOrderId,
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        skuCode,
        plannedGarmentQty,
        explodedPieceTotal: 0,
        involvedPartCount: 0,
        mappingStatus: 'MISSING_COLOR_MAPPING',
        mappingStatusLabel: getMappingStatusLabel('MISSING_COLOR_MAPPING'),
      })
      missingMappings.push({
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        materialSku: allocationLine.materialSku,
        reason,
        mappingStatus: 'MISSING_COLOR_MAPPING',
        mappingStatusLabel: getMappingStatusLabel('MISSING_COLOR_MAPPING'),
      })
      mappingWarnings.push(reason)
      return
    }

    const faceLines = mappingLines.filter((line) => line.materialType === '面料')
    const candidateLines = faceLines.length ? faceLines : mappingLines
    const materialMatched = candidateLines.some((line) => lineMatchesMaterial(line, allocationLine.materialSku))
    const pieceRows = candidateLines.flatMap((line) => {
      if (line.pieceName && Number(line.pieceCountPerUnit || 0) > 0) {
        return [
          {
            patternName: line.patternName || '',
            pieceName: line.pieceName,
            pieceCountPerUnit: Number(line.pieceCountPerUnit || 0),
          },
        ]
      }
      return buildPieceRowsFromPatternFallback(techPackLink.techPack, line, skuCode)
    })

    if (!pieceRows.length) {
      const reason = `${allocationLine.sourceCutOrderNo} ${allocationLine.color}/${allocationLine.sizeLabel} 未匹配到裁片部位映射。`
      allocationRows.push({
        ...baseAllocationRow,
        skuCode,
        mappingStatus: 'MISSING_PIECE_MAPPING',
        mappingStatusLabel: getMappingStatusLabel('MISSING_PIECE_MAPPING'),
        exceptionText: reason,
      })
      skuSummaryRows.push({
        sourceCutOrderId: allocationLine.sourceCutOrderId,
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        skuCode,
        plannedGarmentQty,
        explodedPieceTotal: 0,
        involvedPartCount: 0,
        mappingStatus: 'MISSING_PIECE_MAPPING',
        mappingStatusLabel: getMappingStatusLabel('MISSING_PIECE_MAPPING'),
      })
      missingMappings.push({
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        materialSku: allocationLine.materialSku,
        reason,
        mappingStatus: 'MISSING_PIECE_MAPPING',
        mappingStatusLabel: getMappingStatusLabel('MISSING_PIECE_MAPPING'),
      })
      mappingWarnings.push(reason)
      return
    }

    const mappingStatus: MarkerPieceMappingStatus = materialMatched ? 'MATCHED' : 'MATERIAL_PENDING_CONFIRM'
    const exceptionText = materialMatched
      ? ''
      : `${allocationLine.sourceCutOrderNo} ${allocationLine.materialSku || '当前面料'} 与技术资料映射行未确认一一对应，请人工确认面料映射。`
    const explodedPieceTotal = pieceRows.reduce(
      (sum, pieceRow) => sum + plannedGarmentQty * Math.max(pieceRow.pieceCountPerUnit || 0, 0),
      0,
    )

    allocationRows.push({
      ...baseAllocationRow,
      skuCode,
      mappingStatus,
      mappingStatusLabel: getMappingStatusLabel(mappingStatus),
      exceptionText,
    })
    skuSummaryRows.push({
      sourceCutOrderId: allocationLine.sourceCutOrderId,
      sourceCutOrderNo: allocationLine.sourceCutOrderNo,
      color: allocationLine.color,
      sizeLabel: allocationLine.sizeLabel,
      skuCode,
      plannedGarmentQty,
      explodedPieceTotal,
      involvedPartCount: pieceRows.length,
      mappingStatus,
      mappingStatusLabel: getMappingStatusLabel(mappingStatus),
    })
    pieceRows.forEach((pieceRow) => {
      pieceDetailRows.push({
        sourceCutOrderId: allocationLine.sourceCutOrderId,
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        skuCode,
        materialSku: allocationLine.materialSku,
        patternName: pieceRow.patternName,
        pieceName: pieceRow.pieceName,
        pieceCountPerUnit: pieceRow.pieceCountPerUnit,
        plannedGarmentQty,
        explodedPieceQty: plannedGarmentQty * Math.max(pieceRow.pieceCountPerUnit || 0, 0),
        mappingStatus,
        mappingStatusLabel: getMappingStatusLabel(mappingStatus),
      })
    })
    if (exceptionText) {
      mappingWarnings.push(exceptionText)
      missingMappings.push({
        sourceCutOrderNo: allocationLine.sourceCutOrderNo,
        color: allocationLine.color,
        sizeLabel: allocationLine.sizeLabel,
        materialSku: allocationLine.materialSku,
        reason: exceptionText,
        mappingStatus,
        mappingStatusLabel: getMappingStatusLabel(mappingStatus),
      })
    }
  })

  const sizeKeys = uniqueStrings([
    ...options.marker.sizeDistribution.map((item) => item.sizeLabel),
    ...allocationLines.map((item) => item.sizeLabel),
  ])
  const allocationSizeSummary = sizeKeys.map((sizeLabel) => {
    const requiredQty =
      options.marker.sizeDistribution.find((item) => item.sizeLabel === sizeLabel)?.quantity || 0
    const allocatedQty = allocationSizeMap.get(sizeLabel) || 0
    return {
      sizeLabel,
      requiredQty,
      allocatedQty,
      differenceQty: allocatedQty - requiredQty,
    }
  })

  return {
    sourceOrderRows,
    allocationRows,
    allocationSizeSummary,
    skuSummaryRows,
    pieceDetailRows,
    mappingWarnings: uniqueStrings(mappingWarnings),
    missingMappings,
    totals: {
      sourceOrderCount: sourceOrderRows.length,
      allocationLineCount: allocationRows.length,
      skuRowCount: skuSummaryRows.length,
      pieceRowCount: pieceDetailRows.length,
      plannedGarmentQtyTotal: allocationRows.reduce((sum, row) => sum + row.plannedGarmentQty, 0),
      explodedPieceQtyTotal: pieceDetailRows.reduce((sum, row) => sum + row.explodedPieceQty, 0),
    },
  }
}
