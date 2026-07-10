export type SewingDeliverySlaKind =
  | 'INDEPENDENT_SEWING'
  | 'SEWING_TO_PACKAGING'
  | 'CUTTING_TO_PACKAGING'

export interface SewingDeliveryCoveredProcess {
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  sourceArtifactIds: string[]
}

export interface SewingDeliverySlaTaskLike {
  taskUnitType: string
  processCode: string
  processBusinessCode?: string
  processNameZh: string
  coveredProcesses?: SewingDeliveryCoveredProcess[]
}

export interface SewingDeliveryMilestoneSnapshot {
  readonly ratio: 0.3 | 0.7 | 1
  readonly hoursAfterAcceptance: number
  readonly targetQty: number
  readonly deadlineAt: string
}

export interface SewingDeliverySlaSnapshot {
  readonly snapshotId: string
  readonly assignmentId: string
  readonly runtimeTaskId: string
  readonly productionOrderId: string
  readonly factoryId: string
  readonly factoryName: string
  readonly assignedQty: number
  readonly acceptedAt: string
  readonly slaKind: SewingDeliverySlaKind
  readonly milestones: readonly SewingDeliveryMilestoneSnapshot[]
  readonly active: boolean
  readonly replacedByAssignmentId?: string
}

export interface SewingDeliveryReceiptFact {
  recordId: string
  submittedQty: number
  submittedAt: string
  receivedQty: number
  receivedAt: string
  voided?: boolean
  reversedQty?: number
}

export type SewingDeliveryMilestoneResult =
  | 'UPCOMING'
  | 'ON_TIME'
  | 'OVERDUE_PENDING'
  | 'OVERDUE_REACHED'

export interface SewingDeliveryMilestoneProjection extends SewingDeliveryMilestoneSnapshot {
  readonly result: SewingDeliveryMilestoneResult
  readonly firstReachedAt?: string
  readonly receiverDelayRecordIds: readonly string[]
}

export interface SewingDeliverySlaProjection {
  readonly snapshot: SewingDeliverySlaSnapshot
  readonly confirmedReceivedQty: number
  readonly progressRatio: number
  readonly remainingQty: number
  readonly completed: boolean
  readonly completedAt?: string
  readonly milestones: readonly SewingDeliveryMilestoneProjection[]
}

const RULE_HOURS: Record<SewingDeliverySlaKind, [number, number, number]> = {
  INDEPENDENT_SEWING: [96, 192, 216],
  SEWING_TO_PACKAGING: [120, 216, 240],
  CUTTING_TO_PACKAGING: [144, 216, 288],
}

const MILESTONE_RATIOS = [0.3, 0.7, 1] as const
const snapshotsById = new Map<string, SewingDeliverySlaSnapshot>()
const currentSnapshotIdByRuntimeTaskId = new Map<string, string>()

export interface SewingDeliverySlaSnapshotStoreState {
  snapshots: Array<[string, SewingDeliverySlaSnapshot]>
  currentSnapshotIds: Array<[string, string]>
}

function assertPositiveFiniteInteger(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName}必须为正有限整数`)
  }
}

function assertNonNegativeFiniteNumber(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName}必须为非负有限数`)
  }
}

function isSewingProcess(process: { processCode: string; processName: string }): boolean {
  return process.processCode === 'SEW' || process.processName === '车缝'
}

function isCuttingProcess(process: { processCode: string; processName: string }): boolean {
  return process.processCode === 'CUT'
    || process.processCode === 'CUTTING'
    || process.processName === '裁片'
    || process.processName === '裁剪'
}

function isPostOrPackagingProcess(process: { processCode: string; processName: string }): boolean {
  return process.processCode === 'POST'
    || process.processCode === 'PACK'
    || process.processCode === 'PACKAGING'
    || process.processName === '后道'
    || process.processName === '包装'
}

