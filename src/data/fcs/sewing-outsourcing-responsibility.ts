import {
  listCurrentEffectiveTaskAssignments,
  listEffectiveTaskAssignments,
  type EffectiveTaskAssignment,
} from './effective-task-assignments.ts'
import {
  getOnboardingPpicOptionById,
  isActivePpicTeamLeader,
} from './factory-onboarding-ppic.ts'
import { getRuntimeTaskById } from './runtime-process-tasks.ts'
import { transferSewingSampleApprovalSuggestionPpic } from './sewing-sample-approval-suggestion.ts'

export type SewingTaskResponsibilitySource = 'FACTORY_ASSIGNMENT' | 'LEADER_TRANSFER'
export type SewingTaskResponsibilityStatus = 'CURRENT' | 'SUPERSEDED'

export interface SewingTaskResponsibilityVersion {
  responsibilityVersionId: string
  runtimeTaskId: string
  assignmentId: string
  productionOrderId: string
  factoryId: string
  factoryName: string
  ppicId: string
  ppicName: string
  ppicPhone: string
  source: SewingTaskResponsibilitySource
  effectiveAt: string
  status: SewingTaskResponsibilityStatus
  previousVersionId?: string
  previousPpicId?: string
  previousPpicName?: string
  reason?: string
  remainingItems: string[]
  operatedByPpicId?: string
  operatedByPpicName?: string
  commandId?: string
}

export interface TransferSewingTaskResponsibilityInput {
  commandId: string
  runtimeTaskId: string
  targetPpicId: string
  reason: string
  remainingItems: string[]
  operatedAt: string
  operatedByPpicId: string
}

interface StoredTransfer extends SewingTaskResponsibilityVersion {
  inputFingerprint: string
}

const transfersByRuntimeTaskId = new Map<string, StoredTransfer[]>()
const transferByCommandId = new Map<string, StoredTransfer>()
let transferSequence = 0

function cloneVersion(version: SewingTaskResponsibilityVersion): SewingTaskResponsibilityVersion {
  return {
    ...version,
    remainingItems: [...version.remainingItems],
  }
}

function assignmentBaseVersion(
  assignment: EffectiveTaskAssignment,
  status: SewingTaskResponsibilityStatus,
): SewingTaskResponsibilityVersion | null {
  if (!assignment.ppicId || !assignment.ppicName || !assignment.ppicPhone || !assignment.ppicSnapshotAt) return null
  return {
    responsibilityVersionId: `RESP-${assignment.assignmentId}`,
    runtimeTaskId: assignment.runtimeTaskId,
    assignmentId: assignment.assignmentId,
    productionOrderId: assignment.productionOrderId,
    factoryId: assignment.factoryId,
    factoryName: assignment.factoryName,
    ppicId: assignment.ppicId,
    ppicName: assignment.ppicName,
    ppicPhone: assignment.ppicPhone,
    source: 'FACTORY_ASSIGNMENT',
    effectiveAt: assignment.ppicSnapshotAt,
    status,
    remainingItems: [],
  }
}

function getSingleCurrentSewingAssignment(runtimeTaskId: string): EffectiveTaskAssignment | null {
  const assignments = listCurrentEffectiveTaskAssignments(runtimeTaskId).filter((item) => item.ppicId)
  if (assignments.length > 1) throw new Error(`任务${runtimeTaskId}存在多条有效含车缝分配，无法确定唯一任务PPIC`)
  return assignments[0] ?? null
}

function normalizedTransferInput(input: TransferSewingTaskResponsibilityInput): TransferSewingTaskResponsibilityInput {
  return {
    ...input,
    commandId: input.commandId.trim(),
    runtimeTaskId: input.runtimeTaskId.trim(),
    targetPpicId: input.targetPpicId.trim(),
    reason: input.reason.trim(),
    operatedAt: input.operatedAt.trim(),
    operatedByPpicId: input.operatedByPpicId.trim(),
    remainingItems: input.remainingItems.map((item) => item.trim()).filter(Boolean),
  }
}

function transferFingerprint(input: TransferSewingTaskResponsibilityInput): string {
  return JSON.stringify(input)
}

export function getCurrentSewingTaskResponsibility(runtimeTaskId: string): SewingTaskResponsibilityVersion | null {
  const assignment = getSingleCurrentSewingAssignment(runtimeTaskId)
  if (!assignment) return null
  const transfers = (transfersByRuntimeTaskId.get(runtimeTaskId) ?? [])
    .filter((item) => item.assignmentId === assignment.assignmentId)
  const latestTransfer = transfers.at(-1)
  if (latestTransfer) return cloneVersion({ ...latestTransfer, status: 'CURRENT' })
  const base = assignmentBaseVersion(assignment, 'CURRENT')
  return base ? cloneVersion(base) : null
}

