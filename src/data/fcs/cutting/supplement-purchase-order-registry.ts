export type SupplementPurchaseStatus = '采购中' | '部分到货' | '已到货'

export interface SupplementCreatedPurchaseOrder {
  purchaseOrderId: string
  purchaseOrderNo: string
  supplementOrderId: string
  materialDemandId: string
  materialSku: string
  createdAt: string
  purchaseQty: number
  arrivedQty: number
  pendingQty: number
  unit: string
  status: SupplementPurchaseStatus
  estimatedArrivalAt?: string
}

export type SupplementCreatedPurchaseOrderRef = Pick<SupplementCreatedPurchaseOrder,
  'purchaseOrderId' | 'purchaseOrderNo' | 'materialDemandId' | 'materialSku' | 'purchaseQty' | 'unit'>

const purchaseOrders = new Map<string, SupplementCreatedPurchaseOrder>()

function makeId(supplementOrderId: string, materialDemandId: string, purchaseLineKey = '1'): string {
  return `SUP-PO:${supplementOrderId}:${materialDemandId}:${purchaseLineKey}`
}

export function registerSupplementPurchaseOrder(input: {
  supplementOrderId: string
  materialDemandId: string
  materialSku: string
  purchaseQty: number
  unit: string
  createdAt: string
  purchaseLineKey?: string
}): SupplementCreatedPurchaseOrder {
  if (!Number.isFinite(input.purchaseQty) || input.purchaseQty <= 0) {
    throw new Error('补料采购数量必须大于 0。')
  }
  const purchaseOrderId = makeId(input.supplementOrderId, input.materialDemandId, input.purchaseLineKey)
  const existing = purchaseOrders.get(purchaseOrderId)
  if (existing) return structuredClone(existing)
  const order: SupplementCreatedPurchaseOrder = {
    purchaseOrderId,
    purchaseOrderNo: `CG-${purchaseOrderId.replace(/[^A-Za-z0-9]/g, '').slice(-12).toUpperCase()}`,
    supplementOrderId: input.supplementOrderId,
    materialDemandId: input.materialDemandId,
    materialSku: input.materialSku,
    createdAt: input.createdAt,
    purchaseQty: Number(input.purchaseQty.toFixed(2)),
    arrivedQty: 0,
    pendingQty: Number(input.purchaseQty.toFixed(2)),
    unit: input.unit,
    status: '采购中',
  }
  purchaseOrders.set(purchaseOrderId, order)
  return structuredClone(order)
}

export function listSupplementPurchaseOrders(supplementOrderId?: string): SupplementCreatedPurchaseOrder[] {
  return [...purchaseOrders.values()]
    .filter((order) => !supplementOrderId || order.supplementOrderId === supplementOrderId)
    .map((order) => structuredClone(order))
}

export function removeSupplementPurchaseOrders(supplementOrderId: string): void {
  for (const [id, order] of purchaseOrders) {
    if (order.supplementOrderId === supplementOrderId) purchaseOrders.delete(id)
  }
}

export function updateSupplementPurchaseArrival(input: { purchaseOrderId: string; arrivedQty: number; estimatedArrivalAt?: string }): SupplementCreatedPurchaseOrder {
  const existing = purchaseOrders.get(input.purchaseOrderId)
  if (!existing) throw new Error('未找到本次补料采购单。')
  const arrivedQty = Math.min(Math.max(input.arrivedQty, 0), existing.purchaseQty)
  const order: SupplementCreatedPurchaseOrder = {
    ...existing,
    arrivedQty,
    pendingQty: Number((existing.purchaseQty - arrivedQty).toFixed(2)),
    status: arrivedQty >= existing.purchaseQty ? '已到货' : arrivedQty > 0 ? '部分到货' : '采购中',
    ...(input.estimatedArrivalAt ? { estimatedArrivalAt: input.estimatedArrivalAt } : {}),
  }
  purchaseOrders.set(order.purchaseOrderId, order)
  return structuredClone(order)
}

export function resetSupplementPurchaseOrderRegistryForTesting(): void {
  purchaseOrders.clear()
}
