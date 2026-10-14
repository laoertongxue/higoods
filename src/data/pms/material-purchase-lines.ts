import type { PmsMaterialPurchaseOrder } from './material-purchase-orders.ts'

/** A purchase line owns quantities and price; order totals are display projections. */
export interface PmsMaterialPurchaseOrderLine {
  lineId: string
  materialCode: string
  materialName: string
  materialSpu: string
  materialSkuId?: string
  materialId?: string
  imageUrl: string
  unit: string
  orderedQty: number
  plannedRolls: number
  unitPrice: number
  actualPurchasedQty: number
  actualPurchasedRolls?: number
  sellerReceivedQty: number
  inboundQty: number
  priceConfirmed: boolean
  weightKg?: number
  volumeM3?: number
  colorName?: string
  specName?: string
  sourceRequirementLineNo?: string
  /** Read-only compatibility identity. Reading never persists this mapped row. */
  legacy?: true
}

export function getPmsMaterialPurchaseOrderLines(order: PmsMaterialPurchaseOrder): PmsMaterialPurchaseOrderLine[] {
  if (order.lines?.length) return structuredClone(order.lines)
  return [{
    lineId: `${order.purchaseOrderNo}:L1`, materialCode: order.materialCode,
    materialName: order.materialName, materialSpu: order.materialSpu || '',
    materialSkuId: order.pcsSource?.materialSkuId, materialId: order.pcsSource?.materialId,
    imageUrl: order.materialImageUrl, unit: order.unit, orderedQty: order.orderedQty,
    plannedRolls: order.plannedRolls || 0, unitPrice: order.unitPrice,
    actualPurchasedQty: order.actualPurchasedQty || 0,
    actualPurchasedRolls: order.actualPurchasedRolls || 0,
    sellerReceivedQty: order.sellerReceivedQty ?? order.receivedQty,
    inboundQty: (order.inventoryPosting?.qty || 0) + (order.defectInventoryPosting?.qty || 0),
    priceConfirmed: Boolean(order.priceConfirmed), weightKg: order.weightKg, volumeM3: order.volumeM3,
    sourceRequirementLineNo: order.sourceRequirementLineNo || undefined, legacy: true,
  }]
}

export function findPmsMaterialPurchaseOrderLine(order: PmsMaterialPurchaseOrder, identity: string): PmsMaterialPurchaseOrderLine | undefined {
  return getPmsMaterialPurchaseOrderLines(order).find(line => line.lineId === identity || line.materialCode === identity)
}

export function pmsMaterialPurchaseOrderAmount(order: PmsMaterialPurchaseOrder, basis: 'planned' | 'actual' = 'planned'): number {
  return Math.round(getPmsMaterialPurchaseOrderLines(order).reduce((sum, line) => sum + (basis === 'actual' ? line.actualPurchasedQty : line.orderedQty) * line.unitPrice, 0) * 100) / 100
}

export function pmsMaterialPurchaseQuantityGroups(order: PmsMaterialPurchaseOrder) {
  const groups = new Map<string, { unit: string; orderedQty: number; actualPurchasedQty: number; sellerReceivedQty: number; inboundQty: number; plannedRolls: number }>()
  for (const line of getPmsMaterialPurchaseOrderLines(order)) {
    const row = groups.get(line.unit) || { unit: line.unit, orderedQty: 0, actualPurchasedQty: 0, sellerReceivedQty: 0, inboundQty: 0, plannedRolls: 0 }
    for (const key of ['orderedQty', 'actualPurchasedQty', 'sellerReceivedQty', 'inboundQty', 'plannedRolls'] as const) row[key] += line[key]
    groups.set(line.unit, row)
  }
  return [...groups.values()].map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value])) as typeof row)
}

export function pmsMaterialPurchaseBarcodeLimit(order: PmsMaterialPurchaseOrder, lineId: string): number | undefined {
  const line = findPmsMaterialPurchaseOrderLine(order, lineId)
  return line && line.actualPurchasedQty > 0 ? line.actualPurchasedQty : line?.legacy ? line.orderedQty : undefined
}

export function pmsMaterialPurchaseSellerArrivalStatus(order: PmsMaterialPurchaseOrder): '未确认' | '部分到货' | '全部到货' {
  const lines=getPmsMaterialPurchaseOrderLines(order)
  if(!lines.some(line=>line.sellerReceivedQty>0))return '未确认'
  return lines.every(line=>line.sellerReceivedQty>0 && line.sellerReceivedQty>=(line.actualPurchasedQty||line.orderedQty))?'全部到货':'部分到货'
}

/** Only called inside a saved mutation, never hydration or an ordinary read. */
export function syncPmsMaterialPurchaseLineProjection(order: PmsMaterialPurchaseOrder): void {
  if (!order.lines?.length) return
  const lines = order.lines, first = lines[0], units = new Set(lines.map(line => line.unit))
  order.materialCode = first.materialCode
  order.materialSpu = first.materialSpu
  order.materialName = first.materialName
  order.materialImageUrl = first.imageUrl
  order.unit = units.size === 1 ? first.unit : '多单位'
  order.orderedQty = units.size === 1 ? lines.reduce((sum, line) => sum + line.orderedQty, 0) : 0
  order.receivedQty = units.size === 1 ? lines.reduce((sum, line) => sum + line.sellerReceivedQty, 0) : 0
  order.actualPurchasedQty = units.size === 1 ? lines.reduce((sum, line) => sum + line.actualPurchasedQty, 0) : 0
  order.actualPurchasedRolls = lines.reduce((sum, line) => sum + (line.actualPurchasedRolls||0), 0)
  order.sellerReceivedQty = order.receivedQty
  order.plannedRolls = lines.reduce((sum, line) => sum + line.plannedRolls, 0)
  order.unitPrice = lines.length === 1 ? first.unitPrice : 0
  order.priceConfirmed = lines.every(line => line.priceConfirmed)
  if (lines.length === 1) { order.weightKg = first.weightKg; order.volumeM3 = first.volumeM3 }
}
