import { getMaterialResourceOverview } from '../production-object-overview.ts'

export const SUPPLEMENT_WAREHOUSE_SCOPE = [
  '中转仓',
  '总仓面料仓',
  '总仓辅料仓',
  '染色待加工仓',
  '印花待加工仓',
] as const

export interface SupplementWarehouseInventoryFact {
  warehouseName: string
  location: string
  totalQty: number
  availableQty: number
  unavailableQty: number
  unit: string
  status: string
  updatedAt: string
  unitMatched: boolean
}

export interface SupplementExistingTransitSummary {
  inTransitQty: number
  arrivedQty: number
  pendingQty: number
  unit: string
  status: string
  estimatedArrivalAt: string
  unitMatched: boolean
}

export interface SupplementExistingTransitFact {
  purchaseQty: number
  arrivedQty: number
  pendingQty: number
  unit: string
  status: string
  estimatedArrivalAt: string
  unitMatched: boolean
}

export interface SupplementMaterialSupplyDecisionSnapshot {
  materialDemandId: string
  materialSku: string
  requiredQty: number
  unit: string
  inventoryRows: SupplementWarehouseInventoryFact[]
  availableInventoryCoverageQty: number
  existingTransitSummary: SupplementExistingTransitSummary | null
  existingTransitRows: SupplementExistingTransitFact[]
  existingTransitCoverageQty: number
  uncoveredQty: number
  recommendation: '可继续' | '不建议创建'
  businessDecision: '无需确认' | '取消' | '确认继续'
  newPurchaseRequired: boolean
  checkedAt: string
  warnings: string[]
}

export interface SupplementSupplyFactInput {
  inventoryRows?: Omit<SupplementWarehouseInventoryFact, 'unitMatched'>[]
  transitRows?: Array<{
    purchaseQty: number
    arrivedQty: number
    pendingQty: number
    unit: string
    status: string
    estimatedArrivalAt: string
  }>
}

const factOverrides = new Map<string, SupplementSupplyFactInput>()

function roundQty(value: number): number {
  return Number(Math.max(Number.isFinite(value) ? value : 0, 0).toFixed(2))
}

export function setSupplementSupplyFactsForTesting(materialSku: string, facts: SupplementSupplyFactInput | null): void {
  if (facts) factOverrides.set(materialSku, structuredClone(facts))
  else factOverrides.delete(materialSku)
}

export function resetSupplementSupplyFactsForTesting(): void {
  factOverrides.clear()
}

function readSupplyFacts(materialSku: string): SupplementSupplyFactInput {
  const override = factOverrides.get(materialSku)
  if (override) return structuredClone(override)
  const overview = getMaterialResourceOverview(materialSku)
  const inventoryRows = (overview?.inventoryBatches ?? []).map((row) => ({
    warehouseName: row.warehouseName,
    location: row.batchNo || '未记录',
    totalQty: row.totalQty,
    availableQty: row.availableQty,
    unavailableQty: row.lockedQty + row.pendingInspectionQty + row.frozenQty,
    unit: row.unit || overview?.unit || '',
    status: row.availableQty > 0 ? '可用' : '暂无可用库存',
    updatedAt: '未记录',
  }))
  const seenWarehouses = new Set(inventoryRows.map((row) => row.warehouseName))
  SUPPLEMENT_WAREHOUSE_SCOPE.forEach((warehouseName) => {
    if (!seenWarehouses.has(warehouseName)) {
      inventoryRows.push({
        warehouseName,
        location: '未记录',
        totalQty: 0,
        availableQty: 0,
        unavailableQty: 0,
        unit: overview?.unit || '',
        status: '暂无库存',
        updatedAt: '未记录',
      })
    }
  })
  return {
    inventoryRows,
    transitRows: (overview?.purchaseInTransit ?? []).map((row) => ({
      purchaseQty: row.purchaseQty,
      arrivedQty: row.arrivedQty,
      pendingQty: row.pendingArrivalQty,
      unit: overview?.unit || '',
      status: row.statusText || '采购在途',
      estimatedArrivalAt: row.estimatedArrivalAt && row.estimatedArrivalAt !== '-' ? row.estimatedArrivalAt : '未记录',
    })),
  }
}

