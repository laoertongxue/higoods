import type { FulfillmentRuleCode, TaskFulfillmentPolicy } from './task-fulfillment-policy'
import { getEffectiveTaskAssignment, listEffectiveTaskAssignments } from './effective-task-assignments'
import { resolveOriginalSkuForReturnedSku } from './garment-spu-replacement.ts'

export type ReturnMilestoneStatus = 'UPCOMING' | 'DUE_TODAY' | 'REACHED' | 'CUTTING_SHORTFALL' | 'OVERDUE'
export type ReturnReminderType = 'DUE_TOMORROW' | 'DUE_TODAY' | 'OVERDUE'

export interface ProductionReturnMilestoneSnapshot {
  ratio: 0.3 | 0.7 | 1
  naturalDay: number
  targetQty: number
  deadlineDate: string
  deadlineAt: string
}

export interface ProductionReturnRulePreview {
  assignedQty: number
  assignmentDate: string
  fulfillmentRuleCode: Exclude<FulfillmentRuleCode, 'NO_STAGED_RETURN_RULE'>
  milestones: ProductionReturnMilestoneSnapshot[]
}

export interface ProductionReturnRuleSnapshot {
  snapshotId: string
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  assignedQty: number
  assignmentDate: string
  fulfillmentRuleCode: Exclude<FulfillmentRuleCode, 'NO_STAGED_RETURN_RULE'>
  milestones: ProductionReturnMilestoneSnapshot[]
  active: boolean
  invalidatedAt?: string
  invalidatedReason?: string
  replacedBySnapshotId?: string
}

export interface ProductionReturnReceiptFact {
  receiptId: string
  assignmentId: string
  factoryId: string
  confirmedQty: number
  confirmedDate: string
  confirmedAt?: string
  confirmed: boolean
  voided?: boolean
  executionTaskId?: string
  productionOrderId?: string
  declaredQty?: number
  sourceType?: 'POST_FINISHING_FINAL_CONFIRMATION'
  sourceDocumentNo?: string
  confirmationVersionId?: string
  skuCodes?: string[]
}

export interface ProductionReturnResponsibilityVersionFact {
  responsibilityVersionId: string
  assignmentId: string
  totalResponsibilityQty: number
  createdAt: string
}

export interface ProductionReturnMilestoneProjection extends ProductionReturnMilestoneSnapshot {
  confirmedQtyByDeadline: number
  attributableTargetQty: number
  cuttingShortfallQty: number
  factoryPendingQty: number
  responsibilityQtyAtCutoff: number
  responsibilityCutoffAt: string
  responsibilityVersionId?: string
  shortageQty: number
  reachedDate?: string
  status: ReturnMilestoneStatus
}

export interface ProductionReturnProjection {
  snapshot: ProductionReturnRuleSnapshot
  confirmedReturnedQty: number
  remainingQty: number
  highestRiskStatus: ReturnMilestoneStatus
  milestones: ProductionReturnMilestoneProjection[]
}

export interface ProductionReturnReminder {
  reminderId: string
  assignmentId: string
  factoryId: string
  deadlineDate: string
  milestoneRatio: 0.3 | 0.7 | 1
  reminderType: ReturnReminderType
  generatedDate: string
  targetQty: number
  confirmedQty: number
  shortageQty: number
  message: string
}

export type ProductionOrderReturnListStatus =
  | 'DATA_INCOMPLETE'
  | 'OVERDUE'
  | 'CUTTING_SHORTFALL'
  | 'DUE_TODAY'
  | 'DUE_TOMORROW'
  | 'UPCOMING'
  | 'REACHED'
  | 'NO_RULE'
  | 'BIDDING'

export interface ProductionOrderReturnAssignmentSummary {
  projection: ProductionReturnProjection
  status: Exclude<ProductionOrderReturnListStatus, 'DATA_INCOMPLETE' | 'NO_RULE' | 'BIDDING'>
  focusMilestone: ProductionReturnMilestoneProjection
  reminderState: string
}

export interface ProductionOrderReturnSummary {
  productionOrderId: string
  status: ProductionOrderReturnListStatus
  statusLabel: string
  primary?: ProductionOrderReturnAssignmentSummary
  assignments: ProductionOrderReturnAssignmentSummary[]
  activeAssignmentCount: number
  additionalFactoryCount: number
  additionalRiskNodeCount: number
  message?: string
}

