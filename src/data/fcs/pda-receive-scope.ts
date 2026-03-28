import { PDA_MOCK_QUOTED_TENDERS } from './pda-mobile-mock.ts'
import { type ProcessTask } from './process-tasks.ts'

export const PDA_RECEIVE_EXCLUDED_PROCESS_NAMES = ['印花', '染色'] as const

const EXCLUDED_PROCESS_CODE_KEYWORDS = ['PRINT', 'DYE']

export interface ReceiveScopedTenderLike {
  tenderId: string
  processName?: string
  taskId?: string
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

export function isReceiveEligibleTask(task: ProcessTask | null | undefined): boolean {
  if (!task) return false
  return isReceiveEligibleProcessName(task.processNameZh, task.processCode)
}

export function isReceiveEligibleTender(
  tender: ReceiveScopedTenderLike,
  task: ProcessTask | null,
): boolean {
  if (task) return isReceiveEligibleTask(task)
  return isReceiveEligibleProcessName(tender.processName)
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
      isReceiveEligibleTask(task),
  )
}

export function filterReceiveActiveBiddingTenders<T extends ReceiveScopedTenderLike>(
  tenders: T[],
  submittedTenderIds: ReadonlySet<string>,
  resolveTask: ReceiveTaskResolver,
): T[] {
  return tenders.filter(
    (tender) =>
      !submittedTenderIds.has(tender.tenderId) &&
      isReceiveEligibleTender(tender, tender.taskId ? resolveTask(tender.taskId) : null),
  )
}

export function filterReceiveQuotedTenders<T extends ReceiveScopedTenderLike>(
  tenders: T[],
  submittedTenderIds: ReadonlySet<string>,
  resolveTask: ReceiveTaskResolver,
): T[] {
  return tenders.filter(
    (tender) =>
      submittedTenderIds.has(tender.tenderId) &&
      isReceiveEligibleTender(tender, tender.taskId ? resolveTask(tender.taskId) : null),
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
      task.assignedFactoryId === selectedFactoryId &&
      isReceiveEligibleTask(task),
  )
}