export function buildSupplementSupplyDecision(input: {
  materialDemandId: string
  materialSku: string
  requiredQty: number
  unit: string
  checkedAt: string
  confirmUncovered?: boolean
}): SupplementMaterialSupplyDecisionSnapshot {
  const facts = readSupplyFacts(input.materialSku)
  const inventoryRows = (facts.inventoryRows ?? []).map((row) => ({
    ...row,
    totalQty: roundQty(row.totalQty),
    availableQty: roundQty(row.availableQty),
    unavailableQty: roundQty(row.unavailableQty),
    unitMatched: row.unit === input.unit,
  }))
  const availableInventoryCoverageQty = roundQty(Math.min(
    input.requiredQty,
    inventoryRows.filter((row) => row.unitMatched).reduce((sum, row) => sum + row.availableQty, 0),
  ))
  const remainingAfterInventory = roundQty(input.requiredQty - availableInventoryCoverageQty)
  const transitRows = facts.transitRows ?? []
  const existingTransitRows = transitRows.map((row) => ({
    ...row,
    purchaseQty: roundQty(row.purchaseQty),
    arrivedQty: roundQty(row.arrivedQty),
    pendingQty: roundQty(row.pendingQty),
    estimatedArrivalAt: row.estimatedArrivalAt || '未记录',
    unitMatched: row.unit === input.unit,
  }))
  const matchedTransit = transitRows.filter((row) => row.unit === input.unit)
  const existingTransitCoverageQty = roundQty(Math.min(
    remainingAfterInventory,
    matchedTransit.reduce((sum, row) => sum + Math.max(row.pendingQty, 0), 0),
  ))
  const uncoveredQty = roundQty(remainingAfterInventory - existingTransitCoverageQty)
  const hasNoSource = availableInventoryCoverageQty <= 0 && existingTransitCoverageQty <= 0 && uncoveredQty > 0
  const mismatchedUnits = [
    ...inventoryRows.filter((row) => !row.unitMatched && row.totalQty > 0).map((row) => `${row.warehouseName}库存单位 ${row.unit}`),
    ...transitRows.filter((row) => row.unit !== input.unit && row.pendingQty > 0).map((row) => `采购在途单位 ${row.unit}`),
  ]
  const existingTransitSummary = matchedTransit.length
    ? {
        inTransitQty: roundQty(matchedTransit.reduce((sum, row) => sum + row.purchaseQty, 0)),
        arrivedQty: roundQty(matchedTransit.reduce((sum, row) => sum + row.arrivedQty, 0)),
        pendingQty: roundQty(matchedTransit.reduce((sum, row) => sum + row.pendingQty, 0)),
        unit: input.unit,
        status: [...new Set(matchedTransit.map((row) => row.status))].join('、') || '采购在途',
        estimatedArrivalAt: [...new Set(matchedTransit.map((row) => row.estimatedArrivalAt).filter(Boolean))].join('、') || '未记录',
        unitMatched: true,
      }
    : null
  return {
    materialDemandId: input.materialDemandId,
    materialSku: input.materialSku,
    requiredQty: roundQty(input.requiredQty),
    unit: input.unit,
    inventoryRows,
    availableInventoryCoverageQty,
    existingTransitSummary,
    existingTransitRows,
    existingTransitCoverageQty,
    uncoveredQty,
    recommendation: hasNoSource ? '不建议创建' : '可继续',
    businessDecision: uncoveredQty > 0 ? (input.confirmUncovered ? '确认继续' : '取消') : '无需确认',
    newPurchaseRequired: uncoveredQty > 0 && input.confirmUncovered === true,
    checkedAt: input.checkedAt,
    warnings: mismatchedUnits.length ? [`${mismatchedUnits.join('、')}与需求单位 ${input.unit} 不一致，未参与覆盖计算`] : [],
  }
}

export function buildSupplementSupplyDecisions(input: {
  demands: Array<{ key: string; materialSku: string; requiredQty: number; unit: string }>
  checkedAt: string
  confirmUncovered?: boolean
}): SupplementMaterialSupplyDecisionSnapshot[] {
  return input.demands.map((demand) => buildSupplementSupplyDecision({
    materialDemandId: demand.key,
    materialSku: demand.materialSku,
    requiredQty: demand.requiredQty,
    unit: demand.unit,
    checkedAt: input.checkedAt,
    confirmUncovered: input.confirmUncovered,
  }))
}