export type ReturnReceiptAssignmentResolution =
  | { resolution: 'MATCHED'; assignmentId: string; reason: string }
  | { resolution: 'MANUAL_REVIEW'; candidateAssignmentIds: string[]; reason: string }
  | { resolution: 'NOT_FOUND'; reason: string }

export function resolveReturnReceiptAssignment(input: {
  productionOrderId: string
  factoryId: string
  skuCodes: string[]
  confirmedDate: string
}): ReturnReceiptAssignmentResolution {
  const confirmedDate = assertDate(input.confirmedDate, '到货确认日期')
  // 回货实物可能已经按整色替换后的 SKU 贴码；履约归属仍按生产单原始分配身份匹配。
  const skuSet = new Set(input.skuCodes.flatMap((skuCode) => [
    skuCode,
    resolveOriginalSkuForReturnedSku(input.productionOrderId, skuCode),
  ]))
  const candidates = listEffectiveTaskAssignments()
    .filter((assignment) => assignment.productionOrderId === input.productionOrderId && assignment.factoryId === input.factoryId)
    .filter((assignment) => assignment.businessAssignedAt.slice(0, 10) <= confirmedDate)
    .filter((assignment) => assignment.skuLines.some((line) => skuSet.has(line.skuCode)))
    .sort((a, b) => b.businessAssignedAt.localeCompare(a.businessAssignedAt))
  if (candidates.length === 0) return { resolution: 'NOT_FOUND', reason: '未找到同生产单、同加工厂且包含回货SKU的分配记录' }
  const effective = candidates.filter((item) => item.status === 'EFFECTIVE')
  if (effective.length === 1) return { resolution: 'MATCHED', assignmentId: effective[0].assignmentId, reason: '已按生产单、加工厂、SKU和到货日期匹配当前有效分配' }
  if (effective.length > 1) return { resolution: 'MANUAL_REVIEW', candidateAssignmentIds: effective.map((item) => item.assignmentId), reason: '同一工厂存在多条可匹配有效分配，禁止系统猜测，转人工确认' }
  const historical = candidates.filter((item) => item.status !== 'CANCELLED')
  if (historical.length === 1) return { resolution: 'MATCHED', assignmentId: historical[0].assignmentId, reason: '回货发生在改派后，但按工厂和SKU匹配到原分配，计入原工厂履约' }
  return { resolution: 'MANUAL_REVIEW', candidateAssignmentIds: historical.map((item) => item.assignmentId), reason: '历史分配归属存在歧义，必须人工选择原分配，不得计入新工厂' }
}

let snapshotSeq = 0
const reminderLogs = new Map<string, ProductionReturnReminder>()
const receiptFacts = new Map<string, ProductionReturnReceiptFact>()
const returnRuleSnapshots = new Map<string, ProductionReturnRuleSnapshot>()

function assertDate(value: string, fieldName: string): string {
  const dateText = value.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText)
  if (!match) throw new Error(`${fieldName}必须包含有效的YYYY-MM-DD日期`)
  const [, yearText, monthText, dayText] = match
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)))
  if (
    date.getUTCFullYear() !== Number(yearText)
    || date.getUTCMonth() !== Number(monthText) - 1
    || date.getUTCDate() !== Number(dayText)
  ) throw new Error(`${fieldName}不是有效日期`)
  return dateText
}

function dateToEpochDay(value: string): number {
  const dateText = assertDate(value, '日期')
  return Math.floor(Date.parse(`${dateText}T00:00:00Z`) / 86_400_000)
}

function dateTimeToEpoch(value: string, fieldName: string): number {
  const normalized = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return Date.parse(`${assertDate(normalized, fieldName)}T23:59:59Z`)
  }
  const wallClock = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(normalized)
  const parsed = Date.parse(wallClock ? `${wallClock[1]}T${wallClock[2]}Z` : normalized)
  if (!Number.isFinite(parsed)) throw new Error(`${fieldName}必须是有效日期时间`)
  return parsed
}

