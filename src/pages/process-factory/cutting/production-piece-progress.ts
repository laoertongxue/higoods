import { getTechPackBySpuCode, type TechPack } from '../../../data/fcs/tech-packs'
import type {
  CuttingCutOrderSkuScopeLine,
  CuttingOrderProgressRecord,
  CuttingSkuRequirementLine,
} from '../../../data/fcs/cutting/types'

export type ProductionPieceMappingStatus =
  | 'MATCHED'
  | 'MISSING_TECH_PACK'
  | 'MISSING_SKU'
  | 'MISSING_COLOR_MAPPING'
  | 'MISSING_PIECE_MAPPING'
  | 'MATERIAL_PENDING_CONFIRM'
  | 'SKU_SCOPE_PENDING'

export interface ProductionResolvedTechPackLink {
  status: 'MATCHED' | 'MISSING'
  resolvedSpuCode: string
  sourceKey: 'record-tech-pack' | 'record-spu' | 'missing'
  techPack: TechPack | null
}

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

const mappingStatusLabelMap: Record<ProductionPieceMappingStatus, string> = {
  MATCHED: '已匹配',
  MISSING_TECH_PACK: '未关联技术包',
  MISSING_SKU: '未匹配 SKU',
  MISSING_COLOR_MAPPING: '缺少颜色映射',
  MISSING_PIECE_MAPPING: '缺少裁片映射',
  MATERIAL_PENDING_CONFIRM: '面料待确认',
  SKU_SCOPE_PENDING: '待补承接范围',
}

function normalizeText(value: string | undefined | null): string {
  return String(value || '').trim()
}

function normalizeKey(value: string | undefined | null): string {
  return normalizeText(value).toLowerCase()
}

function equalsLoose(left: string | undefined | null, right: string | undefined | null): boolean {
  const normalizedLeft = normalizeKey(left)
  const normalizedRight = normalizeKey(right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)))
}

function formatStatusLabel(status: ProductionPieceMappingStatus): string {
  return mappingStatusLabelMap[status]
}

function makeSkuKey(line: Pick<CuttingSkuRequirementLine, 'skuCode' | 'color' | 'size'>): string {
  const skuCode = normalizeKey(line.skuCode)
  if (skuCode) return `sku:${skuCode}`
  return `color-size:${normalizeKey(line.color)}:${normalizeKey(line.size)}`
}

function makePieceKey(line: {
  sourceCutOrderNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partName: string
}): string {
  return [
    normalizeKey(line.sourceCutOrderNo),
    normalizeKey(line.materialSku),
    normalizeKey(line.skuCode),
    normalizeKey(line.color),
    normalizeKey(line.size),
    normalizeKey(line.partName),
  ].join('::')
}

function lineMatchesMaterial(
  line: NonNullable<TechPack['colorMaterialMappings']>[number]['lines'][number],
  materialSku: string,
): boolean {
  return equalsLoose(line.materialCode, materialSku) || equalsLoose(line.materialName, materialSku)
}

function resolveSkuCode(
  techPack: TechPack,
  line: Pick<CuttingCutOrderSkuScopeLine, 'skuCode' | 'color' | 'size'>,
): string {
  const normalizedSkuCode = normalizeText(line.skuCode)
  if (normalizedSkuCode) {
    const exactMatched = (techPack.skuCatalog || []).find((item) => equalsLoose(item.skuCode, normalizedSkuCode))
    if (exactMatched) return exactMatched.skuCode
  }

  const matchedByColorSize = (techPack.skuCatalog || []).find(
    (item) => equalsLoose(item.color, line.color) && equalsLoose(item.size, line.size),
  )
  return matchedByColorSize?.skuCode || ''
}

function resolveColorMapping(techPack: TechPack, color: string) {
  return (
    (techPack.colorMaterialMappings || []).find(
      (mapping) => equalsLoose(mapping.colorName, color) || equalsLoose(mapping.colorCode, color),
    ) || null
  )
}

function buildPatternFallbackRows(
  techPack: TechPack,
  mappingLine: NonNullable<TechPack['colorMaterialMappings']>[number]['lines'][number],
  skuCode: string,
): Array<{ partCode: string; partName: string; pieceCountPerUnit: number; patternName: string }> {
  if (!mappingLine.patternId) return []
  const patternFile = techPack.patternFiles.find((pattern) => pattern.id === mappingLine.patternId)
  if (!patternFile?.pieceRows?.length) return []

  return patternFile.pieceRows
    .filter((pieceRow) => !(pieceRow.applicableSkuCodes || []).length || pieceRow.applicableSkuCodes?.includes(skuCode))
    .map((pieceRow) => ({
      partCode: pieceRow.id || '',
      partName: pieceRow.name,
      pieceCountPerUnit: Number(pieceRow.count || 0),
      patternName: mappingLine.patternName || patternFile.fileName || '',
    }))
    .filter((pieceRow) => pieceRow.partName && pieceRow.pieceCountPerUnit > 0)
}

