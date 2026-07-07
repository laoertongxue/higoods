import {
  productionOrders,
  getProductionOrderTechPackSnapshot,
  type ProductionOrder,
} from '../production-orders.ts'
import {
  resolveProductionOrderTaskBoundary,
  shouldGenerateCutOrderForProductionOrder,
} from '../task-generation-boundaries.ts'
import type { TechnicalBomItem, TechnicalColorMaterialMappingLine } from '../../pcs-technical-data-version-types.ts'
import type { ProductionOrderTechPackSnapshot, TechPackBomItemSnapshot } from '../production-tech-pack-snapshot-types.ts'
import {
  resolveCuttingTaskLink,
  type CuttingTaskAssigneeType,
  type CuttingTaskExecutionRoute,
} from './cutting-task-routing.ts'
import type { CuttingMaterialIdentity, CuttingMaterialType, CuttingPatternIdentity } from './types.ts'

export interface GeneratedCutOrderPieceRow {
  partCode: string
  partName: string
  pieceCountPerUnit: number
  patternId: string
  patternName: string
  applicableSkuCodes: string[]
}

export interface GeneratedCutOrderSkuScopeLine {
  skuCode: string
  color: string
  size: string
  plannedQty: number
}

export interface GeneratedCutOrderSourceRecord {
  cutOrderId: string
  cutOrderNo: string
  generationKey: string
  productionOrderId: string
  productionOrderNo: string
  cuttingTaskId: string
  cuttingTaskNo: string
  cuttingTaskAssignmentStatus: string
  cuttingTaskAssigneeFactoryId: string
  cuttingTaskAssigneeFactoryName: string
  cuttingTaskAssigneeType: CuttingTaskAssigneeType
  executionRoute: CuttingTaskExecutionRoute
  executionRouteLabel: string
  spuCode: string
  styleId: string
  styleCode: string
  styleName: string
  techPackVersionId: string
  techPackVersionLabel: string
  materialSku: string
  materialName: string
  materialColor: string
  materialType: CuttingMaterialType
  materialLabel: string
  materialCategory: string
  materialAlias: string
  materialImageUrl: string
  materialUnit: string
  materialIdentity: CuttingMaterialIdentity
  patternIdentity: CuttingPatternIdentity
  markerPlanId: string
  markerPlanNo: string
  requiredQty: number
  sourceTechPackSpuCode: string
  colorScope: string[]
  skuScopeLines: GeneratedCutOrderSkuScopeLine[]
  pieceRows: GeneratedCutOrderPieceRow[]
  pieceSummary: string
  cutOrderSourceType: 'INDEPENDENT_CUTTING_TASK' | 'CONTINUOUS_WITH_CUTTING_TASK'
  cutOrderSourceLabel: string
  cutReturnMode: 'RETURN_TO_OWN_CUTTING_WAREHOUSE' | 'THIRD_PARTY_REPORT_ONLY'
  cutReturnModeLabel: string
  internalCraftOrderPolicy: 'GENERATE_AFTER_RETURN' | 'DO_NOT_GENERATE'
  internalCraftOrderPolicyLabel: string
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function slugToken(value: string | number | null | undefined): string {
  return normalizeText(String(value ?? ''))
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function makeSkuKey(line: { skuCode: string; color: string; size: string }): string {
  return [normalizeText(line.skuCode), normalizeText(line.color), normalizeText(line.size)].join('::')
}

function toCuttingMaterialType(materialType: string): CuttingMaterialType {
  if (materialType.includes('辅')) return 'LINING'
  if (materialType.includes('印')) return 'PRINT'
  if (materialType.includes('染')) return 'DYE'
  return 'SOLID'
}

function toMaterialCategory(materialType: CuttingMaterialType): string {
  if (materialType === 'PRINT') return '主料'
  if (materialType === 'DYE') return '主料'
  if (materialType === 'LINING') return '里辅料'
  return '主料'
}

function findBomItem(techPack: ProductionOrderTechPackSnapshot, line: TechnicalColorMaterialMappingLine): TechPackBomItemSnapshot | null {
  if (line.bomItemId) {
    const byId = techPack.bomItems.find((item) => item.id === line.bomItemId)
    if (byId) return byId
  }
  if (line.materialName) {
    const byName = techPack.bomItems.find((item) => normalizeText(item.name) === normalizeText(line.materialName))
    if (byName) return byName
  }
  return null
}

function resolveMaterialSku(techPack: ProductionOrderTechPackSnapshot, line: TechnicalColorMaterialMappingLine, bomItem: TechnicalBomItem | null): string {
  return normalizeText(line.materialCode) || normalizeText(bomItem?.id) || normalizeText(line.materialName)
}

function findLinkedPatternFiles(
  techPack: ProductionOrderTechPackSnapshot,
  line: TechnicalColorMaterialMappingLine,
  bomItem: TechPackBomItemSnapshot | null,
  materialSku: string,
) {
  const normalizedSku = normalizeText(materialSku).toLowerCase()
  const normalizedName = normalizeText(line.materialName || bomItem?.name).toLowerCase()
  return techPack.patternFiles.filter((pattern) => {
    const linkedSku = normalizeText(pattern.linkedMaterialSku).toLowerCase()
    const linkedName = normalizeText(pattern.linkedMaterialName).toLowerCase()
    return (
      pattern.linkedBomItemId === bomItem?.id
      || pattern.linkedMaterialId === bomItem?.id
      || pattern.id === line.patternId
      || (Boolean(normalizedSku) && linkedSku === normalizedSku)
      || (Boolean(normalizedName) && linkedName === normalizedName)
    )
  })
}

function resolveMaterialAlias(
  techPack: ProductionOrderTechPackSnapshot,
  line: TechnicalColorMaterialMappingLine,
  bomItem: TechPackBomItemSnapshot | null,
  materialSku: string,
): string {
  return unique([
    normalizeText(bomItem?.materialAlias),
    ...findLinkedPatternFiles(techPack, line, bomItem, materialSku).map((pattern) => normalizeText(pattern.linkedMaterialAlias)),
    normalizeText(bomItem?.name),
  ].filter(Boolean)).join(' / ')
}

function resolveMaterialImageUrl(
  techPack: ProductionOrderTechPackSnapshot,
  line: TechnicalColorMaterialMappingLine,
  bomItem: TechPackBomItemSnapshot | null,
  materialSku: string,
): string {
  return (
    normalizeText(bomItem?.materialImageUrl)
    || findLinkedPatternFiles(techPack, line, bomItem, materialSku)
      .map((pattern) => normalizeText(pattern.imageUrl))
      .find(Boolean)
    || techPack.imageSnapshot.materialImages[0]
    || ''
  )
}

function resolvePieceRows(
  techPack: ProductionOrderTechPackSnapshot,
  line: TechnicalColorMaterialMappingLine,
  skuCode: string,
): GeneratedCutOrderPieceRow[] {
  const partName = normalizeText(line.pieceName)
  const partCode = normalizeText(line.pieceId) || partName
  const pieceCountPerUnit = Number(line.pieceCountPerUnit || 0)
  if (partName && pieceCountPerUnit > 0) {
    return [
      {
        partCode,
        partName,
        pieceCountPerUnit,
        patternId: normalizeText(line.patternId),
        patternName: normalizeText(line.patternName),
        applicableSkuCodes: normalizeText(skuCode) ? [normalizeText(skuCode)] : [],
      },
    ]
  }

  const patternId = normalizeText(line.patternId)
  if (!patternId) return []
  const patternFile = techPack.patternFiles.find((item) => item.id === patternId)
  if (!patternFile?.pieceRows?.length) return []

  return patternFile.pieceRows
    .filter((pieceRow) => !(pieceRow.applicableSkuCodes || []).length || (skuCode && pieceRow.applicableSkuCodes?.includes(skuCode)))
    .map((pieceRow) => ({
      partCode: normalizeText(pieceRow.id) || normalizeText(pieceRow.name),
      partName: normalizeText(pieceRow.name),
      pieceCountPerUnit: Number(pieceRow.count || 0),
      patternId,
      patternName: normalizeText(line.patternName) || normalizeText(patternFile.fileName),
      applicableSkuCodes: [...(pieceRow.applicableSkuCodes || [])],
    }))
    .filter((pieceRow) => pieceRow.partName && pieceRow.pieceCountPerUnit > 0)
}

function resolvePatternKind(patternFile: ProductionOrderTechPackSnapshot['patternFiles'][number] | undefined): string {
  return normalizeText(patternFile?.patternMaterialTypeLabel) || '布料纸样'
}

function resolveEffectiveWidthValue(
  patternFile: ProductionOrderTechPackSnapshot['patternFiles'][number] | undefined,
  materialSku: string,
  materialType: CuttingMaterialType,
): number {
  const patternWidth = Number(patternFile?.widthCm || 0)
  if (patternWidth > 0) return patternWidth
  if (materialType === 'LINING') return 92
  const sku = materialSku.toLowerCase()
  if (sku.includes('khaki') || sku.includes('canvas') || sku.includes('navy')) return 145
  return 150
}

function resolvePatternIdentity(
  techPack: ProductionOrderTechPackSnapshot,
  line: TechnicalColorMaterialMappingLine,
  bomItem: TechPackBomItemSnapshot | null,
  materialSku: string,
  materialType: CuttingMaterialType,
  pieceRows: GeneratedCutOrderPieceRow[],
): CuttingPatternIdentity {
  const linkedPatternFiles = findLinkedPatternFiles(techPack, line, bomItem, materialSku)
  const patternFile =
    (line.patternId ? techPack.patternFiles.find((item) => item.id === line.patternId || item.patternFileId === line.patternId) : undefined)
    || linkedPatternFiles[0]
    || techPack.patternFiles[0]
  const patternFileId =
    normalizeText(line.patternId)
    || normalizeText(patternFile?.patternFileId)
    || normalizeText(patternFile?.id)
    || `pattern-${slugToken(line.patternName || materialSku)}`
  const patternFileName =
    normalizeText(line.patternName)
    || normalizeText(patternFile?.patternFileName)
    || normalizeText(patternFile?.fileName)
    || `${patternFileId}.dxf`
  const piecePartCodes = unique(pieceRows.map((row) => row.partCode).filter(Boolean))
  const piecePartNames = unique(pieceRows.map((row) => row.partName).filter(Boolean))

  return {
    patternFileId,
    patternFileName,
    patternVersion: normalizeText(patternFile?.patternVersion) || normalizeText(techPack.sourceTechPackVersionLabel) || 'v1.0',
    patternKind: resolvePatternKind(patternFile),
    effectiveWidthValue: resolveEffectiveWidthValue(patternFile, materialSku, materialType),
    effectiveWidthUnit: 'cm',
    piecePartCodes,
    piecePartNames,
  }
}

function buildGenerationKey(input: {
  productionOrderId: string
  spuCode: string
  styleId: string
  styleCode: string
  styleName: string
  techPackVersionId: string
  materialIdentity: CuttingMaterialIdentity
  patternIdentity: CuttingPatternIdentity
}): string {
  return [
    input.productionOrderId,
    input.spuCode,
    input.styleId,
    input.styleCode,
    input.styleName,
    input.techPackVersionId,
    input.materialIdentity.materialSku,
    input.materialIdentity.materialName,
    input.materialIdentity.materialColor,
    input.materialIdentity.materialAlias,
    input.materialIdentity.materialUnit,
    input.patternIdentity.patternFileId,
    input.patternIdentity.patternFileName,
    input.patternIdentity.patternVersion,
    input.patternIdentity.patternKind,
    input.patternIdentity.effectiveWidthValue,
    input.patternIdentity.effectiveWidthUnit,
  ]
    .map((value) => normalizeText(String(value)).toLowerCase())
    .join('::')
}

function makeStableCutOrderId(input: {
  productionOrderNo: string
  materialIdentity: CuttingMaterialIdentity
  patternIdentity: CuttingPatternIdentity
}): string {
  return [
    'cut-order',
    slugToken(input.productionOrderNo),
    slugToken(input.materialIdentity.materialSku),
    slugToken(input.patternIdentity.patternFileId),
    slugToken(input.patternIdentity.patternVersion),
    slugToken(`${input.patternIdentity.effectiveWidthValue}${input.patternIdentity.effectiveWidthUnit}`),
  ]
    .filter(Boolean)
    .join(':')
}

function makeCutOrderNo(order: ProductionOrder, index: number): string {
  const normalizedDate = order.createdAt.slice(2, 10).replace(/-/g, '')
  const orderSuffix = order.productionOrderId.replace(/\D/g, '').slice(-3).padStart(3, '0')
  return `CUT-${normalizedDate}-${orderSuffix}-${String(index + 1).padStart(2, '0')}`
}

function resolveProductionOrderNo(order: ProductionOrder): string {
  return normalizeText(order.productionOrderNo) || normalizeText(order.productionOrderId)
}

export function hasFormalTechPackForCutting(order: ProductionOrder): boolean {
  const snapshot = order.techPackSnapshot
  if (!snapshot) return false
  if (snapshot.status !== 'RELEASED') return false
  if (!normalizeText(snapshot.sourcePublishedAt)) return false
  if (normalizeText(snapshot.sourceTechPackVersionLabel).includes('草稿')) return false
  return true
}

export function listCuttingProductionOrdersWithFormalTechPack(): ProductionOrder[] {
  const formalOrders = productionOrders.filter((order) =>
    hasFormalTechPackForCutting(order) && shouldGenerateCutOrderForProductionOrder(order),
  )
  const joggerOrders = formalOrders.filter((order) => order.demandSnapshot.spuCode === 'SPU-2024-010')
  const otherOrders = formalOrders.filter((order) => order.demandSnapshot.spuCode !== 'SPU-2024-010')
  return [...joggerOrders, ...otherOrders]
}

function buildSkuScopeLines(order: ProductionOrder): GeneratedCutOrderSkuScopeLine[] {
  return order.demandSnapshot.skuLines.map((line) => ({
    skuCode: normalizeText(line.skuCode),
    color: normalizeText(line.color),
    size: normalizeText(line.size),
    plannedQty: Number(line.qty || 0),
  }))
}

function buildRecordsForOrder(order: ProductionOrder): GeneratedCutOrderSourceRecord[] {
  const boundary = resolveProductionOrderTaskBoundary(order)
  if (!shouldGenerateCutOrderForProductionOrder(order)) return []

  const techPack = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!techPack) return []

  const scopeByMaterialKey = new Map<
    string,
    {
      generationKey: string
      materialSku: string
      materialName: string
      materialColor: string
      materialType: CuttingMaterialType
      materialLabel: string
      materialUnit: string
      materialAlias: string
      materialImageUrl: string
      materialIdentity: CuttingMaterialIdentity
      patternIdentity: CuttingPatternIdentity
      scopeBySkuKey: Map<string, GeneratedCutOrderSkuScopeLine>
      pieceRows: GeneratedCutOrderPieceRow[]
      colors: Set<string>
    }
  >()
  const orderedMaterialKeys: string[] = []

  for (const skuLine of order.demandSnapshot.skuLines) {
    const colorMappings = (techPack.colorMaterialMappings || []).filter(
      (mapping) =>
        normalizeText(mapping.colorName).toLowerCase() === normalizeText(skuLine.color).toLowerCase()
        || normalizeText(mapping.colorCode).toLowerCase() === normalizeText(skuLine.color).toLowerCase(),
    )

    for (const colorMapping of colorMappings) {
      for (const mappingLine of colorMapping.lines) {
        const applicableSkuCodes = mappingLine.applicableSkuCodes || []
        if (applicableSkuCodes.length > 0 && !applicableSkuCodes.includes(skuLine.skuCode)) continue

        const bomItem = findBomItem(techPack, mappingLine)
        const materialSku = resolveMaterialSku(techPack, mappingLine, bomItem)
        if (!materialSku) continue
        const materialType = toCuttingMaterialType(mappingLine.materialType)
        const materialName = normalizeText(mappingLine.materialName) || materialSku
        const materialColor = normalizeText(skuLine.color) || '待补颜色'
        const materialUnit = normalizeText(mappingLine.unit) || '米'
        const materialAlias = resolveMaterialAlias(techPack, mappingLine, bomItem, materialSku)
        const materialImageUrl = resolveMaterialImageUrl(techPack, mappingLine, bomItem, materialSku)
        const pieceRows = resolvePieceRows(techPack, mappingLine, skuLine.skuCode)
        const materialIdentity: CuttingMaterialIdentity = {
          materialSku,
          materialName,
          materialColor,
          materialAlias: materialAlias || materialName,
          materialImageUrl,
          materialUnit,
        }
        const patternIdentity = resolvePatternIdentity(techPack, mappingLine, bomItem, materialSku, materialType, pieceRows)
        const generationKey = buildGenerationKey({
          productionOrderId: order.productionOrderId,
          spuCode: order.demandSnapshot.spuCode,
          styleId: normalizeText(techPack.styleId),
          styleCode: normalizeText(techPack.styleCode) || order.demandSnapshot.spuCode,
          styleName: normalizeText(techPack.styleName) || order.demandSnapshot.spuName,
          techPackVersionId: normalizeText(techPack.sourceTechPackVersionId) || normalizeText(techPack.versionLabel),
          materialIdentity,
          patternIdentity,
        })

        const materialKey = generationKey
        if (!scopeByMaterialKey.has(materialKey)) {
          orderedMaterialKeys.push(materialKey)
          scopeByMaterialKey.set(materialKey, {
            generationKey,
            materialSku,
            materialName,
            materialColor,
            materialType,
            materialLabel: materialName,
            materialUnit,
            materialAlias: materialIdentity.materialAlias,
            materialImageUrl,
            materialIdentity,
            patternIdentity,
            scopeBySkuKey: new Map(),
            pieceRows: [],
            colors: new Set<string>(),
          })
        }

        const bucket = scopeByMaterialKey.get(materialKey)!
        bucket.colors.add(normalizeText(skuLine.color))
        const skuKey = makeSkuKey(skuLine)
        const currentScope = bucket.scopeBySkuKey.get(skuKey)
        if (currentScope) {
          currentScope.plannedQty += Number(skuLine.qty || 0)
        } else {
          bucket.scopeBySkuKey.set(skuKey, {
            skuCode: normalizeText(skuLine.skuCode),
            color: normalizeText(skuLine.color),
            size: normalizeText(skuLine.size),
            plannedQty: Number(skuLine.qty || 0),
          })
        }

        pieceRows.forEach((pieceRow) => {
          const existing = bucket.pieceRows.find(
            (item) =>
              item.partCode === pieceRow.partCode
              && item.patternId === pieceRow.patternId
              && item.partName === pieceRow.partName,
          )
          if (existing) {
            existing.applicableSkuCodes = unique([...existing.applicableSkuCodes, ...pieceRow.applicableSkuCodes])
            if (!existing.pieceCountPerUnit && pieceRow.pieceCountPerUnit) {
              existing.pieceCountPerUnit = pieceRow.pieceCountPerUnit
            }
            return
          }
          bucket.pieceRows.push(pieceRow)
        })
      }
    }
  }

  return orderedMaterialKeys.map((materialKey, index) => {
    const bucket = scopeByMaterialKey.get(materialKey)!
    const skuScopeLines = Array.from(bucket.scopeBySkuKey.values())
    if (bucket.pieceRows.length === 0) return null
    const resolvedPieceRows = bucket.pieceRows.map((item) => ({
        ...item,
        applicableSkuCodes: [...item.applicableSkuCodes],
      }))
    const patternIdentity: CuttingPatternIdentity = {
      ...bucket.patternIdentity,
      piecePartCodes: unique(resolvedPieceRows.map((row) => row.partCode).filter(Boolean)),
      piecePartNames: unique(resolvedPieceRows.map((row) => row.partName).filter(Boolean)),
    }
    const requiredQty = skuScopeLines.reduce((sum, item) => sum + item.plannedQty, 0)
    const productionOrderNo = resolveProductionOrderNo(order)
    const cuttingTaskLink = resolveCuttingTaskLink({
      productionOrderId: order.productionOrderId,
      productionOrderNo,
    })
    return {
      cutOrderId: makeStableCutOrderId({
        productionOrderNo,
        materialIdentity: bucket.materialIdentity,
        patternIdentity,
      }),
      cutOrderNo: makeCutOrderNo(order, index),
      generationKey: bucket.generationKey,
      productionOrderId: order.productionOrderId,
      productionOrderNo,
      ...cuttingTaskLink,
      spuCode: order.demandSnapshot.spuCode,
      styleId: normalizeText(techPack.styleId),
      styleCode: normalizeText(techPack.styleCode) || order.demandSnapshot.spuCode,
      styleName: normalizeText(techPack.styleName) || order.demandSnapshot.spuName,
      techPackVersionId: normalizeText(techPack.sourceTechPackVersionId) || normalizeText(techPack.versionLabel),
      techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || techPack.sourceTechPackVersionLabel || '-',
      materialSku: bucket.materialSku,
      materialName: bucket.materialName,
      materialColor: bucket.materialColor,
      materialType: bucket.materialType,
      materialLabel: bucket.materialLabel,
      materialCategory: toMaterialCategory(bucket.materialType),
      materialAlias: bucket.materialAlias,
      materialImageUrl: bucket.materialImageUrl,
      materialUnit: bucket.materialUnit,
      materialIdentity: { ...bucket.materialIdentity },
      patternIdentity: {
        ...patternIdentity,
        piecePartCodes: [...patternIdentity.piecePartCodes],
        piecePartNames: [...patternIdentity.piecePartNames],
      },
      markerPlanId: '',
      markerPlanNo: '',
      requiredQty,
      sourceTechPackSpuCode: order.techPackSnapshot?.styleCode || order.demandSnapshot.spuCode,
      colorScope: Array.from(bucket.colors.values()),
      skuScopeLines,
      pieceRows: resolvedPieceRows,
      pieceSummary:
        resolvedPieceRows.length > 0
          ? resolvedPieceRows.map((item) => `${item.partName}×${item.pieceCountPerUnit}`).join('、')
          : '待补纸样裁片映射',
      cutOrderSourceType:
        boundary.kind === 'CONTINUOUS_WITH_CUTTING'
          ? 'CONTINUOUS_WITH_CUTTING_TASK'
          : 'INDEPENDENT_CUTTING_TASK',
      cutOrderSourceLabel: boundary.cutOrderSourceLabel,
      cutReturnMode:
        boundary.kind === 'CONTINUOUS_WITH_CUTTING'
          ? 'THIRD_PARTY_REPORT_ONLY'
          : 'RETURN_TO_OWN_CUTTING_WAREHOUSE',
      cutReturnModeLabel: boundary.cutReturnModeLabel,
      internalCraftOrderPolicy:
        boundary.kind === 'CONTINUOUS_WITH_CUTTING'
          ? 'DO_NOT_GENERATE'
          : 'GENERATE_AFTER_RETURN',
      internalCraftOrderPolicyLabel: boundary.internalCraftPolicyLabel,
    }
  }).filter((item): item is GeneratedCutOrderSourceRecord => Boolean(item))
}

function clonePatternIdentity(
  identity: CuttingPatternIdentity,
  overrides: Partial<CuttingPatternIdentity>,
): CuttingPatternIdentity {
  return {
    ...identity,
    ...overrides,
    piecePartCodes: [...(overrides.piecePartCodes ?? identity.piecePartCodes)],
    piecePartNames: [...(overrides.piecePartNames ?? identity.piecePartNames)],
  }
}

function buildScenarioRecord(
  seed: GeneratedCutOrderSourceRecord,
  options: {
    cutOrderNo: string
    patternIdentity: CuttingPatternIdentity
    pieceRows: GeneratedCutOrderPieceRow[]
    materialIdentity?: CuttingMaterialIdentity
  },
): GeneratedCutOrderSourceRecord {
  const materialIdentity = options.materialIdentity ?? seed.materialIdentity
  const generationKey = buildGenerationKey({
    productionOrderId: seed.productionOrderId,
    spuCode: seed.spuCode,
    styleId: seed.styleId,
    styleCode: seed.styleCode,
    styleName: seed.styleName,
    techPackVersionId: seed.techPackVersionId,
    materialIdentity,
    patternIdentity: options.patternIdentity,
  })

  return {
    ...seed,
    cutOrderId: makeStableCutOrderId({
      productionOrderNo: seed.productionOrderNo,
      materialIdentity,
      patternIdentity: options.patternIdentity,
    }),
    cutOrderNo: options.cutOrderNo,
    generationKey,
    materialSku: materialIdentity.materialSku,
    materialName: materialIdentity.materialName,
    materialColor: materialIdentity.materialColor,
    materialLabel: materialIdentity.materialName,
    materialAlias: materialIdentity.materialAlias,
    materialImageUrl: materialIdentity.materialImageUrl,
    materialUnit: materialIdentity.materialUnit,
    materialIdentity: { ...materialIdentity },
    patternIdentity: {
      ...options.patternIdentity,
      piecePartCodes: [...options.patternIdentity.piecePartCodes],
      piecePartNames: [...options.patternIdentity.piecePartNames],
    },
    pieceRows: options.pieceRows.map((row) => ({
      ...row,
      applicableSkuCodes: [...row.applicableSkuCodes],
    })),
    pieceSummary: options.pieceRows.map((item) => `${item.partName}×${item.pieceCountPerUnit}`).join('、'),
  }
}

function buildScenarioMaterialIdentity(
  seed: GeneratedCutOrderSourceRecord,
  options: {
    materialSkuSuffix: string
    materialName: string
    materialAlias: string
    materialColor?: string
  },
): CuttingMaterialIdentity {
  return {
    ...seed.materialIdentity,
    materialSku: `${seed.materialIdentity.materialSku}-${options.materialSkuSuffix}`,
    materialName: options.materialName,
    materialColor: options.materialColor || seed.materialIdentity.materialColor,
    materialAlias: options.materialAlias,
    materialImageUrl: seed.materialIdentity.materialImageUrl,
    materialUnit: seed.materialIdentity.materialUnit,
  }
}

function cloneScenarioPieceRows(seed: GeneratedCutOrderSourceRecord): GeneratedCutOrderPieceRow[] {
  return seed.pieceRows.map((row) => ({
    ...row,
    applicableSkuCodes: [...row.applicableSkuCodes],
  }))
}

function buildPrompt1DimensionScenarioRecords(records: GeneratedCutOrderSourceRecord[]): GeneratedCutOrderSourceRecord[] {
  const scenarioRows: GeneratedCutOrderSourceRecord[] = []
  const blackJoggerSeed = records.find(
    (record) =>
      record.spuCode === 'SPU-2024-010'
      && record.materialSku === 'tdv_demand_SPU_2024_010-bom-black-stretch-twill'
      && record.patternIdentity.patternFileId === 'tdv_demand_SPU_2024_010-pattern-main'
      && record.patternIdentity.effectiveWidthValue === 150,
  )
  if (!blackJoggerSeed) return scenarioRows

  const receivedStableSeed = records.find((record) => record.productionOrderNo === 'PO-202603-0002') ?? blackJoggerSeed
  const datedStableSeeds = {
    cut260301: records.find((record) => record.productionOrderNo === 'PO-202603-0003') ?? blackJoggerSeed,
    cut260303: receivedStableSeed,
  }
  ;[
    {
      seed: receivedStableSeed,
      cutOrderNo: 'CUT-260306-101-01',
      materialSkuSuffix: 'stable-101-01',
      materialName: 'Black 弹力斜纹主面料',
      materialAlias: '稳定 fixture：PDA 多裁片单 101-01',
    },
    {
      seed: receivedStableSeed,
      cutOrderNo: 'CUT-260306-101-02',
      materialSkuSuffix: 'stable-101-02',
      materialName: 'Charcoal 弹力斜纹主面料',
      materialAlias: '稳定 fixture：PDA 多裁片单 101-02',
      materialColor: 'Charcoal',
    },
    {
      seed: blackJoggerSeed,
      cutOrderNo: 'CUT-260307-102-01',
      materialSkuSuffix: 'stable-102-01',
      materialName: '菲票链路主面料 A',
      materialAlias: '稳定 fixture：菲票实际裁剪产出 102-01',
    },
    {
      seed: blackJoggerSeed,
      cutOrderNo: 'CUT-260307-102-02',
      materialSkuSuffix: 'stable-102-02',
      materialName: '菲票链路主面料 B',
      materialAlias: '稳定 fixture：菲票实际裁剪产出 102-02',
    },
    {
      seed: blackJoggerSeed,
      cutOrderNo: 'CUT-260307-102-03',
      materialSkuSuffix: 'stable-102-03',
      materialName: '跨生产单同纸样主面料',
      materialAlias: '稳定 fixture：唛架跨单组合 102-03',
    },
    {
      seed: blackJoggerSeed,
      cutOrderNo: 'CUT-260302-006-01',
      materialSkuSuffix: 'stable-006-01',
      materialName: 'PDA 唛架余额验证主面料',
      materialAlias: '稳定 fixture：PDA 唛架余额 006-01',
    },
    {
      seed: datedStableSeeds.cut260301,
      cutOrderNo: 'CUT-260301-005-01',
      materialSkuSuffix: 'stable-005-01',
      materialName: '菲票交出链路主面料',
      materialAlias: '稳定 fixture：菲票交出 005-01',
    },
    {
      seed: datedStableSeeds.cut260303,
      cutOrderNo: 'CUT-260303-007-01',
      materialSkuSuffix: 'stable-007-01',
      materialName: 'PDA 异常同步主面料',
      materialAlias: '稳定 fixture：PDA 异常同步 007-01',
    },
  ].forEach((item) => {
    scenarioRows.push(buildScenarioRecord(item.seed, {
      cutOrderNo: item.cutOrderNo,
      materialIdentity: buildScenarioMaterialIdentity(item.seed, {
        materialSkuSuffix: item.materialSkuSuffix,
        materialName: item.materialName,
        materialAlias: item.materialAlias,
        materialColor: item.materialColor,
      }),
      patternIdentity: item.seed.patternIdentity,
      pieceRows: cloneScenarioPieceRows(item.seed),
    }))
  })

  const pocketPatternIdentity = clonePatternIdentity(blackJoggerSeed.patternIdentity, {
    patternFileId: 'tdv_demand_SPU_2024_010-pattern-pocket',
    patternFileName: 'SPU-2024-010-口袋布纸样.dxf',
    patternVersion: 'v1.0',
    patternKind: '布料纸样',
    effectiveWidthValue: 150,
    effectiveWidthUnit: 'cm',
    piecePartCodes: ['pocket-bag'],
    piecePartNames: ['口袋布'],
  })
  scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
    cutOrderNo: 'CUT-260306-101-03',
    patternIdentity: pocketPatternIdentity,
    pieceRows: [
      {
        partCode: 'pocket-bag',
        partName: '口袋布',
        pieceCountPerUnit: 2,
        patternId: pocketPatternIdentity.patternFileId,
        patternName: pocketPatternIdentity.patternFileName,
        applicableSkuCodes: [...blackJoggerSeed.skuScopeLines.map((line) => line.skuCode)],
      },
    ],
  }))

  const narrowWidthIdentity = clonePatternIdentity(blackJoggerSeed.patternIdentity, {
    effectiveWidthValue: 155,
    effectiveWidthUnit: 'cm',
  })
  scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
    cutOrderNo: 'CUT-260306-101-04',
    patternIdentity: narrowWidthIdentity,
    pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
      ...row,
      applicableSkuCodes: [...row.applicableSkuCodes],
    })),
  }))
  const samePatternMaterialA: CuttingMaterialIdentity = {
    ...blackJoggerSeed.materialIdentity,
    materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill-select-a',
    materialName: 'Black 弹力斜纹主面料 A',
    materialAlias: '技术包别名：同纸样选择 A',
    materialImageUrl: blackJoggerSeed.materialImageUrl,
  }
  scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
    cutOrderNo: 'CUT-260306-101-05',
    materialIdentity: samePatternMaterialA,
    patternIdentity: blackJoggerSeed.patternIdentity,
    pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
      ...row,
      applicableSkuCodes: [...row.applicableSkuCodes],
    })),
  }))

  const differentHistoryMaterial: CuttingMaterialIdentity = {
    ...blackJoggerSeed.materialIdentity,
    materialSku: 'tdv_demand_SPU_2024_010-bom-black-stretch-twill-history-b',
    materialName: 'Black 弹力斜纹主面料 B',
    materialAlias: '技术包别名：历史组合组 B',
    materialImageUrl: blackJoggerSeed.materialImageUrl,
  }
  scenarioRows.push(buildScenarioRecord(blackJoggerSeed, {
    cutOrderNo: 'CUT-260306-101-06',
    materialIdentity: differentHistoryMaterial,
    patternIdentity: blackJoggerSeed.patternIdentity,
    pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
      ...row,
      applicableSkuCodes: [...row.applicableSkuCodes],
    })),
  }))

  const crossOrderSeed = records.find(
    (record) =>
      record.productionOrderId !== blackJoggerSeed.productionOrderId
      && record.patternIdentity.patternFileId === blackJoggerSeed.patternIdentity.patternFileId,
  )
  if (crossOrderSeed) {
    const crossOrderMaterial: CuttingMaterialIdentity = {
      ...crossOrderSeed.materialIdentity,
      materialSku: 'tdv_demand_SPU_2024_010-bom-cross-po-main',
      materialName: '跨生产单同纸样主面料',
      materialColor: 'Cross Black',
      materialAlias: '技术包别名：跨生产单同组',
      materialImageUrl: crossOrderSeed.materialImageUrl,
      materialUnit: blackJoggerSeed.materialIdentity.materialUnit,
    }
    scenarioRows.push(buildScenarioRecord(crossOrderSeed, {
      cutOrderNo: 'CUT-260307-102-03',
      materialIdentity: crossOrderMaterial,
      patternIdentity: clonePatternIdentity(blackJoggerSeed.patternIdentity, {
        piecePartCodes: [...blackJoggerSeed.patternIdentity.piecePartCodes],
        piecePartNames: [...blackJoggerSeed.patternIdentity.piecePartNames],
      }),
      pieceRows: blackJoggerSeed.pieceRows.map((row) => ({
        ...row,
        applicableSkuCodes: [...crossOrderSeed.skuScopeLines.map((line) => line.skuCode)],
      })),
    }))
  }

  const existingKeys = new Set(records.map((record) => record.generationKey))
  const existingCutOrderNos = new Set(records.map((record) => record.cutOrderNo))
  const seenCutOrderNos = new Set<string>()
  return scenarioRows.filter((record) => {
    if (existingKeys.has(record.generationKey)) return false
    if (existingCutOrderNos.has(record.cutOrderNo) || seenCutOrderNos.has(record.cutOrderNo)) return false
    seenCutOrderNos.add(record.cutOrderNo)
    return true
  })
}

