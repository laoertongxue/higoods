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

function parseProductionOrderOrderedAt(value: string): number {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    throw new Error('生产单下单时间仅支持无时区格式 YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss')
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) {
    throw new Error('生产单下单时间必须使用 YYYY-MM-DD HH:mm:ss 或 YYYY-MM-DDTHH:mm:ss')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  const hasValidDate = year >= 1
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]!
  const hasValidTime = hour >= 0 && hour <= 23
    && minute >= 0 && minute <= 59
    && second >= 0 && second <= 59
  if (!hasValidDate || !hasValidTime) {
    throw new Error('生产单下单时间包含非法日期或时分秒')
  }

  return year * 10_000_000_000
    + month * 100_000_000
    + day * 1_000_000
    + hour * 10_000
    + minute * 100
    + second
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

interface ValidatedCombinedDyeingMember {
  member: CombinedDyeingMemberSnapshot
  orderedAtSortKey: number
}

function canonicalizeMember(member: CombinedDyeingMemberSnapshot): CombinedDyeingMemberSnapshot {
  const dyeWorkOrderId = member.dyeWorkOrderId.trim()
  const dyeWorkOrderNo = member.dyeWorkOrderNo.trim()
  const productionOrderId = member.productionOrderId.trim()
  const productionOrderNo = member.productionOrderNo.trim()
  const requiredIdentities = [
    [dyeWorkOrderId, '染色加工单 ID'],
    [dyeWorkOrderNo, '染色加工单号'],
    [productionOrderId, '生产单 ID'],
    [productionOrderNo, '生产单号'],
  ] as const
  for (const [value, label] of requiredIdentities) {
    if (!value) throw new Error(`${label}不能为空`)
  }

  return {
    ...member,
    dyeWorkOrderId,
    dyeWorkOrderNo,
    productionOrderId,
    productionOrderNo,
  }
}

function validateMembers(members: readonly CombinedDyeingMemberSnapshot[]): ValidatedCombinedDyeingMember[] {
  if (members.length === 0) {
    throw new Error('合并染色分配至少包含 1 个成员')
  }

  const qtyUnit = members[0]!.qtyUnit
  if (!qtyUnit.trim()) {
    throw new Error('成员数量单位不能为空')
  }

  const validatedMembers = members.map((sourceMember): ValidatedCombinedDyeingMember => {
    const member = canonicalizeMember(sourceMember)
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

    const orderedAtSortKey = parseProductionOrderOrderedAt(member.productionOrderOrderedAt)
    return { member, orderedAtSortKey }
  })

  assertUniqueMembers(validatedMembers.map((item) => item.member))
  return validatedMembers
}

function compareMembers(left: ValidatedCombinedDyeingMember, right: ValidatedCombinedDyeingMember): number {
  const timeDifference = left.orderedAtSortKey - right.orderedAtSortKey
  if (timeDifference !== 0) return timeDifference
  if (left.member.productionOrderNo < right.member.productionOrderNo) return -1
  if (left.member.productionOrderNo > right.member.productionOrderNo) return 1
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
  const validatedMembers = validateMembers(members)

  let remainingOutputQty = normalizeQuantity(actualOutputQty)
  const allocations = validatedMembers.sort(compareMembers).map(({ member }): CombinedDyeingMemberAllocation => {
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