function receiptConfirmedTime(receipt: ProductionReturnReceiptFact): number {
  return dateTimeToEpoch(receipt.confirmedAt ?? receipt.confirmedDate, '后道最终确认时间')
}

export function addNaturalDays(dateValue: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error('自然日偏移必须为整数')
  const epochDay = dateToEpochDay(dateValue) + days
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10)
}

export function calculateNaturalDayDeadline(assignmentDate: string, naturalDay: number): string {
  if (!Number.isInteger(naturalDay) || naturalDay < 1) throw new Error('回货节点自然日必须大于等于1')
  // 分配日期即第1自然日，所以第N自然日只增加N-1天。
  return addNaturalDays(assignmentDate, naturalDay - 1)
}

export function buildProductionReturnRulePreview(input: {
  assignedQty: number
  businessAssignedAt: string
  policy: TaskFulfillmentPolicy
}): ProductionReturnRulePreview | null {
  if (input.policy.fulfillmentRuleCode === 'NO_STAGED_RETURN_RULE') return null
  if (!Number.isFinite(input.assignedQty) || input.assignedQty <= 0) throw new Error('分配数量必须大于0')
  const assignedQty = Math.floor(input.assignedQty)
  const assignmentDate = assertDate(input.businessAssignedAt, '业务分配时间')
  return {
    assignedQty,
    assignmentDate,
    fulfillmentRuleCode: input.policy.fulfillmentRuleCode,
    milestones: input.policy.milestones.map((milestone) => ({
      ...milestone,
      targetQty: milestone.ratio === 1 ? assignedQty : Math.ceil(assignedQty * milestone.ratio),
      deadlineDate: calculateNaturalDayDeadline(assignmentDate, milestone.naturalDay),
      deadlineAt: `${calculateNaturalDayDeadline(assignmentDate, milestone.naturalDay)} 23:59:59`,
    })),
  }
}

export function createProductionReturnRuleSnapshot(input: {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  assignedQty: number
  businessAssignedAt: string
  policy: TaskFulfillmentPolicy
}): ProductionReturnRuleSnapshot | null {
  const preview = buildProductionReturnRulePreview(input)
  if (!preview) return null
  snapshotSeq += 1
  const snapshot: ProductionReturnRuleSnapshot = {
    snapshotId: `RET-SLA-${String(snapshotSeq).padStart(6, '0')}`,
    assignmentId: input.assignmentId,
    runtimeTaskId: input.runtimeTaskId,
    productionOrderId: input.productionOrderId,
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    assignedQty: preview.assignedQty,
    assignmentDate: preview.assignmentDate,
    fulfillmentRuleCode: preview.fulfillmentRuleCode,
    milestones: preview.milestones.map((milestone) => ({ ...milestone })),
    active: true,
  }
  const nextAssignment = getEffectiveTaskAssignment(input.assignmentId)
  for (const previous of returnRuleSnapshots.values()) {
    if (!previous.active || previous.runtimeTaskId !== input.runtimeTaskId) continue
    const previousAssignment = getEffectiveTaskAssignment(previous.assignmentId)
    const sharesSku = !nextAssignment || !previousAssignment || previousAssignment.skuLines.some((oldLine) => nextAssignment.skuLines.some((newLine) => newLine.skuCode === oldLine.skuCode))
    if (!sharesSku) continue
    previous.active = false
    previous.invalidatedAt = input.businessAssignedAt
    previous.invalidatedReason = '任务分配事实发生变化，旧回货规则失效留痕'
    previous.replacedBySnapshotId = snapshot.snapshotId
  }
  returnRuleSnapshots.set(snapshot.snapshotId, structuredClone(snapshot))
  return structuredClone(snapshot)
}

export function listProductionReturnRuleSnapshots(input: { runtimeTaskId?: string; assignmentId?: string; activeOnly?: boolean } = {}): ProductionReturnRuleSnapshot[] {
  return [...returnRuleSnapshots.values()]
    .filter((item) => !input.runtimeTaskId || item.runtimeTaskId === input.runtimeTaskId)
    .filter((item) => !input.assignmentId || item.assignmentId === input.assignmentId)
    .filter((item) => !input.activeOnly || item.active)
    .map((item) => structuredClone(item))
}

