import {
  productionOrders,
  getProductionOrderTechPackSnapshot,
  type ProductionOrder,
} from '../production-orders.ts'
import type { TechnicalBomItem, TechnicalColorMaterialMappingLine } from '../../pcs-technical-data-version-types.ts'
import type { ProductionOrderTechPackSnapshot, TechPackBomItemSnapshot } from '../production-tech-pack-snapshot-types.ts'
import type { CuttingMaterialType } from './types.ts'

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
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  materialCategory: string
  materialAlias: string
  materialImageUrl: string
  markerPlanId: string
  markerPlanNo: string
  requiredQty: number
  techPackVersionLabel: string
  sourceTechPackSpuCode: string
  colorScope: string[]
  skuScopeLines: GeneratedCutOrderSkuScopeLine[]
  pieceRows: GeneratedCutOrderPieceRow[]
  pieceSummary: string
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
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
  const formalOrders = productionOrders.filter((order) => hasFormalTechPackForCutting(order))
  const joggerOrders = formalOrders.filter((order) => order.demandSnapshot.spuCode === 'SPU-2024-010')
  const otherOrders = formalOrders.filter((order) => order.demandSnapshot.spuCode !== 'SPU-2024-010')
  return [...joggerOrders, ...otherOrders].slice(0, 16)
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
  const techPack = getProductionOrderTechPackSnapshot(order.productionOrderId)
  if (!techPack) return []

  const scopeByMaterialKey = new Map<
    string,
    {
      materialSku: string
      materialType: CuttingMaterialType
      materialLabel: string
      materialAlias: string
      materialImageUrl: string
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
        const materialAlias = resolveMaterialAlias(techPack, mappingLine, bomItem, materialSku)
        const materialImageUrl = resolveMaterialImageUrl(techPack, mappingLine, bomItem, materialSku)

        const materialKey = `${materialSku.toLowerCase()}::${normalizeText(skuLine.color).toLowerCase()}`
        if (!scopeByMaterialKey.has(materialKey)) {
          orderedMaterialKeys.push(materialKey)
          scopeByMaterialKey.set(materialKey, {
            materialSku,
            materialType: toCuttingMaterialType(mappingLine.materialType),
            materialLabel: normalizeText(mappingLine.materialName) || materialSku,
            materialAlias,
            materialImageUrl,
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

        const pieceRows = resolvePieceRows(techPack, mappingLine, skuLine.skuCode)
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
    const requiredQty = skuScopeLines.reduce((sum, item) => sum + item.plannedQty, 0)
    return {
      cutOrderId: makeCutOrderNo(order, index),
      cutOrderNo: makeCutOrderNo(order, index),
      productionOrderId: order.productionOrderId,
      productionOrderNo: resolveProductionOrderNo(order),
      materialSku: bucket.materialSku,
      materialType: bucket.materialType,
      materialLabel: bucket.materialLabel,
      materialCategory: toMaterialCategory(bucket.materialType),
      materialAlias: bucket.materialAlias,
      materialImageUrl: bucket.materialImageUrl,
      markerPlanId: '',
      markerPlanNo: '',
      requiredQty,
      techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || '-',
      sourceTechPackSpuCode: order.techPackSnapshot?.styleCode || order.demandSnapshot.spuCode,
      colorScope: Array.from(bucket.colors.values()),
      skuScopeLines,
      pieceRows: resolvedPieceRows,
      pieceSummary:
        resolvedPieceRows.length > 0
          ? resolvedPieceRows.map((item) => `${item.partName}×${item.pieceCountPerUnit}`).join('、')
          : '待补纸样裁片映射',
    }
  }).filter((item): item is GeneratedCutOrderSourceRecord => Boolean(item))
}

let cachedRecords: GeneratedCutOrderSourceRecord[] | null = null

export function listGeneratedCutOrderSourceRecords(): GeneratedCutOrderSourceRecord[] {
  if (!cachedRecords) {
    cachedRecords = listCuttingProductionOrdersWithFormalTechPack().flatMap((order) => buildRecordsForOrder(order))
  }
  return cachedRecords.map((record) => ({
    ...record,
    productionOrderNo: normalizeText(record.productionOrderNo) || normalizeText(record.productionOrderId),
    colorScope: [...record.colorScope],
    skuScopeLines: record.skuScopeLines.map((line) => ({ ...line })),
    pieceRows: record.pieceRows.map((row) => ({ ...row, applicableSkuCodes: [...row.applicableSkuCodes] })),
  }))
}

export function getGeneratedCutOrderSourceRecordById(cutOrderId: string): GeneratedCutOrderSourceRecord | null {
  return listGeneratedCutOrderSourceRecords().find((record) => record.cutOrderId === cutOrderId) ?? null
}

export function resetGeneratedCutOrderSourceCache(): void {
  cachedRecords = null
}
