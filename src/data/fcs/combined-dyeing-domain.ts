import {
  getCanonicalDyeWorkOrderById,
  type CanonicalDyeWorkOrder,
} from './dye-work-order-canonical-registry.ts'
import type {
  FormalProductionOrderProcessSnapshotRecord,
  ProcessWorkOrderChangeImpactReason,
} from './process-work-order-domain.ts'

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

export interface CombinedDyeingTaskMemberSnapshot extends CombinedDyeingMemberSnapshot {
  dyeFactoryId: string
  dyeFactoryName: string
  materialId: string
  rawMaterialSku: string
  materialName: string
  targetColor: string
  dyeProcessCode: string
  dyeProcessName: string
}

export interface CombinedDyeingAllocationVersion {
  versionNo: number
  actualInputQty: number
  actualOutputQty: number
  allocations: CombinedDyeingMemberAllocation[]
  excessQty: number
  operator: string
  operatedAt: string
  reason?: string
  current: boolean
}

export interface CombinedDyeingTask {
  taskId: string
  taskNo: string
  status: CombinedDyeingTaskStatus
  dyeFactoryId: string
  dyeFactoryName: string
  materialId: string
  rawMaterialSku: string
  materialName: string
  targetColor: string
  dyeProcessCode: string
  dyeProcessName: string
  qtyUnit: string
  members: CombinedDyeingTaskMemberSnapshot[]
  actualInputQty?: number
  actualOutputQty?: number
  allocationVersions: CombinedDyeingAllocationVersion[]
  createdBy: string
  createdAt: string
  remark?: string
  completedBy?: string
  completedAt?: string
  deletedBy?: string
  deletedAt?: string
  deleteReason?: string
  changeImpact?: CombinedDyeingProductionChangeImpact[]
}

export interface CombinedDyeingProductionChangeImpact {
  changeRecordId: string
  dyeWorkOrderId: string
  before: FormalProductionOrderProcessSnapshotRecord
  after: FormalProductionOrderProcessSnapshotRecord
  reason: ProcessWorkOrderChangeImpactReason
  recordedAt: string
  suggestedAction: string
}

export interface EffectiveDyeingFulfillment {
  dyeWorkOrderId: string
  requiredQty: number
  effectiveSatisfied: number
  remaining: number
  effectiveSatisfiedQty: number
  remainingNeedQty: number
  satisfaction: CombinedDyeingSatisfaction
}

export interface ActiveCombinedDyeingMembership {
  taskId: string
  taskNo: string
  status: Exclude<CombinedDyeingTaskStatus, 'DELETED'>
}

export interface ProductionChangeProtectedCombinedDyeingMembership {
  taskId: string
  taskNo: string
  status: CombinedDyeingTaskStatus
  protection: 'ACTIVE_MEMBERSHIP' | 'COMPLETED_ALLOCATION'
}

const COMBINED_DYEING_QTY_SCALE = 1000
const COMBINED_DYEING_BINARY_TAIL_TOLERANCE = Number.EPSILON * 4
const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER)
const combinedDyeingTaskStore = new Map<string, CombinedDyeingTask>()
let combinedDyeingTaskSequence = 1

function deepClone<T>(value: T): T {
  return structuredClone(value)
}

function requireText(value: string | undefined, label: string): string {
  const normalized = value?.trim() ?? ''
  if (!normalized) throw new Error(`${label}不能为空`)
  return normalized
}

