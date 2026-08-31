export interface SpecialCraftSourceTaskRequest {
  workOrderId: string
  productionOrderId: string
  productionOrderNo: string
  operationId: string
  operationName: string
  craftCode: string
  factoryId: string
  factoryName: string
  planQty: number
  qtyUnit: string
  createdAt: string
  dueAt: string
}

export interface SpecialCraftSourceTaskIdentity {
  taskId: string
  taskNo: string
}

export interface SpecialCraftChildOrderState {
  workOrderId: string
  status: string
  updatedAt?: string
}

interface SpecialCraftSourceTaskAdapter {
  ensureTask(request: SpecialCraftSourceTaskRequest): SpecialCraftSourceTaskIdentity
  reconcileTask(taskId: string, childOrders: SpecialCraftChildOrderState[]): void
}

let adapter: SpecialCraftSourceTaskAdapter | null = null

export function buildSpecialCraftSourceTaskIdentity(
  request: Pick<SpecialCraftSourceTaskRequest, 'productionOrderId' | 'operationId' | 'craftCode'>,
): SpecialCraftSourceTaskIdentity {
  const orderToken = request.productionOrderId.replace(/[^A-Za-z0-9]/g, '').slice(-16) || 'PO'
  const operationToken = request.operationId.replace(/[^A-Za-z0-9]/g, '').slice(-18) || request.craftCode
  const taskId = `TASK-SC-${orderToken}-${operationToken}`
  return { taskId, taskNo: taskId }
}

export function registerSpecialCraftSourceTaskAdapter(nextAdapter: SpecialCraftSourceTaskAdapter): void {
  adapter = nextAdapter
}

export function ensureSpecialCraftSourceTask(
  request: SpecialCraftSourceTaskRequest,
): SpecialCraftSourceTaskIdentity {
  return adapter?.ensureTask(request) || buildSpecialCraftSourceTaskIdentity(request)
}

export function reconcileSpecialCraftSourceTask(
  taskId: string,
  childOrders: SpecialCraftChildOrderState[],
): void {
  adapter?.reconcileTask(taskId, childOrders)
}