function receiptsForSnapshot(
  snapshot: ProductionReturnRuleSnapshot,
  receipts: ProductionReturnReceiptFact[],
): ProductionReturnReceiptFact[] {
  return receipts
    .filter((item) => (
      item.assignmentId === snapshot.assignmentId
      && item.factoryId === snapshot.factoryId
      && item.confirmed
      && !item.voided
      && item.confirmedQty > 0
    ))
    .sort((a, b) => a.confirmedDate.localeCompare(b.confirmedDate))
}

export function projectProductionReturnFulfillment(input: {
  snapshot: ProductionReturnRuleSnapshot
  receipts: ProductionReturnReceiptFact[]
  today: string
  nowAt?: string
  usesCutPieceResponsibility?: boolean
  responsibilityVersions?: ProductionReturnResponsibilityVersionFact[]
}): ProductionReturnProjection {
  const today = assertDate(input.today, '查询日期')
  const nowAt = input.nowAt ?? `${today} 23:59:59`
  const nowTime = dateTimeToEpoch(nowAt, '查询时间')
  const effectiveReceipts = receiptsForSnapshot(input.snapshot, input.receipts)
  const confirmedReturnedQty = effectiveReceipts.reduce((sum, item) => sum + item.confirmedQty, 0)
  const milestones = input.snapshot.milestones.map<ProductionReturnMilestoneProjection>((milestone) => {
    const deadlineAt = milestone.deadlineAt || `${milestone.deadlineDate} 23:59:59`
    const deadlineTime = dateTimeToEpoch(deadlineAt, '节点截止时间')
    const byDeadline = effectiveReceipts.filter((item) => receiptConfirmedTime(item) <= deadlineTime)
    const confirmedQtyByDeadline = byDeadline.reduce((sum, item) => sum + item.confirmedQty, 0)
    const responsibilityCutoffAt = nowTime > deadlineTime ? deadlineAt : nowAt
    const responsibilityCutoffTime = Math.min(nowTime, deadlineTime)
    const responsibilityVersions = (input.responsibilityVersions ?? [])
      .filter((version) => version.assignmentId === input.snapshot.assignmentId)
      .filter((version) => dateTimeToEpoch(version.createdAt, '回货责任版本时间') <= responsibilityCutoffTime)
      .sort((left, right) => dateTimeToEpoch(left.createdAt, '回货责任版本时间') - dateTimeToEpoch(right.createdAt, '回货责任版本时间'))
    const responsibilityVersion = responsibilityVersions.at(-1)
    const responsibilityQtyAtCutoff = input.usesCutPieceResponsibility
      ? Math.min(input.snapshot.assignedQty, responsibilityVersion?.totalResponsibilityQty ?? 0)
      : input.snapshot.assignedQty
    const attributableTargetQty = Math.min(milestone.targetQty, responsibilityQtyAtCutoff)
    const cuttingShortfallQty = Math.max(0, milestone.targetQty - attributableTargetQty)
    const factoryPendingQty = Math.max(0, attributableTargetQty - confirmedQtyByDeadline)
    const reachedDate = (() => {
      let accumulated = 0
      for (const receipt of effectiveReceipts) {
        accumulated += receipt.confirmedQty
        if (accumulated >= milestone.targetQty) return receipt.confirmedAt ?? receipt.confirmedDate
      }
      return undefined
    })()
    let status: ReturnMilestoneStatus = 'UPCOMING'
    if (confirmedQtyByDeadline >= milestone.targetQty) status = 'REACHED'
    else if (nowTime > deadlineTime && factoryPendingQty > 0) status = 'OVERDUE'
    else if (nowTime > deadlineTime && cuttingShortfallQty > 0) status = 'CUTTING_SHORTFALL'
    else if (today === milestone.deadlineDate) status = 'DUE_TODAY'
    return {
      ...milestone,
      deadlineAt,
      confirmedQtyByDeadline,
      attributableTargetQty,
      cuttingShortfallQty,
      factoryPendingQty,
      responsibilityQtyAtCutoff,
      responsibilityCutoffAt,
      responsibilityVersionId: responsibilityVersion?.responsibilityVersionId,
      shortageQty: cuttingShortfallQty + factoryPendingQty,
      reachedDate,
      status,
    }
  })
  const statusRank: Record<ReturnMilestoneStatus, number> = { REACHED: 0, UPCOMING: 1, DUE_TODAY: 2, CUTTING_SHORTFALL: 3, OVERDUE: 4 }
  const highestRiskStatus = milestones.reduce<ReturnMilestoneStatus>(
    (highest, item) => statusRank[item.status] > statusRank[highest] ? item.status : highest,
    'REACHED',
  )
  return {
    snapshot: { ...input.snapshot, milestones: input.snapshot.milestones.map((item) => ({ ...item })) },
    confirmedReturnedQty,
    remainingQty: Math.max(0, input.snapshot.assignedQty - confirmedReturnedQty),
    highestRiskStatus,
    milestones,
  }
}

