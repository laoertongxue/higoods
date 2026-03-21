import { processTasks, type ProcessTask } from './process-tasks'
import {
  generateCaseId,
  listProgressExceptions,
  upsertProgressExceptionCase,
  type ExceptionCase,
} from './store-domain-progress'
import {
  getRuntimeTaskById,
  isRuntimeTaskExecutionTask,
  listRuntimeTasksByBaseTaskId,
  type RuntimeProcessTask,
} from './runtime-process-tasks'
import {
  getPdaPickupHeads,
  getPdaPickupRecordsByHead,
} from './pda-handover-events'
import {
  listWarehouseInternalTransferOrdersByRuntimeTaskId,
  listWarehouseIssueOrdersByRuntimeTaskId,
  listWarehouseReturnOrdersByRuntimeTaskId,
} from './warehouse-material-execution'
import {
  getDefaultSubCategoryKeyFromReason,
  getUnifiedCategoryFromReason,
} from './progress-exception-taxonomy'
import {
  markCaseResolved,
  maybeAutoCloseResolvedCase,
} from './progress-exception-lifecycle'

export type StartDueSource = 'ACCEPTED' | 'AWARDED'
export type StartRiskStatus = 'NORMAL' | 'DUE_SOON' | 'OVERDUE'

const START_DUE_HOURS = 48
const SOON_THRESHOLD_MS = 24 * 60 * 60 * 1000

interface StartPrerequisiteInfo {
  met: boolean
  type: 'PICKUP'
  conditionLabel: string
  summaryLabel: string
  statusLabel: string
  blocker: string
  hint: string
}

type RuntimeStartReadiness =
  | 'READY'
  | 'WAIT_PICKUP'
  | 'WAIT_PREV_DONE'
  | 'WAIT_INTERNAL_TRANSFER'
  | 'NO_RUNTIME_TASK'

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
  const runtimeTasks = listRuntimeTasksByBaseTaskId(task.taskId).filter((runtimeTask) =>
    isRuntimeTaskExecutionTask(runtimeTask),
  )
  if (!runtimeTasks.length) {
    return {
      met: false,
      type: 'PICKUP',
      conditionLabel: '已有领料记录',
      summaryLabel: '暂无执行任务',
      statusLabel: '暂无执行任务，暂不可开工',
      blocker: '暂无执行任务，暂不可开工',
      hint: '请先完成任务分配后再判断开工前置',
    }
  }

  const readinessList = runtimeTasks.map((runtimeTask) => evaluateRuntimeStartReadiness(runtimeTask))
  const blocked = readinessList.find((item) => item.code !== 'READY')
  const met = !blocked
  const hasWarehouseWorkshop = runtimeTasks.some((runtimeTask) => runtimeTask.executorKind === 'WAREHOUSE_WORKSHOP')
  const hasSameFactoryContinue = runtimeTasks.some(
    (runtimeTask) => runtimeTask.transitionFromPrev === 'SAME_FACTORY_CONTINUE',
  )
  const conditionLabel = hasWarehouseWorkshop
    ? '仓内流转已到位'
    : hasSameFactoryContinue
      ? '上一工序连续流转已完成'
      : '已有领料记录'

  const statusLabel = met
    ? '已满足开工前置，可开工'
    : blocked?.code === 'WAIT_PREV_DONE'
      ? '上一工序未完成连续流转，暂不可开工'
      : blocked?.code === 'WAIT_INTERNAL_TRANSFER'
        ? '仓内流转尚未就绪，暂不可开工'
        : '尚无领料记录，暂不可开工'

  const blocker = met
    ? '已满足开工前置'
    : blocked?.code === 'WAIT_PREV_DONE'
      ? '上一工序未完成连续流转，暂不可开工'
      : blocked?.code === 'WAIT_INTERNAL_TRANSFER'
        ? '仓内流转尚未就绪，暂不可开工'
        : '尚无领料记录，暂不可开工'

  const hint = met
    ? '已满足开工前置，工厂可开始本工序'
    : blocked?.code === 'WAIT_PREV_DONE'
      ? '同厂连续工序无需重复领料，待上一工序完成后可直接开工'
      : blocked?.code === 'WAIT_INTERNAL_TRANSFER'
        ? '当前工序由仓内后道执行，需等待仓内流转到位后开工'
        : '外部工厂需先完成仓库发料领料后才能开工'

  const summaryLabel = met ? '前置已满足' : blocked?.label ?? '前置未满足'

  return {
    met,
    type: 'PICKUP',
    conditionLabel,
    summaryLabel,
    statusLabel,
    blocker,
    hint,
  }
}

