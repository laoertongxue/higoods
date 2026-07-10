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
  ratio: 0.3 | 0.7 | 1
  hoursAfterAcceptance: number
  targetQty: number
  deadlineAt: string
}

export interface SewingDeliverySlaSnapshot {
  snapshotId: string
  assignmentId: string
  runtimeTaskId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  assignedQty: number
  acceptedAt: string
  slaKind: SewingDeliverySlaKind
  milestones: SewingDeliveryMilestoneSnapshot[]
  active: boolean
  replacedByAssignmentId?: string
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
  result: SewingDeliveryMilestoneResult
  firstReachedAt?: string
  receiverDelayRecordIds: string[]
}

export interface SewingDeliverySlaProjection {
  snapshot: SewingDeliverySlaSnapshot
  confirmedReceivedQty: number
  progressRatio: number
  remainingQty: number
  completed: boolean
  completedAt?: string
  milestones: SewingDeliveryMilestoneProjection[]
}

const RULE_HOURS: Record<SewingDeliverySlaKind, [number, number, number]> = {
  INDEPENDENT_SEWING: [96, 192, 216],
  SEWING_TO_PACKAGING: [120, 216, 240],
  CUTTING_TO_PACKAGING: [144, 216, 288],
}

const MILESTONE_RATIOS = [0.3, 0.7, 1] as const

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

function parseDateTime(value: string): Date {
  const [datePart, timePart] = value.split(' ')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes, seconds] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hours, minutes, seconds)
}

function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function addHours(value: string, hours: number): string {
  const date = parseDateTime(value)
  date.setTime(date.getTime() + hours * 60 * 60 * 1000)
  return formatDateTime(date)
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
  const ruleHours = RULE_HOURS[input.slaKind]
  return {
    snapshotId: `SEWING-DELIVERY-SLA-${input.assignmentId}`,
    ...input,
    milestones: MILESTONE_RATIOS.map((ratio, index) => ({
      ratio,
      hoursAfterAcceptance: ruleHours[index],
      targetQty: Math.ceil(input.assignedQty * ratio),
      deadlineAt: addHours(input.acceptedAt, ruleHours[index]),
    })),
    active: true,
  }
}

export function projectSewingDeliverySla(
  snapshot: SewingDeliverySlaSnapshot,
  receipts: SewingDeliveryReceiptFact[],
  nowAt: string,
): SewingDeliverySlaProjection {
  const reachedMilestones = snapshot.milestones.map(() => ({
    firstReachedAt: undefined as string | undefined,
    receiverDelayRecordIds: [] as string[],
  }))
  const orderedReceipts = [...receipts].sort((left, right) =>
    left.receivedAt.localeCompare(right.receivedAt) || left.recordId.localeCompare(right.recordId)
  )

  let confirmedReceivedQty = 0
  let completedAt: string | undefined

  for (const receipt of orderedReceipts) {
    if (receipt.voided) continue

    const effectiveReceivedQty = Math.max(receipt.receivedQty - (receipt.reversedQty ?? 0), 0)
    const previousReceivedQty = confirmedReceivedQty
    confirmedReceivedQty += effectiveReceivedQty

    snapshot.milestones.forEach((milestone, index) => {
      const reached = reachedMilestones[index]
      if (reached.firstReachedAt || previousReceivedQty >= milestone.targetQty) return
      if (confirmedReceivedQty < milestone.targetQty) return

      reached.firstReachedAt = receipt.receivedAt
      if (receipt.submittedAt <= milestone.deadlineAt && receipt.receivedAt > milestone.deadlineAt) {
        reached.receiverDelayRecordIds.push(receipt.recordId)
      }
    })

    if (
      completedAt === undefined
      && previousReceivedQty < snapshot.assignedQty
      && confirmedReceivedQty >= snapshot.assignedQty
    ) {
      completedAt = receipt.receivedAt
    }
  }

  const milestones = snapshot.milestones.map((milestone, index): SewingDeliveryMilestoneProjection => {
    const reached = reachedMilestones[index]
    let result: SewingDeliveryMilestoneResult
    if (reached.firstReachedAt) {
      result = reached.firstReachedAt <= milestone.deadlineAt ? 'ON_TIME' : 'OVERDUE_REACHED'
    } else {
      result = nowAt < milestone.deadlineAt ? 'UPCOMING' : 'OVERDUE_PENDING'
    }

    return {
      ...milestone,
      result,
      ...(reached.firstReachedAt ? { firstReachedAt: reached.firstReachedAt } : {}),
      receiverDelayRecordIds: reached.receiverDelayRecordIds,
    }
  })

  return {
    snapshot,
    confirmedReceivedQty,
    progressRatio: confirmedReceivedQty / snapshot.assignedQty,
    remainingQty: Math.max(snapshot.assignedQty - confirmedReceivedQty, 0),
    completed: confirmedReceivedQty >= snapshot.assignedQty,
    ...(completedAt ? { completedAt } : {}),
    milestones,
  }
}