export function buildProductionReturnReminders(projection: ProductionReturnProjection, todayValue: string): ProductionReturnReminder[] {
  const today = assertDate(todayValue, '提醒日期')
  return projection.milestones.flatMap((milestone) => {
    if (milestone.status === 'REACHED' || milestone.status === 'CUTTING_SHORTFALL') return []
    const daysToDeadline = dateToEpochDay(milestone.deadlineDate) - dateToEpochDay(today)
    let reminderType: ReturnReminderType | null = null
    if (daysToDeadline === 1) reminderType = 'DUE_TOMORROW'
    else if (daysToDeadline === 0) reminderType = 'DUE_TODAY'
    else if (daysToDeadline === -1) reminderType = 'OVERDUE'
    if (!reminderType) return []
    const dayLabel = reminderType === 'DUE_TOMORROW'
      ? '明日到期'
      : reminderType === 'DUE_TODAY'
        ? '今日到期'
        : '已逾期1天，触发本节点唯一一次逾期警告'
    return [{
      reminderId: [projection.snapshot.assignmentId, milestone.ratio, reminderType, today].join('::'),
      assignmentId: projection.snapshot.assignmentId,
      factoryId: projection.snapshot.factoryId,
      deadlineDate: milestone.deadlineDate,
      milestoneRatio: milestone.ratio,
      reminderType,
      generatedDate: today,
      targetQty: milestone.targetQty,
      confirmedQty: milestone.confirmedQtyByDeadline,
      shortageQty: milestone.shortageQty,
      message: `${projection.snapshot.productionOrderId} ${projection.snapshot.factoryName} ${Math.round(milestone.ratio * 100)}%回货节点${dayLabel}，计划应回${milestone.targetQty}件，截止当前工厂承担${milestone.attributableTargetQty}件，后道按期确认${milestone.confirmedQtyByDeadline}件，工厂尚差${milestone.factoryPendingQty}件，裁床待补${milestone.cuttingShortfallQty}件。`,
    }]
  })
}

export function recordProductionReturnReceipt(fact: ProductionReturnReceiptFact): ProductionReturnReceiptFact {
  if (!fact.receiptId.trim()) throw new Error('回货确认记录号不能为空')
  if (!fact.assignmentId.trim() || !fact.factoryId.trim()) throw new Error('回货确认必须关联分配记录和加工厂')
  if (!Number.isFinite(fact.confirmedQty) || fact.confirmedQty <= 0) throw new Error('回货确认数量必须大于0')
  assertDate(fact.confirmedDate, '到货确认日期')
  if (fact.confirmedAt) dateTimeToEpoch(fact.confirmedAt, '后道最终确认时间')
  const saved = { ...fact }
  receiptFacts.set(fact.receiptId, saved)
  return { ...saved }
}

export function listProductionReturnReceipts(input: { assignmentId?: string; factoryId?: string } = {}): ProductionReturnReceiptFact[] {
  return [...receiptFacts.values()]
    .filter((item) => !input.assignmentId || item.assignmentId === input.assignmentId)
    .filter((item) => !input.factoryId || item.factoryId === input.factoryId)
    .map((item) => ({ ...item }))
}

