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

const COMBINED_DYEING_QTY_SCALE = 1000
const COMBINED_DYEING_BINARY_TAIL_TOLERANCE = Number.EPSILON * 4
const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER)

function parseExactDecimalMinorUnits(decimalText: string): bigint | null {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(decimalText)
  if (!match) return null

  const sign = match[1] === '-' ? -1n : 1n
  const integerDigits = match[2]!
  const fractionDigits = match[3] ?? ''
  const exponent = Number(match[4] ?? 0)
  const coefficientDigits = `${integerDigits}${fractionDigits}`
  const minorUnitPower = exponent - fractionDigits.length + 3

  let minorUnits: bigint
  if (minorUnitPower >= 0) {
    minorUnits = BigInt(`${coefficientDigits}${'0'.repeat(minorUnitPower)}`)
  } else {
    const digitsToRemove = -minorUnitPower
    if (digitsToRemove > coefficientDigits.length) return null
    const removedDigits = coefficientDigits.slice(-digitsToRemove)
    if (!/^0+$/.test(removedDigits)) return null
    minorUnits = BigInt(coefficientDigits.slice(0, -digitsToRemove) || '0')
  }

  return sign * minorUnits
}

export function parseCombinedDyeingQuantityMinorUnits(value: number, label = '数量'): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label}必须是有限数`)
  }
  if (Math.abs(value) > Number.MAX_SAFE_INTEGER / COMBINED_DYEING_QTY_SCALE) {
    throw new Error(`${label}超过安全上限，乘 1000 后必须不大于 Number.MAX_SAFE_INTEGER`)
  }

  const exactMinorUnits = parseExactDecimalMinorUnits(value.toString())
  if (exactMinorUnits !== null) {
    if (exactMinorUnits < -MAX_SAFE_MINOR_UNITS || exactMinorUnits > MAX_SAFE_MINOR_UNITS) {
      throw new Error(`${label}超过安全上限，乘 1000 后必须是安全整数`)
    }
    return Number(exactMinorUnits)
  }

  const roundedMinorUnits = Math.round(value * COMBINED_DYEING_QTY_SCALE)
  if (value !== 0 && roundedMinorUnits === 0) {
    throw new Error(`${label}最多 3 位小数，非零数量不得规范化为 0`)
  }
  const normalizedQuantity = roundedMinorUnits / COMBINED_DYEING_QTY_SCALE
  if (Math.abs(value - normalizedQuantity) > COMBINED_DYEING_BINARY_TAIL_TOLERANCE) {
    throw new Error(`${label}最多 3 位小数`)
  }
  if (!Number.isSafeInteger(roundedMinorUnits)) {
    throw new Error(`${label}超过安全上限，乘 1000 后必须是安全整数`)
  }

  return Object.is(roundedMinorUnits, -0) ? 0 : roundedMinorUnits
}

function fromQuantityMinorUnits(value: number): number {
  return value / COMBINED_DYEING_QTY_SCALE
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
  requiredMinorUnits: number
  satisfiedBeforeMinorUnits: number
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
    qtyUnit: member.qtyUnit.trim(),
  }
}

function validateMembers(members: readonly CombinedDyeingMemberSnapshot[]): ValidatedCombinedDyeingMember[] {
  if (members.length === 0) {
    throw new Error('合并染色分配至少包含 1 个成员')
  }

  const canonicalMembers = members.map(canonicalizeMember)
  const qtyUnit = canonicalMembers[0]!.qtyUnit
  if (!qtyUnit) {
    const firstMember = canonicalMembers[0]!
    throw new Error(`染色加工单 ${firstMember.dyeWorkOrderNo}/生产单 ${firstMember.productionOrderNo} 的数量单位不能为空`)
  }

  const validatedMembers = canonicalMembers.map((member): ValidatedCombinedDyeingMember => {
    const memberIdentity = `染色加工单 ${member.dyeWorkOrderNo}/生产单 ${member.productionOrderNo}`
    if (member.requiredQty <= 0) {
      throw new Error(`${memberIdentity} 的需求数量必须大于 0`)
    }
    const requiredMinorUnits = parseCombinedDyeingQuantityMinorUnits(member.requiredQty, `${memberIdentity} 的需求数量`)

    if (member.effectiveSatisfiedQtyBeforeTask < 0) {
      throw new Error(`${memberIdentity} 的任务前已满足数量必须在 0 到需求数量之间`)
    }
    const satisfiedBeforeMinorUnits = parseCombinedDyeingQuantityMinorUnits(
      member.effectiveSatisfiedQtyBeforeTask,
      `${memberIdentity} 的任务前已满足数量`,
    )
    if (satisfiedBeforeMinorUnits > requiredMinorUnits) {
      throw new Error(`${memberIdentity} 的任务前已满足数量必须在 0 到需求数量之间`)
    }

    if (member.qtyUnit !== qtyUnit) {
      throw new Error(`${memberIdentity} 的数量单位必须一致`)
    }

    const orderedAtSortKey = parseProductionOrderOrderedAt(member.productionOrderOrderedAt)
    return {
      member: {
        ...member,
        requiredQty: fromQuantityMinorUnits(requiredMinorUnits),
        effectiveSatisfiedQtyBeforeTask: fromQuantityMinorUnits(satisfiedBeforeMinorUnits),
      },
      orderedAtSortKey,
      requiredMinorUnits,
      satisfiedBeforeMinorUnits,
    }
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
  if (actualOutputQty < 0) {
    throw new Error('实际产出数量不得小于 0')
  }
  const actualOutputMinorUnits = parseCombinedDyeingQuantityMinorUnits(actualOutputQty, '实际产出数量')
  const validatedMembers = validateMembers(members)

  let remainingOutputMinorUnits = actualOutputMinorUnits
  const allocations = validatedMembers.sort(compareMembers).map(({
    member,
    requiredMinorUnits,
    satisfiedBeforeMinorUnits,
  }): CombinedDyeingMemberAllocation => {
    const remainingNeedMinorUnits = requiredMinorUnits - satisfiedBeforeMinorUnits
    const allocatedMinorUnits = Math.min(remainingNeedMinorUnits, remainingOutputMinorUnits)
    const unmetMinorUnits = remainingNeedMinorUnits - allocatedMinorUnits
    remainingOutputMinorUnits -= allocatedMinorUnits

    const allocatedQty = fromQuantityMinorUnits(allocatedMinorUnits)
    const unmetQty = fromQuantityMinorUnits(unmetMinorUnits)

    const satisfaction: CombinedDyeingSatisfaction = unmetMinorUnits === 0
      ? 'FULL'
      : allocatedMinorUnits > 0
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
    excessQty: fromQuantityMinorUnits(remainingOutputMinorUnits),
  }
}