export function classifySewingDeliverySla(task: SewingDeliverySlaTaskLike): SewingDeliverySlaKind | null {
  if (
    (task.taskUnitType === 'PROCESS_TASK' || task.taskUnitType === 'SINGLE_PROCESS_TASK')
    && (
      task.processCode === 'SEW'
      || task.processBusinessCode === 'SEW'
      || task.processNameZh === '车缝'
    )
  ) {
    return 'INDEPENDENT_SEWING'
  }

  if (task.taskUnitType !== 'COMBINED_PROCESS_TASK') return null

  const firstProcess = task.coveredProcesses?.[0]
  const lastProcess = task.coveredProcesses?.[task.coveredProcesses.length - 1]
  if (!firstProcess || !lastProcess || !isPostOrPackagingProcess(lastProcess)) return null
  if (!task.coveredProcesses?.some(isSewingProcess)) return null

  if (isSewingProcess(firstProcess)) return 'SEWING_TO_PACKAGING'
  if (isCuttingProcess(firstProcess)) return 'CUTTING_TO_PACKAGING'
  return null
}

function parseDateTime(value: string, fieldName: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match) {
    throw new Error(`${fieldName}必须为 YYYY-MM-DD HH:mm:ss 格式`)
  }

  const [, yearText, monthText, dayText, hoursText, minutesText, secondsText] = match
  const [year, month, day, hours, minutes, seconds] = [
    yearText,
    monthText,
    dayText,
    hoursText,
    minutesText,
    secondsText,
  ].map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(hours, minutes, seconds, 0)
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hours
    || date.getUTCMinutes() !== minutes
    || date.getUTCSeconds() !== seconds
  ) {
    throw new Error(`${fieldName}不是有效的年月日时分秒`)
  }
  return date
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

export function formatOperationLocalWallClock(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function operationWallClockToDateTimeLocal(value: string): string {
  parseDateTime(value, '操作端本地时间')
  return value.replace(' ', 'T').slice(0, 16)
}

export function dateTimeLocalToOperationWallClock(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) {
    throw new Error('业务分配时间必须为 YYYY-MM-DDTHH:mm 格式')
  }
  const normalized = `${match[1]} ${match[2]}:${match[3] ?? '00'}`
  parseDateTime(normalized, '业务分配时间')
  return normalized
}

export function compareSewingDeliveryDateTimes(left: string, right: string): number {
  return parseDateTime(left, '业务分配时间').getTime() - parseDateTime(right, '当前操作时间').getTime()
}

function addHours(value: string, hours: number, fieldName: string): string {
  const date = parseDateTime(value, fieldName)
  date.setTime(date.getTime() + hours * 60 * 60 * 1000)
  return formatDateTime(date)
}

function cloneAndFreezeSnapshot(snapshot: SewingDeliverySlaSnapshot): SewingDeliverySlaSnapshot {
  const milestones = Object.freeze(
    snapshot.milestones.map((milestone) => Object.freeze({ ...milestone })),
  )
  return Object.freeze({ ...snapshot, milestones })
}

export function saveSewingDeliverySlaSnapshot(snapshot: SewingDeliverySlaSnapshot): void {
  const currentSnapshotId = currentSnapshotIdByRuntimeTaskId.get(snapshot.runtimeTaskId)
  const currentSnapshot = currentSnapshotId ? snapshotsById.get(currentSnapshotId) : undefined
  if (currentSnapshot && currentSnapshot.snapshotId !== snapshot.snapshotId) {
    snapshotsById.set(currentSnapshot.snapshotId, cloneAndFreezeSnapshot({
      ...currentSnapshot,
      active: false,
      replacedByAssignmentId: snapshot.assignmentId,
    }))
  }

  const storedSnapshot = cloneAndFreezeSnapshot({
    ...snapshot,
    active: true,
    replacedByAssignmentId: undefined,
  })
  snapshotsById.set(storedSnapshot.snapshotId, storedSnapshot)
  currentSnapshotIdByRuntimeTaskId.set(storedSnapshot.runtimeTaskId, storedSnapshot.snapshotId)
}

