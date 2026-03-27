import type { ProcessTask } from '../process-tasks.ts'
import {
  isRuntimeTaskExecutionTask,
  listRuntimeExecutionTasks,
  listRuntimeProcessTasks,
  listRuntimeTasksByBaseTaskId,
  type RuntimeProcessTask,
} from '../runtime-process-tasks.ts'
import {
  getTaskTypeDisplayName,
  listExecutionTaskFacts,
} from './task-execution-adapter.ts'

export type TaskChainTenderStatus = 'OPEN' | 'OVERDUE' | 'AWARDED' | 'CLOSED' | 'CANCELLED'

export interface TaskChainTender {
  tenderId: string
  taskIds: string[]
  productionOrderIds: string[]
  deadline: string
  status: TaskChainTenderStatus
}

function parseDateLike(value: string | undefined): number {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

function resolveTenderStatus(tasks: RuntimeProcessTask[], deadline: string): TaskChainTenderStatus {
  const hasAwarded = tasks.some((task) => task.assignmentStatus === 'AWARDED')
  const hasBidding = tasks.some(
    (task) =>
      task.assignmentMode === 'BIDDING'
      && (task.assignmentStatus === 'BIDDING' || task.assignmentStatus === 'ASSIGNING'),
  )
  const deadlineMs = parseDateLike(deadline)
  const now = Date.now()

  if (hasBidding && Number.isFinite(deadlineMs) && deadlineMs < now) {
    return 'OVERDUE'
  }
  if (hasBidding) return 'OPEN'
  if (hasAwarded) return 'AWARDED'
  return 'CLOSED'
}

function compareTask(a: ProcessTask, b: ProcessTask): number {
  if (a.productionOrderId !== b.productionOrderId) {
    return a.productionOrderId.localeCompare(b.productionOrderId)
  }
  if (a.seq !== b.seq) return a.seq - b.seq
  return a.taskId.localeCompare(b.taskId)
}

export function listTaskChainTasks(): ProcessTask[] {
  return listExecutionTaskFacts()
    .filter((task) => task.defaultDocType !== 'DEMAND')
    .sort(compareTask)
}

export function getTaskChainTaskById(taskId: string): ProcessTask | undefined {
  return listTaskChainTasks().find((task) => task.taskId === taskId)
}

export function listTaskChainRuntimeTasksByBaseTaskId(baseTaskId: string): RuntimeProcessTask[] {
  const byBase = listRuntimeTasksByBaseTaskId(baseTaskId).filter((task) =>
    isRuntimeTaskExecutionTask(task),
  )
  if (byBase.length > 0) return byBase
  return listRuntimeProcessTasks().filter(
    (task) => task.taskId === baseTaskId && isRuntimeTaskExecutionTask(task),
  )
}

export function resolveTaskChainTenderId(task: ProcessTask): string | undefined {
  const runtimeTasks = listTaskChainRuntimeTasksByBaseTaskId(task.taskId)
  return runtimeTasks.find((item) => Boolean(item.tenderId))?.tenderId ?? task.tenderId
}

export function listTaskChainTenders(): TaskChainTender[] {
  const runtimeTasks = listRuntimeExecutionTasks().filter(
    (task) => Boolean(task.tenderId) && task.defaultDocType !== 'DEMAND',
  )
  const grouped = new Map<string, RuntimeProcessTask[]>()

  for (const task of runtimeTasks) {
    const tenderId = task.tenderId
    if (!tenderId) continue
    const current = grouped.get(tenderId) ?? []
    current.push(task)
    grouped.set(tenderId, current)
  }

  return Array.from(grouped.entries())
    .map(([tenderId, tasks]) => {
      const taskIds = Array.from(new Set(tasks.map((task) => task.baseTaskId || task.taskId)))
      const productionOrderIds = Array.from(new Set(tasks.map((task) => task.productionOrderId)))
      const deadlines = tasks
        .map((task) => task.biddingDeadline || task.taskDeadline || '')
        .filter((value) => Boolean(value))
        .sort((left, right) => parseDateLike(left) - parseDateLike(right))
      const deadline = deadlines[0] ?? ''

      return {
        tenderId,
        taskIds,
        productionOrderIds,
        deadline,
        status: resolveTenderStatus(tasks, deadline),
      } satisfies TaskChainTender
    })
    .sort((left, right) => left.tenderId.localeCompare(right.tenderId))
}

export function getTaskChainTenderById(tenderId: string): TaskChainTender | undefined {
  return listTaskChainTenders().find((item) => item.tenderId === tenderId)
}

export function getTaskChainTaskDisplayName(task: ProcessTask): string {
  return getTaskTypeDisplayName(task)
}
