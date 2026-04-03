import { getTechPackBySpuCode, type TechPack } from '../../data/fcs/tech-packs.ts'
import type {
  CuttingCutOrderSkuScopeLine,
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingSkuRequirementLine,
} from '../../data/fcs/cutting/types.ts'

export type PieceTruthMappingStatus =
  | 'MATCHED'
  | 'MISSING_TECH_PACK'
  | 'MISSING_SKU'
  | 'MISSING_COLOR_MAPPING'
  | 'MISSING_PIECE_MAPPING'
  | 'MATERIAL_PENDING_CONFIRM'
  | 'SKU_SCOPE_PENDING'

export type ProductionPieceTruthCompletionKey = 'COMPLETED' | 'IN_PROGRESS' | 'DATA_PENDING' | 'HAS_EXCEPTION'

export type PieceTruthOverlaySourceType = 'PICKUP' | 'INBOUND' | 'HANDOVER' | 'REPLENISHMENT'

export interface ProductionResolvedTechPackLink {
  status: 'MATCHED' | 'MISSING'
  resolvedSpuCode: string
  sourceKey: 'record-tech-pack' | 'record-spu' | 'missing'
  techPack: TechPack | null
}

export interface ProductionSkuRequirementRef {
  productionOrderId: string
  productionOrderNo: string
  skuCode: string
  color: string
  size: string
  plannedQty: number
  techPackSpuCode: string
}

export interface OriginalCutOrderSkuScopeRef {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  plannedQty: number
  mergeBatchId: string
  mergeBatchNo: string
}

export interface PieceRequirementRow {
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceCountPerUnit: number
  requiredGarmentQty: number
  requiredPieceQty: number
  mappingStatus: PieceTruthMappingStatus
  mappingStatusLabel: string
  techPackSpuCode: string
  patternId: string
  patternName: string
}

export interface PieceActualRow {
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  actualCutQty: number
  inboundQty: number
  sourceType: 'PIECE_PROGRESS' | 'OVERLAY_SIGNAL'
  latestUpdatedAt: string
  latestOperatorName: string
}

export interface PieceGapRow {
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  requiredPieceQty: number
  actualCutQty: number
  inboundQty: number
  gapCutQty: number
  gapInboundQty: number
  mappingStatus: PieceTruthMappingStatus
  mappingStatusLabel: string
  currentStateLabel: string
  nextActionLabel: string
  latestUpdatedAt: string
  latestOperatorName: string
  pieceCountPerUnit: number
  requiredGarmentQty: number
  techPackSpuCode: string
  patternId: string
  patternName: string
}

export interface ProductionPieceTruthIssue {
  issueId: string
  issueType: 'MAPPING_MISSING' | 'DATA_PENDING'
  level: 'mapping' | 'data'
  message: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
}

export interface ProductionPieceTruthSkuRow {
  skuCode: string
  color: string
  size: string
  requiredGarmentQty: number
  requiredPieceQty: number
  actualCutQty: number
  inboundQty: number
  gapCutQty: number
  gapInboundQty: number
  originalCutOrderCount: number
  materialCount: number
  mappingStatus: PieceTruthMappingStatus
  mappingStatusLabel: string
  currentStateLabel: string
  nextActionLabel: string
}

export interface ProductionPieceTruthOriginalCutOrderRow {
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  materialSku: string
  skuCount: number
  gapPartCount: number
  gapCutQty: number
  gapInboundQty: number
  currentStateLabel: string
  nextActionLabel: string
}

export interface ProductionPieceTruthMaterialRow {
  materialSku: string
  originalCutOrderCount: number
  skuCount: number
  gapPartCount: number
  gapCutQty: number
  gapInboundQty: number
  currentStateLabel: string
  nextActionLabel: string
}

export interface ProductionPieceTruthCounts {
  skuTotalCount: number
  completedSkuCount: number
  pendingSkuCount: number
  incompletePartCount: number
  affectedMaterialCount: number
  originalCutOrderCount: number
  mappingIssueCount: number
  dataIssueCount: number
  requiredPieceQtyTotal: number
  actualCutQtyTotal: number
  inboundQtyTotal: number
  gapCutQtyTotal: number
  gapInboundQtyTotal: number
}

export interface ProductionPieceTruthCompletionMeta {
  key: ProductionPieceTruthCompletionKey
  label: string
  className: string
  detailText: string
}

export interface ProductionPieceTruthResult {
  productionOrderId: string
  productionOrderNo: string
  requirementRows: PieceRequirementRow[]
  actualRows: PieceActualRow[]
  gapRows: PieceGapRow[]
  skuRows: ProductionPieceTruthSkuRow[]
  originalCutOrderRows: ProductionPieceTruthOriginalCutOrderRow[]
  materialRows: ProductionPieceTruthMaterialRow[]
  mappingIssues: ProductionPieceTruthIssue[]
  dataIssues: ProductionPieceTruthIssue[]
  completionState: ProductionPieceTruthCompletionKey
  completionLabel: string
  completionClassName: string
  completionDetailText: string
  nextActionLabel: string
  counts: ProductionPieceTruthCounts
  techPackLink: ProductionResolvedTechPackLink
}

export interface PieceTruthOverlaySignal {
  sourceType: PieceTruthOverlaySourceType
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
  cutPieceOrderNo: string
  materialSku: string
  latestUpdatedAt: string
  latestOperatorName: string
  note?: string
}

export interface ProductionPieceTruthCompletionOptions {
  hasObjectException?: boolean
  hasObjectPending?: boolean
  hasObjectDataPending?: boolean
  objectExceptionReason?: string
  objectPendingReason?: string
  objectDataPendingReason?: string
}

