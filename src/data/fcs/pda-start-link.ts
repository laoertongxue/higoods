import { processTasks, type ProcessTask } from './process-tasks'
import { calculateSlaDue, generateCaseId, initialExceptions, type ExceptionCase } from './store-domain-progress'

export type StartDueSource = 'ACCEPTED' | 'AWARDED'
export type StartRiskStatus = 'NORMAL' | 'DUE_SOON' | 'OVERDUE'

const START_DUE_HOURS = 48
const SOON_THRESHOLD_MS = 24 * 60 * 60 * 1000

interface StartPrerequisiteInfo {
  met: boolean
  type: 'PICKUP' | 'RECEIVE'
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseDateMs(value: string): number {
  return new Date(value.replace(' ', 'T')).getTime()
}

function addHours(baseAt: string, hours: number): string {
  const date = new Date(baseAt.replace(' ', 'T'))
  date.setHours(date.getHours() + hours)
  return nowTimestamp(date)
}

export function getStartPrerequisite(task: ProcessTask): StartPrerequisiteInfo {
  const handoverStatus = (task as ProcessTask & { handoverStatus?: string }).handoverStatus

  if (task.seq === 1) {
    return { met: handoverStatus === 'PICKED_UP', type: 'PICKUP' }
  }

  return { met: handoverStatus === 'RECEIVED', type: 'RECEIVE' }
}

export function getStartDueBase(task: ProcessTask): { baseAt?: string; source?: StartDueSource } {
  if (task.assignmentMode === 'BIDDING') {
    const awardedAt = (task as ProcessTask & { awardedAt?: string }).awardedAt
    if (awardedAt) {
      return { baseAt: awardedAt, source: 'AWARDED' }
    }
  }

  if (task.acceptedAt) {
    return { baseAt: task.acceptedAt, source: 'ACCEPTED' }
  }

  return {}
}

export function getTaskStartDueInfo(task: ProcessTask, nowMs: number = Date.now()): {
  startDueAt?: string
  startDueSource?: StartDueSource
  startRiskStatus: StartRiskStatus
  remainingMs?: number
  prerequisiteMet: boolean
} {
  const prerequisite = getStartPrerequisite(task)
  const { baseAt, source } = getStartDueBase(task)

  if (!baseAt || !source) {
    return {
      startRiskStatus: 'NORMAL',
      prerequisiteMet: prerequisite.met,
    }
  }

  const startDueAt = addHours(baseAt, START_DUE_HOURS)
  const dueMs = parseDateMs(startDueAt)
  const remainingMs = dueMs - nowMs

  let startRiskStatus: StartRiskStatus = 'NORMAL'
  const isNotStarted = task.status === 'NOT_STARTED' && !task.startedAt

  if (isNotStarted && prerequisite.met) {
    if (remainingMs < 0) {
      startRiskStatus = 'OVERDUE'
    } else if (remainingMs < SOON_THRESHOLD_MS) {
      startRiskStatus = 'DUE_SOON'
    }
  }

  return {
    startDueAt,
    startDueSource: source,
    startRiskStatus,
    remainingMs,
    prerequisiteMet: prerequisite.met,
  }
}

function isOpenStartOverdueException(exceptionCase: ExceptionCase): boolean {
  return exceptionCase.reasonCode === 'START_OVERDUE' && exceptionCase.caseStatus !== 'CLOSED'
}

function findTaskOpenStartOverdueException(taskId: string): ExceptionCase | undefined {
  return initialExceptions.find(
    (item) => isOpenStartOverdueException(item) && item.relatedTaskIds.includes(taskId),
  )
}

function createStartOverdueException(task: ProcessTask, startDueAt: string, now: string): ExceptionCase {
  const exceptionCase: ExceptionCase = {
    caseId: generateCaseId(),
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'EXECUTION',
    reasonCode: 'START_OVERDUE',
    sourceType: 'TASK',
    sourceId: task.taskId,
    relatedOrderIds: [task.productionOrderId],
    relatedTaskIds: [task.taskId],
    relatedTenderIds: task.tenderId ? [task.tenderId] : [],
    ownerUserId: undefined,
    ownerUserName: undefined,
    summary: '开工已逾期',
    detail: `任务 ${task.taskId} 在 ${startDueAt} 前未确认开工，系统自动生成执行异常。`,
    createdAt: now,
    updatedAt: now,
    slaDueAt: calculateSlaDue('S2', now),
    tags: ['执行异常', '开工逾期', 'PDA执行'],
    actions: [],
    auditLogs: [
      {
        id: `EAL-${Date.now()}`,
        action: 'CREATE',
        detail: '系统自动生成：开工逾期',
        at: now,
        by: '系统',
      },
    ],
  }

  initialExceptions.push(exceptionCase)
  return exceptionCase
}

function closeStartOverdueException(exceptionCase: ExceptionCase, now: string): void {
  exceptionCase.caseStatus = 'CLOSED'
  exceptionCase.updatedAt = now
  exceptionCase.closedAt = now
  exceptionCase.closeRemark = '工厂已确认开工，系统自动关闭'
  exceptionCase.resolvedAt = now
  exceptionCase.resolvedBy = '系统'
  exceptionCase.auditLogs = [
    ...exceptionCase.auditLogs,
    {
      id: `EAL-${Date.now()}`,
      action: 'AUTO_CLOSE',
      detail: '工厂已确认开工，系统自动关闭',
      at: now,
      by: '系统',
    },
  ]
}

export function syncPdaStartRiskAndExceptions(now: Date = new Date()): void {
  const nowMs = now.getTime()
  const nowAt = nowTimestamp(now)

  processTasks.forEach((task) => {
    if (!task.taskId.startsWith('PDA-EXEC-')) return

    const dueInfo = getTaskStartDueInfo(task, nowMs)
    const writableTask = task as ProcessTask & {
      awardedAt?: string
      startDueAt?: string
      startDueSource?: StartDueSource
      startRiskStatus?: StartRiskStatus
      startOverdueExceptionId?: string | null
    }

    writableTask.startDueAt = dueInfo.startDueAt
    writableTask.startDueSource = dueInfo.startDueSource
    writableTask.startRiskStatus = dueInfo.startRiskStatus

    const started = task.status !== 'NOT_STARTED' || Boolean(task.startedAt)
    const existedOpen = findTaskOpenStartOverdueException(task.taskId)

    if (!started && dueInfo.startRiskStatus === 'OVERDUE' && dueInfo.startDueAt) {
      if (existedOpen) {
        writableTask.startOverdueExceptionId = existedOpen.caseId
      } else {
        const created = createStartOverdueException(task, dueInfo.startDueAt, nowAt)
        writableTask.startOverdueExceptionId = created.caseId
      }
      return
    }

    if (started && existedOpen) {
      closeStartOverdueException(existedOpen, nowAt)
    }

    if (started || dueInfo.startRiskStatus !== 'OVERDUE') {
      writableTask.startOverdueExceptionId = null
    }
  })
}

export function formatRemainingHours(remainingMs: number): string {
  const hours = Math.ceil(remainingMs / (60 * 60 * 1000))
  return String(Math.max(hours, 0))
}

export function formatStartDueSourceText(source?: StartDueSource): string {
  if (source === 'AWARDED') {
    return '中标后 48 小时内开工'
  }
  if (source === 'ACCEPTED') {
    return '接单后 48 小时内开工'
  }
  return '待接单/中标后开始计算'
}
