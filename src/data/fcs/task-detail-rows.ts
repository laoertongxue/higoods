import {
  DETAIL_SPLIT_DIMENSION_LABEL,
  type DetailSplitDimension,
  type DetailSplitMode,
} from './process-craft-dict.ts'
import type { GeneratedTaskArtifact } from './production-artifact-generation.ts'
import { productionOrders } from './production-orders.ts'
import { getTechPackBySpuCode, type TechPackBomItem, type TechPackPatternFile } from './tech-packs.ts'

export type TaskDetailRowType = 'COMPOSITE'

export interface TaskDetailRowSourceRefs {
  orderId: string
  spuCode: string
  processCode: string
  sourceEntryId: string
  craftCode?: string
  bomItemId?: string
  patternId?: string
  pieceIds?: string[]
  garmentSku?: string
  garmentColor?: string
}

export interface TaskDetailRow {
  rowKey: string
  taskId: string
  rowType: TaskDetailRowType
  rowLabel: string
  qty: number
  uom: string
  dimensions: Partial<Record<DetailSplitDimension, string>>
  sourceRefs: TaskDetailRowSourceRefs
  sortKey: string
}

interface OrderSkuLine {
  skuCode: string
  color: string
  qty: number
}

interface MaterialCandidate {
  bomItemId: string
  materialCode: string
  materialName: string
  consumptionFactor: number
  applicableSkuCodes: string[]
}

interface PatternCandidate {
  patternId: string
  patternName: string
  linkedBomItemId?: string
  applicableSkuCodes: string[]
  pieceIds: string[]
}

const DIMENSION_PRIORITY: DetailSplitDimension[] = [
  'GARMENT_COLOR',
  'GARMENT_SKU',
  'PATTERN',
  'MATERIAL_SKU',
]

function uniqueStable(values: string[]): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function normalizeToken(value: string): string {
  const token = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return token || 'na'
}

function roundQty(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value * 1000) / 1000
}