const mappingStatusLabelMap: Record<PieceTruthMappingStatus, string> = {
  MATCHED: '已匹配',
  MISSING_TECH_PACK: '未关联技术包',
  MISSING_SKU: '未匹配 SKU',
  MISSING_COLOR_MAPPING: '缺少颜色映射',
  MISSING_PIECE_MAPPING: '缺少裁片映射',
  MATERIAL_PENDING_CONFIRM: '面料待确认',
  SKU_SCOPE_PENDING: '待补承接范围',
}

export const productionPieceTruthCompletionMetaMap: Record<
  ProductionPieceTruthCompletionKey,
  { label: string; className: string }
> = {
  COMPLETED: { label: '已完成', className: 'bg-emerald-100 text-emerald-700' },
  IN_PROGRESS: { label: '进行中', className: 'bg-blue-100 text-blue-700' },
  DATA_PENDING: { label: '数据待补', className: 'bg-slate-100 text-slate-700' },
  HAS_EXCEPTION: { label: '有异常', className: 'bg-rose-100 text-rose-700' },
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

function makeSkuKey(line: Pick<ProductionSkuRequirementRef, 'skuCode' | 'color' | 'size'>): string {
  const skuCode = normalizeKey(line.skuCode)
  if (skuCode) return `sku:${skuCode}`
  return `color-size:${normalizeKey(line.color)}:${normalizeKey(line.size)}`
}

function makePieceKey(line: {
  originalCutOrderNo: string
  materialSku: string
  skuCode: string
  color: string
  size: string
  partCode: string
  partName: string
}): string {
  return [
    normalizeKey(line.originalCutOrderNo),
    normalizeKey(line.materialSku),
    normalizeKey(line.skuCode),
    normalizeKey(line.color),
    normalizeKey(line.size),
    normalizeKey(line.partCode || line.partName),
  ].join('::')
}

function makeOriginalMaterialKey(line: {
  originalCutOrderNo: string
  materialSku: string
  skuCode?: string
  color?: string
  size?: string
}): string {
  return [
    normalizeKey(line.originalCutOrderNo),
    normalizeKey(line.materialSku),
    normalizeKey(line.skuCode),
    normalizeKey(line.color),
    normalizeKey(line.size),
  ].join('::')
}

function getOriginalCutOrderIdentity(materialLine: CuttingMaterialLine): {
  originalCutOrderId: string
  originalCutOrderNo: string
} {
  return {
    originalCutOrderId: normalizeText(materialLine.originalCutOrderId),
    originalCutOrderNo: normalizeText(materialLine.originalCutOrderNo),
  }
}

function getMergeBatchIdentity(materialLine: CuttingMaterialLine): {
  mergeBatchId: string
  mergeBatchNo: string
} {
  return {
    mergeBatchId: normalizeText(materialLine.mergeBatchId),
    mergeBatchNo: normalizeText(materialLine.mergeBatchNo),
  }
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
): Array<{ partCode: string; partName: string; pieceCountPerUnit: number; patternId: string; patternName: string }> {
  if (!mappingLine.patternId) return []
  const patternFile = techPack.patternFiles.find((pattern) => pattern.id === mappingLine.patternId)
  if (!patternFile?.pieceRows?.length) return []

  return patternFile.pieceRows
    .filter((pieceRow) => !(pieceRow.applicableSkuCodes || []).length || pieceRow.applicableSkuCodes?.includes(skuCode))
    .map((pieceRow) => ({
      partCode: pieceRow.id || '',
      partName: pieceRow.name,
      pieceCountPerUnit: Number(pieceRow.count || 0),
      patternId: patternFile.id,
      patternName: mappingLine.patternName || patternFile.fileName || '',
    }))
    .filter((pieceRow) => pieceRow.partName && pieceRow.pieceCountPerUnit > 0)
}

function pushIssue(
  bucket: ProductionPieceTruthIssue[],
  options: {
    issueType: 'MAPPING_MISSING' | 'DATA_PENDING'
    message: string
    productionOrderId: string
    productionOrderNo: string
    originalCutOrderId?: string
    originalCutOrderNo?: string
    mergeBatchId?: string
    mergeBatchNo?: string
    materialSku?: string
    skuCode?: string
    color?: string
    size?: string
    partCode?: string
    partName?: string
  },
): void {
  const issueId = [
    options.issueType,
    options.productionOrderNo,
    options.originalCutOrderNo,
    options.materialSku,
    options.skuCode,
    options.color,
    options.size,
    options.partCode || options.partName,
    options.message,
  ]
    .map((value) => normalizeKey(value))
    .filter(Boolean)
    .join('::')
  if (bucket.some((item) => item.issueId === issueId)) return
  bucket.push({
    issueId,
    issueType: options.issueType,
    level: options.issueType === 'MAPPING_MISSING' ? 'mapping' : 'data',
    message: options.message,
    productionOrderId: options.productionOrderId,
    productionOrderNo: options.productionOrderNo,
    originalCutOrderId: options.originalCutOrderId || '',
    originalCutOrderNo: options.originalCutOrderNo || '',
    mergeBatchId: options.mergeBatchId || '',
    mergeBatchNo: options.mergeBatchNo || '',
    materialSku: options.materialSku || '',
    skuCode: options.skuCode || '',
    color: options.color || '',
    size: options.size || '',
    partCode: options.partCode || '',
    partName: options.partName || '',
  })
}

export function resolveTechPackForProduction(
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

export function buildProductionSkuRequirements(
  record: CuttingOrderProgressRecord,
): ProductionSkuRequirementRef[] {
  return (record.skuRequirementLines || [])
    .filter((line) => Number(line.plannedQty || 0) > 0)
    .map((line) => ({
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      skuCode: normalizeText(line.skuCode),
      color: normalizeText(line.color),
      size: normalizeText(line.size),
      plannedQty: Number(line.plannedQty || 0),
      techPackSpuCode: normalizeText(record.techPackSpuCode) || normalizeText(record.spuCode),
    }))
}

export function buildOriginalCutOrderSkuScopes(
  record: CuttingOrderProgressRecord,
): OriginalCutOrderSkuScopeRef[] {
  const rows: OriginalCutOrderSkuScopeRef[] = []

  record.materialLines.forEach((materialLine) => {
    const originalIdentity = getOriginalCutOrderIdentity(materialLine)
    const mergeIdentity = getMergeBatchIdentity(materialLine)

    ;(materialLine.skuScopeLines || [])
      .filter((scopeLine) => Number(scopeLine.plannedQty || 0) > 0)
      .forEach((scopeLine) => {
        rows.push({
          originalCutOrderId: originalIdentity.originalCutOrderId,
          originalCutOrderNo: originalIdentity.originalCutOrderNo,
          productionOrderId: record.productionOrderId,
          productionOrderNo: record.productionOrderNo,
          materialSku: normalizeText(materialLine.materialSku),
          skuCode: normalizeText(scopeLine.skuCode),
          color: normalizeText(scopeLine.color),
          size: normalizeText(scopeLine.size),
          plannedQty: Number(scopeLine.plannedQty || 0),
          mergeBatchId: mergeIdentity.mergeBatchId,
          mergeBatchNo: mergeIdentity.mergeBatchNo,
        })
      })
  })

  return rows
}

export function buildPieceRequirementRows(
  record: CuttingOrderProgressRecord,
  requirements: ProductionSkuRequirementRef[],
  scopes: OriginalCutOrderSkuScopeRef[],
  techPackLink: ProductionResolvedTechPackLink,
): PieceRequirementRow[] {
  const rows: PieceRequirementRow[] = []
  const materialLineByKey = new Map(
    record.materialLines.map((materialLine) => [makeOriginalMaterialKey({
      originalCutOrderNo: getOriginalCutOrderIdentity(materialLine).originalCutOrderNo,
      materialSku: materialLine.materialSku,
    }), materialLine]),
  )

  scopes.forEach((scope) => {
    const requiredGarmentQty = Number(scope.plannedQty || 0)
    const materialLine =
      materialLineByKey.get(makeOriginalMaterialKey({
        originalCutOrderNo: scope.originalCutOrderNo,
        materialSku: scope.materialSku,
      })) || null

    const pushMissingRow = (
      mappingStatus: PieceTruthMappingStatus,
      options?: Partial<Pick<PieceRequirementRow, 'skuCode' | 'partCode' | 'partName' | 'pieceCountPerUnit' | 'patternId' | 'patternName'>>,
    ) => {
      const pieceCountPerUnit = Number(options?.pieceCountPerUnit || 0)
      rows.push({
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        originalCutOrderId: scope.originalCutOrderId,
        originalCutOrderNo: scope.originalCutOrderNo,
        mergeBatchId: scope.mergeBatchId,
        mergeBatchNo: scope.mergeBatchNo,
        materialSku: scope.materialSku,
        skuCode: options?.skuCode || scope.skuCode,
        color: scope.color,
        size: scope.size,
        partCode: options?.partCode || '',
        partName: options?.partName || '待确认',
        pieceCountPerUnit,
        requiredGarmentQty,
        requiredPieceQty: requiredGarmentQty * pieceCountPerUnit,
        mappingStatus,
        mappingStatusLabel: mappingStatusLabelMap[mappingStatus],
        techPackSpuCode: techPackLink.resolvedSpuCode,
        patternId: options?.patternId || '',
        patternName: options?.patternName || '',
      })
    }

    if (!techPackLink.techPack) {
      pushMissingRow('MISSING_TECH_PACK')
      return
    }

    const skuCode = resolveSkuCode(techPackLink.techPack, {
      skuCode: scope.skuCode,
      color: scope.color,
      size: scope.size,
      plannedQty: scope.plannedQty,
    })

    if (!skuCode) {
      pushMissingRow('MISSING_SKU')
      return
    }

    const colorMapping = resolveColorMapping(techPackLink.techPack, scope.color)
    if (!colorMapping) {
      pushMissingRow('MISSING_COLOR_MAPPING', { skuCode })
      return
    }

    const candidateLines = colorMapping.lines.filter(
      (line) =>
        line.materialType === '面料' &&
        (!(line.applicableSkuCodes || []).length || line.applicableSkuCodes?.includes(skuCode)),
    )

    if (!candidateLines.length) {
      pushMissingRow('MISSING_PIECE_MAPPING', { skuCode })
      return
    }

    const matchedMaterialLines = materialLine
      ? candidateLines.filter((line) => lineMatchesMaterial(line, materialLine.materialSku))
      : []
    const selectedLines = matchedMaterialLines.length ? matchedMaterialLines : candidateLines
    const mappingStatus: PieceTruthMappingStatus = matchedMaterialLines.length ? 'MATCHED' : 'MATERIAL_PENDING_CONFIRM'

    selectedLines.forEach((mappingLine) => {
      const pieceRows =
        mappingLine.pieceName && Number(mappingLine.pieceCountPerUnit || 0) > 0
          ? [
              {
                partCode: mappingLine.pieceId || '',
                partName: mappingLine.pieceName,
                pieceCountPerUnit: Number(mappingLine.pieceCountPerUnit || 0),
                patternId: mappingLine.patternId || '',
                patternName: mappingLine.patternName || '',
              },
            ]
          : buildPatternFallbackRows(techPackLink.techPack!, mappingLine, skuCode)

      if (!pieceRows.length) {
        pushMissingRow('MISSING_PIECE_MAPPING', {
          skuCode,
          patternId: mappingLine.patternId || '',
          patternName: mappingLine.patternName || '',
        })
        return
      }

      pieceRows.forEach((pieceRow) => {
        rows.push({
          productionOrderId: record.productionOrderId,
          productionOrderNo: record.productionOrderNo,
          originalCutOrderId: scope.originalCutOrderId,
          originalCutOrderNo: scope.originalCutOrderNo,
          mergeBatchId: scope.mergeBatchId,
          mergeBatchNo: scope.mergeBatchNo,
          materialSku: scope.materialSku,
          skuCode,
          color: scope.color,
          size: scope.size,
          partCode: pieceRow.partCode,
          partName: pieceRow.partName,
          pieceCountPerUnit: pieceRow.pieceCountPerUnit,
          requiredGarmentQty,
          requiredPieceQty: requiredGarmentQty * pieceRow.pieceCountPerUnit,
          mappingStatus,
          mappingStatusLabel: mappingStatusLabelMap[mappingStatus],
          techPackSpuCode: techPackLink.resolvedSpuCode,
          patternId: pieceRow.patternId,
          patternName: pieceRow.patternName,
        })
      })
    })
  })

  requirements.forEach((requirement) => {
    const scopedQty = scopes
      .filter((scope) => makeSkuKey(scope) === makeSkuKey(requirement))
      .reduce((sum, scope) => sum + Number(scope.plannedQty || 0), 0)
    if (scopedQty !== Number(requirement.plannedQty || 0)) {
      rows.push({
        productionOrderId: requirement.productionOrderId,
        productionOrderNo: requirement.productionOrderNo,
        originalCutOrderId: '',
        originalCutOrderNo: '',
        mergeBatchId: '',
        mergeBatchNo: '',
        materialSku: '',
        skuCode: requirement.skuCode,
        color: requirement.color,
        size: requirement.size,
        partCode: '',
        partName: '待补承接范围',
        pieceCountPerUnit: 0,
        requiredGarmentQty: Number(requirement.plannedQty || 0),
        requiredPieceQty: 0,
        mappingStatus: 'SKU_SCOPE_PENDING',
        mappingStatusLabel: mappingStatusLabelMap.SKU_SCOPE_PENDING,
        techPackSpuCode: requirement.techPackSpuCode,
        patternId: '',
        patternName: '',
      })
    }
  })

  return rows
}

export function buildPieceActualRows(
  record: CuttingOrderProgressRecord,
  requirementRows: PieceRequirementRow[],
  overlaySignals: PieceTruthOverlaySignal[] = [],
): PieceActualRow[] {
  const grouped = new Map<string, PieceActualRow>()

  record.materialLines.forEach((materialLine) => {
    const originalIdentity = getOriginalCutOrderIdentity(materialLine)
    const mergeIdentity = getMergeBatchIdentity(materialLine)
    ;(materialLine.pieceProgressLines || []).forEach((pieceLine) => {
      const key = makePieceKey({
        originalCutOrderNo: originalIdentity.originalCutOrderNo,
        materialSku: materialLine.materialSku,
        skuCode: pieceLine.skuCode,
        color: pieceLine.color,
        size: pieceLine.size,
        partCode: pieceLine.partCode || '',
        partName: pieceLine.partName,
      })
      const current = grouped.get(key)
      grouped.set(key, {
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        originalCutOrderId: originalIdentity.originalCutOrderId,
        originalCutOrderNo: originalIdentity.originalCutOrderNo,
        mergeBatchId: mergeIdentity.mergeBatchId,
        mergeBatchNo: mergeIdentity.mergeBatchNo,
        materialSku: normalizeText(materialLine.materialSku),
        skuCode: normalizeText(pieceLine.skuCode),
        color: normalizeText(pieceLine.color),
        size: normalizeText(pieceLine.size),
        partCode: normalizeText(pieceLine.partCode),
        partName: normalizeText(pieceLine.partName),
        actualCutQty: (current?.actualCutQty || 0) + Number(pieceLine.actualCutQty || 0),
        inboundQty: (current?.inboundQty || 0) + Number(pieceLine.inboundQty || 0),
        sourceType: 'PIECE_PROGRESS',
        latestUpdatedAt:
          [current?.latestUpdatedAt, pieceLine.latestUpdatedAt].filter(Boolean).sort().at(-1) || '',
        latestOperatorName: pieceLine.latestOperatorName || current?.latestOperatorName || '',
      })
    })
  })

  const overlayByOriginalMaterialSku = overlaySignals.reduce<Record<string, PieceTruthOverlaySignal[]>>((result, signal) => {
    const key = makeOriginalMaterialKey({
      originalCutOrderNo: signal.originalCutOrderNo,
      materialSku: signal.materialSku,
      skuCode: '',
      color: '',
      size: '',
    })
    result[key] = [...(result[key] || []), signal]
    return result
  }, {})

  requirementRows
    .filter((row) => row.originalCutOrderNo && row.materialSku)
    .forEach((row) => {
      const pieceKey = makePieceKey({
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
      })
      if (grouped.has(pieceKey)) return

      const overlayKey = makeOriginalMaterialKey({
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
      })
      const overlay = (overlayByOriginalMaterialSku[overlayKey] || [])
        .slice()
        .sort((left, right) => right.latestUpdatedAt.localeCompare(left.latestUpdatedAt, 'zh-CN'))[0]

      if (!overlay) return

      grouped.set(pieceKey, {
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        originalCutOrderId: row.originalCutOrderId,
        originalCutOrderNo: row.originalCutOrderNo,
        mergeBatchId: row.mergeBatchId,
        mergeBatchNo: row.mergeBatchNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
        actualCutQty: 0,
        inboundQty: 0,
        sourceType: 'OVERLAY_SIGNAL',
        latestUpdatedAt: overlay.latestUpdatedAt,
        latestOperatorName: overlay.latestOperatorName,
      })
    })

  return Array.from(grouped.values())
}

function buildGapStateRow(
  row: PieceRequirementRow,
  actual: PieceActualRow | undefined,
  record: CuttingOrderProgressRecord,
  materialLine: CuttingMaterialLine | undefined,
  overlaySignals: PieceTruthOverlaySignal[],
): { currentStateLabel: string; nextActionLabel: string } {
  if (row.mappingStatus !== 'MATCHED') {
    return {
      currentStateLabel: row.mappingStatusLabel,
      nextActionLabel: row.mappingStatus === 'SKU_SCOPE_PENDING' ? '去原始裁片单补承接范围' : '去原始裁片单补映射',
    }
  }

  const overlayKey = makeOriginalMaterialKey({
    originalCutOrderNo: row.originalCutOrderNo,
    materialSku: row.materialSku,
  })
  const relatedSignals = overlaySignals.filter(
    (signal) =>
      makeOriginalMaterialKey({
        originalCutOrderNo: signal.originalCutOrderNo,
        materialSku: signal.materialSku,
      }) === overlayKey,
  )
  const hasInboundSignal = relatedSignals.some((signal) => signal.sourceType === 'INBOUND')
  const hasHandoverSignal = relatedSignals.some((signal) => signal.sourceType === 'HANDOVER')
  const hasReplenishmentSignal = relatedSignals.some((signal) => signal.sourceType === 'REPLENISHMENT')
  const actualCutQty = Number(actual?.actualCutQty || 0)
  const inboundQty = Number(actual?.inboundQty || 0)
  const gapCutQty = Math.max(row.requiredPieceQty - actualCutQty, 0)
  const gapInboundQty = Math.max(row.requiredPieceQty - inboundQty, 0)

  if (gapCutQty > 0) {
    if (materialLine?.configStatus !== 'CONFIGURED' || materialLine?.receiveStatus !== 'RECEIVED') {
      return { currentStateLabel: '待配料 / 待领料', nextActionLabel: '去仓库配料领料' }
    }
    if (materialLine?.issueFlags.includes('REPLENISH_PENDING') || record.riskFlags.includes('REPLENISH_PENDING') || hasReplenishmentSignal) {
      return { currentStateLabel: '待补料', nextActionLabel: '去补料管理' }
    }
    if (!record.hasSpreadingRecord) {
      return { currentStateLabel: '待铺布', nextActionLabel: '去唛架铺布' }
    }
    return { currentStateLabel: '裁片未齐', nextActionLabel: '去唛架铺布' }
  }

  if (gapInboundQty > 0) {
    return { currentStateLabel: hasInboundSignal ? '入仓数据待补' : '裁完待入仓', nextActionLabel: '去裁片仓' }
  }

  if (hasHandoverSignal) {
    return { currentStateLabel: '已交接', nextActionLabel: '当前已齐套' }
  }

  return { currentStateLabel: '已齐套', nextActionLabel: '当前已齐套' }
}

export function buildPieceGapRows(
  record: CuttingOrderProgressRecord,
  requirementRows: PieceRequirementRow[],
  actualRows: PieceActualRow[],
  overlaySignals: PieceTruthOverlaySignal[] = [],
): PieceGapRow[] {
  const actualRowMap = new Map(
    actualRows.map((row) => [
      makePieceKey({
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
      }),
      row,
    ]),
  )
  const materialLineMap = new Map(
    record.materialLines.map((materialLine) => [
      makeOriginalMaterialKey({
        originalCutOrderNo: getOriginalCutOrderIdentity(materialLine).originalCutOrderNo,
        materialSku: materialLine.materialSku,
      }),
      materialLine,
    ]),
  )

  return requirementRows.map((row) => {
    const actual = actualRowMap.get(
      makePieceKey({
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
      }),
    )
    const materialLine =
      materialLineMap.get(
        makeOriginalMaterialKey({
          originalCutOrderNo: row.originalCutOrderNo,
          materialSku: row.materialSku,
        }),
      ) || undefined
    const actualCutQty = Number(actual?.actualCutQty || 0)
    const inboundQty = Number(actual?.inboundQty || 0)
    const gapCutQty = Math.max(row.requiredPieceQty - actualCutQty, 0)
    const gapInboundQty = Math.max(row.requiredPieceQty - inboundQty, 0)
    const state = buildGapStateRow(row, actual, record, materialLine, overlaySignals)

    return {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      mergeBatchId: row.mergeBatchId,
      mergeBatchNo: row.mergeBatchNo,
      materialSku: row.materialSku,
      skuCode: row.skuCode,
      color: row.color,
      size: row.size,
      partCode: row.partCode,
      partName: row.partName,
      requiredPieceQty: row.requiredPieceQty,
      actualCutQty,
      inboundQty,
      gapCutQty,
      gapInboundQty,
      mappingStatus: row.mappingStatus,
      mappingStatusLabel: row.mappingStatusLabel,
      currentStateLabel: state.currentStateLabel,
      nextActionLabel: state.nextActionLabel,
      latestUpdatedAt: actual?.latestUpdatedAt || '',
      latestOperatorName: actual?.latestOperatorName || '',
      pieceCountPerUnit: row.pieceCountPerUnit,
      requiredGarmentQty: row.requiredGarmentQty,
      techPackSpuCode: row.techPackSpuCode,
      patternId: row.patternId,
      patternName: row.patternName,
    }
  })
}

function buildSkuRows(gapRows: PieceGapRow[]): ProductionPieceTruthSkuRow[] {
  const grouped = new Map<
    string,
    ProductionPieceTruthSkuRow & { originalCutOrderNos: Set<string>; materialSkus: Set<string> }
  >()

  gapRows.forEach((row) => {
    const key = makeSkuKey(row)
    const current = grouped.get(key)
    const nextOriginalCutOrderNos = new Set([...(current?.originalCutOrderNos || []), row.originalCutOrderNo].filter(Boolean))
    const nextMaterialSkus = new Set([...(current?.materialSkus || []), row.materialSku].filter(Boolean))
    const mappingStatus =
      current?.mappingStatus && current.mappingStatus !== 'MATCHED' ? current.mappingStatus : row.mappingStatus
    const gapCutQty = (current?.gapCutQty || 0) + row.gapCutQty
    const gapInboundQty = (current?.gapInboundQty || 0) + row.gapInboundQty
    const currentStateLabel =
      mappingStatus !== 'MATCHED'
        ? row.mappingStatusLabel
        : gapCutQty > 0
          ? '未裁齐'
          : gapInboundQty > 0
            ? '待入仓'
            : '已齐套'
    const nextActionLabel =
      mappingStatus !== 'MATCHED'
        ? '去原始裁片单补映射'
        : gapCutQty > 0
          ? row.nextActionLabel
          : gapInboundQty > 0
            ? '去裁片仓'
            : '当前已齐套'

    grouped.set(key, {
      skuCode: row.skuCode,
      color: row.color,
      size: row.size,
      requiredGarmentQty: (current?.requiredGarmentQty || 0) + row.requiredGarmentQty,
      requiredPieceQty: (current?.requiredPieceQty || 0) + row.requiredPieceQty,
      actualCutQty: (current?.actualCutQty || 0) + row.actualCutQty,
      inboundQty: (current?.inboundQty || 0) + row.inboundQty,
      gapCutQty,
      gapInboundQty,
      originalCutOrderCount: nextOriginalCutOrderNos.size,
      materialCount: nextMaterialSkus.size,
      mappingStatus,
      mappingStatusLabel: mappingStatusLabelMap[mappingStatus],
      currentStateLabel,
      nextActionLabel,
      originalCutOrderNos: nextOriginalCutOrderNos,
      materialSkus: nextMaterialSkus,
    })
  })

  return Array.from(grouped.values()).map(({ originalCutOrderNos, materialSkus, ...row }) => row)
}

function buildOriginalCutOrderRows(gapRows: PieceGapRow[]): ProductionPieceTruthOriginalCutOrderRow[] {
  const grouped = new Map<string, ProductionPieceTruthOriginalCutOrderRow & { skuKeys: Set<string> }>()

  gapRows.forEach((row) => {
    if (!row.originalCutOrderNo) return
    const key = `${row.originalCutOrderNo}::${row.materialSku}`
    const current = grouped.get(key)
    const gapPartCount = (current?.gapPartCount || 0) + (row.gapCutQty > 0 || row.gapInboundQty > 0 || row.mappingStatus !== 'MATCHED' ? 1 : 0)
    const gapCutQty = (current?.gapCutQty || 0) + row.gapCutQty
    const gapInboundQty = (current?.gapInboundQty || 0) + row.gapInboundQty
    const currentStateLabel =
      row.mappingStatus !== 'MATCHED'
        ? row.mappingStatusLabel
        : gapCutQty > 0
          ? '未裁齐'
          : gapInboundQty > 0
            ? '待入仓'
            : '已齐套'
    const nextActionLabel =
      row.mappingStatus !== 'MATCHED'
        ? '去原始裁片单补映射'
        : gapCutQty > 0
          ? row.nextActionLabel
          : gapInboundQty > 0
            ? '去裁片仓'
            : '当前已齐套'

    const nextSkuKeys = new Set([...(current?.skuKeys || []), row.skuCode || `${row.color}/${row.size}`].filter(Boolean))

    grouped.set(key, {
      originalCutOrderId: row.originalCutOrderId,
      originalCutOrderNo: row.originalCutOrderNo,
      mergeBatchId: row.mergeBatchId,
      mergeBatchNo: row.mergeBatchNo,
      materialSku: row.materialSku,
      skuCount: nextSkuKeys.size,
      gapPartCount,
      gapCutQty,
      gapInboundQty,
      currentStateLabel,
      nextActionLabel,
      skuKeys: nextSkuKeys,
    })
  })

  return Array.from(grouped.values())
    .map(({ skuKeys, ...row }) => row)
    .sort((left, right) => left.originalCutOrderNo.localeCompare(right.originalCutOrderNo, 'zh-CN'))
}

function buildMaterialRows(gapRows: PieceGapRow[]): ProductionPieceTruthMaterialRow[] {
  const grouped = new Map<
    string,
    ProductionPieceTruthMaterialRow & { originalCutOrderNos: Set<string>; skuKeys: Set<string> }
  >()

  gapRows.forEach((row) => {
    const key = row.materialSku || `${row.originalCutOrderNo}-unknown-material`
    const current = grouped.get(key)
    const gapPartCount = (current?.gapPartCount || 0) + (row.gapCutQty > 0 || row.gapInboundQty > 0 || row.mappingStatus !== 'MATCHED' ? 1 : 0)
    const gapCutQty = (current?.gapCutQty || 0) + row.gapCutQty
    const gapInboundQty = (current?.gapInboundQty || 0) + row.gapInboundQty
    const currentStateLabel =
      row.mappingStatus !== 'MATCHED'
        ? row.mappingStatusLabel
        : gapCutQty > 0
          ? '未裁齐'
          : gapInboundQty > 0
            ? '待入仓'
            : '已齐套'
    const nextActionLabel =
      row.mappingStatus !== 'MATCHED'
        ? '去原始裁片单补映射'
        : gapCutQty > 0
          ? row.nextActionLabel
          : gapInboundQty > 0
            ? '去裁片仓'
            : '当前已齐套'

    const nextOriginalCutOrderNos = new Set([...(current?.originalCutOrderNos || []), row.originalCutOrderNo].filter(Boolean))
    const nextSkuKeys = new Set([...(current?.skuKeys || []), row.skuCode || `${row.color}/${row.size}`].filter(Boolean))

    grouped.set(key, {
      materialSku: row.materialSku || '待补面料 SKU',
      originalCutOrderCount: nextOriginalCutOrderNos.size,
      skuCount: nextSkuKeys.size,
      gapPartCount,
      gapCutQty,
      gapInboundQty,
      currentStateLabel,
      nextActionLabel,
      originalCutOrderNos: nextOriginalCutOrderNos,
      skuKeys: nextSkuKeys,
    })
  })

  return Array.from(grouped.values())
    .map(({ originalCutOrderNos, skuKeys, ...row }) => row)
    .sort((left, right) => left.materialSku.localeCompare(right.materialSku, 'zh-CN'))
}

export function buildProductionPieceTruthCompletion(
  result: Pick<ProductionPieceTruthResult, 'counts' | 'mappingIssues' | 'dataIssues' | 'gapRows'>,
  options: ProductionPieceTruthCompletionOptions = {},
): ProductionPieceTruthCompletionMeta {
  if (result.dataIssues.length > 0 || options.hasObjectDataPending) {
    const meta = productionPieceTruthCompletionMetaMap.DATA_PENDING
    return {
      key: 'DATA_PENDING',
      label: meta.label,
      className: meta.className,
      detailText:
        options.objectDataPendingReason ||
        result.dataIssues[0]?.message ||
        `数据待补 ${result.dataIssues.length} 项`,
    }
  }

  if (result.mappingIssues.length > 0) {
    const meta = productionPieceTruthCompletionMetaMap.DATA_PENDING
    return {
      key: 'DATA_PENDING',
      label: meta.label,
      className: meta.className,
      detailText: result.mappingIssues[0]?.message || `映射缺失 ${result.mappingIssues.length} 项`,
    }
  }

  if (options.hasObjectException) {
    const meta = productionPieceTruthCompletionMetaMap.HAS_EXCEPTION
    return {
      key: 'HAS_EXCEPTION',
      label: meta.label,
      className: meta.className,
      detailText: options.objectExceptionReason || '当前存在异常对象，暂不可判完成。',
    }
  }

  if (
    result.counts.gapCutQtyTotal > 0 ||
    result.counts.gapInboundQtyTotal > 0 ||
    result.counts.pendingSkuCount > 0 ||
    options.hasObjectPending
  ) {
    const meta = productionPieceTruthCompletionMetaMap.IN_PROGRESS
    const detailText =
      options.objectPendingReason ||
      (result.counts.gapCutQtyTotal > 0
        ? `仍缺裁片 ${result.counts.gapCutQtyTotal} 片`
        : result.counts.gapInboundQtyTotal > 0
          ? `待入仓 ${result.counts.gapInboundQtyTotal} 片`
          : `未完成 SKU ${result.counts.pendingSkuCount} 个`)
    return {
      key: 'IN_PROGRESS',
      label: meta.label,
      className: meta.className,
      detailText,
    }
  }

  const meta = productionPieceTruthCompletionMetaMap.COMPLETED
  return {
    key: 'COMPLETED',
    label: meta.label,
    className: meta.className,
    detailText: 'SKU 与部位已齐套，当前可判完成。',
  }
}

function buildNextActionLabel(result: {
  mappingIssues: ProductionPieceTruthIssue[]
  dataIssues: ProductionPieceTruthIssue[]
  gapRows: PieceGapRow[]
  counts: ProductionPieceTruthCounts
}): string {
  if (result.mappingIssues.length > 0) return '去原始裁片单补映射'
  if (result.dataIssues.length > 0) return '去生产单进度补数据'

  const priorityRow =
    result.gapRows.find((row) => row.mappingStatus !== 'MATCHED') ||
    result.gapRows.find((row) => row.gapCutQty > 0) ||
    result.gapRows.find((row) => row.gapInboundQty > 0) ||
    null

  if (priorityRow) return priorityRow.nextActionLabel
  if (result.counts.pendingSkuCount > 0) return '继续处理'
  return '当前已齐套'
}

export function buildProductionPieceTruth(
  record: CuttingOrderProgressRecord,
  options: {
    overlaySignals?: PieceTruthOverlaySignal[]
    completionOptions?: ProductionPieceTruthCompletionOptions
  } = {},
): ProductionPieceTruthResult {
  const overlaySignals = options.overlaySignals || []
  const techPackLink = resolveTechPackForProduction(record)
  const requirements = buildProductionSkuRequirements(record)
  const scopes = buildOriginalCutOrderSkuScopes(record)
  const requirementRows = buildPieceRequirementRows(record, requirements, scopes, techPackLink)
  const actualRows = buildPieceActualRows(record, requirementRows, overlaySignals)
  const gapRows = buildPieceGapRows(record, requirementRows, actualRows, overlaySignals)
  const mappingIssues: ProductionPieceTruthIssue[] = []
  const dataIssues: ProductionPieceTruthIssue[] = []

  if (!requirements.length) {
    pushIssue(dataIssues, {
      issueType: 'DATA_PENDING',
      message: '当前生产单缺少 SKU 需求行，无法判断理论应有量。',
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
    })
  }

  if (techPackLink.status === 'MISSING') {
    pushIssue(mappingIssues, {
      issueType: 'MAPPING_MISSING',
      message: '当前生产单未关联技术包，无法构建部位定义。',
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
    })
  }

  requirements.forEach((requirement) => {
    const scopedRows = scopes.filter((scope) => makeSkuKey(scope) === makeSkuKey(requirement))
    const scopedQty = scopedRows.reduce((sum, scope) => sum + Number(scope.plannedQty || 0), 0)
    if (!scopedRows.length || scopedQty !== Number(requirement.plannedQty || 0)) {
      pushIssue(dataIssues, {
        issueType: 'DATA_PENDING',
        message: `${requirement.color}/${requirement.size} 的裁片单承接范围待补齐：需求 ${requirement.plannedQty}，当前承接 ${scopedQty}`,
        productionOrderId: requirement.productionOrderId,
        productionOrderNo: requirement.productionOrderNo,
        skuCode: requirement.skuCode,
        color: requirement.color,
        size: requirement.size,
      })
    }
  })

  requirementRows
    .filter((row) => row.mappingStatus !== 'MATCHED')
    .forEach((row) => {
      pushIssue(mappingIssues, {
        issueType: 'MAPPING_MISSING',
        message: `${row.originalCutOrderNo || '未定位裁片单'} · ${row.color}/${row.size} · ${row.partName}：${row.mappingStatusLabel}`,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        originalCutOrderId: row.originalCutOrderId,
        originalCutOrderNo: row.originalCutOrderNo,
        mergeBatchId: row.mergeBatchId,
        mergeBatchNo: row.mergeBatchNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
      })
    })

  const actualRowKeys = new Set(
    actualRows.map((row) =>
      makePieceKey({
        originalCutOrderNo: row.originalCutOrderNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
      }),
    ),
  )

  gapRows.forEach((row) => {
    const actualKey = makePieceKey({
      originalCutOrderNo: row.originalCutOrderNo,
      materialSku: row.materialSku,
      skuCode: row.skuCode,
      color: row.color,
      size: row.size,
      partCode: row.partCode,
      partName: row.partName,
    })
    const overlayExists = overlaySignals.some(
      (signal) =>
        signal.originalCutOrderNo === row.originalCutOrderNo &&
        signal.materialSku === row.materialSku,
    )
    if (!actualRowKeys.has(actualKey) && (record.hasSpreadingRecord || record.hasInboundRecord || overlayExists)) {
      pushIssue(dataIssues, {
        issueType: 'DATA_PENDING',
        message: `${row.originalCutOrderNo} · ${row.partName} 缺少部位进度，当前无法判断真实产出。`,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        originalCutOrderId: row.originalCutOrderId,
        originalCutOrderNo: row.originalCutOrderNo,
        mergeBatchId: row.mergeBatchId,
        mergeBatchNo: row.mergeBatchNo,
        materialSku: row.materialSku,
        skuCode: row.skuCode,
        color: row.color,
        size: row.size,
        partCode: row.partCode,
        partName: row.partName,
      })
    }
  })

  record.materialLines.forEach((materialLine) => {
    const originalIdentity = getOriginalCutOrderIdentity(materialLine)
    const mergeIdentity = getMergeBatchIdentity(materialLine)
    if (mergeIdentity.mergeBatchNo && !mergeIdentity.mergeBatchId) {
      pushIssue(dataIssues, {
        issueType: 'DATA_PENDING',
        message: `${originalIdentity.originalCutOrderNo} 已挂合并批次号 ${mergeIdentity.mergeBatchNo}，但缺少 mergeBatchId。`,
        productionOrderId: record.productionOrderId,
        productionOrderNo: record.productionOrderNo,
        originalCutOrderId: originalIdentity.originalCutOrderId,
        originalCutOrderNo: originalIdentity.originalCutOrderNo,
        mergeBatchNo: mergeIdentity.mergeBatchNo,
        materialSku: materialLine.materialSku,
      })
    }
  })

  const skuRows = buildSkuRows(gapRows)
  const originalCutOrderRows = buildOriginalCutOrderRows(gapRows)
  const materialRows = buildMaterialRows(gapRows)
  const counts: ProductionPieceTruthCounts = {
    skuTotalCount: skuRows.length,
    completedSkuCount: skuRows.filter((row) => row.mappingStatus === 'MATCHED' && row.gapCutQty === 0 && row.gapInboundQty === 0).length,
    pendingSkuCount: skuRows.filter((row) => row.mappingStatus !== 'MATCHED' || row.gapCutQty > 0 || row.gapInboundQty > 0).length,
    incompletePartCount: gapRows.filter((row) => row.mappingStatus !== 'MATCHED' || row.gapCutQty > 0 || row.gapInboundQty > 0).length,
    affectedMaterialCount: materialRows.filter((row) => row.gapPartCount > 0).length,
    originalCutOrderCount: originalCutOrderRows.length,
    mappingIssueCount: mappingIssues.length,
    dataIssueCount: dataIssues.length,
    requiredPieceQtyTotal: gapRows.reduce((sum, row) => sum + row.requiredPieceQty, 0),
    actualCutQtyTotal: gapRows.reduce((sum, row) => sum + row.actualCutQty, 0),
    inboundQtyTotal: gapRows.reduce((sum, row) => sum + row.inboundQty, 0),
    gapCutQtyTotal: gapRows.reduce((sum, row) => sum + row.gapCutQty, 0),
    gapInboundQtyTotal: gapRows.reduce((sum, row) => sum + row.gapInboundQty, 0),
  }

  const provisionalResult = {
    productionOrderId: record.productionOrderId,
    productionOrderNo: record.productionOrderNo,
    requirementRows,
    actualRows,
    gapRows,
    skuRows,
    originalCutOrderRows,
    materialRows,
    mappingIssues,
    dataIssues,
    counts,
  }

  const completionMeta = buildProductionPieceTruthCompletion(provisionalResult, options.completionOptions)

  return {
    ...provisionalResult,
    completionState: completionMeta.key,
    completionLabel: completionMeta.label,
    completionClassName: completionMeta.className,
    completionDetailText: completionMeta.detailText,
    nextActionLabel: buildNextActionLabel(provisionalResult),
    techPackLink,
  }
}