function evaluateRuntimeStartReadiness(task: RuntimeProcessTask): { code: RuntimeStartReadiness; label: string } {
  if (task.executorKind === 'WAREHOUSE_WORKSHOP') {
    const transferDocs = listWarehouseInternalTransferOrdersByRuntimeTaskId(task.taskId)
    const hasReadyTransfer = transferDocs.some((doc) =>
      doc.status === 'RECEIVED' ||
      doc.status === 'CLOSED' ||
      doc.status === 'IN_TRANSIT' ||
      doc.lines.some((line) => line.transferredQty > 0),
    )
    return hasReadyTransfer
      ? { code: 'READY', label: '仓内流转已到位' }
      : { code: 'WAIT_INTERNAL_TRANSFER', label: '待仓内流转' }
  }

  if (task.transitionFromPrev === 'SAME_FACTORY_CONTINUE') {
    const upstreamDone = task.dependsOnTaskIds.every((upstreamTaskId) => {
      const upstreamTask = getRuntimeTaskById(upstreamTaskId)
      if (!upstreamTask) return false
      if (upstreamTask.status === 'DONE') return true
      return listWarehouseReturnOrdersByRuntimeTaskId(upstreamTask.taskId).some(
        (doc) => doc.status === 'RETURNED' || doc.status === 'CLOSED',
      )
    })
    return upstreamDone
      ? { code: 'READY', label: '同厂连续流转已就绪' }
      : { code: 'WAIT_PREV_DONE', label: '待上一工序完成' }
  }

  const issueDocs = listWarehouseIssueOrdersByRuntimeTaskId(task.taskId)
  if (!issueDocs.length) {
    return { code: 'NO_RUNTIME_TASK', label: '待仓库发料单生成' }
  }

  const pickupHeads = getPdaPickupHeads().filter((head) => head.runtimeTaskId === task.taskId)
  const hasReadyPickup = pickupHeads.some((head) => {
    if (head.summaryStatus === 'WRITTEN_BACK' || head.completionStatus === 'COMPLETED') return true
    const records = getPdaPickupRecordsByHead(head.handoverId)
    return records.some((record) => record.status === 'RECEIVED')
  })

  return hasReadyPickup ? { code: 'READY', label: '领料记录已满足' } : { code: 'WAIT_PICKUP', label: '待领料' }
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
  return (
    exceptionCase.reasonCode === 'START_OVERDUE' &&
    (exceptionCase.caseStatus === 'OPEN' || exceptionCase.caseStatus === 'IN_PROGRESS')
  )
}

function findTaskOpenStartOverdueException(taskId: string): ExceptionCase | undefined {
  return listProgressExceptions().find(
    (item) => isOpenStartOverdueException(item) && item.relatedTaskIds.includes(taskId),
  )
}

function createStartOverdueException(task: ProcessTask, startDueAt: string, now: string): ExceptionCase {
  const reasonCode = 'START_OVERDUE'
  const exceptionCase: ExceptionCase = {
    caseId: generateCaseId(),
    caseStatus: 'OPEN',
    severity: 'S2',
    category: 'EXECUTION',
    unifiedCategory: getUnifiedCategoryFromReason(reasonCode, 'EXECUTION'),
    subCategoryKey: getDefaultSubCategoryKeyFromReason(reasonCode) || 'EXEC_START_OVERDUE',
    reasonCode,
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
    tags: ['执行异常', '开工逾期', 'PDA执行'],
    actions: [],
    auditLogs: [
      {
        id: `EAL-START-${task.taskId.replace(/[^A-Za-z0-9]/g, '').slice(-24)}-CREATE`,
        action: 'CREATE',
        detail: '系统自动生成：开工逾期',
        at: now,
        by: '系统',
      },
    ],
  }

  upsertProgressExceptionCase(exceptionCase)
  return exceptionCase
}

function replaceException(updated: ExceptionCase): void {
  upsertProgressExceptionCase(updated)
}

function resolveStartOverdueException(exceptionCase: ExceptionCase, now: string): void {
  const resolved = markCaseResolved(exceptionCase, {
    by: '系统',
    source: 'SYSTEM',
    ruleCode: 'EXEC_START_CONFIRMED',
    detail: '工厂已确认开工，系统自动判定为已解决',
    at: now,
    actionType: 'AUTO_RESOLVE',
    auditAction: 'AUTO_RESOLVE',
  })
  replaceException(maybeAutoCloseResolvedCase(resolved, '系统'))
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
      resolveStartOverdueException(existedOpen, nowAt)
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