export function getSewingDeliverySlaSnapshot(runtimeTaskId: string): SewingDeliverySlaSnapshot | null {
  const snapshotId = currentSnapshotIdByRuntimeTaskId.get(runtimeTaskId)
  const snapshot = snapshotId ? snapshotsById.get(snapshotId) : undefined
  return snapshot ? cloneAndFreezeSnapshot(snapshot) : null
}

export function listSewingDeliverySlaSnapshotHistory(runtimeTaskId: string): SewingDeliverySlaSnapshot[] {
  return Array.from(snapshotsById.values())
    .filter((snapshot) => snapshot.runtimeTaskId === runtimeTaskId)
    .map(cloneAndFreezeSnapshot)
}

export function captureSewingDeliverySlaSnapshotStore(): SewingDeliverySlaSnapshotStoreState {
  return {
    snapshots: Array.from(snapshotsById.entries()).map(([snapshotId, snapshot]) => [
      snapshotId,
      cloneAndFreezeSnapshot(snapshot),
    ]),
    currentSnapshotIds: Array.from(currentSnapshotIdByRuntimeTaskId.entries()),
  }
}

export function restoreSewingDeliverySlaSnapshotStore(state: SewingDeliverySlaSnapshotStoreState): void {
  snapshotsById.clear()
  currentSnapshotIdByRuntimeTaskId.clear()
  state.snapshots.forEach(([snapshotId, snapshot]) => snapshotsById.set(snapshotId, cloneAndFreezeSnapshot(snapshot)))
  state.currentSnapshotIds.forEach(([runtimeTaskId, snapshotId]) => {
    currentSnapshotIdByRuntimeTaskId.set(runtimeTaskId, snapshotId)
  })
}

export function clearSewingDeliverySlaSnapshotStore(runtimeTaskId?: string): void {
  if (!runtimeTaskId) {
    snapshotsById.clear()
    currentSnapshotIdByRuntimeTaskId.clear()
    return
  }

  for (const [snapshotId, snapshot] of snapshotsById.entries()) {
    if (snapshot.runtimeTaskId === runtimeTaskId) snapshotsById.delete(snapshotId)
  }
  currentSnapshotIdByRuntimeTaskId.delete(runtimeTaskId)
}

export function createSewingDeliverySlaSnapshot(input: {
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  assignedQty: number
  acceptedAt: string
  slaKind: SewingDeliverySlaKind
}): SewingDeliverySlaSnapshot {
  assertPositiveFiniteInteger(input.assignedQty, '分配数量')
  const ruleHours = RULE_HOURS[input.slaKind]
  return cloneAndFreezeSnapshot({
    snapshotId: `SEWING-DELIVERY-SLA-${input.assignmentId}`,
    ...input,
    milestones: MILESTONE_RATIOS.map((ratio, index) => ({
      ratio,
      hoursAfterAcceptance: ruleHours[index],
      targetQty: Math.ceil(input.assignedQty * ratio),
      deadlineAt: addHours(input.acceptedAt, ruleHours[index], '接单时间'),
    })),
    active: true,
  })
}