export function generateAndSaveProductionReturnReminders(input: {
  snapshots: ProductionReturnRuleSnapshot[]
  today: string
}): ProductionReturnReminder[] {
  const saved: ProductionReturnReminder[] = []
  for (const snapshot of input.snapshots.filter((item) => item.active)) {
    const projection = projectProductionReturnFulfillment({
      snapshot,
      receipts: listProductionReturnReceipts({ assignmentId: snapshot.assignmentId, factoryId: snapshot.factoryId }),
      today: input.today,
    })
    for (const reminder of buildProductionReturnReminders(projection, input.today)) {
      if (!reminderLogs.has(reminder.reminderId)) reminderLogs.set(reminder.reminderId, reminder)
      saved.push({ ...reminderLogs.get(reminder.reminderId)! })
    }
  }
  return saved
}

export function listProductionReturnReminderLogs(input: { assignmentId?: string; factoryId?: string } = {}): ProductionReturnReminder[] {
  return [...reminderLogs.values()]
    .filter((item) => !input.assignmentId || item.assignmentId === input.assignmentId)
    .filter((item) => !input.factoryId || item.factoryId === input.factoryId)
    .map((item) => ({ ...item }))
}

const RETURN_LIST_STATUS_LABEL: Record<ProductionOrderReturnListStatus, string> = {
  DATA_INCOMPLETE: '履约数据不完整',
  OVERDUE: '已逾期',
  CUTTING_SHORTFALL: '裁床待补裁片',
  DUE_TODAY: '今日到期',
  DUE_TOMORROW: '明日到期',
  UPCOMING: '即将到期',
  REACHED: '已达成',
  NO_RULE: '无分阶段回货规则',
  BIDDING: '竞价中',
}

function resolveAssignmentListStatus(
  projection: ProductionReturnProjection,
  today: string,
): ProductionOrderReturnAssignmentSummary {
  const todayDay = dateToEpochDay(today)
  const overdue = projection.milestones.find((item) => item.status === 'OVERDUE')
  const cuttingShortfall = projection.milestones.find((item) => item.status === 'CUTTING_SHORTFALL')
  const dueToday = projection.milestones.find((item) => item.status === 'DUE_TODAY')
  const dueTomorrow = projection.milestones.find((item) => item.status === 'UPCOMING' && dateToEpochDay(item.deadlineDate) - todayDay === 1)
  const upcoming = projection.milestones.find((item) => item.status === 'UPCOMING')
  const focusMilestone = overdue || cuttingShortfall || dueToday || dueTomorrow || upcoming || projection.milestones[projection.milestones.length - 1]
  const status: ProductionOrderReturnAssignmentSummary['status'] = overdue
    ? 'OVERDUE'
    : cuttingShortfall
      ? 'CUTTING_SHORTFALL'
      : dueToday
        ? 'DUE_TODAY'
        : dueTomorrow
          ? 'DUE_TOMORROW'
          : upcoming
            ? 'UPCOMING'
            : 'REACHED'
  const expectedReminderType: ReturnReminderType | null = status === 'DUE_TOMORROW'
    ? 'DUE_TOMORROW'
    : status === 'DUE_TODAY'
      ? 'DUE_TODAY'
      : status === 'OVERDUE'
        ? 'OVERDUE'
        : null
  const hasReminder = expectedReminderType != null && listProductionReturnReminderLogs({
    assignmentId: projection.snapshot.assignmentId,
    factoryId: projection.snapshot.factoryId,
  }).some((item) => item.milestoneRatio === focusMilestone.ratio && item.reminderType === expectedReminderType)
  const reminderState = status === 'REACHED'
    ? '节点已达成，无需提醒'
    : status === 'CUTTING_SHORTFALL'
      ? `工厂截止节点的已获裁片责任已履行，裁床仍待补${focusMilestone.cuttingShortfallQty}件对应裁片`
    : expectedReminderType == null
      ? '尚未到提醒时间'
      : expectedReminderType === 'OVERDUE'
        ? `逾期警告${hasReminder ? '已发送' : '待发送'}`
        : `${expectedReminderType === 'DUE_TOMORROW' ? '截止前1天提醒' : '截止当天提醒'}${hasReminder ? '已发送' : '待发送'}`
  return { projection, status, focusMilestone, reminderState }
}

