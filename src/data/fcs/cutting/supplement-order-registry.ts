export type SupplementOrderStatus = '未完成' | '已完成'

export interface SupplementOrderLifecycle {
  id: string
  recordNo: string
  cutOrderId: string
  cutOrderNo: string
  productionOrderNo: string
  sequenceNo: number
  status: SupplementOrderStatus
  reason: string
  totalQty: number
  lineSummary: string
  createdAt: string
  createdBy: string
  completedAt: string
  completedBy: string
}

export type ReadonlySupplementOrderLifecycle = Readonly<SupplementOrderLifecycle>

export type RegisterSupplementOrderInput = Omit<
  SupplementOrderLifecycle,
  'sequenceNo' | 'status' | 'completedAt' | 'completedBy'
>

const supplementOrders = new Map<string, SupplementOrderLifecycle>()

function cloneSupplementOrder(
  order: SupplementOrderLifecycle,
): ReadonlySupplementOrderLifecycle {
  return { ...order }
}

function hasSameBusinessIdentity(
  existing: SupplementOrderLifecycle,
  input: RegisterSupplementOrderInput,
): boolean {
  return existing.id === input.id
    && existing.recordNo === input.recordNo
    && existing.cutOrderId === input.cutOrderId
    && existing.cutOrderNo === input.cutOrderNo
    && existing.productionOrderNo === input.productionOrderNo
}

export function listSupplementOrdersByCutOrder(
  cutOrderId: string,
): ReadonlyArray<ReadonlySupplementOrderLifecycle> {
  return [...supplementOrders.values()]
    .filter((order) => order.cutOrderId === cutOrderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo)
    .map(cloneSupplementOrder)
}

export function getSupplementOrder(id: string): ReadonlySupplementOrderLifecycle | undefined {
  const order = supplementOrders.get(id)
  return order ? cloneSupplementOrder(order) : undefined
}

export function registerSupplementOrder(
  input: RegisterSupplementOrderInput,
): ReadonlySupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (existing) {
    if (!hasSameBusinessIdentity(existing, input)) {
      throw new Error('补料单标识冲突，不能登记到不同业务对象。')
    }
    return cloneSupplementOrder(existing)
  }

  const order: SupplementOrderLifecycle = {
    ...input,
    sequenceNo: listSupplementOrdersByCutOrder(input.cutOrderId).length + 1,
    status: '未完成',
    completedAt: '',
    completedBy: '',
  }
  supplementOrders.set(order.id, order)
  return cloneSupplementOrder(order)
}

export function completeSupplementOrder(input: {
  id: string
  completedAt: string
  completedBy: string
}): ReadonlySupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (!existing) {
    throw new Error('未找到对应补料单，请刷新后重试。')
  }
  if (existing.status === '已完成') {
    throw new Error('该补料单已完成，无需重复操作。')
  }

  const completed: SupplementOrderLifecycle = {
    ...existing,
    status: '已完成',
    completedAt: input.completedAt,
    completedBy: input.completedBy,
  }
  supplementOrders.set(completed.id, completed)
  return cloneSupplementOrder(completed)
}

export function resetSupplementOrderRegistryForTesting(): void {
  supplementOrders.clear()
}