export function projectSewingDeliverySla(
  snapshot: SewingDeliverySlaSnapshot,
  receipts: SewingDeliveryReceiptFact[],
  nowAt: string,
): SewingDeliverySlaProjection {
  assertPositiveFiniteInteger(snapshot.assignedQty, '分配数量')
  parseDateTime(snapshot.acceptedAt, '接单时间')
  snapshot.milestones.forEach((milestone) => parseDateTime(milestone.deadlineAt, '节点截止时间'))
  parseDateTime(nowAt, '当前时间')
  receipts.forEach((receipt) => {
    assertNonNegativeFiniteNumber(receipt.submittedQty, '交出数量')
    assertNonNegativeFiniteNumber(receipt.receivedQty, '实收数量')
    const reversedQty = receipt.reversedQty ?? 0
    assertNonNegativeFiniteNumber(reversedQty, '冲销数量')
    if (reversedQty > receipt.receivedQty) {
      throw new Error('冲销数量不能超过实收数量')
    }
    parseDateTime(receipt.submittedAt, '交出时间')
    parseDateTime(receipt.receivedAt, '实收时间')
  })
  const projectionSnapshot = cloneAndFreezeSnapshot(snapshot)
  const reachedMilestones = projectionSnapshot.milestones.map(() => ({
    firstReachedAt: undefined as string | undefined,
    receiverDelayCandidateRecordIds: [] as string[],
  }))
  const orderedReceipts = [...receipts].sort((left, right) => left.receivedAt.localeCompare(right.receivedAt))

  let confirmedReceivedQty = 0
  let completedAt: string | undefined

  for (let receiptIndex = 0; receiptIndex < orderedReceipts.length;) {
    const receivedAt = orderedReceipts[receiptIndex].receivedAt
    const receiptBatch: SewingDeliveryReceiptFact[] = []
    while (orderedReceipts[receiptIndex]?.receivedAt === receivedAt) {
      receiptBatch.push(orderedReceipts[receiptIndex])
      receiptIndex += 1
    }

    const previousReceivedQty = confirmedReceivedQty
    const batchReceivedQty = receiptBatch.reduce((sum, receipt) => {
      if (receipt.voided) return sum
      return sum + Math.max(receipt.receivedQty - (receipt.reversedQty ?? 0), 0)
    }, 0)
    confirmedReceivedQty += batchReceivedQty

    projectionSnapshot.milestones.forEach((milestone, index) => {
      const reached = reachedMilestones[index]
      if (reached.firstReachedAt) return
      reached.receiverDelayCandidateRecordIds.push(
        ...receiptBatch
          .filter((receipt) => {
            const effectiveReceivedQty = receipt.voided
              ? 0
              : Math.max(receipt.receivedQty - (receipt.reversedQty ?? 0), 0)
            return effectiveReceivedQty > 0
              && receipt.submittedQty > 0
              && receipt.submittedAt <= milestone.deadlineAt
              && receipt.receivedAt > milestone.deadlineAt
          })
          .map((receipt) => receipt.recordId)
          .sort(),
      )
      if (previousReceivedQty >= milestone.targetQty || confirmedReceivedQty < milestone.targetQty) return
      reached.firstReachedAt = receivedAt
    })

    if (
      completedAt === undefined
      && previousReceivedQty < projectionSnapshot.assignedQty
      && confirmedReceivedQty >= projectionSnapshot.assignedQty
    ) {
      completedAt = receivedAt
    }
  }

  const milestones = Object.freeze(projectionSnapshot.milestones.map((milestone, index): SewingDeliveryMilestoneProjection => {
    const reached = reachedMilestones[index]
    let result: SewingDeliveryMilestoneResult
    if (reached.firstReachedAt) {
      result = reached.firstReachedAt <= milestone.deadlineAt ? 'ON_TIME' : 'OVERDUE_REACHED'
    } else {
      result = nowAt < milestone.deadlineAt ? 'UPCOMING' : 'OVERDUE_PENDING'
    }

    return Object.freeze({
      ...milestone,
      result,
      ...(reached.firstReachedAt ? { firstReachedAt: reached.firstReachedAt } : {}),
      receiverDelayRecordIds: Object.freeze(
        reached.firstReachedAt
          ? [...new Set(reached.receiverDelayCandidateRecordIds)].sort()
          : [],
      ),
    })
  }))

  return Object.freeze({
    snapshot: projectionSnapshot,
    confirmedReceivedQty,
    progressRatio: confirmedReceivedQty / projectionSnapshot.assignedQty,
    remainingQty: Math.max(projectionSnapshot.assignedQty - confirmedReceivedQty, 0),
    completed: confirmedReceivedQty >= projectionSnapshot.assignedQty,
    ...(completedAt ? { completedAt } : {}),
    milestones,
  })
}
