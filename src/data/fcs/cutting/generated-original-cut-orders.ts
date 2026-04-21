import {
  productionOrders,
  type ProductionOrder,
} from '../production-orders.ts'
import {
  getProductionOrderCompatTechPack,
  getProductionOrderCutPieceParts,
} from '../production-order-tech-pack-runtime.ts'
import type { TechPack, TechPackBomItem, TechPackColorMaterialMappingLine } from '../tech-packs.ts'
import type { CuttingMaterialType } from './types.ts'

export interface GeneratedOriginalCutOrderPieceRow {
  partCode: string
  partName: string
  pieceCountPerUnit: number
  patternId: string
  patternName: string
  applicableSkuCodes: string[]
}

export interface GeneratedOriginalCutOrderSkuScopeLine {
  skuCode: string
  color: string
  size: string
  plannedQty: number
}

export interface GeneratedOriginalCutOrderSourceRecord {
  originalCutOrderId: string
  originalCutOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  materialSku: string
  materialType: CuttingMaterialType
  materialLabel: string
  materialCategory: string
  mergeBatchId: string
  mergeBatchNo: string
  requiredQty: number
  techPackVersionLabel: string
  sourceTechPackSpuCode: string
  colorScope: string[]
  skuScopeLines: GeneratedOriginalCutOrderSkuScopeLine[]
  pieceRows: GeneratedOriginalCutOrderPieceRow[]
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

function findBomItem(techPack: TechPack, line: TechPackColorMaterialMappingLine): TechPackBomItem | null {
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

function resolveMaterialSku(techPack: TechPack, line: TechPackColorMaterialMappingLine, bomItem: TechPackBomItem | null): string {
  return normalizeText(line.materialCode) || normalizeText(bomItem?.id) || normalizeText(line.materialName)
}

function resolvePieceRows(
  techPack: TechPack,
  line: TechPackColorMaterialMappingLine,
  skuCode: string,
): GeneratedOriginalCutOrderPieceRow[] {
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

function makeOriginalCutOrderNo(order: ProductionOrder, index: number): string {
  const normalizedDate = order.createdAt.slice(2, 10).replace(/-/g, '')
  const orderSuffix = order.productionOrderId.replace(/\D/g, '').slice(-3).padStart(3, '0')
  return `CUT-${normalizedDate}-${orderSuffix}-${String(index + 1).padStart(2, '0')}`
}

function resolveProductionOrderNo(order: ProductionOrder): string {
  return normalizeText(order.productionOrderNo) || normalizeText(order.productionOrderId)
}

function buildSkuScopeLines(order: ProductionOrder): GeneratedOriginalCutOrderSkuScopeLine[] {
  return order.demandSnapshot.skuLines.map((line) => ({
    skuCode: normalizeText(line.skuCode),
    color: normalizeText(line.color),
    size: normalizeText(line.size),
    plannedQty: Number(line.qty || 0),
  }))
}

function buildMockSt081OriginalCutOrders(order: ProductionOrder): GeneratedOriginalCutOrderSourceRecord[] | null {
  if (!['PO-202603-081', 'PO-202603-087', 'PO-202603-088'].includes(order.productionOrderId)) return null

  const skuScopeLines = buildSkuScopeLines(order)
  const totalQty = skuScopeLines.reduce((sum, item) => sum + item.plannedQty, 0)
  const colorScope = unique(skuScopeLines.map((line) => line.color).filter(Boolean))
  const cutPieceParts = getProductionOrderCutPieceParts(order.productionOrderId)
  const buildResolvedPieceRows = (materialSku: string, fallbackRows: GeneratedOriginalCutOrderPieceRow[]): GeneratedOriginalCutOrderPieceRow[] => {
    const matchedRows = cutPieceParts
      .filter((item) => !item.materialSku || item.materialSku === materialSku)
      .map((item) => ({
        partCode: item.partCode,
        partName: item.partNameCn,
        pieceCountPerUnit: item.pieceCountPerGarment,
        patternId: item.partCode,
        patternName: item.partNameCn,
        applicableSkuCodes: skuScopeLines.map((line) => line.skuCode),
      }))
      .filter((item) => item.partName && item.pieceCountPerUnit > 0)

    return matchedRows.length ? matchedRows : fallbackRows
  }
  const materials: Array<{
    materialSku: string
    materialType: CuttingMaterialType
    materialLabel: string
    pieceRows: GeneratedOriginalCutOrderPieceRow[]
  }> = [
    {
      materialSku: 'FAB-SKU-PRINT-001',
      materialType: 'PRINT',
      materialLabel: '主布面料',
      pieceRows: buildResolvedPieceRows('FAB-SKU-PRINT-001', [
        {
          partCode: 'tee-front',
          partName: '前片',
          pieceCountPerUnit: 1,
          patternId: 'tee-front',
          patternName: 'T 恤前片',
          applicableSkuCodes: skuScopeLines.map((line) => line.skuCode),
        },
        {
          partCode: 'tee-back',
          partName: '后片',
          pieceCountPerUnit: 1,
          patternId: 'tee-back',
          patternName: 'T 恤后片',
          applicableSkuCodes: skuScopeLines.map((line) => line.skuCode),
        },
        {
          partCode: 'tee-sleeve',
          partName: '袖子',
          pieceCountPerUnit: 2,
          patternId: 'tee-sleeve',
          patternName: 'T 恤袖子',
          applicableSkuCodes: skuScopeLines.map((line) => line.skuCode),
        },
      ]),
    },
    {
      materialSku: 'FAB-SKU-LINING-001',
      materialType: 'LINING',
      materialLabel: '领口里布',
      pieceRows: [
        {
          partCode: 'tee-neck-lining',
          partName: '领口里布片',
          pieceCountPerUnit: 1,
          patternId: 'tee-neck-lining',
          patternName: '领口里布',
          applicableSkuCodes: skuScopeLines.map((line) => line.skuCode),
        },
      ],
    },
    {
      materialSku: 'FAB-SKU-SOLID-033',
      materialType: 'SOLID',
      materialLabel: '领口拼接布',
      pieceRows: [
        {
          partCode: 'tee-neck-contrast',
          partName: '领口拼接片',
          pieceCountPerUnit: 1,
          patternId: 'tee-neck-contrast',
          patternName: '领口拼接布',
          applicableSkuCodes: skuScopeLines.map((line) => line.skuCode),
        },
      ],
    },
  ]

  return materials.map((material, index) => ({
    originalCutOrderId: makeOriginalCutOrderNo(order, index),
    originalCutOrderNo: makeOriginalCutOrderNo(order, index),
    productionOrderId: order.productionOrderId,
    productionOrderNo: resolveProductionOrderNo(order),
    materialSku: material.materialSku,
    materialType: material.materialType,
    materialLabel: material.materialLabel,
    materialCategory: toMaterialCategory(material.materialType),
    mergeBatchId: '',
    mergeBatchNo: '',
    requiredQty: totalQty,
    techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || '-',
    sourceTechPackSpuCode: order.demandSnapshot.spuCode,
    colorScope,
    skuScopeLines: skuScopeLines.map((line) => ({ ...line })),
    pieceRows: material.pieceRows.map((row) => ({ ...row, applicableSkuCodes: [...row.applicableSkuCodes] })),
    pieceSummary: material.pieceRows.map((row) => `${row.partName}×${row.pieceCountPerUnit}`).join('、'),
  }))
}

function buildRecordsForOrder(order: ProductionOrder): GeneratedOriginalCutOrderSourceRecord[] {
  const mockOverrideRows = buildMockSt081OriginalCutOrders(order)
  if (mockOverrideRows) return mockOverrideRows

  const techPack = getProductionOrderCompatTechPack(order.productionOrderId)
  if (!techPack) return []

  const scopeByMaterialKey = new Map<
    string,
    {
      materialSku: string
      materialType: CuttingMaterialType
      materialLabel: string
      scopeBySkuKey: Map<string, GeneratedOriginalCutOrderSkuScopeLine>
      pieceRows: GeneratedOriginalCutOrderPieceRow[]
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

        const materialKey = materialSku.toLowerCase()
        if (!scopeByMaterialKey.has(materialKey)) {
          orderedMaterialKeys.push(materialKey)
          scopeByMaterialKey.set(materialKey, {
            materialSku,
            materialType: toCuttingMaterialType(mappingLine.materialType),
            materialLabel: normalizeText(mappingLine.materialName) || materialSku,
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
    const requiredQty = skuScopeLines.reduce((sum, item) => sum + item.plannedQty, 0)
    return {
      originalCutOrderId: makeOriginalCutOrderNo(order, index),
      originalCutOrderNo: makeOriginalCutOrderNo(order, index),
      productionOrderId: order.productionOrderId,
      productionOrderNo: resolveProductionOrderNo(order),
      materialSku: bucket.materialSku,
      materialType: bucket.materialType,
      materialLabel: bucket.materialLabel,
      materialCategory: toMaterialCategory(bucket.materialType),
      mergeBatchId: '',
      mergeBatchNo: '',
      requiredQty,
      techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || '-',
      sourceTechPackSpuCode: order.techPackSnapshot?.styleCode || order.demandSnapshot.spuCode,
      colorScope: Array.from(bucket.colors.values()),
      skuScopeLines,
      pieceRows: bucket.pieceRows.map((item) => ({
        ...item,
        applicableSkuCodes: [...item.applicableSkuCodes],
      })),
      pieceSummary:
        bucket.pieceRows.length > 0
          ? bucket.pieceRows.map((item) => `${item.partName}×${item.pieceCountPerUnit}`).join('、')
          : '待补纸样裁片映射',
    }
  })
}

let cachedRecords: GeneratedOriginalCutOrderSourceRecord[] | null = null

export function listGeneratedOriginalCutOrderSourceRecords(): GeneratedOriginalCutOrderSourceRecord[] {
  if (!cachedRecords) {
    cachedRecords = productionOrders.flatMap((order) => buildRecordsForOrder(order))
  }
  return cachedRecords.map((record) => ({
    ...record,
    productionOrderNo: normalizeText(record.productionOrderNo) || normalizeText(record.productionOrderId),
    colorScope: [...record.colorScope],
    skuScopeLines: record.skuScopeLines.map((line) => ({ ...line })),
    pieceRows: record.pieceRows.map((row) => ({ ...row, applicableSkuCodes: [...row.applicableSkuCodes] })),
  }))
}

export function getGeneratedOriginalCutOrderSourceRecordById(originalCutOrderId: string): GeneratedOriginalCutOrderSourceRecord | null {
  return listGeneratedOriginalCutOrderSourceRecords().find((record) => record.originalCutOrderId === originalCutOrderId) ?? null
}

export function resetGeneratedOriginalCutOrderSourceCache(): void {
  cachedRecords = null
}