export function listSewingTaskResponsibilityVersions(runtimeTaskId: string): SewingTaskResponsibilityVersion[] {
  const assignments = listEffectiveTaskAssignments(runtimeTaskId).filter((item) => item.ppicId)
  const currentAssignmentIds = new Set(listCurrentEffectiveTaskAssignments(runtimeTaskId).map((item) => item.assignmentId))
  const transfers = transfersByRuntimeTaskId.get(runtimeTaskId) ?? []
  return assignments.flatMap((assignment) => {
    const assignmentTransfers = transfers.filter((item) => item.assignmentId === assignment.assignmentId)
    const assignmentIsCurrent = currentAssignmentIds.has(assignment.assignmentId)
    const base = assignmentBaseVersion(
      assignment,
      assignmentIsCurrent && assignmentTransfers.length === 0 ? 'CURRENT' : 'SUPERSEDED',
    )
    if (!base) return []
    return [
      base,
      ...assignmentTransfers.map((item, index) => cloneVersion({
        ...item,
        status: assignmentIsCurrent && index === assignmentTransfers.length - 1 ? 'CURRENT' : 'SUPERSEDED',
      })),
    ]
  }).map(cloneVersion)
}

export function transferSewingTaskResponsibility(
  rawInput: TransferSewingTaskResponsibilityInput,
): SewingTaskResponsibilityVersion {
  const input = normalizedTransferInput(rawInput)
  if (!input.commandId) throw new Error('责任移交命令ID不能为空')
  const fingerprint = transferFingerprint(input)
  const existing = transferByCommandId.get(input.commandId)
  if (existing) {
    if (existing.inputFingerprint !== fingerprint) throw new Error('责任移交命令ID已被其他内容使用')
    return cloneVersion(existing)
  }
  if (!isActivePpicTeamLeader(input.operatedByPpicId)) {
    throw new Error('仅PPIC团队负责人可发起责任移交')
  }
  const operator = getOnboardingPpicOptionById(input.operatedByPpicId)!
  const targetPpic = getOnboardingPpicOptionById(input.targetPpicId)
  if (!targetPpic || targetPpic.status !== '启用') throw new Error('目标PPIC不存在或已停用')
  if (!input.reason) throw new Error('责任移交原因不能为空')
  if (input.remainingItems.length === 0) throw new Error('责任移交必须列明剩余事项')

  const runtimeTask = getRuntimeTaskById(input.runtimeTaskId)
  if (
    !runtimeTask
    || runtimeTask.status === 'DONE'
    || runtimeTask.status === 'CANCELLED'
    || runtimeTask.executionEnabled === false
  ) {
    throw new Error('任务不存在或已完结，不能走未完任务责任移交')
  }
  const current = getCurrentSewingTaskResponsibility(input.runtimeTaskId)
  if (!current) throw new Error('任务没有生效中的PPIC责任版本')
  if (current.ppicId === targetPpic.ppicId) throw new Error('目标PPIC不能与当前任务PPIC相同')

  transferSequence += 1
  const record: StoredTransfer = {
    responsibilityVersionId: `RESP-TRANSFER-${String(transferSequence).padStart(6, '0')}`,
    runtimeTaskId: current.runtimeTaskId,
    assignmentId: current.assignmentId,
    productionOrderId: current.productionOrderId,
    factoryId: current.factoryId,
    factoryName: current.factoryName,
    ppicId: targetPpic.ppicId,
    ppicName: targetPpic.ppicName,
    ppicPhone: targetPpic.mobilePhone,
    source: 'LEADER_TRANSFER',
    effectiveAt: input.operatedAt,
    status: 'CURRENT',
    previousVersionId: current.responsibilityVersionId,
    previousPpicId: current.ppicId,
    previousPpicName: current.ppicName,
    reason: input.reason,
    remainingItems: [...input.remainingItems],
    operatedByPpicId: operator.ppicId,
    operatedByPpicName: operator.ppicName,
    commandId: input.commandId,
    inputFingerprint: fingerprint,
  }
  transfersByRuntimeTaskId.set(input.runtimeTaskId, [
    ...(transfersByRuntimeTaskId.get(input.runtimeTaskId) ?? []),
    record,
  ])
  transferByCommandId.set(input.commandId, record)
  transferSewingSampleApprovalSuggestionPpic({
    runtimeTaskId: record.runtimeTaskId,
    targetPpicId: record.ppicId,
    targetPpicName: record.ppicName,
  })
  return cloneVersion(record)
}

export function resetSewingTaskResponsibilityTransfersForTests(): void {
  transfersByRuntimeTaskId.clear()
  transferByCommandId.clear()
  transferSequence = 0
}