function formatQty(value: number): string {
  const rounded = roundQty(value)
  if (Number.isInteger(rounded)) return `${rounded}`
  return rounded.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

function fallbackDimensionsByGranularity(
  granularity: GeneratedTaskArtifact['assignmentGranularity'],
): DetailSplitDimension[] {
  if (granularity === 'SKU' || granularity === 'DETAIL') return ['GARMENT_SKU']
  if (granularity === 'COLOR') return ['GARMENT_COLOR', 'MATERIAL_SKU']
  return ['PATTERN', 'MATERIAL_SKU']
}

function resolveOrderSkuLines(orderId: string): OrderSkuLine[] {
  const order = productionOrders.find((item) => item.productionOrderId === orderId)
  if (!order) return []

  return order.demandSnapshot.skuLines
    .map((line) => ({
      skuCode: line.skuCode,
      color: line.color,
      qty: line.qty,
    }))
    .sort((a, b) => a.skuCode.localeCompare(b.skuCode))
}

function resolveMaterialCandidates(
  bomItems: TechPackBomItem[],
  processCode: string,
  orderSkuCodes: string[],
): MaterialCandidate[] {
  const filteredByProcess = bomItems.filter((item) => {
    if (!item.usageProcessCodes || item.usageProcessCodes.length === 0) return true
    return item.usageProcessCodes.includes(processCode)
  })

  const scopedBomItems = filteredByProcess.length > 0 ? filteredByProcess : bomItems

  const rows = scopedBomItems.map((item) => {
    const applicableSkuCodes =
      item.applicableSkuCodes && item.applicableSkuCodes.length > 0
        ? uniqueStable(item.applicableSkuCodes).filter((sku) => orderSkuCodes.includes(sku))
        : [...orderSkuCodes]

    const consumptionFactor = Math.max(item.unitConsumption, 0)
      * (1 + Math.max(item.lossRate, 0))

    return {
      bomItemId: item.id,
      materialCode: item.id,
      materialName: item.name,
      consumptionFactor: consumptionFactor > 0 ? consumptionFactor : 1,
      applicableSkuCodes,
    }
  })

  const validRows = rows.filter((row) => row.applicableSkuCodes.length > 0)
  if (validRows.length > 0) return validRows

  return [
    {
      bomItemId: 'BOM_DEFAULT',
      materialCode: 'BOM_DEFAULT',
      materialName: '默认物料',
      consumptionFactor: 1,
      applicableSkuCodes: [...orderSkuCodes],
    },
  ]
}

function resolvePatternCandidates(
  patterns: TechPackPatternFile[],
  orderSkuCodes: string[],
): PatternCandidate[] {
  if (!patterns.length) {
    return [
      {
        patternId: 'PATTERN_DEFAULT',
        patternName: '默认纸样',
        applicableSkuCodes: [...orderSkuCodes],
        pieceIds: [],
      },
    ]
  }

  return patterns.map((pattern) => {
    const pieceIds = uniqueStable((pattern.pieceRows ?? []).map((piece) => piece.id))
    const pieceSkuCodes = uniqueStable(
      (pattern.pieceRows ?? []).flatMap((piece) => piece.applicableSkuCodes ?? []),
    )

    const applicableSkuCodes =
      pieceSkuCodes.length > 0
        ? pieceSkuCodes.filter((sku) => orderSkuCodes.includes(sku))
        : [...orderSkuCodes]

    return {
      patternId: pattern.id,
      patternName: pattern.fileName,
      linkedBomItemId: pattern.linkedBomItemId,
      applicableSkuCodes,
      pieceIds,
    }
  })
}

function sumOrderQtyBySku(orderSkuLines: OrderSkuLine[], skuCodes: string[]): number {
  if (skuCodes.length === 0) return 0
  const skuSet = new Set(skuCodes)
  return orderSkuLines
    .filter((line) => skuSet.has(line.skuCode))
    .reduce((sum, line) => sum + line.qty, 0)
}

function intersectSkuCodes(a: string[], b: string[]): string[] {
  const bSet = new Set(b)
  return a.filter((value) => bSet.has(value))
}

function makeRowLabel(
  dimensions: Partial<Record<DetailSplitDimension, string>>,
  orderedDimensions: DetailSplitDimension[],
): string {
  const segments = orderedDimensions
    .map((dimension) => dimensions[dimension])
    .filter((value): value is string => Boolean(value))
  if (segments.length > 0) return segments.join(' / ')
  return '默认明细行'
}

function makeRowKey(taskId: string, orderedDimensions: DetailSplitDimension[], dimensions: Partial<Record<DetailSplitDimension, string>>): string {
  const segments = orderedDimensions.map((dimension) => `${dimension}_${normalizeToken(dimensions[dimension] ?? '-')}`)
  return `ROW-${taskId}-${segments.join('__')}`
}

function makeSortKey(orderedDimensions: DetailSplitDimension[], dimensions: Partial<Record<DetailSplitDimension, string>>): string {
  const segments = orderedDimensions.map((dimension) => normalizeToken(dimensions[dimension] ?? '-'))
  return `${orderedDimensions.join('+')}::${segments.join('::')}`
}

function upsertRow(
  rowMap: Map<string, TaskDetailRow>,
  taskId: string,
  orderedDimensions: DetailSplitDimension[],
  dimensions: Partial<Record<DetailSplitDimension, string>>,
  qty: number,
  sourceRefs: TaskDetailRowSourceRefs,
): void {
  const stableQty = roundQty(qty)
  if (stableQty <= 0) return

  const rowKey = makeRowKey(taskId, orderedDimensions, dimensions)
  const existing = rowMap.get(rowKey)
  if (existing) {
    existing.qty = roundQty(existing.qty + stableQty)
    existing.sourceRefs = { ...existing.sourceRefs, ...sourceRefs }
    return
  }

  rowMap.set(rowKey, {
    rowKey,
    taskId,
    rowType: 'COMPOSITE',
    rowLabel: makeRowLabel(dimensions, orderedDimensions),
    qty: stableQty,
    uom: '件',
    dimensions,
    sourceRefs,
    sortKey: makeSortKey(orderedDimensions, dimensions),
  })
}

function buildSkuRows(
  rowMap: Map<string, TaskDetailRow>,
  taskId: string,
  dimensions: DetailSplitDimension[],
  orderSkuLines: OrderSkuLine[],
  baseRefs: Omit<TaskDetailRowSourceRefs, 'garmentSku' | 'garmentColor'>,
): void {
  for (const line of orderSkuLines) {
    upsertRow(
      rowMap,
      taskId,
      dimensions,
      { GARMENT_SKU: line.skuCode },
      line.qty,
      {
        ...baseRefs,
        garmentSku: line.skuCode,
        garmentColor: line.color,
      },
    )
  }
}

function buildColorMaterialRows(
  rowMap: Map<string, TaskDetailRow>,
  taskId: string,
  dimensions: DetailSplitDimension[],
  orderSkuLines: OrderSkuLine[],
  materials: MaterialCandidate[],
  baseRefs: Omit<TaskDetailRowSourceRefs, 'garmentColor' | 'bomItemId'>,
): void {
  const colors = uniqueStable(orderSkuLines.map((line) => line.color))

  for (const color of colors) {
    const colorSkuCodes = orderSkuLines
      .filter((line) => line.color === color)
      .map((line) => line.skuCode)

    for (const material of materials) {
      const matchedSkuCodes = intersectSkuCodes(colorSkuCodes, material.applicableSkuCodes)
      const baseQty = sumOrderQtyBySku(orderSkuLines, matchedSkuCodes)
      const qty = baseQty * material.consumptionFactor
      upsertRow(
        rowMap,
        taskId,
        dimensions,
        {
          GARMENT_COLOR: color,
          MATERIAL_SKU: material.materialName,
        },
        qty,
        {
          ...baseRefs,
          garmentColor: color,
          bomItemId: material.bomItemId,
        },
      )
    }
  }
}

function buildPatternMaterialRows(
  rowMap: Map<string, TaskDetailRow>,
  taskId: string,
  dimensions: DetailSplitDimension[],
  orderSkuLines: OrderSkuLine[],
  patterns: PatternCandidate[],
  materials: MaterialCandidate[],
  baseRefs: Omit<TaskDetailRowSourceRefs, 'patternId' | 'pieceIds' | 'bomItemId'>,
): void {
  for (const pattern of patterns) {
    const scopedMaterials = pattern.linkedBomItemId
      ? materials.filter((material) => material.bomItemId === pattern.linkedBomItemId)
      : materials

    const materialPool = scopedMaterials.length > 0 ? scopedMaterials : materials

    for (const material of materialPool) {
      const matchedSkuCodes = intersectSkuCodes(pattern.applicableSkuCodes, material.applicableSkuCodes)
      const baseQty = sumOrderQtyBySku(orderSkuLines, matchedSkuCodes)
      const qty = baseQty * material.consumptionFactor

      upsertRow(
        rowMap,
        taskId,
        dimensions,
        {
          PATTERN: pattern.patternName,
          MATERIAL_SKU: material.materialName,
        },
        qty,
        {
          ...baseRefs,
          patternId: pattern.patternId,
          pieceIds: pattern.pieceIds,
          bomItemId: material.bomItemId,
        },
      )
    }
  }
}

function buildColorPatternMaterialRows(
  rowMap: Map<string, TaskDetailRow>,
  taskId: string,
  dimensions: DetailSplitDimension[],
  orderSkuLines: OrderSkuLine[],
  patterns: PatternCandidate[],
  materials: MaterialCandidate[],
  baseRefs: Omit<TaskDetailRowSourceRefs, 'garmentColor' | 'patternId' | 'pieceIds' | 'bomItemId'>,
): void {
  const colors = uniqueStable(orderSkuLines.map((line) => line.color))

  for (const color of colors) {
    const colorSkuCodes = orderSkuLines
      .filter((line) => line.color === color)
      .map((line) => line.skuCode)

    for (const pattern of patterns) {
      const scopedMaterials = pattern.linkedBomItemId
        ? materials.filter((material) => material.bomItemId === pattern.linkedBomItemId)
        : materials
      const materialPool = scopedMaterials.length > 0 ? scopedMaterials : materials

      for (const material of materialPool) {
        const matchedSkuCodes = intersectSkuCodes(
          colorSkuCodes,
          intersectSkuCodes(pattern.applicableSkuCodes, material.applicableSkuCodes),
        )
        const baseQty = sumOrderQtyBySku(orderSkuLines, matchedSkuCodes)
        const qty = baseQty * material.consumptionFactor

        upsertRow(
          rowMap,
          taskId,
          dimensions,
          {
            GARMENT_COLOR: color,
            PATTERN: pattern.patternName,
            MATERIAL_SKU: material.materialName,
          },
          qty,
          {
            ...baseRefs,
            garmentColor: color,
            patternId: pattern.patternId,
            pieceIds: pattern.pieceIds,
            bomItemId: material.bomItemId,
          },
        )
      }
    }
  }
}

function normalizeDimensions(dimensions: DetailSplitDimension[]): DetailSplitDimension[] {
  const unique = uniqueStable(dimensions) as DetailSplitDimension[]
  if (unique.length === 0) return []
  return [...unique].sort((a, b) => DIMENSION_PRIORITY.indexOf(a) - DIMENSION_PRIORITY.indexOf(b))
}

export function generateTaskDetailRowsForArtifact(input: {
  taskId: string
  artifact: GeneratedTaskArtifact
}): TaskDetailRow[] {
  const { taskId, artifact } = input

  const order = productionOrders.find((item) => item.productionOrderId === artifact.orderId)
  if (!order) return []

  const techPack = getTechPackBySpuCode(order.demandSnapshot.spuCode)
  if (!techPack) return []

  const orderSkuLines = resolveOrderSkuLines(artifact.orderId)
  if (!orderSkuLines.length) return []

  const orderSkuCodes = orderSkuLines.map((line) => line.skuCode)
  const dimensions = normalizeDimensions(
    artifact.detailSplitDimensions && artifact.detailSplitDimensions.length > 0
      ? artifact.detailSplitDimensions
      : fallbackDimensionsByGranularity(artifact.assignmentGranularity),
  )

  const materials = resolveMaterialCandidates(techPack.bomItems, artifact.processCode, orderSkuCodes)
  const patterns = resolvePatternCandidates(techPack.patternFiles, orderSkuCodes)

  const rowMap = new Map<string, TaskDetailRow>()
  const baseRefs = {
    orderId: artifact.orderId,
    spuCode: techPack.spuCode,
    processCode: artifact.processCode,
    craftCode: artifact.craftCode,
    sourceEntryId: artifact.sourceEntryId,
  }

  const hasColor = dimensions.includes('GARMENT_COLOR')
  const hasSku = dimensions.includes('GARMENT_SKU')
  const hasPattern = dimensions.includes('PATTERN')
  const hasMaterial = dimensions.includes('MATERIAL_SKU')

  if (hasSku && dimensions.length === 1) {
    buildSkuRows(rowMap, taskId, dimensions, orderSkuLines, baseRefs)
  } else if (hasColor && hasPattern && hasMaterial) {
    buildColorPatternMaterialRows(rowMap, taskId, dimensions, orderSkuLines, patterns, materials, baseRefs)
  } else if (hasPattern && hasMaterial) {
    buildPatternMaterialRows(rowMap, taskId, dimensions, orderSkuLines, patterns, materials, baseRefs)
  } else if (hasColor && hasMaterial) {
    buildColorMaterialRows(rowMap, taskId, dimensions, orderSkuLines, materials, baseRefs)
  } else {
    buildSkuRows(rowMap, taskId, ['GARMENT_SKU'], orderSkuLines, baseRefs)
  }

  return [...rowMap.values()].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export function formatTaskDetailDimensionsText(row: TaskDetailRow): string {
  const dimensions = Object.entries(row.dimensions)
    .filter((entry): entry is [DetailSplitDimension, string] => Boolean(entry[1]))
    .sort((a, b) => DIMENSION_PRIORITY.indexOf(a[0]) - DIMENSION_PRIORITY.indexOf(b[0]))

  if (dimensions.length === 0) return '-'

  return dimensions
    .map(([key, value]) => `${DETAIL_SPLIT_DIMENSION_LABEL[key]}：${value}`)
    .join('；')
}

export function summarizeTaskDetailRows(
  rows: TaskDetailRow[],
  previewCount = 2,
): {
  count: number
  totalQty: number
  previewText: string
} {
  const count = rows.length
  const totalQty = roundQty(rows.reduce((sum, row) => sum + row.qty, 0))
  const previewText = rows
    .slice(0, previewCount)
    .map((row) => `${row.rowLabel} × ${formatQty(row.qty)}${row.uom}`)
    .join('；')

  return {
    count,
    totalQty,
    previewText,
  }
}

export function getDetailSplitModeLabel(mode: DetailSplitMode): string {
  return mode === 'COMPOSITE' ? '组合维度' : mode
}
