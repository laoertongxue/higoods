export type CombinedDyeingTaskStatus = 'WAIT_DYEING' | 'COMPLETED' | 'DELETED'

export type CombinedDyeingSatisfaction = 'FULL' | 'PARTIAL' | 'UNMET'

export interface CombinedDyeingMemberSnapshot {
  dyeWorkOrderId: string
  dyeWorkOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  productionOrderOrderedAt: string
  requiredQty: number
  effectiveSatisfiedQtyBeforeTask: number
  qtyUnit: string
}

export interface CombinedDyeingMemberAllocation extends CombinedDyeingMemberSnapshot {
  allocatedQty: number
  satisfaction: CombinedDyeingSatisfaction
  unmetQty: number
}

export interface CombinedDyeingAllocationResult {
  allocations: CombinedDyeingMemberAllocation[]
  excessQty: number
}

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label}必须是有限数`)
  }
}

function normalizeQuantity(value: number): number {
  const normalized = Number(value.toPrecision(15))
  return Object.is(normalized, -0) ? 0 : normalized
}

function hasValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(value)
  if (!match || !Number.isFinite(Date.parse(value))) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1]!
}

function assertUniqueMembers(members: readonly CombinedDyeingMemberSnapshot[]): void {
  const dyeWorkOrderIds = new Set<string>()
  const dyeWorkOrderNos = new Set<string>()
  const productionOrderIds = new Set<string>()
  const productionOrderNos = new Set<string>()

  for (const member of members) {
    if (dyeWorkOrderIds.has(member.dyeWorkOrderId) || dyeWorkOrderNos.has(member.dyeWorkOrderNo)) {
      throw new Error('合并染色成员不得包含重复染色加工单')
    }
    if (productionOrderIds.has(member.productionOrderId) || productionOrderNos.has(member.productionOrderNo)) {
      throw new Error('合并染色成员不得包含重复生产单')
    }
    dyeWorkOrderIds.add(member.dyeWorkOrderId)
    dyeWorkOrderNos.add(member.dyeWorkOrderNo)
    productionOrderIds.add(member.productionOrderId)
    productionOrderNos.add(member.productionOrderNo)
  }
}

function validateMembers(members: readonly CombinedDyeingMemberSnapshot[]): void {
  if (members.length === 0) {
    throw new Error('合并染色分配至少包含 1 个成员')
  }

  const qtyUnit = members[0]!.qtyUnit
  if (!qtyUnit.trim()) {
    throw new Error('成员数量单位不能为空')
  }

  for (const member of members) {
    assertFiniteNumber(member.requiredQty, '需求数量')
    if (member.requiredQty <= 0) {
      throw new Error('需求数量必须大于 0')
    }

    assertFiniteNumber(member.effectiveSatisfiedQtyBeforeTask, '任务前已满足数量')
    if (member.effectiveSatisfiedQtyBeforeTask < 0 || member.effectiveSatisfiedQtyBeforeTask > member.requiredQty) {
      throw new Error('任务前已满足数量必须在 0 到需求数量之间')
    }

    if (member.qtyUnit !== qtyUnit) {
      throw new Error('合并染色成员数量单位必须一致')
    }

    if (!member.productionOrderOrderedAt.trim() || !hasValidCalendarDate(member.productionOrderOrderedAt)) {
      throw new Error('生产单下单时间不能为空且必须是合法日期')
    }
  }

  assertUniqueMembers(members)
}

function compareMembers(left: CombinedDyeingMemberSnapshot, right: CombinedDyeingMemberSnapshot): number {
  const timeDifference = Date.parse(left.productionOrderOrderedAt) - Date.parse(right.productionOrderOrderedAt)
  if (timeDifference !== 0) return timeDifference
  if (left.productionOrderNo < right.productionOrderNo) return -1
  if (left.productionOrderNo > right.productionOrderNo) return 1
  return 0
}

export function allocateCombinedDyeingOutput(
  members: readonly CombinedDyeingMemberSnapshot[],
  actualOutputQty: number,
): CombinedDyeingAllocationResult {
  assertFiniteNumber(actualOutputQty, '实际产出数量')
  if (actualOutputQty < 0) {
    throw new Error('实际产出数量不得小于 0')
  }
  validateMembers(members)

  let remainingOutputQty = normalizeQuantity(actualOutputQty)
  const allocations = [...members].sort(compareMembers).map((member): CombinedDyeingMemberAllocation => {
    const remainingNeed = normalizeQuantity(Math.max(member.requiredQty - member.effectiveSatisfiedQtyBeforeTask, 0))
    const allocatedQty = normalizeQuantity(Math.min(remainingNeed, remainingOutputQty))
    const unmetQty = normalizeQuantity(remainingNeed - allocatedQty)
    remainingOutputQty = normalizeQuantity(remainingOutputQty - allocatedQty)

    const satisfaction: CombinedDyeingSatisfaction = unmetQty === 0
      ? 'FULL'
      : allocatedQty > 0
        ? 'PARTIAL'
        : 'UNMET'

    return {
      dyeWorkOrderId: member.dyeWorkOrderId,
      dyeWorkOrderNo: member.dyeWorkOrderNo,
      productionOrderId: member.productionOrderId,
      productionOrderNo: member.productionOrderNo,
      productionOrderOrderedAt: member.productionOrderOrderedAt,
      requiredQty: member.requiredQty,
      effectiveSatisfiedQtyBeforeTask: member.effectiveSatisfiedQtyBeforeTask,
      qtyUnit: member.qtyUnit,
      allocatedQty,
      satisfaction,
      unmetQty,
    }
  })

  return {
    allocations,
    excessQty: remainingOutputQty,
  }
}