export function projectProductionOrderReturnSummary(input: {
  productionOrderId: string
  today: string
  expectedStagedReturn?: boolean
  bidding?: boolean
}): ProductionOrderReturnSummary {
  const today = assertDate(input.today, '查询日期')
  if (input.bidding) {
    return {
      productionOrderId: input.productionOrderId,
      status: 'BIDDING',
      statusLabel: RETURN_LIST_STATUS_LABEL.BIDDING,
      assignments: [], activeAssignmentCount: 0, additionalFactoryCount: 0, additionalRiskNodeCount: 0,
      message: '竞价中，定标后开始计算回货履约',
    }
  }
  const snapshots = listProductionReturnRuleSnapshots({ activeOnly: true })
    .filter((snapshot) => snapshot.productionOrderId === input.productionOrderId)
  if (snapshots.length === 0) {
    const status: ProductionOrderReturnListStatus = input.expectedStagedReturn ? 'DATA_INCOMPLETE' : 'NO_RULE'
    return {
      productionOrderId: input.productionOrderId,
      status,
      statusLabel: RETURN_LIST_STATUS_LABEL[status],
      assignments: [], activeAssignmentCount: 0, additionalFactoryCount: 0, additionalRiskNodeCount: 0,
      message: status === 'DATA_INCOMPLETE' ? '任务已具备分阶段回货规则，但尚未形成有效分配快照' : '该生产单当前没有适用的分阶段回货规则',
    }
  }
  const invalid = snapshots.find((snapshot) => (
    !snapshot.assignmentId || !snapshot.factoryId || !snapshot.factoryName || snapshot.assignedQty <= 0
    || snapshot.milestones.length !== 3
    || snapshot.milestones.some((item) => item.targetQty <= 0 || !item.deadlineDate)
  ))
  if (invalid) {
    return {
      productionOrderId: input.productionOrderId,
      status: 'DATA_INCOMPLETE',
      statusLabel: RETURN_LIST_STATUS_LABEL.DATA_INCOMPLETE,
      assignments: [], activeAssignmentCount: snapshots.length, additionalFactoryCount: Math.max(0, snapshots.length - 1), additionalRiskNodeCount: 0,
      message: `分配 ${invalid.assignmentId || invalid.snapshotId} 的回货履约数据不完整`,
    }
  }
  const assignments = snapshots.map((snapshot) => resolveAssignmentListStatus(projectProductionReturnFulfillment({
    snapshot,
    receipts: listProductionReturnReceipts({ assignmentId: snapshot.assignmentId, factoryId: snapshot.factoryId }),
    today,
  }), today))
  const rank: Record<ProductionOrderReturnAssignmentSummary['status'], number> = { OVERDUE: 7, CUTTING_SHORTFALL: 6, DUE_TODAY: 5, DUE_TOMORROW: 4, UPCOMING: 3, REACHED: 2 }
  assignments.sort((left, right) => rank[right.status] - rank[left.status] || left.focusMilestone.deadlineDate.localeCompare(right.focusMilestone.deadlineDate))
  const primary = assignments[0]
  const factoryCount = new Set(assignments.map((item) => item.projection.snapshot.factoryId)).size
  const riskNodes = assignments.flatMap((item) => item.projection.milestones).filter((item) => item.status !== 'REACHED').length
  return {
    productionOrderId: input.productionOrderId,
    status: primary.status,
    statusLabel: RETURN_LIST_STATUS_LABEL[primary.status],
    primary,
    assignments,
    activeAssignmentCount: assignments.length,
    additionalFactoryCount: Math.max(0, factoryCount - 1),
    additionalRiskNodeCount: Math.max(0, riskNodes - 1),
  }
}

export function invalidateProductionReturnRuleSnapshot(
  snapshot: ProductionReturnRuleSnapshot,
  input: { invalidatedAt: string; reason: string; replacedBySnapshotId?: string },
): ProductionReturnRuleSnapshot {
  return {
    ...snapshot,
    milestones: snapshot.milestones.map((item) => ({ ...item })),
    active: false,
    invalidatedAt: input.invalidatedAt,
    invalidatedReason: input.reason,
    replacedBySnapshotId: input.replacedBySnapshotId,
  }
}

export function resetProductionReturnSnapshotSequenceForTests(): void {
  snapshotSeq = 0
  reminderLogs.clear()
  receiptFacts.clear()
  returnRuleSnapshots.clear()
}