let cachedRecords: GeneratedCutOrderSourceRecord[] | null = null

export function listGeneratedCutOrderSourceRecords(): GeneratedCutOrderSourceRecord[] {
  if (!cachedRecords) {
    const baseRecords = listCuttingProductionOrdersWithFormalTechPack().flatMap((order) => buildRecordsForOrder(order))
    cachedRecords = [...baseRecords, ...buildPrompt1DimensionScenarioRecords(baseRecords)]
  }
  return cachedRecords.map((record) => ({
    ...record,
    productionOrderNo: normalizeText(record.productionOrderNo) || normalizeText(record.productionOrderId),
    materialIdentity: { ...record.materialIdentity },
    patternIdentity: {
      ...record.patternIdentity,
      piecePartCodes: [...record.patternIdentity.piecePartCodes],
      piecePartNames: [...record.patternIdentity.piecePartNames],
    },
    colorScope: [...record.colorScope],
    skuScopeLines: record.skuScopeLines.map((line) => ({ ...line })),
    pieceRows: record.pieceRows.map((row) => ({ ...row, applicableSkuCodes: [...row.applicableSkuCodes] })),
  }))
}

export function getGeneratedCutOrderSourceRecordById(cutOrderId: string): GeneratedCutOrderSourceRecord | null {
  return listGeneratedCutOrderSourceRecords().find((record) => record.cutOrderId === cutOrderId || record.cutOrderNo === cutOrderId) ?? null
}

export function resetGeneratedCutOrderSourceCache(): void {
  cachedRecords = null
}
