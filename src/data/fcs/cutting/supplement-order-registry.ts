export type SupplementOrderStatus = '未完成' | '已完成'

export interface SupplementOrderLineFact {
  readonly color: string
  readonly size: string
  readonly supplementQty: number
}

export interface SupplementOrderMaterialDemandFact {
  readonly materialSku: string
  readonly materialName: string
  readonly requiredQty: number
  readonly unit: string
}

export interface SupplementOrderLifecycle {
  readonly id: string
  readonly recordNo: string
  readonly cutOrderId: string
  readonly cutOrderNo: string
  readonly productionOrderNo: string
  readonly sequenceNo: number
  readonly status: SupplementOrderStatus
  readonly reason: string
  readonly reasonDetail: string
  readonly totalQty: number
  readonly lineSummary: string
  readonly lines: ReadonlyArray<SupplementOrderLineFact>
  readonly materialDemands: ReadonlyArray<SupplementOrderMaterialDemandFact>
  readonly createdAt: string
  readonly createdBy: string
  readonly completedAt: string
  readonly completedBy: string
}

type MutableSupplementOrderLifecycle = {
  -readonly [Key in keyof SupplementOrderLifecycle]: SupplementOrderLifecycle[Key]
}

export type RegisterSupplementOrderInput = Omit<
  SupplementOrderLifecycle,
  'sequenceNo' | 'status' | 'completedAt' | 'completedBy'
>

const supplementOrders = new Map<string, MutableSupplementOrderLifecycle>()

function cloneSupplementOrder(
  order: SupplementOrderLifecycle,
): SupplementOrderLifecycle {
  return {
    ...order,
    lines: order.lines.map((line) => ({ ...line })),
    materialDemands: order.materialDemands.map((demand) => ({ ...demand })),
  }
}

function hasSameBusinessIdentity(
  existing: MutableSupplementOrderLifecycle,
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
): ReadonlyArray<SupplementOrderLifecycle> {
  return [...supplementOrders.values()]
    .filter((order) => order.cutOrderId === cutOrderId)
    .sort((left, right) => left.sequenceNo - right.sequenceNo)
    .map(cloneSupplementOrder)
}

export function listSupplementOrders(): ReadonlyArray<SupplementOrderLifecycle> {
  return [...supplementOrders.values()].map(cloneSupplementOrder)
}

export function getSupplementOrder(id: string): SupplementOrderLifecycle | undefined {
  const order = supplementOrders.get(id)
  return order ? cloneSupplementOrder(order) : undefined
}

export function registerSupplementOrder(
  input: RegisterSupplementOrderInput,
): SupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (existing) {
    if (!hasSameBusinessIdentity(existing, input)) {
      throw new Error('补料单标识冲突，不能登记到不同业务对象。')
    }
    return cloneSupplementOrder(existing)
  }

  const order: MutableSupplementOrderLifecycle = {
    ...input,
    lines: input.lines.map((line) => ({ ...line })),
    materialDemands: input.materialDemands.map((demand) => ({ ...demand })),
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
}): SupplementOrderLifecycle {
  const existing = supplementOrders.get(input.id)
  if (!existing) {
    throw new Error('未找到对应补料单，请刷新后重试。')
  }
  if (existing.status === '已完成') {
    throw new Error('该补料单已完成，无需重复操作。')
  }

  const completed: MutableSupplementOrderLifecycle = {
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
