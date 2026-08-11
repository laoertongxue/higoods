import { PDA_MOCK_QUOTED_TENDERS } from './pda-mobile-mock.ts'
import { canFactoryAccessSpecialCraftPdaTask } from './special-craft-pda-scope.ts'
import { type ProcessTask } from './process-tasks.ts'

export const PDA_RECEIVE_EXCLUDED_PROCESS_NAMES = ['印花'] as const

const EXCLUDED_PROCESS_CODE_KEYWORDS = ['PRINT']

export interface ReceiveScopedTenderLike {
  tenderId: string
  processName?: string
  processCode?: string
  taskId?: string
  runtimeShared?: boolean
}

type ReceiveTaskResolver = (taskId: string) => ProcessTask | null

function normalizeValue(value: string | null | undefined): string {
  return (value ?? '').trim()
}

function hasExcludedProcessName(value: string | null | undefined): boolean {
  const normalized = normalizeValue(value)
  return PDA_RECEIVE_EXCLUDED_PROCESS_NAMES.some((name) => normalized === name || normalized.includes(name))
}

function hasExcludedProcessCode(value: string | null | undefined): boolean {
  const normalized = normalizeValue(value).toUpperCase()
  return EXCLUDED_PROCESS_CODE_KEYWORDS.some((keyword) => normalized.includes(keyword))
}

export function isReceiveEligibleProcessName(processName?: string, processCode?: string): boolean {
  return !hasExcludedProcessName(processName) && !hasExcludedProcessCode(processCode)
}

export function isReceiveEligibleTask(task: ProcessTask | null | undefined, selectedFactoryId?: string): boolean {
  if (!task) return false
  const canAccess = !selectedFactoryId || canFactoryAccessSpecialCraftPdaTask(selectedFactoryId, task)
  if (!canAccess) return false
  // 生产准备加工单不进入通用任务体系，但已分配加工单仍必须在 PDA 完成接单、执行和交出。
  if (task.defaultDocType === 'PREPARATION_ORDER') return true
  return isReceiveEligibleProcessName(task.processNameZh, task.processCode)
}

export function isReceiveEligibleTender(
  tender: ReceiveScopedTenderLike,
  task: ProcessTask | null,
  selectedFactoryId?: string,
): boolean {
  if (task?.defaultDocType === 'PREPARATION_ORDER') return false
  if (task) return isReceiveEligibleTask(task, selectedFactoryId)
  return isReceiveEligibleProcessName(tender.processName, tender.processCode)
    && (!selectedFactoryId || canFactoryAccessSpecialCraftPdaTask(selectedFactoryId, tender))
}

export function createInitialPdaReceiveSubmittedTenderIds(): Set<string> {
  return new Set(PDA_MOCK_QUOTED_TENDERS.map((item) => item.tenderId))
}

export function filterReceivePendingAcceptTasks(
  tasks: ProcessTask[],
  selectedFactoryId: string,
): ProcessTask[] {
  return tasks.filter(
    (task) =>
      task.assignedFactoryId === selectedFactoryId &&
      task.assignmentMode === 'DIRECT' &&
      (!task.acceptanceStatus || task.acceptanceStatus === 'PENDING') &&
      isReceiveEligibleTask(task, selectedFactoryId),
  )
}

export function filterReceiveActiveBiddingTenders<T extends ReceiveScopedTenderLike>(
  tenders: T[],
  submittedTenderIds: ReadonlySet<string>,
  resolveTask: ReceiveTaskResolver,
  selectedFactoryId?: string,
): T[] {
  return tenders.filter(
    (tender) =>
      !submittedTenderIds.has(tender.tenderId) &&
      isReceiveEligibleTender(tender, tender.taskId ? resolveTask(tender.taskId) : null, selectedFactoryId),
  )
}

export function filterReceiveQuotedTenders<T extends ReceiveScopedTenderLike>(
  tenders: T[],
  submittedTenderIds: ReadonlySet<string>,
  resolveTask: ReceiveTaskResolver,
  selectedFactoryId?: string,
): T[] {
  return tenders.filter(
    (tender) =>
      (submittedTenderIds.has(tender.tenderId) || tender.runtimeShared === true) &&
      isReceiveEligibleTender(tender, tender.taskId ? resolveTask(tender.taskId) : null, selectedFactoryId),
  )
}

export function filterReceiveAwardedTaskFacts(
  tasks: ProcessTask[],
  selectedFactoryId: string,
): ProcessTask[] {
  return tasks.filter(
    (task) =>
      task.assignmentMode === 'BIDDING' &&
      task.assignmentStatus === 'AWARDED' &&
      task.acceptanceStatus !== 'REJECTED' &&
      task.assignedFactoryId === selectedFactoryId &&
      isReceiveEligibleTask(task, selectedFactoryId),
  )
}