function nowBusinessTimestamp(): string {
  const now = new globalThis.Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

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

function getCurrentAllocationVersion(task: CombinedDyeingTask): CombinedDyeingAllocationVersion | undefined {
  return task.allocationVersions.find((version) => version.current)
}

function buildTaskMember(workOrder: CanonicalDyeWorkOrder): CombinedDyeingTaskMemberSnapshot {
  if (workOrder.sourceType !== 'PRODUCTION_ORDER') {
    throw new Error(`染色加工单 ${workOrder.dyeOrderNo} 只允许生产单来源参加合并染色`)
  }
  const productionOrderId = requireText(workOrder.sourceProductionOrderId, `染色加工单 ${workOrder.dyeOrderNo} 的生产单 ID`)
  const productionOrderIds = workOrder.productionOrderIds ?? []
  if (productionOrderIds.length !== 1 || productionOrderIds[0] !== productionOrderId) {
    throw new Error(`染色加工单 ${workOrder.dyeOrderNo} 必须且只能关联一张生产单`)
  }
  const fulfillment = getEffectiveDyeingFulfillment(workOrder.dyeOrderId)
  if (fulfillment.requiredQty > 0 && fulfillment.remainingNeedQty === 0) {
    throw new Error(`染色加工单 ${workOrder.dyeOrderNo} 已全部满足，无需再次参加合并染色`)
  }
  const requiredQty = fromQuantityMinorUnits(parseCombinedDyeingQuantityMinorUnits(workOrder.plannedQty, `染色加工单 ${workOrder.dyeOrderNo} 的需求数量`))
  const materialId = requireText(workOrder.materialId, `染色加工单 ${workOrder.dyeOrderNo} 的面料标识`)
  return {
    dyeWorkOrderId: requireText(workOrder.dyeOrderId, '染色加工单 ID'),
    dyeWorkOrderNo: requireText(workOrder.dyeOrderNo, '染色加工单号'),
    productionOrderId,
    productionOrderNo: requireText(workOrder.sourceProductionOrderNo, `染色加工单 ${workOrder.dyeOrderNo} 的生产单号`),
    productionOrderOrderedAt: requireText(workOrder.productionOrderOrderedAt, `染色加工单 ${workOrder.dyeOrderNo} 的生产单下单时间`),
    requiredQty,
    effectiveSatisfiedQtyBeforeTask: fulfillment.effectiveSatisfiedQty,
    qtyUnit: requireText(workOrder.qtyUnit, `染色加工单 ${workOrder.dyeOrderNo} 的数量单位`),
    dyeFactoryId: requireText(workOrder.dyeFactoryId, `染色加工单 ${workOrder.dyeOrderNo} 的染厂`),
    dyeFactoryName: requireText(workOrder.dyeFactoryName, `染色加工单 ${workOrder.dyeOrderNo} 的染厂名称`),
    materialId,
    rawMaterialSku: requireText(workOrder.rawMaterialSku, `染色加工单 ${workOrder.dyeOrderNo} 的面料编码`),
    materialName: requireText(workOrder.composition || workOrder.rawMaterialSku, `染色加工单 ${workOrder.dyeOrderNo} 的面料名称`),
    targetColor: requireText(workOrder.targetColor, `染色加工单 ${workOrder.dyeOrderNo} 的目标颜色`),
    dyeProcessCode: requireText(workOrder.dyeProcessCode, `染色加工单 ${workOrder.dyeOrderNo} 的染色工艺编码`),
    dyeProcessName: requireText(workOrder.dyeProcessName, `染色加工单 ${workOrder.dyeOrderNo} 的染色工艺`),
  }
}

function assertSameMergeIdentity(members: readonly CombinedDyeingTaskMemberSnapshot[]): void {
  const first = members[0]!
  for (const member of members.slice(1)) {
    if (member.dyeFactoryId !== first.dyeFactoryId) throw new Error('合并染色成员必须属于同一染厂')
    if (member.materialId !== first.materialId) {
      throw new Error('合并染色成员必须使用同一面料')
    }
    if (member.targetColor !== first.targetColor) throw new Error('合并染色成员必须使用同一目标颜色')
    if (member.dyeProcessCode !== first.dyeProcessCode || member.dyeProcessName !== first.dyeProcessName) {
      throw new Error('合并染色成员必须使用同一染色工艺')
    }
    if (member.qtyUnit !== first.qtyUnit) throw new Error('合并染色成员数量单位必须一致')
  }
}

function assertAllowedKeys(input: object, allowedKeys: readonly string[], label: string): void {
  const extraKey = Object.keys(input).find((key) => !allowedKeys.includes(key))
  if (extraKey) throw new Error(`${label}不接受字段：${extraKey}`)
}

export function createCombinedDyeingTask(input: {
  dyeWorkOrderIds: readonly string[]
  createdBy: string
  createdAt?: string
  remark?: string
}): CombinedDyeingTask {
  assertAllowedKeys(input, ['dyeWorkOrderIds', 'createdBy', 'createdAt', 'remark'], '创建合并染色任务')
  if (input.dyeWorkOrderIds.length < 2) throw new Error('合并染色任务至少需要 2 张染色加工单')
  const canonicalIds = input.dyeWorkOrderIds.map((id) => requireText(id, '染色加工单 ID'))
  if (new Set(canonicalIds).size !== canonicalIds.length) throw new Error('合并染色任务不得包含重复染色加工单 ID')
  const canonicalWorkOrders = canonicalIds.map((id) => {
    const order = getCanonicalDyeWorkOrderById(id)
    if (!order) throw new Error(`未找到染色加工单：${id}`)
    if (order.dyeOrderId !== id) throw new Error(`染色加工单 canonical ID 不一致：${id}`)
    return order
  })
  const members = canonicalWorkOrders.map(buildTaskMember)
  assertUniqueMembers(members)
  assertSameMergeIdentity(members)
  for (const member of members) {
    const activeMembership = getActiveCombinedDyeingMembership(member.dyeWorkOrderId)
    if (activeMembership) {
      throw new Error(`染色加工单 ${member.dyeWorkOrderNo} 已加入未删除合并任务 ${activeMembership.taskNo}`)
    }
  }

  const createdBy = requireText(input.createdBy, '创建人')
  const createdAt = input.createdAt === undefined ? nowBusinessTimestamp() : requireText(input.createdAt, '创建时间')
  const remark = input.remark?.trim() || undefined
  const sequence = combinedDyeingTaskSequence
  const sequenceText = String(sequence).padStart(6, '0')
  const first = members[0]!
  const task: CombinedDyeingTask = {
    taskId: `COMBINED-DYE-${sequenceText}`,
    taskNo: `HBRW-${sequenceText}`,
    status: 'WAIT_DYEING',
    dyeFactoryId: first.dyeFactoryId,
    dyeFactoryName: first.dyeFactoryName,
    materialId: first.materialId,
    rawMaterialSku: first.rawMaterialSku,
    materialName: first.materialName,
    targetColor: first.targetColor,
    dyeProcessCode: first.dyeProcessCode,
    dyeProcessName: first.dyeProcessName,
    qtyUnit: first.qtyUnit,
    members: deepClone(members),
    allocationVersions: [],
    createdBy,
    createdAt,
    remark,
  }
  combinedDyeingTaskStore.set(task.taskId, task)
  combinedDyeingTaskSequence = sequence + 1
  return deepClone(task)
}

export function completeCombinedDyeingTask(taskId: string, input: {
  actualInputQty: number
  actualOutputQty: number
  remark?: string
  completedBy: string
  completedAt: string
}): CombinedDyeingTask {
  assertAllowedKeys(input, ['actualInputQty', 'actualOutputQty', 'remark', 'completedBy', 'completedAt'], '完成合并染色任务')
  const task = combinedDyeingTaskStore.get(taskId)
  if (!task) throw new Error(`未找到合并染色任务：${taskId}`)
  if (task.status !== 'WAIT_DYEING') throw new Error('合并染色任务只能完成一次')
  const inputMinorUnits = parseCombinedDyeingQuantityMinorUnits(input.actualInputQty, '实际投入数量')
  if (inputMinorUnits <= 0) throw new Error('实际投入数量必须大于 0')
  if (input.actualOutputQty < 0) throw new Error('实际产出数量不得小于 0')
  const outputMinorUnits = parseCombinedDyeingQuantityMinorUnits(input.actualOutputQty, '实际产出数量')
  const allocation = allocateCombinedDyeingOutput(task.members, fromQuantityMinorUnits(outputMinorUnits))
  const remark = input.remark?.trim() ?? ''
  const version: CombinedDyeingAllocationVersion = {
    versionNo: 1,
    actualInputQty: fromQuantityMinorUnits(inputMinorUnits),
    actualOutputQty: fromQuantityMinorUnits(outputMinorUnits),
    allocations: allocation.allocations,
    excessQty: allocation.excessQty,
    operator: requireText(input.completedBy, '完成人'),
    operatedAt: requireText(input.completedAt, '完成时间'),
    reason: remark || undefined,
    current: true,
  }
  task.status = 'COMPLETED'
  task.actualInputQty = version.actualInputQty
  task.actualOutputQty = version.actualOutputQty
  task.completedBy = version.operator
  task.completedAt = version.operatedAt
  task.remark = remark
  task.allocationVersions.push(version)
  return deepClone(task)
}

export function correctCombinedDyeingResult(taskId: string, input: {
  actualInputQty: number
  actualOutputQty: number
  reason: string
  correctedBy: string
  correctedAt: string
}): CombinedDyeingTask {
  assertAllowedKeys(input, ['actualInputQty', 'actualOutputQty', 'reason', 'correctedBy', 'correctedAt'], '更正合并染色结果')
  const task = combinedDyeingTaskStore.get(taskId)
  if (!task) throw new Error(`未找到合并染色任务：${taskId}`)
  if (task.status === 'DELETED') throw new Error('已删除的合并染色任务不得更正')
  if (task.status !== 'COMPLETED') throw new Error('只有已完成的合并染色任务可以更正')
  const inputMinorUnits = parseCombinedDyeingQuantityMinorUnits(input.actualInputQty, '更正实际投入数量')
  if (inputMinorUnits <= 0) throw new Error('更正实际投入数量必须大于 0')
  if (input.actualOutputQty < 0) throw new Error('更正实际产出数量不得小于 0')
  const outputMinorUnits = parseCombinedDyeingQuantityMinorUnits(input.actualOutputQty, '更正实际产出数量')
  const correctedBy = requireText(input.correctedBy, '更正人')
  const correctedAt = requireText(input.correctedAt, '更正时间')
  const reason = requireText(input.reason, '更正原因')
  const allocation = allocateCombinedDyeingOutput(task.members, fromQuantityMinorUnits(outputMinorUnits))
  const version: CombinedDyeingAllocationVersion = {
    versionNo: task.allocationVersions.length + 1,
    actualInputQty: fromQuantityMinorUnits(inputMinorUnits),
    actualOutputQty: fromQuantityMinorUnits(outputMinorUnits),
    allocations: allocation.allocations,
    excessQty: allocation.excessQty,
    operator: correctedBy,
    operatedAt: correctedAt,
    reason,
    current: true,
  }
  task.allocationVersions.forEach((existingVersion) => { existingVersion.current = false })
  task.actualInputQty = version.actualInputQty
  task.actualOutputQty = version.actualOutputQty
  task.allocationVersions.push(version)
  return deepClone(task)
}

export function deleteCombinedDyeingTask(taskId: string, input: {
  deletedBy: string
  deletedAt: string
  reason: string
}): CombinedDyeingTask {
  assertAllowedKeys(input, ['deletedBy', 'deletedAt', 'reason'], '删除合并染色任务')
  const task = combinedDyeingTaskStore.get(taskId)
  if (!task) throw new Error(`未找到合并染色任务：${taskId}`)
  if (task.status === 'DELETED') throw new Error('合并染色任务已删除，不得重复删除')
  const deletedBy = requireText(input.deletedBy, '删除人')
  const deletedAt = requireText(input.deletedAt, '删除时间')
  const reason = requireText(input.reason, '删除原因')
  task.status = 'DELETED'
  task.deletedBy = deletedBy
  task.deletedAt = deletedAt
  task.deleteReason = reason
  return deepClone(task)
}

export function listCombinedDyeingTasks(options?: { includeDeleted?: boolean }): CombinedDyeingTask[] {
  return Array.from(combinedDyeingTaskStore.values())
    .filter((task) => options?.includeDeleted === true || task.status !== 'DELETED')
    .map(deepClone)
}

export function getCombinedDyeingTaskById(taskId: string): CombinedDyeingTask | undefined {
  const task = combinedDyeingTaskStore.get(taskId)
  return task ? deepClone(task) : undefined
}

export function getActiveCombinedDyeingMembership(dyeWorkOrderId: string): ActiveCombinedDyeingMembership | undefined {
  const task = Array.from(combinedDyeingTaskStore.values()).find((item) => (
    item.status !== 'DELETED' && item.members.some((member) => member.dyeWorkOrderId === dyeWorkOrderId)
  ))
  if (!task || task.status === 'DELETED') return undefined
  return deepClone({ taskId: task.taskId, taskNo: task.taskNo, status: task.status })
}

export function getProductionChangeProtectedCombinedDyeingMembership(
  dyeWorkOrderId: string,
): ProductionChangeProtectedCombinedDyeingMembership | undefined {
  const active = Array.from(combinedDyeingTaskStore.values()).find((task) => (
    task.status !== 'DELETED' && task.members.some((member) => member.dyeWorkOrderId === dyeWorkOrderId)
  ))
  if (active) {
    return deepClone({
      taskId: active.taskId,
      taskNo: active.taskNo,
      status: active.status,
      protection: 'ACTIVE_MEMBERSHIP',
    })
  }
  const completed = Array.from(combinedDyeingTaskStore.values()).find((task) => (
    task.allocationVersions.some((version) => (
      version.current && version.allocations.some((allocation) => allocation.dyeWorkOrderId === dyeWorkOrderId)
    ))
  ))
  return completed
    ? deepClone({
        taskId: completed.taskId,
        taskNo: completed.taskNo,
        status: completed.status,
        protection: 'COMPLETED_ALLOCATION',
      })
    : undefined
}

export function prepareCombinedDyeingProductionChangeImpact(
  taskId: string,
  input: CombinedDyeingProductionChangeImpact,
): { commit: () => void } {
  const task = combinedDyeingTaskStore.get(taskId)
  if (!task) throw new Error(`未找到合并染色任务：${taskId}`)
  requireText(input.changeRecordId, '生产变更记录 ID')
  requireText(input.dyeWorkOrderId, '染色加工单 ID')
  requireText(input.recordedAt, '影响记录时间')
  requireText(input.suggestedAction, '建议动作')
  if (!task.members.some((member) => member.dyeWorkOrderId === input.dyeWorkOrderId)) {
    throw new Error(`染色加工单 ${input.dyeWorkOrderId} 不属于合并染色任务 ${task.taskNo}`)
  }
  const history = task.changeImpact ?? []
  if (history.some((item) => (
    item.changeRecordId === input.changeRecordId && item.dyeWorkOrderId === input.dyeWorkOrderId
  ))) {
    return { commit: () => undefined }
  }
  const nextHistory = [...history, deepClone(input)]
  return {
    commit: () => {
      task.changeImpact = nextHistory
    },
  }
}

export function recordCombinedDyeingProductionChangeImpact(
  taskId: string,
  input: CombinedDyeingProductionChangeImpact,
): CombinedDyeingTask {
  prepareCombinedDyeingProductionChangeImpact(taskId, input).commit()
  return deepClone(combinedDyeingTaskStore.get(taskId)!)
}

export function getEffectiveDyeingFulfillment(dyeWorkOrderId: string): EffectiveDyeingFulfillment {
  const relevantTasks = Array.from(combinedDyeingTaskStore.values()).filter((task) => (
    (task.status === 'COMPLETED' || task.status === 'DELETED')
    && getCurrentAllocationVersion(task)
    && task.members.some((member) => member.dyeWorkOrderId === dyeWorkOrderId)
  ))
  const member = relevantTasks.flatMap((task) => task.members).find((item) => item.dyeWorkOrderId === dyeWorkOrderId)
  if (!member) {
    return {
      dyeWorkOrderId,
      requiredQty: 0,
      effectiveSatisfied: 0,
      remaining: 0,
      effectiveSatisfiedQty: 0,
      remainingNeedQty: 0,
      satisfaction: 'UNMET',
    }
  }
  const requiredMinorUnits = parseCombinedDyeingQuantityMinorUnits(member.requiredQty)
  const satisfiedMinorUnits = relevantTasks.reduce((sum, task) => {
    const allocation = getCurrentAllocationVersion(task)?.allocations.find((item) => item.dyeWorkOrderId === dyeWorkOrderId)
    return sum + (allocation ? parseCombinedDyeingQuantityMinorUnits(allocation.allocatedQty) : 0)
  }, 0)
  const effectiveMinorUnits = Math.min(requiredMinorUnits, satisfiedMinorUnits)
  const remainingMinorUnits = requiredMinorUnits - effectiveMinorUnits
  return {
    dyeWorkOrderId,
    requiredQty: fromQuantityMinorUnits(requiredMinorUnits),
    effectiveSatisfied: fromQuantityMinorUnits(effectiveMinorUnits),
    remaining: fromQuantityMinorUnits(remainingMinorUnits),
    effectiveSatisfiedQty: fromQuantityMinorUnits(effectiveMinorUnits),
    remainingNeedQty: fromQuantityMinorUnits(remainingMinorUnits),
    satisfaction: remainingMinorUnits === 0 ? 'FULL' : effectiveMinorUnits > 0 ? 'PARTIAL' : 'UNMET',
  }
}
