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

export interface SewingDeliveryReceiverDelayAttribution {
  readonly recordId: string
  readonly submittedAt: string
  readonly receivedAt: string
  readonly affectedQty: number
  readonly delayHours: number
}

export interface SewingDeliveryMilestoneProjection extends SewingDeliveryMilestoneSnapshot {
  readonly result: SewingDeliveryMilestoneResult
  readonly firstReachedAt?: string
  readonly receiverDelayRecordIds: readonly string[]
  readonly receiverDelayRecords: readonly SewingDeliveryReceiverDelayAttribution[]
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

export type SewingDeliveryResponsibilityConclusion = 'FACTORY' | 'RECEIVER' | 'SHARED'

export interface SewingDeliveryResponsibilityReview {
  readonly reviewId: string
  readonly snapshotId: string
  readonly runtimeTaskId: string
  readonly milestoneRatio: 0.3 | 0.7 | 1
  readonly conclusion: SewingDeliveryResponsibilityConclusion
  readonly remark: string
  readonly reviewedBy: string
  readonly reviewedAt: string
}

const RULE_HOURS: Record<SewingDeliverySlaKind, [number, number, number]> = {
  INDEPENDENT_SEWING: [96, 192, 216],
  SEWING_TO_PACKAGING: [120, 216, 240],
  CUTTING_TO_PACKAGING: [144, 216, 288],
}

const MILESTONE_RATIOS = [0.3, 0.7, 1] as const
const snapshotsById = new Map<string, SewingDeliverySlaSnapshot>()
const currentSnapshotIdByRuntimeTaskId = new Map<string, string>()
const responsibilityReviews: SewingDeliveryResponsibilityReview[] = []

export interface SewingDeliverySlaSnapshotStoreState {
  snapshots: Array<[string, SewingDeliverySlaSnapshot]>
  currentSnapshotIds: Array<[string, string]>
  responsibilityReviews: SewingDeliveryResponsibilityReview[]
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

function cloneAndFreezeResponsibilityReview(
  review: SewingDeliveryResponsibilityReview,
): SewingDeliveryResponsibilityReview {
  return Object.freeze({ ...review })
}

export function saveSewingDeliverySlaSnapshot(snapshot: SewingDeliverySlaSnapshot): void {
  const existingById = snapshotsById.get(snapshot.snapshotId)
  if (
    existingById
    && (
      existingById.runtimeTaskId !== snapshot.runtimeTaskId
      || existingById.assignmentId !== snapshot.assignmentId
      || JSON.stringify(existingById) !== JSON.stringify(snapshot)
    )
  ) {
    throw new Error(`含车缝履约快照ID冲突：${snapshot.snapshotId} 已存在`)
  }
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

export function replaceSewingDeliverySlaSnapshot(
  sourceRuntimeTaskId: string,
  replacement: SewingDeliverySlaSnapshot,
): void {
  const sourceSnapshotId = currentSnapshotIdByRuntimeTaskId.get(sourceRuntimeTaskId)
  const sourceSnapshot = sourceSnapshotId ? snapshotsById.get(sourceSnapshotId) : undefined
  if (!sourceSnapshot?.active) throw new Error('原任务没有生效中的含车缝履约快照')
  snapshotsById.set(sourceSnapshot.snapshotId, cloneAndFreezeSnapshot({
    ...sourceSnapshot,
    active: false,
    replacedByAssignmentId: replacement.assignmentId,
  }))
  currentSnapshotIdByRuntimeTaskId.delete(sourceRuntimeTaskId)
  saveSewingDeliverySlaSnapshot(replacement)
}

export function getSewingDeliverySlaSnapshot(runtimeTaskId: string): SewingDeliverySlaSnapshot | null {
  const snapshotId = currentSnapshotIdByRuntimeTaskId.get(runtimeTaskId)
  const snapshot = snapshotId ? snapshotsById.get(snapshotId) : undefined
  return snapshot ? cloneAndFreezeSnapshot(snapshot) : null
}

export function getSewingDeliverySlaSnapshotById(snapshotId: string): SewingDeliverySlaSnapshot | null {
  const snapshot = snapshotsById.get(snapshotId)
  return snapshot ? cloneAndFreezeSnapshot(snapshot) : null
}

export function getLatestSewingDeliverySlaSnapshot(runtimeTaskId: string): SewingDeliverySlaSnapshot | null {
  const current = getSewingDeliverySlaSnapshot(runtimeTaskId)
  if (current) return current
  const history = listSewingDeliverySlaSnapshotHistory(runtimeTaskId)
  return history.length > 0 ? history[history.length - 1] : null
}

export function listSewingDeliverySlaSnapshotHistory(runtimeTaskId: string): SewingDeliverySlaSnapshot[] {
  return Array.from(snapshotsById.values())
    .filter((snapshot) => snapshot.runtimeTaskId === runtimeTaskId)
    .map(cloneAndFreezeSnapshot)
}

export function listAllSewingDeliverySlaSnapshots(): readonly SewingDeliverySlaSnapshot[] {
  return Object.freeze(Array.from(snapshotsById.values()).map(cloneAndFreezeSnapshot))
}

export function captureSewingDeliverySlaSnapshotStore(): SewingDeliverySlaSnapshotStoreState {
  return {
    snapshots: Array.from(snapshotsById.entries()).map(([snapshotId, snapshot]) => [
      snapshotId,
      cloneAndFreezeSnapshot(snapshot),
    ]),
    currentSnapshotIds: Array.from(currentSnapshotIdByRuntimeTaskId.entries()),
    responsibilityReviews: responsibilityReviews.map(cloneAndFreezeResponsibilityReview),
  }
}

export function restoreSewingDeliverySlaSnapshotStore(state: SewingDeliverySlaSnapshotStoreState): void {
  snapshotsById.clear()
  currentSnapshotIdByRuntimeTaskId.clear()
  responsibilityReviews.splice(0, responsibilityReviews.length)
  state.snapshots.forEach(([snapshotId, snapshot]) => snapshotsById.set(snapshotId, cloneAndFreezeSnapshot(snapshot)))
  state.currentSnapshotIds.forEach(([runtimeTaskId, snapshotId]) => {
    currentSnapshotIdByRuntimeTaskId.set(runtimeTaskId, snapshotId)
  })
  state.responsibilityReviews.forEach((review) => {
    responsibilityReviews.push(cloneAndFreezeResponsibilityReview(review))
  })
}

export function clearSewingDeliverySlaSnapshotStore(runtimeTaskId?: string): void {
  if (!runtimeTaskId) {
    snapshotsById.clear()
    currentSnapshotIdByRuntimeTaskId.clear()
    responsibilityReviews.splice(0, responsibilityReviews.length)
    return
  }

  for (const [snapshotId, snapshot] of snapshotsById.entries()) {
    if (snapshot.runtimeTaskId === runtimeTaskId) snapshotsById.delete(snapshotId)
  }
  currentSnapshotIdByRuntimeTaskId.delete(runtimeTaskId)
  for (let index = responsibilityReviews.length - 1; index >= 0; index -= 1) {
    if (responsibilityReviews[index].runtimeTaskId === runtimeTaskId) responsibilityReviews.splice(index, 1)
  }
}

export function recordSewingDeliveryResponsibilityReview(input: {
  runtimeTaskId: string
  milestoneRatio: 0.3 | 0.7 | 1
  conclusion: SewingDeliveryResponsibilityConclusion
  remark: string
  reviewedBy: string
  reviewedAt: string
  projection: SewingDeliverySlaProjection | undefined
}): SewingDeliveryResponsibilityReview {
  const runtimeTaskId = input.runtimeTaskId.trim()
  const projectedSnapshotId = input.projection?.snapshot.snapshotId
  const snapshot = projectedSnapshotId ? getSewingDeliverySlaSnapshotById(projectedSnapshotId) : null
  if (!snapshot || snapshot.runtimeTaskId !== runtimeTaskId) throw new Error('责任复核任务必须存在对应履约快照')
  if (!MILESTONE_RATIOS.includes(input.milestoneRatio)) throw new Error('复核节点比例必须为 30%、70% 或 100%')
  if (!['FACTORY', 'RECEIVER', 'SHARED'].includes(input.conclusion)) throw new Error('责任结论必须为工厂、接收方或双方共同责任')
  if (input.projection?.snapshot.snapshotId !== snapshot.snapshotId) throw new Error('责任复核必须基于所选履约快照')
  const milestone = input.projection.milestones.find((item) => item.ratio === input.milestoneRatio)
  if (!milestone || milestone.receiverDelayRecords.length === 0) throw new Error('当前节点没有接收确认延迟，不能记录责任结论')
  const remark = input.remark.trim()
  const reviewedBy = input.reviewedBy.trim()
  if (!remark) throw new Error('责任复核说明不能为空')
  if (!reviewedBy) throw new Error('责任复核人不能为空')
  parseDateTime(input.reviewedAt, '责任复核时间')

  const review = cloneAndFreezeResponsibilityReview({
    reviewId: `SEWING-SLA-REVIEW-${runtimeTaskId}-${String(input.milestoneRatio).replace('.', '')}-${responsibilityReviews.length + 1}`,
    snapshotId: snapshot.snapshotId,
    runtimeTaskId,
    milestoneRatio: input.milestoneRatio,
    conclusion: input.conclusion,
    remark,
    reviewedBy,
    reviewedAt: input.reviewedAt,
  })
  responsibilityReviews.push(review)
  return cloneAndFreezeResponsibilityReview(review)
}

export function listSewingDeliveryResponsibilityReviews(
  runtimeTaskId: string,
  milestoneRatio?: number,
): readonly SewingDeliveryResponsibilityReview[] {
  const reviews = responsibilityReviews
    .filter((review) => review.runtimeTaskId === runtimeTaskId && (milestoneRatio === undefined || review.milestoneRatio === milestoneRatio))
    .map(cloneAndFreezeResponsibilityReview)
  return Object.freeze(reviews)
}

export function getSewingDeliveryResponsibilityReview(
  runtimeTaskId: string,
  milestoneRatio: number,
): SewingDeliveryResponsibilityReview | null {
  const snapshotId = currentSnapshotIdByRuntimeTaskId.get(runtimeTaskId)
    ?? listSewingDeliverySlaSnapshotHistory(runtimeTaskId).at(-1)?.snapshotId
  if (!snapshotId) return null
  const reviews = listSewingDeliveryResponsibilityReviews(runtimeTaskId, milestoneRatio)
    .filter((review) => review.snapshotId === snapshotId)
  return reviews.length > 0 ? cloneAndFreezeResponsibilityReview(reviews[reviews.length - 1]) : null
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
    snapshotId: `SEWING-DELIVERY-SLA-${input.runtimeTaskId}-${input.assignmentId}`,
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
    if (!receipt.submittedAt) return
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
    receiverDelayCandidateRecords: [] as SewingDeliveryReceiverDelayAttribution[],
  }))
  const visibleReceiptByRecordId = new Map<string, SewingDeliveryReceiptFact>()
  receipts
    .filter((receipt) => Boolean(receipt.submittedAt)
      && receipt.receivedAt <= nowAt
      && receipt.submittedAt <= nowAt
      && receipt.submittedAt <= receipt.receivedAt)
    .forEach((receipt) => {
      const current = visibleReceiptByRecordId.get(receipt.recordId)
      const receiptSignature = JSON.stringify(receipt)
      const currentSignature = current ? JSON.stringify(current) : ''
      if (
        !current
        || receipt.receivedAt > current.receivedAt
        || (receipt.receivedAt === current.receivedAt && receiptSignature > currentSignature)
      ) {
        visibleReceiptByRecordId.set(receipt.recordId, receipt)
      }
    })
  const orderedReceipts = [...visibleReceiptByRecordId.values()].sort((left, right) => {
    const timeOrder = left.receivedAt.localeCompare(right.receivedAt)
    return timeOrder !== 0 ? timeOrder : left.recordId.localeCompare(right.recordId)
  })

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
      let remainingMilestoneGap = Math.max(milestone.targetQty - previousReceivedQty, 0)
      const receiverDelayCandidates = receiptBatch
          .filter((receipt) => {
            const effectiveReceivedQty = receipt.voided
              ? 0
              : Math.max(receipt.receivedQty - (receipt.reversedQty ?? 0), 0)
            return effectiveReceivedQty > 0
              && receipt.submittedQty > 0
              && receipt.submittedAt <= milestone.deadlineAt
              && receipt.receivedAt > milestone.deadlineAt
          })
          .sort((left, right) => left.recordId.localeCompare(right.recordId))
      receiverDelayCandidates.forEach((receipt) => {
        const effectiveReceivedQty = Math.max(receipt.receivedQty - (receipt.reversedQty ?? 0), 0)
        const affectedQty = Math.min(effectiveReceivedQty, receipt.submittedQty, remainingMilestoneGap)
        if (affectedQty <= 0) return
        reached.receiverDelayCandidateRecords.push({
          recordId: receipt.recordId,
          submittedAt: receipt.submittedAt,
          receivedAt: receipt.receivedAt,
          affectedQty,
          delayHours: (parseDateTime(receipt.receivedAt, '实收时间').getTime() - parseDateTime(milestone.deadlineAt, '节点截止时间').getTime()) / 3_600_000,
        })
        remainingMilestoneGap -= affectedQty
      })
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

    const receiverDelayRecords = reached.firstReachedAt
      ? [...new Map(reached.receiverDelayCandidateRecords.map((record) => [record.recordId, record])).values()]
          .sort((left, right) => left.recordId.localeCompare(right.recordId))
          .map((record) => Object.freeze({ ...record }))
      : []
    return Object.freeze({
      ...milestone,
      result,
      ...(reached.firstReachedAt ? { firstReachedAt: reached.firstReachedAt } : {}),
      receiverDelayRecordIds: Object.freeze(receiverDelayRecords.map((record) => record.recordId)),
      receiverDelayRecords: Object.freeze(receiverDelayRecords),
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
