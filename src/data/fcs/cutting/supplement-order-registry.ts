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

export type RegisterSupplementOrderInput = Omit<
  SupplementOrderLifecycle,
  'sequenceNo' | 'status' | 'completedAt' | 'completedBy'
>

const supplementOrders = new Map<string, SupplementOrderLifecycle>()

export function listSupplementOrdersByCutOrder(
  cutOrderId: string,
): SupplementOrderLifecycle[] {
  return [...supplementOrders.values()]
    .filter((order) => order.cutOrderId === cutOrderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo)
}

export function getSupplementOrder(id: string): SupplementOrderLifecycle | undefined {
  return supplementOrders.get(id)
}

export function registerSupplementOrder(
  input: RegisterSupplementOrderInput,
): SupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (existing) return existing

  const order: SupplementOrderLifecycle = {
    ...input,
    sequenceNo: listSupplementOrdersByCutOrder(input.cutOrderId).length + 1,
    status: '未完成',
    completedAt: '',
    completedBy: '',
  }
  supplementOrders.set(order.id, order)
  return order
}

export function completeSupplementOrder(input: {
  id: string
  completedAt: string
  completedBy: string
}): SupplementOrderLifecycle {
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
  return completed
}

export function resetSupplementOrderRegistryForTesting(): void {
  supplementOrders.clear()
}