export function resolveProductionProgressTechPackLink(
  record: Pick<CuttingOrderProgressRecord, 'techPackSpuCode' | 'spuCode'>,
): ProductionResolvedTechPackLink {
  const candidates: Array<{ value: string; sourceKey: ProductionResolvedTechPackLink['sourceKey'] }> = [
    { value: normalizeText(record.techPackSpuCode), sourceKey: 'record-tech-pack' },
    { value: normalizeText(record.spuCode), sourceKey: 'record-spu' },
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

export function buildProductionPieceRequirementRows(
  record: CuttingOrderProgressRecord,
  techPack: TechPack | null,
): ProductionPieceRequirementRow[] {
  const rows: ProductionPieceRequirementRow[] = []

  record.materialLines.forEach((materialLine) => {
    const scopeLines = materialLine.skuScopeLines || []
    scopeLines
      .filter((scopeLine) => Number(scopeLine.plannedQty || 0) > 0)
      .forEach((scopeLine) => {
        const requiredGarmentQty = Number(scopeLine.plannedQty || 0)
        const missingBaseRow = (
          mappingStatus: ProductionPieceMappingStatus,
          options?: Partial<Pick<ProductionPieceRequirementRow, 'skuCode' | 'partCode' | 'partName' | 'patternName' | 'pieceCountPerUnit'>>,
        ) => {
          const pieceCountPerUnit = Number(options?.pieceCountPerUnit || 0)
          rows.push({
            productionOrderId: record.productionOrderId,
            productionOrderNo: record.productionOrderNo,
            sourceCutOrderNo: materialLine.cutPieceOrderNo,
            materialSku: materialLine.materialSku,
            skuCode: options?.skuCode || normalizeText(scopeLine.skuCode),
            color: scopeLine.color,
            size: scopeLine.size,
            partCode: options?.partCode || '',
            partName: options?.partName || '待确认',
            patternName: options?.patternName || '',
            pieceCountPerUnit,
            requiredGarmentQty,
            requiredPieceQty: requiredGarmentQty * pieceCountPerUnit,
            mappingStatus,
            mappingStatusLabel: formatStatusLabel(mappingStatus),
          })
        }

        if (!techPack) {
          missingBaseRow('MISSING_TECH_PACK')
          return
        }

        const skuCode = resolveSkuCode(techPack, scopeLine)
        if (!skuCode) {
          missingBaseRow('MISSING_SKU')
          return
        }

        const colorMapping = resolveColorMapping(techPack, scopeLine.color)
        if (!colorMapping) {
          missingBaseRow('MISSING_COLOR_MAPPING', { skuCode })
          return
        }

        const candidateLines = colorMapping.lines.filter(
          (line) =>
            line.materialType === '面料' &&
            (!(line.applicableSkuCodes || []).length || line.applicableSkuCodes?.includes(skuCode)),
        )

        if (!candidateLines.length) {
          missingBaseRow('MISSING_PIECE_MAPPING', { skuCode })
          return
        }

        const matchedMaterialLines = candidateLines.filter((line) => lineMatchesMaterial(line, materialLine.materialSku))
        const selectedLines = matchedMaterialLines.length ? matchedMaterialLines : candidateLines
        const mappingStatus: ProductionPieceMappingStatus = matchedMaterialLines.length ? 'MATCHED' : 'MATERIAL_PENDING_CONFIRM'

        selectedLines.forEach((mappingLine) => {
          const pieceRows =
            mappingLine.pieceName && Number(mappingLine.pieceCountPerUnit || 0) > 0
              ? [
                  {
                    partCode: mappingLine.pieceId || '',
                    partName: mappingLine.pieceName,
                    pieceCountPerUnit: Number(mappingLine.pieceCountPerUnit || 0),
                    patternName: mappingLine.patternName || '',
                  },
                ]
              : buildPatternFallbackRows(techPack, mappingLine, skuCode)

          if (!pieceRows.length) {
            missingBaseRow('MISSING_PIECE_MAPPING', {
              skuCode,
              patternName: mappingLine.patternName || '',
            })
            return
          }

          pieceRows.forEach((pieceRow) => {
            rows.push({
              productionOrderId: record.productionOrderId,
              productionOrderNo: record.productionOrderNo,
              sourceCutOrderNo: materialLine.cutPieceOrderNo,
              materialSku: materialLine.materialSku,
              skuCode,
              color: scopeLine.color,
              size: scopeLine.size,
              partCode: pieceRow.partCode,
              partName: pieceRow.partName,
              patternName: pieceRow.patternName,
              pieceCountPerUnit: pieceRow.pieceCountPerUnit,
              requiredGarmentQty,
              requiredPieceQty: requiredGarmentQty * pieceRow.pieceCountPerUnit,
              mappingStatus,
              mappingStatusLabel: formatStatusLabel(mappingStatus),
            })
          })
        })
      })
  })

  return rows
}

export function buildProductionPieceActualRows(record: CuttingOrderProgressRecord): ProductionPieceActualRow[] {
  const grouped = new Map<string, ProductionPieceActualRow>()

  record.materialLines.forEach((materialLine) => {
    ;(materialLine.pieceProgressLines || []).forEach((pieceLine) => {
      const key = makePieceKey({
        sourceCutOrderNo: materialLine.cutPieceOrderNo,
        materialSku: materialLine.materialSku,
        skuCode: pieceLine.skuCode,
        color: pieceLine.color,
        size: pieceLine.size,
        partName: pieceLine.partName,
      })

      const current = grouped.get(key)
      const next: ProductionPieceActualRow = {
        sourceCutOrderNo: materialLine.cutPieceOrderNo,
        materialSku: materialLine.materialSku,
        skuCode: pieceLine.skuCode,
        color: pieceLine.color,
        size: pieceLine.size,
        partName: pieceLine.partName,
        actualCutQty: (current?.actualCutQty || 0) + Number(pieceLine.actualCutQty || 0),
        inboundQty: (current?.inboundQty || 0) + Number(pieceLine.inboundQty || 0),
        latestUpdatedAt:
          [current?.latestUpdatedAt, pieceLine.latestUpdatedAt].filter(Boolean).sort().at(-1) || '',
        latestOperatorName: pieceLine.latestOperatorName || current?.latestOperatorName || '',
      }
      grouped.set(key, next)
    })
  })

  return Array.from(grouped.values())
}

export function buildProductionPieceGapRows(
  record: CuttingOrderProgressRecord,
  techPack: TechPack | null,
): ProductionPieceGapRow[] {
  const requirementRows = buildProductionPieceRequirementRows(record, techPack)
  const actualRows = buildProductionPieceActualRows(record)
  const actualRowMap = new Map(actualRows.map((row) => [makePieceKey(row), row]))

  return requirementRows.map((row) => {
    const actual = actualRowMap.get(makePieceKey(row))
    const actualCutQty = Number(actual?.actualCutQty || 0)
    const inboundQty = Number(actual?.inboundQty || 0)
    return {
      ...row,
      actualCutQty,
      inboundQty,
      gapQty: Math.max(row.requiredPieceQty - actualCutQty, 0),
      inboundGapQty: Math.max(row.requiredPieceQty - inboundQty, 0),
      latestUpdatedAt: actual?.latestUpdatedAt || '',
      latestOperatorName: actual?.latestOperatorName || '',
    }
  })
}

export function buildProductionPieceProgressViewModel(
  record: CuttingOrderProgressRecord,
): ProductionPieceProgressViewModel {
  const techPackLink = resolveProductionProgressTechPackLink(record)
  const requirementRows = buildProductionPieceRequirementRows(record, techPackLink.techPack)
  const gapRows = buildProductionPieceGapRows(record, techPackLink.techPack)
  const requirementSkuMap = new Map(
    (record.skuRequirementLines || [])
      .filter((line) => Number(line.plannedQty || 0) > 0)
      .map((line) => [makeSkuKey(line), line] as const),
  )
  const scopeSkuMap = new Map<string, number>()

  record.materialLines.forEach((materialLine) => {
    ;(materialLine.skuScopeLines || []).forEach((scopeLine) => {
      const key = makeSkuKey(scopeLine)
      scopeSkuMap.set(key, (scopeSkuMap.get(key) || 0) + Number(scopeLine.plannedQty || 0))
    })
  })

  const skuSummaryRows = Array.from(
    new Map(
      (record.skuRequirementLines || []).map((line) => {
        const key = makeSkuKey(line)
        const relatedRows = gapRows.filter((row) => makeSkuKey(row) === key)
        const statusSet = uniqueStrings(relatedRows.map((row) => row.mappingStatus))
        const mappingStatus = (statusSet[0] as ProductionPieceMappingStatus | undefined) || 'SKU_SCOPE_PENDING'
        const sourceCutOrderCount = uniqueStrings(relatedRows.map((row) => row.sourceCutOrderNo)).length
        const requiredPieceQty = relatedRows.reduce((sum, row) => sum + row.requiredPieceQty, 0)
        const actualCutQty = relatedRows.reduce((sum, row) => sum + row.actualCutQty, 0)
        const inboundQty = relatedRows.reduce((sum, row) => sum + row.inboundQty, 0)
        const gapQty = relatedRows.reduce((sum, row) => sum + row.gapQty, 0)
        const inboundGapQty = relatedRows.reduce((sum, row) => sum + row.inboundGapQty, 0)

        let completionLabel = '已完成'
        if (mappingStatus !== 'MATCHED') completionLabel = '映射异常'
        else if (gapQty > 0) completionLabel = '未裁齐'
        else if (inboundGapQty > 0) completionLabel = '裁完待入仓'

        return [
          key,
          {
            skuCode: line.skuCode,
            color: line.color,
            size: line.size,
            requiredGarmentQty: Number(line.plannedQty || 0),
            requiredPieceQty,
            actualCutQty,
            inboundQty,
            gapQty,
            inboundGapQty,
            sourceCutOrderCount,
            mappingStatus,
            mappingStatusLabel: formatStatusLabel(mappingStatus),
            completionLabel,
          },
        ] as const
      }),
    ).values(),
  )

  const incompleteSkuRows = skuSummaryRows.filter(
    (row) => row.mappingStatus !== 'MATCHED' || row.gapQty > 0 || row.inboundGapQty > 0,
  )

  const incompleteBySource = new Map<string, ProductionIncompleteOriginalOrderRow>()
  gapRows
    .filter((row) => row.mappingStatus !== 'MATCHED' || row.gapQty > 0 || row.inboundGapQty > 0)
    .forEach((row) => {
      const key = normalizeKey(row.sourceCutOrderNo)
      const current = incompleteBySource.get(key)
      const skuLabel = `${row.color}/${row.size}`
      const next: ProductionIncompleteOriginalOrderRow = {
        sourceCutOrderNo: row.sourceCutOrderNo,
        materialSkuSummary: uniqueStrings([...(current?.materialSkuSummary.split('、') || []), row.materialSku]).join('、'),
        skuSummaryText: uniqueStrings([...(current?.skuSummaryText.split('、') || []), skuLabel]).join('、'),
        gapPartCount: (current?.gapPartCount || 0) + (row.gapQty > 0 || row.inboundGapQty > 0 ? 1 : 0),
        gapPieceQty: (current?.gapPieceQty || 0) + Math.max(row.gapQty, row.inboundGapQty),
        mappingWarningCount: (current?.mappingWarningCount || 0) + (row.mappingStatus === 'MATCHED' ? 0 : 1),
      }
      incompleteBySource.set(key, next)
    })

  const mappingWarnings: string[] = []
  if (techPackLink.status === 'MISSING') {
    mappingWarnings.push('未关联技术包')
  }

  requirementSkuMap.forEach((requirementLine, key) => {
    const scopedQty = scopeSkuMap.get(key) || 0
    const plannedQty = Number(requirementLine.plannedQty || 0)
    if (scopedQty !== plannedQty) {
      mappingWarnings.push(
        `${requirementLine.color}/${requirementLine.size} 承接数量待补齐：需求 ${plannedQty}，当前裁片单承接 ${scopedQty}`,
      )
    }
  })

  gapRows
    .filter((row) => row.mappingStatus !== 'MATCHED')
    .forEach((row) => {
      mappingWarnings.push(
        `${row.sourceCutOrderNo} · ${row.color}/${row.size} · ${row.partName}：${row.mappingStatusLabel}`,
      )
    })

  const totals: ProductionPieceProgressTotals = {
    requiredGarmentQtyTotal: (record.skuRequirementLines || []).reduce((sum, row) => sum + Number(row.plannedQty || 0), 0),
    requiredPieceQtyTotal: gapRows.reduce((sum, row) => sum + row.requiredPieceQty, 0),
    actualCutQtyTotal: gapRows.reduce((sum, row) => sum + row.actualCutQty, 0),
    inboundQtyTotal: gapRows.reduce((sum, row) => sum + row.inboundQty, 0),
    gapQtyTotal: gapRows.reduce((sum, row) => sum + row.gapQty, 0),
    inboundGapQtyTotal: gapRows.reduce((sum, row) => sum + row.inboundGapQty, 0),
    incompleteSkuCount: incompleteSkuRows.length,
    incompleteOriginalOrderCount: incompleteBySource.size,
  }

  return {
    techPackLink,
    skuSummaryRows,
    pieceDetailRows: gapRows,
    gapRows: gapRows.filter((row) => row.gapQty > 0 || row.inboundGapQty > 0 || row.mappingStatus !== 'MATCHED'),
    incompleteSkuRows,
    incompleteOriginalOrderRows: Array.from(incompleteBySource.values()),
    mappingWarnings: uniqueStrings(mappingWarnings),
    totals,
  }
}
